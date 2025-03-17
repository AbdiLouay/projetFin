const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'votre-cle-secrete';

// Activer CORS avec la configuration correcte
app.use(cors({
    origin: 'http://192.168.65.227:3001',  // Autoriser l'origine du front-end
    credentials: true,  // Permettre l'envoi de cookies et de headers d'authentification
}));

// Autres middlewares
app.use(bodyParser.json());
app.use(cookieParser());

// Middleware pour logger toutes les requêtes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Corps de la requête:', req.body);
    next();
});

// Configuration de la base de données
const db = mysql.createConnection({
    host: '192.168.65.227',
    user: 'chef',
    password: 'root',
    database: 'vmc1',
});

// Connexion à la base
db.connect(err => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
        process.exit(1);
    }
    console.log('Connecté à la base de données MySQL.');
});

// Route pour enregistrer un utilisateur et token
app.post('/api/register', [
    body('login')
        .isString()
        .isLength({ min: 3 }).withMessage('Le login doit contenir au moins 3 caractères.')
        .trim()
        .escape(),
    body('password')
        .isString()
        .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères.'),
    body('role').optional().isString()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Données invalides', errors: errors.array() });
    }

    const { login, password, role } = req.body;
    console.log(`Demande d'inscription reçue pour: ${login}`);

    // Vérifier si l'utilisateur existe déjà
    db.query('SELECT * FROM Utilisateur WHERE nom = ?', [login], async (err, results) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'utilisateur :', err);
            return res.status(500).json({ message: 'Erreur interne du serveur' });
        }
        if (results.length > 0) {
            console.log(`Utilisateur déjà existant: ${login}`);
            return res.status(409).json({ message: 'Cet utilisateur existe déjà.' });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Mot de passe hashé avec succès');

        // Générer un token
        const token = jwt.sign({ login, role: role || 'user' }, SECRET_KEY, { expiresIn: '1h' });

        // Enregistrer l'utilisateur en base avec le token
        db.query('INSERT INTO Utilisateur (nom, mot_de_passe, role, token) VALUES (?, ?, ?, ?)',
            [login, hashedPassword, role || 'user', token],
            (err, result) => {
                if (err) {
                    console.error('Erreur lors de l\'insertion de l\'utilisateur :', err);
                    return res.status(500).json({ message: 'Erreur interne du serveur' });
                }
                console.log(`Utilisateur créé avec succès: ${login} (ID: ${result.insertId})`);
                return res.status(201).json({ message: 'Utilisateur créé avec succès.', token });
            }
        );
    });
});

// Route de connexion avec logs améliorés
app.post('/api/login', [
    body('login')
        .isString()
        .isLength({ min: 3 }).withMessage('Le login doit contenir au moins 3 caractères.')
        .trim()
        .escape(),
    body('password')
        .isString()
        .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères.')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn(`[${new Date().toISOString()}] ❌ Données invalides reçues`, errors.array());
        return res.status(400).json({ message: 'Données invalides', errors: errors.array() });
    }

    const { login, password } = req.body;
    console.log(`[${new Date().toISOString()}] 🔹 Demande de connexion reçue pour: ${login}`);

    db.query('SELECT * FROM Utilisateur WHERE nom = ?', [login], (err, results) => {
        if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Erreur lors de la recherche de l'utilisateur:`, err);
            return res.status(500).json({ message: 'Erreur interne du serveur' });
        }
        if (results.length === 0) {
            console.warn(`[${new Date().toISOString()}] ⚠️ Utilisateur non trouvé: ${login}`);
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        const user = results[0];
        console.log(`[${new Date().toISOString()}] ✅ Utilisateur trouvé: ${user.nom}`);

        // Vérifier le mot de passe
        bcrypt.compare(password, user.mot_de_passe, (err, isMatch) => {
            if (err) {
                console.error(`[${new Date().toISOString()}] ❌ Erreur lors de la comparaison des mots de passe:`, err);
                return res.status(500).json({ message: 'Erreur interne du serveur' });
            }
            if (!isMatch) {
                console.warn(`[${new Date().toISOString()}] ⚠️ Mot de passe incorrect pour: ${login}`);
                return res.status(401).json({ message: 'Identifiants invalides' });
            }

            // Générer un nouveau token
            const nouveauToken = jwt.sign(
                { id_utilisateur: user.id_utilisateur, nom: user.nom, role: user.role },
                SECRET_KEY,
                { expiresIn: '1h' }
            );
            console.log(`[${new Date().toISOString()}] ✅ Connexion réussie, token généré pour ${login}: ${nouveauToken}`);

            // Mettre à jour le token en base de données
            db.query('UPDATE Utilisateur SET token = ? WHERE id_utilisateur = ?', [nouveauToken, user.id_utilisateur], (err) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] ❌ Erreur lors de la mise à jour du token en base:`, err);
                    return res.status(500).json({ message: 'Erreur interne du serveur' });
                }

                console.log(`[${new Date().toISOString()}] ✅ Nouveau token enregistré en base pour ${login}`);

                res.cookie('token', 'valeur-du-token', {
                    secure: false,    // Désactive secure si tu es en HTTP
                    maxAge: 3600000,  // Durée de vie du cookie (1 heure)
                    sameSite: 'Lax',  // Politique SameSite (peut être 'Strict' ou 'None' selon les besoins)
                });                

                // Vérifier si le cookie est bien défini
                console.log(`[${new Date().toISOString()}] 🔹 Vérification du cookie envoyé:`, res.getHeader('Set-Cookie'));

                // Vérifier les en-têtes de la réponse
                console.log(`[${new Date().toISOString()}] 🔹 Headers de réponse envoyés:`, res.getHeaders());

                // Retourner un message de succès
                return res.status(200).json({
                    message: 'Connexion réussie',
                    data: { token: nouveauToken }
                });
            });
        });
    });
});


const verifyToken = (req, res, next) => {
    console.log('--- Vérification du Token ---');
    
    // Log des cookies reçus dans la requête pour vérifier leur contenu
    console.log(`[${new Date().toISOString()}] Cookies reçus :`, req.cookies);
    
    // Récupérer le token depuis les cookies ou l'en-tête Authorization
    let token = req.cookies.token || req.headers['authorization']?.split(' ')[1];  // Récupérer le token depuis Authorization

    if (!token) {
        console.warn(`[${new Date().toISOString()}] ⚠️ Accès refusé: Aucun token trouvé dans les cookies ou les headers.`);
        return res.status(403).json({ message: 'Token manquant' });
    }

    console.log(`[${new Date().toISOString()}] ✅ Token trouvé dans les cookies ou les headers: ${token.substring(0, 10)}... (raccourci pour sécurité)`);

    // Vérification du token JWT
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Échec de la vérification du token.`);
            
            // Log de l'erreur spécifique
            console.error(`[${new Date().toISOString()}] Détails de l'erreur:`, err);

            if (err.name === 'TokenExpiredError') {
                console.warn('⚠️ Token expiré, demande de renouvellement nécessaire.');
                return res.status(401).json({ message: 'Token expiré' });
            }

            console.error('Erreur lors de la validation du token:', err);
            return res.status(401).json({ message: 'Token invalide' });
        }

        console.log(`[${new Date().toISOString()}] ✅ Token valide. Utilisateur: ${decoded.nom}, Rôle: ${decoded.role}`);
        
        // Ajouter l'utilisateur décodé à la requête
        req.user = decoded;

        // Log de l'utilisateur décodé
        console.log(`[${new Date().toISOString()}] Données utilisateur extraites du token :`, decoded);

        next();
    });
};



// Route pour envoyer des données de capteur aléatoires avec vérification du token
app.get('/api/capteur', verifyToken, (req, res) => {
    console.log('--- Requête reçue sur /api/capteur ---');
    console.log(`[${new Date().toISOString()}] Requête GET /api/capteur de ${req.user ? req.user.nom : 'Utilisateur non authentifié'}`);

    // Vérifier l'utilisateur authentifié
    if (!req.user) {
        console.log(`[${new Date().toISOString()}] Accès refusé: Aucun utilisateur authentifié.`);
        return res.status(403).json({ message: 'Accès refusé: Token invalide ou manquant.' });
    }

    console.log(`[${new Date().toISOString()}] Utilisateur connecté:`, req.user);

    // Générer des données de capteur aléatoires
    const generateRandomData = () => {
        const temperature = (Math.random() * (30 - 15) + 15).toFixed(2);
        const humidite = (Math.random() * (100 - 30) + 30).toFixed(2);
        const pression = (Math.random() * (1100 - 900) + 900).toFixed(2);

        console.log(`[${new Date().toISOString()}] Données générées - Température: ${temperature}°C, Humidité: ${humidite}%, Pression: ${pression} hPa`);

        return { temperature, humidite, pression };
    };

    const data = {
        capteur_id: Math.floor(Math.random() * 1000),
        valeurs: generateRandomData(),
        timestamp: new Date().toISOString()
    };

    console.log(`[${new Date().toISOString()}] Données finales générées:`, JSON.stringify(data, null, 2));

    console.log(`[${new Date().toISOString()}] Envoi des données au client...`);
    res.json(data);

    console.log(`[${new Date().toISOString()}] Réponse envoyée avec succès.`);
});

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://192.168.65.227:${PORT}`);
});
