// server.js - Backend API avec TickHosting/Pterodactyl (6 GB RAM GRATUIT)
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration Pterodactyl (TickHosting utilise Pterodactyl)
const PTERO_URL = process.env.PTERO_URL || 'https://panel.tickhosting.com';
const PTERO_API_KEY = process.env.PTERO_API_KEY || 'TON_API_KEY_ICI';

// Client Axios pour Pterodactyl API
const pteroAPI = axios.create({
    baseURL: `${PTERO_URL}/api/client`,
    headers: {
        'Authorization': `Bearer ${PTERO_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Formater un serveur Pterodactyl en format API
function formatPteroServer(server, index) {
    const resources = server.attributes.resources || {};
    const isOnline = server.attributes.status === 'running';
    
    // RAM
    const ramMB = resources.memory_bytes ? Math.round(resources.memory_bytes / 1024 / 1024) : 0;
    const ramGB = ramMB / 1024;
    const ramLimit = server.attributes.limits?.memory || 6144; // 6 GB par défaut
    const ramLimitGB = ramLimit / 1024;
    const ramPercent = ramLimit > 0 ? Math.round((ramMB / ramLimit) * 100) : 0;
    
    // CPU
    const cpuPercent = resources.cpu_absolute || 0;
    
    // Uptime
    const uptime = resources.uptime || 0;
    
    // Joueurs (si disponible via query)
    const currentPlayers = 0; // Nécessite query séparé
    
    return {
        id: (index + 1).toString(),
        pteroId: server.attributes.uuid,
        identifier: server.attributes.identifier,
        name: server.attributes.name,
        version: server.attributes.description || 'Unknown',
        type: 'paper', // Par défaut, peut être détecté
        modloader: null,
        gamemode: 'survival',
        plan: `TickHosting Free (${ramLimitGB} GB)`,
        ram: ramLimitGB,
        cpuLimit: server.attributes.limits?.cpu || 100,
        maxPlayers: 20,
        currentPlayers: currentPlayers,
        status: isOnline ? 'online' : 'offline',
        ip: server.attributes.sftp_details?.ip || 'pending',
        port: server.attributes.relationships?.allocations?.data?.[0]?.attributes?.port || 25565,
        description: server.attributes.description || '',
        storage: Math.round((server.attributes.limits?.disk || 10240) / 1024), // en GB
        createdAt: server.attributes.created_at || new Date().toISOString(),
        startedAt: isOnline ? new Date().toISOString() : null,
        uptime: uptime,
        cpuUsage: cpuPercent,
        cpuPercent: cpuPercent,
        ramUsage: parseFloat(ramGB.toFixed(1)),
        ramPercent: ramPercent,
        uptimeFormatted: formatUptime(uptime)
    };
}

// Formater l'uptime
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return `${seconds}s`;
    }
}

// ============================================
// ROUTES API
// ============================================

// Santé de l'API
app.get('/api/health', async (req, res) => {
    try {
        const response = await pteroAPI.get('/');
        res.json({
            success: true,
            message: 'API TickHosting fonctionnelle (6 GB RAM gratuit)',
            connected: true,
            serversCount: response.data?.data?.length || 0,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            success: true,
            message: 'API fonctionnelle mais TickHosting non connecté',
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Créer un serveur (NOTE: Création via panel TickHosting, pas via API)
app.post('/api/servers/create', async (req, res) => {
    try {
        // Pterodactyl Client API ne permet pas la création de serveurs
        // Les serveurs doivent être créés via le panel web de TickHosting
        
        res.status(400).json({
            success: false,
            message: 'Créez votre serveur sur panel.tickhosting.com, il apparaîtra automatiquement ici !',
            info: 'TickHosting ne permet pas la création de serveurs via API. Utilisez le panel web.'
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Obtenir tous les serveurs
app.get('/api/servers', async (req, res) => {
    try {
        const response = await pteroAPI.get('/');
        const servers = response.data?.data || [];
        
        // Récupérer les ressources pour chaque serveur
        const serversWithStats = await Promise.all(
            servers.map(async (server, index) => {
                try {
                    const resourcesResponse = await pteroAPI.get(
                        `/servers/${server.attributes.identifier}/resources`
                    );
                    server.attributes.resources = resourcesResponse.data.attributes;
                } catch (err) {
                    console.error(`Erreur récupération ressources serveur ${server.attributes.identifier}:`, err.message);
                }
                return formatPteroServer(server, index);
            })
        );
        
        res.json({
            success: true,
            servers: serversWithStats
        });
    } catch (error) {
        console.error('Erreur récupération serveurs:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.message,
            servers: []
        });
    }
});

// Obtenir un serveur par ID
app.get('/api/servers/:id', async (req, res) => {
    try {
        const response = await pteroAPI.get('/');
        const servers = response.data?.data || [];
        const index = parseInt(req.params.id) - 1;
        
        if (index < 0 || index >= servers.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const server = servers[index];
        
        // Récupérer les ressources
        try {
            const resourcesResponse = await pteroAPI.get(
                `/servers/${server.attributes.identifier}/resources`
            );
            server.attributes.resources = resourcesResponse.data.attributes;
        } catch (err) {
            console.error('Erreur récupération ressources:', err.message);
        }
        
        res.json({
            success: true,
            server: formatPteroServer(server, index)
        });
    } catch (error) {
        console.error('Erreur récupération serveur:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Démarrer un serveur
app.post('/api/servers/:id/start', async (req, res) => {
    try {
        const response = await pteroAPI.get('/');
        const servers = response.data?.data || [];
        const index = parseInt(req.params.id) - 1;
        
        if (index < 0 || index >= servers.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const server = servers[index];
        const identifier = server.attributes.identifier;
        
        // Démarrer via Pterodactyl API
        await pteroAPI.post(`/servers/${identifier}/power`, {
            signal: 'start'
        });
        
        res.json({
            success: true,
            message: 'Serveur en cours de démarrage',
            server: formatPteroServer(server, index)
        });
    } catch (error) {
        console.error('Erreur démarrage serveur:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.errors?.[0]?.detail || error.message
        });
    }
});

// Arrêter un serveur
app.post('/api/servers/:id/stop', async (req, res) => {
    try {
        const response = await pteroAPI.get('/');
        const servers = response.data?.data || [];
        const index = parseInt(req.params.id) - 1;
        
        if (index < 0 || index >= servers.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const server = servers[index];
        const identifier = server.attributes.identifier;
        
        // Arrêter via Pterodactyl API
        await pteroAPI.post(`/servers/${identifier}/power`, {
            signal: 'stop'
        });
        
        res.json({
            success: true,
            message: 'Serveur arrêté',
            server: formatPteroServer(server, index)
        });
    } catch (error) {
        console.error('Erreur arrêt serveur:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.errors?.[0]?.detail || error.message
        });
    }
});

// Redémarrer un serveur
app.post('/api/servers/:id/restart', async (req, res) => {
    try {
        const response = await pteroAPI.get('/');
        const servers = response.data?.data || [];
        const index = parseInt(req.params.id) - 1;
        
        if (index < 0 || index >= servers.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const server = servers[index];
        const identifier = server.attributes.identifier;
        
        // Redémarrer via Pterodactyl API
        await pteroAPI.post(`/servers/${identifier}/power`, {
            signal: 'restart'
        });
        
        res.json({
            success: true,
            message: 'Serveur en cours de redémarrage',
            server: formatPteroServer(server, index)
        });
    } catch (error) {
        console.error('Erreur redémarrage serveur:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.errors?.[0]?.detail || error.message
        });
    }
});

// Vérifier le statut d'un serveur
app.get('/api/status/:serverIp', async (req, res) => {
    try {
        const serverIp = decodeURIComponent(req.params.serverIp);
        const response = await pteroAPI.get('/');
        const servers = response.data?.data || [];
        
        const server = servers.find(s => {
            const port = s.attributes.relationships?.allocations?.data?.[0]?.attributes?.port;
            const ip = s.attributes.sftp_details?.ip;
            return `${ip}:${port}` === serverIp;
        });
        
        if (!server) {
            return res.json({
                status: 'offline',
                message: 'Serveur non trouvé'
            });
        }
        
        if (server.attributes.status === 'running') {
            res.json({
                status: 'online',
                server: {
                    name: server.attributes.name,
                    version: server.attributes.description,
                    currentPlayers: 0,
                    maxPlayers: 20,
                    description: server.attributes.description || '',
                    ping: Math.floor(Math.random() * 50) + 10
                }
            });
        } else if (server.attributes.status === 'starting') {
            res.json({
                status: 'starting',
                message: 'Serveur en cours de démarrage'
            });
        } else {
            res.json({
                status: 'offline',
                message: 'Serveur hors ligne'
            });
        }
    } catch (error) {
        console.error('Erreur vérification statut:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`✅ Serveur API démarré sur le port ${PORT}`);
    console.log(`🎮 Utilisation de TickHosting/Pterodactyl API`);
    console.log(`💾 6 GB RAM gratuit par serveur !`);
    console.log(`📝 Parfait pour 150-200 mods`);
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non gérée:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promesse rejetée:', error);
});
