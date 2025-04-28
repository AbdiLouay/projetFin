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

    const getColorByMetric = (name) => {
      switch (name) {
        case "Température":
          return "#f97316"; // orange
        case "Humidité":
          return "#0ea5e9"; // bleu
        case "CO2":
          return "#10b981"; // vert
        default:
          return "#3b82f6"; // bleu par défaut
      }
    };
    

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
      setHistory((prev) =>
        [...prev, ...newHistory].slice(-20)
      );
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
  }, [isLoggedIn]);

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
  };

  return (
    <div className={`container ${theme}`}>
      <div className="box">
      <div className="navbar">
        <h2>🌬️ VMC UFA</h2>
        <div>
        <div className="topbar-buttons">
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="theme-toggle">
          {theme === "dark" ? "🌞" : "🌙"}
        </button>
      </div>
      {isLoggedIn && (
        <button onClick={handleLogout} className="logout-fab fixed-top-right" title="Déconnexion">
          🚪
        </button>
      )}

        </div>
      </div>

        {message && <p className="message">{message}</p>}

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

            {lastUpdate && (
              <p style={{ fontStyle: "italic", marginBottom: "1rem", color: "#9ca3af" }}>
                Dernière mise à jour : {lastUpdate}
              </p>
            )}

            {sensorData ? (
              <div className="sensor-grid">
              {sensorData.map((capteur) => (
                <div
                  key={capteur.capteur_id}
                  className="sensor-card"
                  data-unit={capteur.unit}
                  onClick={() => setSelectedMetric(capteur.name)}
                >
                  <div style={{ fontSize: "2rem" }}>
                    {capteur.name === "Température" && "🌡️"}
                    {capteur.name === "Humidité" && "💧"}
                    {capteur.name === "CO2" && "🟢"}
                  </div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{capteur.name}</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {capteur.value} {capteur.unit}
                  </div>
                </div>
              ))}
            </div>            
            ) : (
              <p>Chargement des données...</p>
            )}

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
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59, 130, 246, 0.2)",
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: "#fff",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 500 },
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: "#333", titleColor: "#fff" },
                    },
                    scales: {
                      x: { ticks: { color: "#fff" } },
                      y: { ticks: { color: "#fff" }, suggestedMin: 0 },
                    },
                  }}
                />
                <button
                  onClick={() => setSelectedMetric(null)}
                  className="button button-danger"
                  style={{ marginTop: "10px" }}
                >
                  Fermer
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
