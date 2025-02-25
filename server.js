const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken'); // Importez jsonwebtoken

const cors = require('cors');
const app = express();
const PORT = 3000;

// Activer CORS pour toutes les routes
app.use(cors());

app.use(bodyParser.json());
app.use(cookieParser());

// Configuration de la base de données
const db = mysql.createConnection({
    host: '192.168.65.227', // L'adresse IP ou le nom d'hôte de votre serveur
    user: 'chef',           // Votre utilisateur MySQL
    password: 'root',       // Votre mot de passe MySQL
    database: 'Connexion',  // Le nom de votre base de données
});

// Connecter à la base
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
            const token = jwt.sign({ username, fullName }, SECRET_KEY, { expiresIn: '1h' });
            db.query('INSERT INTO users (username, fullname, token) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE fullname = ?, token = ?',
                [username, fullName, token, fullName, token], (err) => {
                    if (err) return res.status(500).json({ error: 'Erreur MySQL' });
                });

            wss.clients.forEach(client => client.send(JSON.stringify({ type: 'auth-success', token })));
            res.json({ message: 'Authentification réussie', token, fullName });
        } else {
            res.status(401).json({ error: 'Identifiants invalides' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la connexion à École Directe' });
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

// Lancer le serveur sur le port 3000
app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://192.168.65.227:${PORT}`);
});