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







// Lancer le serveur sur le port 3000
app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://192.168.65.227:${PORT}`);
});