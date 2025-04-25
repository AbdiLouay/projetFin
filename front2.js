import React, { useState, useEffect } from "react";
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';


// Enregistre les composants de Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sensorData, setSensorData] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState(null);


  console.log("Historique des valeurs :", history);


  const API_URL = "http://192.168.65.227:3000/api";


  // Fonction pour récupérer le token depuis les cookies
  const getTokenFromCookies = () => {
    const match = document.cookie.match(/(^| )token=([^;]+)/);
    return match ? match[2] : null;
  };


  // Fonction pour récupérer les données du capteur
  const fetchSensorData = async () => {
    const token = getTokenFromCookies();
    console.log("Token récupéré depuis les cookies:", token);
  
    // Vérification si un token est présent
    if (!token) {
      setMessage("⚠️ Vous devez être connecté pour voir les données.");
      console.log("Token manquant dans la requête.");
      return;
    }
  
    try {
      // Envoi de la requête à l'API pour récupérer les données des capteurs
      const response = await fetch(`${API_URL}/capteurs`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
  
      console.log("Requête envoyée:", {
        url: `${API_URL}/capteurs`,
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });
  
      // Vérification de la réponse de l'API
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }
  
      // Conversion de la réponse en JSON
      const data = await response.json();
  
      // Vérification que les données sont valides
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Les données reçues sont invalides ou vides");
      }
  
      // Ajouter les données au nouvel historique
      const newHistory = data.map(capteur => ({
        timestamp: new Date().toLocaleTimeString(), // Ajouter un horodatage
        capteur_id: capteur.capteur_id,
        name: capteur.name,
        unit: capteur.unit,
        value: parseFloat(capteur.value) || 0, // Convertir en nombre, sinon 0 si impossible
      }));
  
      // Mettre à jour l'état des données du capteur et de l'historique
      setSensorData(data);
      setHistory(prev => {
        const updatedHistory = [...prev, ...newHistory];
        // Limiter l'historique à 20 éléments (max 20 dernières entrées)
        return updatedHistory.slice(-20);
      });
  
      console.log("Données des capteurs:", data);
    } catch (error) {
      setMessage("⚠️ Erreur de récupération des données du capteur.");
      console.error("Erreur de la requête:", error);
    }
  };
  
  useEffect(() => {
    let intervalId;
    // Si l'utilisateur est connecté, récupérer les données des capteurs
    if (isLoggedIn) {
      fetchSensorData();
      intervalId = setInterval(fetchSensorData, 30000); // Rafraîchir toutes les 30 secondes
    }
    return () => clearInterval(intervalId); // Nettoyer l'intervalle lorsque le composant est démonté
  }, [isLoggedIn]);
  

  // Fonction pour gérer la connexion
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });


      const data = await response.json();
      console.log('Réponse serveur lors de la connexion:', data); // Afficher la réponse du serveur dans la console


      if (response.ok) {
        // Sauvegarder le token dans le cookie
        document.cookie = `token=${data.data.token}; path=/; max-age=3600`; // Cookie valable 1 heure (3600 secondes)
        setIsLoggedIn(true);
        setView("home");
      } else {
        setMessage(data.message || "❌ Identifiants incorrects !");
      }
    } catch (error) {
      setMessage("⚠️ Erreur de connexion au serveur.");
      console.error("Erreur de la connexion:", error);  // Affiche l'erreur dans la console pour débogage
    }
  };


  // Fonction pour gérer l'inscription
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });


      const data = await response.json();
      console.log('Réponse serveur lors de l\'inscription:', data); // Afficher la réponse du serveur dans la console


      if (response.ok) {
        setMessage("✅ Inscription réussie !");
        setTimeout(() => setView("login"), 1000);
      } else {
        setMessage(data.message || "⚠️ Erreur d'inscription.");
      }
    } catch (error) {
      setMessage("⚠️ Erreur de connexion au serveur.");
      console.error("Erreur lors de l'inscription:", error);  // Affiche l'erreur dans la console pour débogage
    }
  };


  // Fonction pour gérer la déconnexion
  const handleLogout = () => {
    // Supprimer le cookie lors de la déconnexion
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC"; // Expirer le cookie
    setIsLoggedIn(false);
    setView("login");
  };


  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#1f2937', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', color: '#fff' }}>
        <h2 style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '1.5rem' }}>🌬️ VMC UFA</h2>

        {message && <p style={{ color: '#f87171', textAlign: 'center', marginBottom: '1rem' }}>{message}</p>}

        {!isLoggedIn && (
          <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
            <input
              style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #4b5563', background: '#334155', color: '#e2e8f0' }}
              type="text"
              placeholder="Nom d'utilisateur"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
            <input
              style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #4b5563', background: '#334155', color: '#e2e8f0' }}
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', backgroundColor: view === 'login' ? '#3b82f6' : '#10b981', color: '#fff', border: 'none', marginBottom: '1rem' }}>
              {view === 'login' ? 'Se connecter' : "S'inscrire"}
            </button>
            <button type="button" onClick={() => setView(view === 'login' ? 'register' : 'login')} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', backgroundColor: '#4b5563', color: '#fff' }}>
              {view === 'login' ? 'Créer un compte' : 'Retour à la connexion'}
            </button>
          </form>
        )}

        {isLoggedIn && view === "home" && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Bienvenue, {login} !</h3>
            <div style={{ marginBottom: '1rem' }}>
              <h4>Données du capteur :</h4>
              {sensorData ? (
                <ul style={{ listStyle: 'none', padding: 0, lineHeight: '1.6' }}>
                  {sensorData.map((capteur) => (
                    <li key={capteur.capteur_id} onClick={() => setSelectedMetric(capteur.name)}>
                      {capteur.name}: {capteur.value} {capteur.unit}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Chargement des données...</p>
              )}
            </div>

            {selectedMetric && history.length > 0 && (
              <div style={{ width: '400px', height: '250px', margin: '20px auto', backgroundColor: '#1f2937', borderRadius: 10, padding: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', color: '#fff' }}>
                <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>📊 Évolution de {selectedMetric}</h4>

                <Line
                  data={{
                    labels: history.map((point) => point.timestamp),
                    datasets: [
                      {
                        label: selectedMetric,
                        data: history.map((point) => point.value),  // Utiliser `value` pour le graphique
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#fff',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 500 }, // Animation fluide
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: '#333', titleColor: '#fff' },
                    },
                    scales: {
                      x: { ticks: { color: "#fff" } },
                      y: { ticks: { color: "#fff" }, suggestedMin: 0 },
                    },
                  }}
                />
                <button onClick={() => setSelectedMetric(null)} style={{ width: '100%', padding: '8px', borderRadius: '8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', marginTop: '10px' }}>
                  ❌ Fermer
                </button>
              </div>
            )}

            <button style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', backgroundColor: '#ef4444', color: '#fff', border: 'none' }} onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


export default App;