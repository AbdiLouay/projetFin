import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./App.css";

// Enregistrement des composants ChartJS nécessaires pour Line chart
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const App = () => {
  // États pour gérer l'authentification, la vue, les formulaires et les données
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState("login"); // "login" ou "register" ou "home"
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sensorData, setSensorData] = useState(null); // données capteurs actuelles
  const [history, setHistory] = useState([]); // historique des données pour graphique
  const [selectedMetric, setSelectedMetric] = useState(null); // métrique choisie pour graphique
  const [lastUpdate, setLastUpdate] = useState(null); // heure de dernière mise à jour
  const [theme, setTheme] = useState("dark"); // thème clair/sombre

  // Nouveaux états pour l'enregistrement
  const [isRecording, setIsRecording] = useState(false);
  const [recordedHistory, setRecordedHistory] = useState([]);

  // URL API backend
  const API_URL = "http://192.168.65.227:3000/api";

  // Récupérer le token JWT dans les cookies pour authentification
  const getTokenFromCookies = () => {
    const match = document.cookie.match(/(^| )token=([^;]+)/);
    return match ? match[2] : null;
  };

  // Fonction pour récupérer les données des capteurs depuis l'API
  const fetchSensorData = async () => {
    const token = getTokenFromCookies();
    if (!token) {
      setMessage("⚠️ Vous devez être connecté pour voir les données.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/capteurs`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // envoi du token
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la récupération des données");
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Les données reçues sont invalides ou vides");
      }

      // Formatage de l'historique pour affichage graphique
      const newHistory = data.map((capteur) => ({
        timestamp: new Date().toLocaleTimeString(),
        capteur_id: capteur.capteur_id,
        name: capteur.name,
        unit: capteur.unit,
        value: parseFloat(capteur.value) || 0,
      }));

      // Mise à jour des états
      setSensorData(data);
      setLastUpdate(new Date().toLocaleTimeString());
      // On garde max 20 dernières valeurs dans l'historique
      setHistory((prev) => [...prev, ...newHistory].slice(-20));
      setMessage(""); // efface message d'erreur si ok

      // Si on enregistre, on ajoute ces nouvelles données dans recordedHistory
      if (isRecording) {
        // On stocke seulement capteur_id, timestamp ISO, et valeur pour l'enregistrement
        const newRecorded = data.map((capteur) => ({
          capteur_id: capteur.capteur_id,
          timestamp: new Date().toISOString(),
          value: parseFloat(capteur.value) || 0,
        }));
        setRecordedHistory((prev) => [...prev, ...newRecorded]);
      }
    } catch (error) {
      setMessage("⚠️ Erreur de récupération des données du capteur.");
    }
  };

  // Effet pour lancer la récupération des données toutes les 30 secondes si connecté
  useEffect(() => {
    let intervalId;
    if (isLoggedIn) {
      fetchSensorData();
      intervalId = setInterval(fetchSensorData, 30000); // 30s
    }
    return () => clearInterval(intervalId); // nettoyage à la fin
  }, [isLoggedIn, isRecording]); // re-run si isRecording change (juste pour sûreté)

  // Gestion du formulaire de connexion
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json();
      if (response.ok) {
        // Stockage du token dans un cookie (1h)
        document.cookie = `token=${data.data.token}; path=/; max-age=3600`;
        setIsLoggedIn(true);
        setView("home"); // passe à la page d'accueil
        setMessage("");
      } else {
        setMessage(data.message || "❌ Identifiants incorrects !");
      }
    } catch (error) {
      setMessage("⚠️ Erreur de connexion au serveur.");
    }
  };

  // Gestion du formulaire d'inscription
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage("✅ Inscription réussie !");
        setTimeout(() => setView("login"), 1000); // retour à la connexion
      } else {
        setMessage(data.message || "⚠️ Erreur d'inscription.");
      }
    } catch (error) {
      setMessage("⚠️ Erreur de connexion au serveur.");
    }
  };

  // Déconnexion : suppression cookie + retour à login
  const handleLogout = () => {
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    setIsLoggedIn(false);
    setView("login");
    setSensorData(null);
    setHistory([]);
    setSelectedMetric(null);
    setMessage("");
    setIsRecording(false);
    setRecordedHistory([]);
  };

  // Fonction pour sauvegarder l'enregistrement (création session + envoi des données)
  const handleSaveRecording = async () => {
    if (recordedHistory.length === 0) {
      alert("⚠️ Aucune donnée enregistrée à sauvegarder.");
      return;
    }

    const name = prompt("Nom de l'enregistrement :");
    const description = prompt("Description :");

    if (!name || !description) {
      alert("❌ Nom et description requis.");
      return;
    }

    const date = new Date();
    const sessionToSend = {
      nom: name,
      description,
      date_debut: date.toISOString().slice(0, 19).replace("T", " "),
      intervalle: 30,
    };

    const token = getTokenFromCookies();
    if (!token) {
      alert("❌ Token invalide ou manquant.");
      return;
    }

    try {
      // 1) Création de la session
      const res = await fetch(`${API_URL}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sessionToSend),
      });
      const result = await res.json();

      if (!res.ok) {
        if (result.message === "Token invalide ou expiré.") {
          alert("Session expirée. Veuillez vous reconnecter.");
          handleLogout();
        } else {
          alert("Erreur : " + result.message);
        }
        return;
      }

      // 2) Envoi des données enregistrées liées à la session
      // Suppose que l'API attend un endpoint POST /session/:id/data
      const sessionId = result.data.session_id; // adapte selon ta réponse API

      const dataToSend = recordedHistory.map(({ capteur_id, timestamp, value }) => ({
        capteur_id,
        timestamp: new Date(timestamp).toISOString(),
        value,
      }));

      const dataRes = await fetch(`${API_URL}/session/${sessionId}/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: dataToSend }),
      });
      const dataResult = await dataRes.json();

      if (!dataRes.ok) {
        alert("Erreur lors de l'envoi des données : " + (dataResult.message || "Erreur inconnue"));
        return;
      }

      alert("✅ Session et données sauvegardées !");

      // Reset enregistrement
      setIsRecording(false);
      setRecordedHistory([]);
    } catch {
      alert("❌ Erreur serveur.");
    }
  };

  // Fonction pour annuler l'enregistrement sans sauvegarder
  const handleStopRecording = () => {
    if (window.confirm("Voulez-vous vraiment annuler l'enregistrement sans sauvegarder ?")) {
      setIsRecording(false);
      setRecordedHistory([]);
    }
  };

  return (
    <div className={`container ${theme}`}>
      <div className="box">
        {/* Barre de navigation avec titre et bouton thème + déconnexion */}
        <div className="navbar">
          <h2>🌬️ VMC UFA</h2>
          <div>
            <div className="topbar-buttons">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="theme-toggle"
                title="Changer le thème"
              >
                {theme === "dark" ? "🌞" : "🌙"}
              </button>
            </div>
            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="logout-fab fixed-top-right"
                title="Déconnexion"
              >
                🚪
              </button>
            )}
          </div>
        </div>

        {/* Affichage des messages d'info ou d'erreur */}
        {message && <p className="message">{message}</p>}

        {/* Formulaire connexion / inscription */}
        {!isLoggedIn && (
          <form onSubmit={view === "login" ? handleLogin : handleRegister}>
            <input
              className="form-input"
              type="text"
              placeholder="Nom d'utilisateur"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
            <input
              className="form-input"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button className="button button-primary">
              {view === "login" ? "🔐Se connecter" : "S'inscrire"}
            </button>
            <button
              type="button"
              onClick={() => setView(view === "login" ? "register" : "login")}
              className="button button-secondary"
            >
              {view === "login" ? "Créer un compte" : "Retour à la connexion"}
            </button>
          </form>
        )}

        {/* Page principale avec données, graphiques et contrôle d'enregistrement */}
        {isLoggedIn && view === "home" && (
          <>
            <h3 style={{ marginBottom: "1rem" }}>👋 Bienvenue, {login} !</h3>
            <button
              onClick={fetchSensorData}
              className="button button-secondary"
              style={{ marginBottom: "1rem" }}
            >
              🔄 Actualiser les données
            </button>

            {/* Boutons pour gérer l'enregistrement */}
            <div className="record-controls" style={{ marginBottom: "1rem" }}>
              {!isRecording ? (
                <button
                  onClick={() => setIsRecording(true)}
                  className="button button-primary"
                >
                  📼 Démarrer l'enregistrement
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveRecording}
                    className="button button-success"
                    style={{ marginRight: "1rem" }}
                  >
                    💾 Sauvegarder
                  </button>
                  <button
                    onClick={handleStopRecording}
                    className="button button-danger"
                  >
                    ❌ Annuler
                  </button>
                </>
              )}
            </div>

            {lastUpdate && (
              <p
                style={{
                  fontStyle: "italic",
                  marginBottom: "1rem",
                  color: "#9ca3af",
                }}
              >
                Dernière mise à jour : {lastUpdate}
              </p>
            )}

            {/* Affichage des cartes capteurs */}
            {sensorData ? (
              <div className="sensor-grid">
                {sensorData.map((capteur) => (
                  <div
                    key={capteur.capteur_id}
                    className="sensor-card"
                    data-unit={capteur.unit}
                    onClick={() => setSelectedMetric(capteur.name)} // clic pour graphique
                    title={`Afficher historique ${capteur.name}`}
                  >
                    <div style={{ fontSize: "2rem" }}>
                      {capteur.name === "Température" && "🌡️"}
                      {capteur.name === "Humidité" && "💧"}
                      {capteur.name === "CO2" && "🟢"}
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>
                      {capteur.name}
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                      {capteur.value} {capteur.unit}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>Chargement des données...</p>
            )}

            {/* Graphique historique quand une métrique est sélectionnée */}
            {selectedMetric && (
              <div className="chart-container">
                <h4 style={{ textAlign: "center", marginBottom: 10 }}>
                  📈 Historique de <strong>{selectedMetric}</strong>
                </h4>

                <Line
                  data={{
                    labels: history
                      .filter((point) => point.name === selectedMetric)
                      .map((point) => point.timestamp),
                    datasets: [
                      {
                        label: selectedMetric,
                        data: history
                          .filter((point) => point.name === selectedMetric)
                          .map((point) => point.value),
                        borderColor: "rgb(75, 192, 192)",
                        backgroundColor: "rgba(75, 192, 192, 0.2)",
                        fill: true,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: "top" },
                      title: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />

                <button
                  className="button button-secondary"
                  onClick={() => setSelectedMetric(null)}
                  style={{ marginTop: "1rem" }}
                >
                  🔙 Retour
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
