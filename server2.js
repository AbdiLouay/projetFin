const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET;
const secret = process.env.JWT_SECRET;

console.log("JWT_SECRET =", process.env.JWT_SECRET);


const Modbus = require('jsmodbus');
const net = require('net');

const MODBUS_SERVER_IP = '192.168.64.253'; //l'IP
const MODBUS_PORT = 502;  // Port Modbus standard
const MODBUS_ID = 1;  // ID de l'esclave Modbus

// Créer un socket pour la connexion Modbus
const socket = new net.Socket();

// Créer le client Modbus
const client = new Modbus.client.TCP(socket, MODBUS_ID);

const app = express();
const PORT = 3000;

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

// Se connecter au serveur Modbus
socket.connect(MODBUS_PORT, MODBUS_SERVER_IP, () => {
    console.log(' Connexion au serveur Modbus réussie');
});

// Configuration de la base de données
const db = mysql.createConnection({
    host: '192.168.65.227',
    user: 'chef',
    password: 'Root@2025',
    database: 'vmc1',
});

const util = require('util');
const query = util.promisify(db.query).bind(db);


// Connexion à la base
db.connect(err => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
        process.exit(1);
    }
    console.log('Connecté à la base de données MySQL.');
});

const rateLimit = require('express-rate-limit');

// Middleware de rate limiting pour la route /api/register
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 4, // Limite chaque IP à 5 requêtes par fenêtre
    message: {
        message: "Trop de tentatives d'inscription depuis cette IP. Réessayez plus tard."
    },
    standardHeaders: true, // Retourne les headers RateLimit
    legacyHeaders: false,  // Désactive les anciens headers
});

// Route pour enregistrer un utilisateur et token
app.post('/api/register', registerLimiter, [
    body('login')
        .isString()
        .isLength({ min: 5 }).withMessage('Le login doit contenir au moins 5 caractères.')
        .trim()
        .escape(),
    body('password')
        .isString()
        .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères.'),
    body('role').optional().isString()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.', errors: errors.array() });
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


        const jwt = require('jsonwebtoken');

        const secret = process.env.JWT_SECRET;
        
        if (!secret) {
          throw new Error("La clé secrète JWT n'est pas définie dans les variables d'environnement !");
        }
        

        // Générer un token
        const token = jwt.sign({ login, role: role || 'user' }, SECRET_KEY, { expiresIn: '1h' });

        // Enregistrer l'utilisateur en base de donnee
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

// Route de connexion
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
        console.warn(`[${new Date().toISOString()}]  Données invalides reçues`, errors.array());
        return res.status(400).json({ message: 'Données invalides', errors: errors.array() });
    }

    const { login, password } = req.body;
    console.log(`[${new Date().toISOString()}] 🔹 Demande de connexion reçue pour: ${login}`);

    db.query('SELECT * FROM Utilisateur WHERE nom = ?', [login], (err, results) => {
        if (err) {
            console.error(`[${new Date().toISOString()}]  Erreur lors de la recherche de l'utilisateur:`, err);
            return res.status(500).json({ message: 'Erreur interne du serveur' });
        }
        if (results.length === 0) {
            console.warn(`[${new Date().toISOString()}] Utilisateur non trouvé: ${login}`);
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        const user = results[0];
        console.log(`[${new Date().toISOString()}] Utilisateur trouvé: ${user.nom}`);

        // Vérifier le mot de passe
        bcrypt.compare(password, user.mot_de_passe, (err, isMatch) => {
            if (err) {
                console.error(`[${new Date().toISOString()}]  Erreur lors de la comparaison des mots de passe:`, err);
                return res.status(500).json({ message: 'Erreur interne du serveur' });
            }
            if (!isMatch) {
                console.warn(`[${new Date().toISOString()}]  Mot de passe incorrect pour: ${login}`);
                return res.status(401).json({ message: 'Identifiants invalides' });
            }

            // Générer un nouveau token
            const nouveauToken = jwt.sign(
                { id_utilisateur: user.id_utilisateur, nom: user.nom, role: user.role },
                SECRET_KEY,
                { expiresIn: '4h' }
            );
            console.log(`[${new Date().toISOString()}]  Connexion réussie, token généré pour ${login}: ${nouveauToken}`);

            // Mettre à jour le token en base de données
            db.query('UPDATE Utilisateur SET token = ? WHERE id_utilisateur = ?', [nouveauToken, user.id_utilisateur], (err) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}]  Erreur lors de la mise à jour du token en base:`, err);
                    return res.status(500).json({ message: 'Erreur interne du serveur' });
                }

                console.log(`[${new Date().toISOString()}]  Nouveau token enregistré en base pour ${login}`);

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
        console.warn(`[${new Date().toISOString()}] Accès refusé: Aucun token trouvé dans les cookies ou les headers.`);
        return res.status(403).json({ message: 'Token manquant' });
    }

    console.log(`[${new Date().toISOString()}] Token trouvé dans les cookies ou les headers: ${token.substring(0, 10)}... (raccourci pour sécurité)`);

    // Vérification du token JWT
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error(`[${new Date().toISOString()}] Échec de la vérification du token.`);
            
            // Log de l'erreur spécifique
            console.error(`[${new Date().toISOString()}] Détails de l'erreur:`, err);

            if (err.name === 'TokenExpiredError') {
                console.warn(' Token expiré, demande de renouvellement nécessaire.');
                return res.status(401).json({ message: 'Token expiré' });
            }

            console.error('Erreur lors de la validation du token:', err);
            return res.status(401).json({ message: 'Token invalide' });
        }

        console.log(`[${new Date().toISOString()}] Token valide. Utilisateur: ${decoded.nom}, Rôle: ${decoded.role}`);
        
        // Ajouter l'utilisateur décodé à la requête
        req.user = decoded;

        // Log de l'utilisateur décodé
        console.log(`[${new Date().toISOString()}] Données utilisateur extraites du token :`, decoded);

        next();
    });
};


const config = [
    { "name": "de COV","unit": "%", "min": 0, "max": 100, "address": 0 },
    { "name": "débimètre","unit": "m3/h", "min": 0, "max": 30, "address": 1 },
    { "name": "débimètre","unit": "m3/h", "min": 0, "max": 30, "address": 2 },
    { "name": "débimètre","unit": "m3/h", "min": 0, "max": 30, "address": 3 },
    { "name": "débimètre","unit": "m3/h", "min": 0, "max": 30, "address": 4 },
    { "name": "de température","unit": "°C", "min": -35, "max": 35, "address": 5 },
    { "name": "d'humidité","unit": "%", "min": 0, "max": 100, "address": 6 },
    { "name": "de température","unit": "°C", "min": -35, "max": 35, "address": 7 },
    { "name": "d'humidité","unit": "%", "min": 0, "max": 100, "address": 8 },
    { "name": "de température","unit": "°C", "min": -35, "max": 35, "address": 9},
    { "name": "d'humidité","unit": "%", "min": 0, "max": 100, "address": 10 },
    { "name": "de température","unit": "°C", "min": -35, "max": 35, "address": 11 },
    { "name": "d'humidité","unit": "%", "min": 0, "max": 100, "address": 12 },
    { "name": "d'ambiance","unit": "°C", "min": -35, "max": 35, "address": 13 },
    { "name": "de CO2","unit": "ppm", "min": 0, "max": 5000, "address": 14 }
];


// Route pour récupérer les données des capteurs
app.get('/api/capteurs', verifyToken, async (req, res) => {
  console.log('--- Requête reçue sur /api/capteurs ---');

  // Vérifie si la connexion Modbus est active
  if (!socket.writable) {
    console.error('Erreur : Connexion Modbus non établie.');
    return res.status(500).json({ message: 'Erreur : connexion Modbus non établie.' });
  }

  try {
    // Nombre total de registres à lire, basé sur la config des capteurs
    const totalRegistres = config.length;
    console.log('Envoi de la requête Modbus pour lire les registres');

    // Lecture des registres Modbus (lecture des entrées analogiques)
    const response = await client.readInputRegisters(0, totalRegistres);
    const values = response.response._body.values;

    console.log(`Données Modbus brutes reçues : ${JSON.stringify(values)}`);

    const ADC_MAX = 16709; // Valeur maximale de l’ADC pour les capteurs analogiques

    // Fonction pour convertir une valeur 16 bits non signée en valeur signée
    function toSigned16(value) {
      return value > 0x7FFF ? value - 0x10000 : value;
    }

    // Fonction pour arrondir à 4 décimales
    function roundTo4(value) {
      return parseFloat(value.toFixed(4));
    }

    // Fonction de conversion des données brutes selon le type de capteur
    function convertValue(raw, capteurConfig) {
      const signedValue = toSigned16(raw);

      switch (capteurConfig.name) {
        case 'de température':
case "d'ambiance": {
  const minBrut = 0;
  const maxBrut = 16709;
  const minPhysique = -35;
  const maxPhysique = 35;

  const percent = (signedValue - minBrut) / (maxBrut - minBrut);
  return roundTo4(percent * (maxPhysique - minPhysique) + minPhysique);
}


        case 'débimètre':
        case "d'humidité":
        case 'de COV':
        case 'de CO2': {
          // Conversion en pourcentage basé sur ADC_MAX
          const percent = (signedValue / ADC_MAX) * 100;
          // Clamp entre les min et max définis dans la config
          return roundTo4(Math.min(Math.max(percent, capteurConfig.min), capteurConfig.max));
        }

        default: {
          // Cas par défaut, même traitement que précédemment
          const percent = (signedValue / ADC_MAX) * 100;
          return roundTo4(Math.min(Math.max(percent, capteurConfig.min), capteurConfig.max));
        }
      }
    }

    // Traitement de chaque capteur selon sa config
    const capteursData = config.map((capteurConfig, index) => {
      const rawValue = values[index];
      const value = convertValue(rawValue, capteurConfig);

      return {
        capteur_id: capteurConfig.address + 1, // Adresse du capteur (1-based index)
        name: capteurConfig.name,
        unit: capteurConfig.unit,
        rawValue: toSigned16(rawValue), // Valeur brute convertie en signée
        value, // Valeur convertie et arrondie
        timestamp: new Date().toISOString() // Timestamp ISO
      };
    });

    // Formatage du timestamp au format MySQL DATETIME
    function formatDateForMySQL(dateString) {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 19).replace('T', ' ');
    }

    // Requête SQL d'insertion multiple
    const sql = `INSERT INTO capteur (id_capteur, ctype, valeur, unite, date_heure) VALUES ?`;

    // Création du tableau de valeurs à insérer en base de données
    const valuesToInsert = capteursData.map(capteur => [
      capteur.capteur_id,
      capteur.name,
      capteur.value,
      capteur.unit,
      formatDateForMySQL(capteur.timestamp),
    ]);

    // Insertion des données dans la base
    db.query(sql, [valuesToInsert], (err, result) => {
      if (err) {
        console.error('Erreur lors de l’enregistrement automatique des capteurs :', err);
      } else {
        console.log(`${result.affectedRows} capteur(s) enregistré(s) automatiquement`);
      }
    });

    // Réponse au client avec les données formatées
    console.log('Données des capteurs traitées envoyées au client:', JSON.stringify(capteursData));
    return res.json(capteursData);

  } catch (error) {
    // Gestion des erreurs de lecture Modbus
    console.error('Erreur lors de la lecture Modbus :', error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des données des capteurs' });
  }
});





// Gérer la fermeture de connexion proprement
socket.on('error', (err) => {
    console.error('Erreur de connexion Modbus:', err.message);
});

socket.on('close', () => {
    console.log('Connexion Modbus fermée');
});

// Route pour enregistrer les données des capteurs
app.post('/enregistrer', (req, res) => {
  console.log('Requête reçue sur /enregistrer');

  const capteursData = req.body; // Données envoyées en JSON
  console.log('Données reçues:', JSON.stringify(capteursData, null, 2));

  if (!Array.isArray(capteursData) || capteursData.length === 0) {
      console.error(' Aucune donnée reçue ou format incorrect');
      return res.status(400).json({ error: 'Aucune donnée reçue ou format incorrect' });
  }

  // Préparation de la requête SQL
  const sql = `INSERT INTO capteur(id_capteur, ctype, valeur, unite, date_heure) VALUES ?`;
  
  // Vérifier que chaque capteur a bien les bonnes valeurs
  const values = capteursData.map(capteur => [
      capteur.capteur_id, // capteur_id au lieu de id_capteur
      capteur.name, //  name au lieu de type_mesure
      capteur.value, //  value au lieu de valeur
      capteur.unit, // unit au lieu de unite
      new Date().toISOString(), // Timestamp actuel
  ]);

  console.log('Requête SQL préparée:', sql);
  console.log('Valeurs à insérer:', values);

  db.query(sql, [values], (err, result) => {
      if (err) {
          console.error('Erreur lors de l\'insertion des données :', err);
          return res.status(500).json({ error: 'Erreur lors de l\'enregistrement en BDD' });
      }
      console.log(`${result.affectedRows} enregistrement(s) ajouté(s)`);
      res.status(200).json({ message: `${result.affectedRows} enregistrement(s) ajouté(s)` });
  });
});

// ROUTE POUR RÉCUPÉRER LE TOKEN
app.get('/api/get-token/:id', (req, res) => {
    const userId = req.params.id;
    console.log(`🔹 Requête reçue pour récupérer le token de l'utilisateur ID: ${userId}`);

    const sql = 'SELECT token FROM Utilisateur WHERE id_utilisateur = ?';

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(' Erreur MySQL:', err);
            res.status(500).json({ error: 'Erreur serveur' });
            return;
        }

        if (result.length === 0) {
            console.warn('Token non trouvé pour l\'utilisateur ID:', userId);
            res.status(404).json({ error: 'Token non trouvé' });
        } else {
            console.log(` Token trouvé pour l'utilisateur ID: ${userId}`);
            res.json({ token: result[0].token });
        }
    });
});

app.post('/api/capteur', verifyToken, (req, res) => {
    // Vérifie que la requête est un tableau
    if (!Array.isArray(req.body) || req.body.length === 0) {
    return res.status(400).json({ message: "Le body doit être un tableau non vide." });
    }
    
    let insertedCount = 0;
    let errors = [];
    
    req.body.forEach((capteur) => {
    const { id_capteur, type, valeur, date_heure } = capteur;
    
    // Vérifie que tous les champs sont présents
    if (id_capteur == null || !type || valeur == null || !date_heure) {
      errors.push("Champ manquant pour un capteur.");
      return;
    }
    
    const sql = 'INSERT INTO capteur (id_capteur, type, valeur, date_heure) VALUES (?, ?, ?, ?)';
    db.query(sql, [id_capteur, type, valeur, date_heure], (err, result) => {
      if (err) {
        errors.push(err);
      } else {
        insertedCount++;
      }
    
      // Quand toutes les requêtes sont traitées
      if (insertedCount + errors.length === req.body.length) {
        if (errors.length > 0) {
          return res.status(500).json({ message: "Erreur lors de l'insertion de certains capteurs.", errors });
        }
        return res.status(201).json({ message: "Tous les capteurs ont été enregistrés avec succès." });
      }
    });
  });
});

app.delete('/api/capteurs', verifyToken, (req, res) => {
    const deleteCapteurs = 'DELETE FROM capteur'; // attention ici : c'est bien ta nouvelle table "capteur"
    
    db.query(deleteCapteurs, (err, result) => {
    if (err) {
    console.error('Erreur lors de la suppression des capteurs :', err);
    return res.status(500).json({ message: 'Erreur lors de la suppression des capteurs.' });
    }
    
    res.status(200).json({ message: 'Tous les capteurs ont été supprimés.' });
  });
});

app.post('/api/session', verifyToken, (req, res) => {
  const { nom, description, date_debut, date_fin, intervalle } = req.body;

  // Vérifie les champs obligatoires
  if (!nom || !date_debut || !intervalle) {
    return res.status(400).json({
      message: "Champs requis manquants : nom, date_debut, intervalle."
    });
  }

  // Récupération et vérification du token JWT depuis l'en-tête Authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.warn("Aucun token fourni dans l'en-tête Authorization.");
    return res.status(403).json({ message: "Token manquant ou invalide." });
  }

  try {
    // Vérification du token JWT
    const decoded = jwt.verify(token, SECRET_KEY);
    const id_utilisateur = decoded.id_utilisateur;

    // Formatage des dates en 'YYYY-MM-DD HH:mm:ss' pour MySQL
    const formatted_date_debut = new Date(date_debut).toISOString().slice(0, 19).replace('T', ' ');
    const formatted_date_fin = date_fin ? new Date(date_fin).toISOString().slice(0, 19).replace('T', ' ') : null;

    // Log des données à insérer
    console.log("Données reçues pour insertion :", {
      nom,
      description,
      formatted_date_debut,
      formatted_date_fin,
      intervalle,
      id_utilisateur
    });

    const sql = `
      INSERT INTO SessionMesure (nom, description, date_debut, date_fin, intervalle, id_utilisateur)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
      nom,
      description || "",
      formatted_date_debut,
      formatted_date_fin,
      intervalle,
      id_utilisateur
    ], (err, result) => {
      if (err) {
        console.error("Erreur SQL lors de l'insertion :", err);
        return res.status(500).json({ message: "Erreur d'enregistrement", error: err });
      }

      console.log("Session insérée avec succès. ID :", result.insertId);
      // Envoi du succès au front
      return res.status(201).json({
        message: "Session enregistrée avec succès.",
        id_session: result.insertId
      });
    });

  } catch (err) {
    console.error('Erreur lors de la vérification du token JWT:', err);
    return res.status(401).json({ message: "Token invalide ou expiré." });
  }
});

  
app.put('/api/session/fin/:id', verifyToken, (req, res) => {
  const id_session = req.params.id;
  const { date_fin } = req.body;

  if (!date_fin) {
    return res.status(400).json({ message: "Champ 'date_fin' requis." });
  }

  const sql = `UPDATE SessionMesure SET date_fin = ? WHERE id_session = ?`;

  db.query(sql, [date_fin, id_session], (err, result) => {
    if (err) {
        return res.status(500).json({ message: "Erreur lors de la mise à jour de la session.", error: err });
    }
    if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Session non trouvée." });
    }
    res.status(200).json({ message: "Session mise à jour avec succès." });
  });
});

  
  app.get("/api/users/:login", async (req, res) => {
    const login = req.params.login;
  
    try {
      // Exécution de la requête SQL
      const rows = await query(
        "SELECT id_utilisateur FROM Utilisateur WHERE nom = ?",
        [login]
      );
  
      console.log("Résultat brut de la requête SQL :", rows);
  
      if (!Array.isArray(rows) || rows.length === 0) {
        console.warn(`Aucun utilisateur trouvé pour le login : ${login}`);
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
  
      const { id_utilisateur } = rows[0];
  
      if (!id_utilisateur) {
        console.error(`id_utilisateur manquant dans la réponse SQL pour ${login}`);
        return res.status(500).json({ message: "Erreur serveur : ID utilisateur manquant" });
      }
  
      res.json({ id_utilisateur });
  
    } catch (error) {
      console.error("Erreur lors de la récupération de l’utilisateur :", error);
      res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
  });
  


  
// Vérifie si l'utilisateur est toujours authentifié (après rechargement par ex)
app.get('/api/check-auth', verifyToken, (req, res) => {
    res.status(200).json({
        message: 'Utilisateur toujours connecté',
        user: req.user,
    });
});


// Lancer le serveur
app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://192.168.65.227:${PORT}`);
});
