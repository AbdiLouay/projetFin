const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'votre-cle-secrete';

// Activer CORS
app.use(cors());
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
    database: 'vmc',
});

// Connexion à la base
db.connect(err => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
        process.exit(1);
    }
    console.log('Connecté à la base de données MySQL.');
});

// Route pour enregistrer un utilisateur et un token
app.post('/api/register', async (req, res) => {
    try {
        const { login, password, role } = req.body;

        if (!login || !password) {
            return res.status(400).json({ message: 'Nom et mot de passe sont requis.' });
        }

        console.log(`Demande d'inscription reçue pour: ${login}`);

        db.query('SELECT * FROM Utilisateur WHERE nom = ?', [login], async (err, results) => {
            if (err) {
                console.error('Erreur lors de la vérification de l utilisateur :', err);
                return res.status(500).json({ message: 'Erreur interne du serveur' });
            }
            if (results.length > 0) {
                console.log('Utilisateur déjà existant:', login);
                return res.status(409).json({ message: 'Cet utilisateur existe déjà.' });
            }

            const dateExpiration = new Date();
            dateExpiration.setFullYear(dateExpiration.getFullYear() + 1);
            const formattedDate = dateExpiration.toISOString().slice(0, 19).replace('T', ' ');

            const hashedPassword = await bcrypt.hash(password, 10);
            console.log('Mot de passe hashé avec succès');

            const token = jwt.sign({ login, role: role || 'user' }, SECRET_KEY, { expiresIn: '1h' });

            db.query('INSERT INTO Utilisateur (nom, mot_de_passe, role, date_expiration, token) VALUES (?, ?, ?, ?, ?)',
                [login, hashedPassword, role || 'user', formattedDate, token],
                (err, result) => {
                    if (err) {
                        console.error('Erreur lors de l insertion de l utilisateur :', err);
                        return res.status(500).json({ message: 'Erreur interne du serveur' });
                    }
                    console.log(`Utilisateur créé avec succès: ${login} (ID: ${result.insertId})`);
                    return res.status(201).json({ message: 'Utilisateur créé avec succès.', token, date_expiration: formattedDate });
                }
            );
        });
    } catch (error) {
        console.error('Erreur globale dans /register :', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

// Route pour la connexion avec identifiant créé
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    console.log(`Demande de connexion reçue pour: ${login}`);

    if (!login || !password) {
        return res.status(400).json({ message: 'Nom et mot de passe sont requis.' });
    }

    db.query('SELECT * FROM Utilisateur WHERE nom = ?', [login], async (err, results) => {
        if (err) {
            console.error('Erreur lors de la recherche de l utilisateur :', err);
            return res.status(500).json({ message: 'Erreur interne du serveur' });
        }
        if (results.length === 0) {
            console.log('Utilisateur non trouvé:', login);
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        const user = results[0];
        console.log('Utilisateur trouvé:', user.nom);

        const isMatch = await bcrypt.compare(password, user.mot_de_passe);
        if (!isMatch) {
            console.log('Mot de passe incorrect pour:', login);
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        const token = jwt.sign({ id_utilisateur: user.id_utilisateur, nom: user.nom, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
        console.log(`Connexion réussie, token généré pour ${login}`);

        db.query('UPDATE Utilisateur SET token = ? WHERE id_utilisateur = ?', [token, user.id_utilisateur], (err) => {
            if (err) {
                console.error('Erreur lors de la mise à jour du token :', err);
                return res.status(500).json({ message: 'Erreur interne du serveur' });
            }
            console.log(`Token enregistré pour ${login}`);
            res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'Strict' });
            return res.status(200).json({ message: 'Connexion réussie', token });
        });
    });
});

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://192.168.65.227:${PORT}`);
});
