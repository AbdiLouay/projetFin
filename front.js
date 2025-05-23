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

const API_URL = "http://192.168.65.227:3000/api";

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sensorData, setSensorData] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedHistory, setRecordedHistory] = useState([]);
  const [userFilter, setUserFilter] = useState("");
  const [viewingGlobalHistory, setViewingGlobalHistory] = useState(null);

  useEffect(() => {
    const savedLogin = localStorage.getItem("login");
    if (savedLogin) setLogin(savedLogin);
  }, []);

  const getTokenFromCookies = () => {
    const match = document.cookie.match(/(^| )token=([^;]+)/);
    return match ? match[2] : null;
  };

  const fetchSensorData = async () => {
    const token = getTokenFromCookies();
    if (!token) {
      setMessage("❌ Vous devez être connecté.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/capteurs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Erreur récupération capteurs.");
        return;
      }

      const timestamp = Date.now();
      const entries = data.map((capteur) => ({
        timestamp,
        capteur_id: capteur.capteur_id,
        name: capteur.name,
        unit: capteur.unit,
        value: parseFloat(capteur.value) || 0,
      }));

      setSensorData(data);
      setHistory((prev) => [...prev, ...entries].slice(-100));
      if (isRecording) setRecordedHistory((prev) => [...prev, ...entries]);
    } catch {
      setMessage("⚠️ Erreur serveur capteurs");
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (res.ok) {
        document.cookie = `token=${data.data.token}; path=/; max-age=3600`;
        localStorage.setItem("login", login);
        setIsLoggedIn(true);
        setView("home");
        setMessage("");
      } else {
        setMessage(data.message || "❌ Identifiants invalides.");
      }
    } catch {
      setMessage("⚠️ Erreur serveur.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLogin("");
    setPassword("");
    document.cookie = "token=; Max-Age=0; path=/;";
    localStorage.removeItem("login");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Inscription réussie !");
        setView("login");
      } else {
        setMessage(data.message || "❌ Erreur lors de l'inscription.");
      }
    } catch {
      setMessage("⚠️ Erreur serveur.");
    }
  };

  const handleSaveRecording = async () => {
    const name = prompt("Nom de l'enregistrement :");
    if (!name) return alert("❌ Vous devez entrer un nom.");
    const description = prompt("Description :");
    if (!description) return alert("❌ Vous devez entrer une description.");

    const date = new Date();
    const formattedDate = date.toISOString().slice(0, 19).replace("T", " ");

    const sessionToSend = {
      nom: name,
      description,
      date_debut: formattedDate,
      intervalle: 30,
    };

    const token = getTokenFromCookies();
    if (!token) return alert("❌ Token invalide ou manquant.");

    try {
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
          alert("Erreur lors de l’envoi : " + result.message);
        }
        return;
      }

      alert("✅ Session sauvegardée !");
    } catch {
      alert("❌ Erreur serveur ou réseau.");
    }

    const saved = {
      name,
      description,
      user: login,
      date: date.toLocaleString(),
      data: recordedHistory,
    };

    const existing = JSON.parse(localStorage.getItem("globalHistories") || "[]");
    localStorage.setItem("globalHistories", JSON.stringify([...existing, saved]));

    setIsRecording(false);
    setRecordedHistory([]);
  };

  const deleteRecording = (entry) => {
    const histories = JSON.parse(localStorage.getItem("globalHistories") || "[]");
    const updated = histories.filter((h) => h.name !== entry.name || h.date !== entry.date);
    localStorage.setItem("globalHistories", JSON.stringify(updated));
    setViewingGlobalHistory(null);
  };

  const getColorForMetric = (name) => {
    const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return `hsl(${hash % 360}, 70%, 50%)`;
  };

  const renderChart = (dataList, uniqueKey = "") => {
    const labels = Array.from(new Set(dataList.map((d) => d.timestamp)))
      .sort()
      .map((ts) =>
        new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      );

    const metrics = [...new Set(dataList.map((d) => d.name))];
    const datasets = metrics.map((metric) => ({
      label: metric,
      data: dataList.filter((d) => d.name === metric).map((d) => d.value),
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 2,
      borderColor: getColorForMetric(metric),
    }));

    return (
      <Line
        key={uniqueKey}
        data={{ labels, datasets }}
        options={{
          responsive: true,
          plugins: { legend: { display: true } },
        }}
      />
    );
  };

  const filteredHistories = (JSON.parse(localStorage.getItem("globalHistories") || "[]") || [])
    .filter((r) => (r.user || "").toLowerCase().includes(userFilter.toLowerCase()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className={`container ${theme}`}>
      <header className="navbar">
        <h2>🌬️ VMC UFA</h2>
        <div>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "🌞" : "🌙"}
          </button>
          {isLoggedIn && <button onClick={handleLogout}>🚪</button>}
        </div>
      </header>

      <main>
        {message && <p className="message">{message}</p>}

        {!isLoggedIn ? (
          <form onSubmit={view === "login" ? handleLogin : handleRegister} className="auth-form">
            <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Utilisateur" required />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              required
            />
            <button type="submit">{view === "login" ? "🔐 Connexion" : "📝 Inscription"}</button>
            <button type="button" onClick={() => setView(view === "login" ? "register" : "login")}>
              Changer mode
            </button>
          </form>
        ) : (
          <>
            <h3>👋 Bonjour {login}</h3>
            <button onClick={fetchSensorData}>🔄 Actualiser</button>
            <button onClick={() => setIsRecording(!isRecording)}>
              {isRecording ? "⏹️ Stop" : "▶️ Enregistrement"}
            </button>
            {isRecording && <button onClick={handleSaveRecording}>💾 Sauvegarder</button>}

            <input
              placeholder="🔍 Rechercher un utilisateur"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />

            <div className="sensor-grid">
              {sensorData.map((c) => (
                <div key={c.capteur_id} onClick={() => setSelectedMetric(c.name)} className="sensor-card">
                  <strong>{c.name}</strong>: {c.value} {c.unit}
                </div>
              ))}
            </div>

            {selectedMetric && (
              <div className="modal" onClick={() => setSelectedMetric(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h4>{selectedMetric}</h4>
                  {renderChart(history.filter((d) => d.name === selectedMetric), `live-${selectedMetric}`)}
                  <button onClick={() => setSelectedMetric(null)}>Fermer</button>
                </div>
              </div>
            )}

            <h4>📦 Enregistrements complets</h4>
            {filteredHistories.map((entry, idx) => (
              <div key={idx} onClick={() => setViewingGlobalHistory(entry)} className="history-card">
                <strong>{entry.name}</strong> — {entry.user} ({entry.date})<br />
                <em>{entry.description || "Aucune description"}</em>
              </div>
            ))}

            {viewingGlobalHistory && (
              <div className="modal" onClick={() => setViewingGlobalHistory(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h4>{viewingGlobalHistory.name}</h4>
                  {renderChart(viewingGlobalHistory.data, `history-${viewingGlobalHistory.date}`)}
                  <button onClick={() => deleteRecording(viewingGlobalHistory)}>🗑️ Supprimer</button>
                  <button onClick={() => setViewingGlobalHistory(null)}>Fermer</button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
