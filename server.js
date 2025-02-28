const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Ajout d'Axios
const WebSocket = require('ws'); // Ajout de WebSocket
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'votre_secret_key';

// Activer CORS
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

// Configuration de la base de données
const db = mysql.createConnection({
    host: '192.168.65.227',
    user: 'chef',
    password: 'root',
    database: 'Connexion',
});

// Connexion à la base
db.connect(err => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
        process.exit(1);
    }
    console.log('Connecté à la base de données MySQL.');
});

// WebSocket Server
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', ws => {
    console.log('Client WebSocket connecté');
});

// Route d'authentification avec École Directe
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const response = await axios.post('https://api.ecoledirecte.com/v3/login.awp', {
            identifiant: username,
            motdepasse: password
        });

        if (response.data.code === 200) {
            const userData = response.data.data.accounts[0];
            const fullName = `${userData.prenom} ${userData.nom}`;

            // Vérifier si l'utilisateur a déjà un token en base
            db.query('SELECT token FROM users WHERE username = ?', [username], (err, results) => {
                if (err) return res.status(500).json({ error: 'Erreur MySQL' });

                if (results.length > 0 && results[0].token) {
                    // Un token existe déjà, on le renvoie
                    const existingToken = results[0].token;
                    return res.json({ message: 'Authentification réussie', token: existingToken, fullName });
                } else {
                    // Pas de token existant, on en génère un
                    const token = jwt.sign({ username, fullName }, SECRET_KEY, { expiresIn: '1h' });

                    db.query('INSERT INTO users (username, fullname, token) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE fullname = ?, token = ?',
                        [username, fullName, token, fullName, token], (err) => {
                            if (err) return res.status(500).json({ error: 'Erreur MySQL' });
                        });

                    // Envoyer via WebSocket
                    wss.clients.forEach(client => client.send(JSON.stringify({ type: 'auth-success', token })));
                    
                    return res.json({ message: 'Authentification réussie', token, fullName });
                }
            });

        } else {
            return res.status(401).json({ error: 'Identifiants invalides' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lors de la connexion à École Directe' });
    }
});

// Route pour enregistrer des mesures capteurs
app.post('/capteurs', (req, res) => {
    const { capteurs } = req.body;
    capteurs.forEach(({ type, valeur }) => {
        db.query('INSERT INTO mesures (type, valeur, date) VALUES (?, ?, NOW())',
            [type, valeur], (err) => {
                if (err) return res.status(500).json({ error: 'Erreur MySQL' });
            });
    });
    wss.clients.forEach(client => client.send(JSON.stringify({ type: 'capteurs', data: capteurs })));
    res.json({ message: 'Données enregistrées' });
});

// Route pour enregistrer une plage de mesure
app.post('/plage-mesure', (req, res) => {
    const { username, nom, debut, fin } = req.body;
    db.query('INSERT INTO plages_mesure (username, nom, debut, fin) VALUES (?, ?, ?, ?)',
        [username, nom, debut, fin], (err) => {
            if (err) return res.status(500).json({ error: 'Erreur MySQL' });
            res.json({ message: 'Plage de mesure enregistrée' });
        });
});

// Route pour récupérer une plage de mesure
app.get('/plage-mesure/:username', (req, res) => {
    const { username } = req.params;
    db.query('SELECT * FROM plages_mesure WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).json({ error: 'Erreur MySQL' });
        res.json({ plages: results });
    });
});

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://192.168.65.227:${PORT}`);
});
