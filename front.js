import React, { useState, useEffect } from "react";

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState("login"); // Affichage de l'écran login ou home
  const [login, setLogin] = useState(""); // Nom d'utilisateur
  const [password, setPassword] = useState(""); // Mot de passe
  const [message, setMessage] = useState(""); // Messages d'erreur ou de succès
  const [sensorData, setSensorData] = useState(null); // Données du capteur
  const [loading, setLoading] = useState(false); // Pour afficher l'état de chargement
  const API_URL = "http://192.168.65.227:3000/api"; // URL de votre API

  // Fonction pour récupérer un cookie spécifique par son nom
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`); 
    if (parts.length === 2) return parts.pop().split(';').shift();
  };

  // Fonction pour récupérer les données du capteur
  const fetchSensorData = async () => {
    setLoading(true); // Commence le chargement
    try {
      const response = await fetch(`${API_URL}/capteur`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Cela envoie automatiquement les cookies (incluant le token)
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la récupération des données du capteur.");
      }

      const data = await response.json();
      setSensorData(data); // Met à jour l'état avec les données récupérées
    } catch (error) {
      setMessage("⚠️ Erreur de récupération des données du capteur.");
    } finally {
      setLoading(false); // Arrête le chargement
    }
  };

  // useEffect pour récupérer les données du capteur toutes les 5 secondes si l'utilisateur est connecté
  useEffect(() => {
    let intervalId;
    if (isLoggedIn) {
      fetchSensorData();
      intervalId = setInterval(fetchSensorData, 5000); // Récupération des données toutes les 5 secondes
    }
    return () => clearInterval(intervalId); // Nettoyage lors du démantèlement du composant
  }, [isLoggedIn]);

  // Fonction de gestion de la connexion
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
        // Sauvegarde du token dans le cookie sécurisé
        document.cookie = `token=${data.token}; path=/; secure; HttpOnly; SameSite=Strict`; 
        setIsLoggedIn(true);
        setView("home");
      } else {
        setMessage(data.message || "❌ Identifiants incorrects !");
      }
    } catch (error) {
      setMessage("⚠️ Erreur de connexion au serveur.");
    }
  };

  // Fonction de gestion de l'inscription
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

  // Fonction de gestion de la déconnexion
  const handleLogout = () => {
    setIsLoggedIn(false);
    setView("login");
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;"; // Supprime le token
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#1f2937",
          padding: "2rem",
          borderRadius: "12px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
          color: "#fff",
        }}
      >
        <h2
          style={{
            fontSize: "1.8rem",
            textAlign: "center",
            marginBottom: "1.5rem",
          }}
        >
          🌬️ VMC Pro Platform
        </h2>

        {message && (
          <p style={{ color: "#f87171", textAlign: "center", marginBottom: "1rem" }}>
            {message}
          </p>
        )}

        {!isLoggedIn && (
          <form onSubmit={view === "login" ? handleLogin : handleRegister}>
            <input
              style={{
                width: "100%",
                padding: "0.8rem",
                marginBottom: "1rem",
                borderRadius: "8px",
                border: "1px solid #4b5563",
                background: "#334155",
                color: "#e2e8f0",
              }}
              type="text"
              placeholder="Nom d'utilisateur"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
            <input
              style={{
                width: "100%",
                padding: "0.8rem",
                marginBottom: "1rem",
                borderRadius: "8px",
                border: "1px solid #4b5563",
                background: "#334155",
                color: "#e2e8f0",
              }}
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              style={{
                width: "100%",
                padding: "0.8rem",
                borderRadius: "8px",
                backgroundColor: view === "login" ? "#3b82f6" : "#10b981",
                color: "#fff",
                border: "none",
                marginBottom: "1rem",
              }}
            >
              {view === "login" ? "Se connecter" : "S'inscrire"}
            </button>
            <button
              type="button"
              onClick={() => setView(view === "login" ? "register" : "login")}
              style={{
                width: "100%",
                padding: "0.8rem",
                borderRadius: "8px",
                backgroundColor: "#4b5563",
                color: "#fff",
              }}
            >
              {view === "login" ? "Créer un compte" : "Retour à la connexion"}
            </button>
          </form>
        )}

        {isLoggedIn && view === "home" && (
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
              Bienvenue, {login} !
            </h3>
            <div style={{ marginBottom: "1rem" }}>
              <h4>Données du capteur :</h4>
              {loading ? (
                <p>Chargement des données...</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, lineHeight: "1.6" }}>
                  {sensorData ? (
                    <>
                      <li>🌡️ Température: {sensorData.valeurs.temperature} °C</li>
                      <li>💧 Humidité: {sensorData.valeurs.humidite} %</li>
                      <li>⚡ Pression: {sensorData.valeurs.pression} hPa</li>
                      <li>⏰ Heure: {sensorData.timestamp}</li>
                    </>
                  ) : (
                    <p>Les données sont introuvables...</p>
                  )}
                </ul>
              )}
            </div>
            <button
              style={{
                width: "100%",
                padding: "0.8rem",
                borderRadius: "8px",
                backgroundColor: "#ef4444",
                color: "#fff",
                border: "none",
              }}
              onClick={handleLogout}
            >
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
