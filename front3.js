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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sensorData, setSensorData] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [theme, setTheme] = useState("dark");

  const [isRecording, setIsRecording] = useState(false);
  const [recordedHistory, setRecordedHistory] = useState([]);
  const [savedSessions, setSavedSessions] = useState([]);

  // **Nouvel état pour la session sélectionnée**
  const [selectedSession, setSelectedSession] = useState(null);

  const API_URL = "http://192.168.65.227:3000/api";

  const getTokenFromCookies = () => {
    const match = document.cookie.match(/(^| )token=([^;]+)/);
    return match ? match[2] : null;
  };

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
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la récupération des données");
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Les données reçues sont invalides ou vides");
      }

      const newHistory = data.map((capteur) => ({
        timestamp: new Date().toLocaleTimeString(),
        capteur_id: capteur.capteur_id,
        name: capteur.name,
        unit: capteur.unit,
        value: parseFloat(capteur.value) || 0,
      }));

      setSensorData(data);
      setLastUpdate(new Date().toLocaleTimeString());
      setHistory((prev) => [...prev, ...newHistory].slice(-20));
      setMessage("");

      if (isRecording) {
        const newRecorded = data.map((capteur) => ({
          capteur_id: capteur.capteur_id,
          name: capteur.name,
          unit: capteur.unit,
          timestamp: new Date().toISOString(),
          value: parseFloat(capteur.value) || 0,
        }));
        setRecordedHistory((prev) => [...prev, ...newRecorded]);
      }
    } catch (error) {
      setMessage("⚠️ Erreur de récupération des données du capteur.");
    }
  };

  useEffect(() => {
    let intervalId;
    if (isLoggedIn) {
      fetchSensorData();
      intervalId = setInterval(fetchSensorData, 30000);
    }
    return () => clearInterval(intervalId);
  }, [isLoggedIn, isRecording]);

  useEffect(() => {
  if (theme === "dark") {
    document.body.classList.add("dark");
    document.body.classList.remove("light");
  } else {
    document.body.classList.add("light");
    document.body.classList.remove("dark");
  }
}, [theme]);

useEffect(() => {
  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/check-auth`, {
        method: "GET",
        credentials: "include", // si tu utilises les cookies httpOnly
        headers: {
          Authorization: `Bearer ${getTokenFromCookies()}`, // si tu passes le token manuellement
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Utilisateur toujours connecté :", data.user);
        setIsLoggedIn(true);
        setView("home");
      } else {
        console.warn("❌ Token invalide ou expiré");
      }
    } catch (error) {
      console.error("Erreur lors de la vérification d'auth :", error);
    }
  };

  checkAuth();
}, []);

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
        document.cookie = `token=${data.data.token}; path=/; max-age=3600`;
        setIsLoggedIn(true);
        setView("home");
        setMessage("");
      } else {
        setMessage(data.message || "❌ Identifiants incorrects !");
      }
    } catch (error) {
      setMessage("⚠️ Erreur de connexion au serveur.");
    }
  };

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
        setTimeout(() => setView("login"), 1000);
      } else {
        setMessage(data.message || "⚠️ Erreur d'inscription.");
      }
    } catch (error) {
      setMessage("⚠️ Erreur de connexion au serveur.");
    }
  };

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
    setSavedSessions([]);
    setSelectedSession(null);
  };

const handleSaveRecording = async () => {
  if (recordedHistory.length === 0) {
    alert("⚠️ Aucune donnée enregistrée à sauvegarder.");
    return;
  }

  const nom = prompt("Nom de l'enregistrement :");
  const description = prompt("Description :");
  if (!nom || !description) {
    alert("❌ Nom et description requis.");
    return;
  }

  const dateDebut = recordedHistory[0]?.timestamp;
  const dateFin = recordedHistory[recordedHistory.length - 1]?.timestamp;
  const intervalle = 30; // ou selon ton réglage réel

  const token = getTokenFromCookies();

  try {
    // 1. Création de la session
    const response = await fetch(`${API_URL}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nom,
        description,
        date_debut: dateDebut,
        date_fin: dateFin,
        intervalle,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Réponse erreur session:", data);
      throw new Error(data.message || "Erreur lors de la sauvegarde de la session.");
    }

    const id_session = data.id_session;

    // ✅ 2. Envoi des mesures dans la BDD
    console.log("Données envoyées à /session :", {
      nom,
      description,
      date_debut: dateDebut,
      date_fin: dateFin,
      intervalle,
    });



    // ✅ 3. Mise à jour locale
    const newSession = {
      id_session,
      nom,
      description,
      date: new Date(dateDebut).toLocaleString(),
      utilisateur: login,
      donnees: recordedHistory,
    };

    setSavedSessions((prev) => [...prev, newSession]);
    setIsRecording(false);
    setRecordedHistory([]);
    alert("✅ Session + mesures enregistrées en base de données !");
  } catch (error) {
    console.error("Erreur:", error);
    alert("❌ Une erreur est survenue : " + error.message);
  }
};



  const handleStopRecording = () => {
    if (window.confirm("Voulez-vous vraiment annuler l'enregistrement sans sauvegarder ?")) {
      setIsRecording(false);
      setRecordedHistory([]);
    }
  };

  return (
    <div className={`container ${theme}`}>
      <div className="box">
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

        {message && <p className="message">{message}</p>}

        {!isLoggedIn && (
          // Formulaire qui change de comportement selon la vue (login ou inscription)
          <form onSubmit={view === "login" ? handleLogin : handleRegister}>
            
            {/* Champ pour le nom d'utilisateur */}
            <input
              className="form-input"
              type="text"
              placeholder="Nom d'utilisateur"
              value={login}
              onChange={(e) => setLogin(e.target.value)} // Met à jour l'état login
              required
            />

            {/* Champ pour le mot de passe */}
            <input
              className="form-input"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)} // Met à jour l'état password
              required
            />

            {/* Bouton principal : connexion ou inscription selon la vue active */}
            <button className="button button-primary">
              {view === "login" ? "🔐 Se connecter" : "S'inscrire"}
            </button>

            {/* Bouton secondaire pour changer entre connexion et inscription */}
            <button
              type="button"
              onClick={() => setView(view === "login" ? "register" : "login")}
              className="button button-secondary"
            >
              {view === "login" ? "Créer un compte" : "Retour à la connexion"}
            </button>

          </form>
        )}


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
              <p style={{ fontStyle: "italic", color: "#9ca3af" }}>
                Dernière mise à jour : {lastUpdate}
              </p>
            )}

            {/* Affichage des capteurs temps réel, si aucune session sélectionnée */}
            {!selectedSession && sensorData && (
              <div className="sensor-grid">
                {sensorData.map((capteur) => (
                  <div
                    key={capteur.capteur_id}
                    className="sensor-card"
                    onClick={() => setSelectedMetric(capteur.name)}
                    title={`Afficher historique ${capteur.name}`}
                  >
                    <div style={{ fontSize: "2rem" }}>
                      {capteur.name === "Température" && "🌡️"}
                      {capteur.name === "Humidité" && "💧"}
                      {capteur.name === "CO2" && "🟢"}
                    </div>
                    <div style={{ fontWeight: 600 }}>{capteur.name}</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                      {capteur.value} {capteur.unit}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Graphique historique du capteur sélectionné */}
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
                    scales: { y: { beginAtZero: true } },
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

            {/* 📦 Liste des sessions enregistrées (cliquables) */}
            {!selectedSession && savedSessions.length > 0 && (
              <div className="session-list">
                <h4 style={{ marginTop: "2rem" }}>📦 Sessions enregistrées</h4>
                {savedSessions.map((session, index) => (
                  <div
                    key={index}
                    className="session-item"
                    onClick={() => setSelectedSession(session)}
                    style={{ cursor: "pointer" }}
                    title="Cliquez pour voir les données enregistrées"
                  >
                    <h5>📝 {session.nom}</h5>
                    <p><strong>Description :</strong> {session.description}</p>
                    <p><strong>Utilisateur :</strong> {session.utilisateur}</p>
                    <p><strong>Date :</strong> {session.date}</p>
                    {/* Pour alléger la liste, on enlève les valeurs détaillées ici */}
                  </div>
                ))}
              </div>
            )}

            {/* Affichage des graphiques pour la session sélectionnée */}
            {selectedSession && (
              <div className="chart-container">
                <h4 style={{ textAlign: "center", marginBottom: 10 }}>
                  📊 Données enregistrées : <strong>{selectedSession.nom}</strong>
                </h4>

                {[...new Set(selectedSession.donnees.map((d) => d.name))].map(
                  (capteurName) => {
                    const donneesFiltrees = selectedSession.donnees.filter(
                      (d) => d.name === capteurName
                    );
                    return (
                      <div key={capteurName} style={{ marginBottom: "2rem" }}>
                        <h5>{capteurName}</h5>
                        <Line
                          data={{
                            labels: donneesFiltrees.map((d) =>
                              new Date(d.timestamp).toLocaleTimeString()
                            ),
                            datasets: [
                              {
                                label: capteurName,
                                data: donneesFiltrees.map((d) => d.value),
                                borderColor: "rgb(153, 102, 255)",
                                backgroundColor: "rgba(153, 102, 255, 0.2)",
                                fill: true,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { position: "top" },
                            },
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      </div>
                    );
                  }
                )}

                <button
                  className="button button-secondary"
                  onClick={() => setSelectedSession(null)}
                  style={{ marginTop: "1rem" }}
                >
                  🔙 Retour aux sessions
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
