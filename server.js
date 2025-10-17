// server.js - Backend API pour hébergement Minecraft
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Base de données simulée (en mémoire)
let servers = [
  {
    id: '1',
    name: 'Mon Serveur Survie',
    version: '1.21',
    type: 'paper',
    plan: 'super',
    ram: '8',
    maxPlayers: 50,
    currentPlayers: 32,
    status: 'online',
    ip: 'play.mccloud.fr:25565',
    port: 25565,
    description: 'Serveur survie communautaire',
    createdAt: new Date().toISOString()
  }
];

let serverIdCounter = 2;

// Routes API

// GET - Test de santé de l'API
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API fonctionnelle',
    timestamp: new Date().toISOString()
  });
});

// GET - Récupérer tous les serveurs
app.get('/api/servers', (req, res) => {
  res.json({
    success: true,
    servers: servers
  });
});

// GET - Récupérer un serveur spécifique
app.get('/api/servers/:id', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  
  if (!server) {
    return res.status(404).json({
      success: false,
      message: 'Serveur non trouvé'
    });
  }
  
  res.json({
    success: true,
    server: server
  });
});

// POST - Créer un nouveau serveur
app.post('/api/servers/create', (req, res) => {
  try {
    const { 
      name, 
      version, 
      serverType, 
      modloaderVersion,
      gamemode, 
      plan, 
      description 
    } = req.body;

    // Validation
    if (!name || !version || !serverType || !plan) {
      return res.status(400).json({
        success: false,
        message: 'Données manquantes (nom, version, type, plan requis)'
      });
    }

    // Configuration selon le plan
    const ramMap = {
      'Basique': '4',
      'Super': '8',
      'Gamer': '16'
    };

    const maxPlayersMap = {
      'Basique': 20,
      'Super': 50,
      'Gamer': 100
    };

    // Générer un port unique
    const port = 25565 + servers.length;

    // Créer le nouveau serveur
    const newServer = {
      id: String(serverIdCounter++),
      name: name,
      version: version,
      type: serverType,
      modloader: modloaderVersion || null,
      gamemode: gamemode || 'survival',
      plan: plan,
      ram: ramMap[plan] || '4',
      maxPlayers: maxPlayersMap[plan] || 20,
      currentPlayers: 0,
      status: 'starting',
      ip: `mc-${serverIdCounter}.mccloud.fr:${port}`,
      port: port,
      description: description || '',
      createdAt: new Date().toISOString()
    };

    // Ajouter à la base de données
    servers.push(newServer);

    // Log de création
    console.log(`🚀 Serveur créé: ${name}`);
    console.log(`   Version: ${version}`);
    console.log(`   Type: ${serverType}`);
    console.log(`   RAM: ${ramMap[plan]} GB`);
    console.log(`   Port: ${port}`);

    // Simuler le démarrage (5 secondes)
    setTimeout(() => {
      const server = servers.find(s => s.id === newServer.id);
      if (server) {
        server.status = 'online';
        console.log(`✅ Serveur ${name} en ligne!`);
      }
    }, 5000);

    res.json({
      success: true,
      message: 'Serveur créé avec succès',
      server: newServer
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// POST - Démarrer un serveur
app.post('/api/servers/:id/start', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  
  if (!server) {
    return res.status(404).json({
      success: false,
      message: 'Serveur non trouvé'
    });
  }

  if (server.status === 'online') {
    return res.json({
      success: false,
      message: 'Le serveur est déjà en ligne'
    });
  }

  server.status = 'starting';
  
  setTimeout(() => {
    server.status = 'online';
    console.log(`✅ Serveur ${server.name} démarré`);
  }, 3000);

  res.json({
    success: true,
    message: 'Serveur en cours de démarrage',
    server: server
  });
});

// POST - Arrêter un serveur
app.post('/api/servers/:id/stop', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  
  if (!server) {
    return res.status(404).json({
      success: false,
      message: 'Serveur non trouvé'
    });
  }

  if (server.status === 'offline') {
    return res.json({
      success: false,
      message: 'Le serveur est déjà hors ligne'
    });
  }

  server.status = 'offline';
  server.currentPlayers = 0;
  
  console.log(`🛑 Serveur ${server.name} arrêté`);

  res.json({
    success: true,
    message: 'Serveur arrêté',
    server: server
  });
});

// DELETE - Supprimer un serveur
app.delete('/api/servers/:id', (req, res) => {
  const serverIndex = servers.findIndex(s => s.id === req.params.id);
  
  if (serverIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Serveur non trouvé'
    });
  }

  const server = servers[serverIndex];
  servers.splice(serverIndex, 1);
  
  console.log(`🗑️ Serveur ${server.name} supprimé`);

  res.json({
    success: true,
    message: 'Serveur supprimé avec succès'
  });
});

// GET - Vérifier le statut d'un serveur par IP
app.get('/api/status/:ip', (req, res) => {
  const ip = req.params.ip;
  const server = servers.find(s => s.ip === ip);
  
  if (!server) {
    return res.json({
      success: true,
      status: 'offline',
      ip: ip
    });
  }

  res.json({
    success: true,
    status: server.status,
    server: {
      name: server.name,
      version: server.version,
      currentPlayers: server.currentPlayers,
      maxPlayers: server.maxPlayers,
      description: server.description,
      ip: server.ip,
      ping: Math.floor(Math.random() * 100) + 20
    }
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Backend API démarré sur le port ${PORT}`);
  console.log(`📡 Endpoints disponibles:`);
  console.log(`   GET    /api/health`);
  console.log(`   GET    /api/servers`);
  console.log(`   GET    /api/servers/:id`);
  console.log(`   POST   /api/servers/create`);
  console.log(`   POST   /api/servers/:id/start`);
  console.log(`   POST   /api/servers/:id/stop`);
  console.log(`   DELETE /api/servers/:id`);
  console.log(`   GET    /api/status/:ip`);
  console.log(``);
  console.log(`✅ Serveur prêt!`);
});
