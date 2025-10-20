// server.js - Backend API avec Aternos
const express = require('express');
const cors = require('cors');
const { Client } = require('aternos-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration Aternos (À MODIFIER avec tes identifiants)
const ATERNOS_USERNAME = process.env.ATERNOS_USERNAME || 'TON_EMAIL_ATERNOS';
const ATERNOS_PASSWORD = process.env.ATERNOS_PASSWORD || 'TON_MOT_DE_PASSE';

// Client Aternos
let aternosClient = null;
let aternosServers = new Map(); // Map<serverId, aternosServerObject>
let isConnected = false;

// Initialiser la connexion Aternos au démarrage
async function initAternos() {
    try {
        console.log('🔄 Connexion à Aternos...');
        aternosClient = new Client();
        await aternosClient.login(ATERNOS_USERNAME, ATERNOS_PASSWORD);
        isConnected = true;
        console.log('✅ Connecté à Aternos !');
        
        // Récupérer les serveurs existants
        await refreshServerList();
    } catch (error) {
        console.error('❌ Erreur connexion Aternos:', error.message);
        isConnected = false;
    }
}

// Rafraîchir la liste des serveurs depuis Aternos
async function refreshServerList() {
    if (!isConnected || !aternosClient) return;
    
    try {
        const servers = await aternosClient.getServers();
        aternosServers.clear();
        
        for (const server of servers) {
            aternosServers.set(server.id, server);
        }
        
        console.log(`✅ ${aternosServers.size} serveur(s) Aternos chargé(s)`);
    } catch (error) {
        console.error('❌ Erreur récupération serveurs:', error.message);
    }
}

// Convertir un serveur Aternos en format API
function formatAternosServer(aternosServer, serverId) {
    const status = aternosServer.status || 'offline'; // 'online', 'offline', 'starting', 'stopping'
    const isOnline = status === 'online';
    
    // Récupérer les infos
    const currentPlayers = aternosServer.playersCurrent || 0;
    const maxPlayers = aternosServer.playersMax || 20;
    const version = aternosServer.software?.version || 'Unknown';
    const softwareName = aternosServer.software?.name?.toLowerCase() || 'vanilla';
    
    // Mapper le type de software
    let type = 'vanilla';
    if (softwareName.includes('paper')) type = 'paper';
    else if (softwareName.includes('spigot')) type = 'spigot';
    else if (softwareName.includes('forge')) type = 'forge';
    else if (softwareName.includes('fabric')) type = 'fabric';
    
    // RAM réaliste
    let baseRam = 0.5;
    if (type === 'forge') baseRam = 1.2;
    else if (type === 'fabric') baseRam = 0.8;
    else if (type === 'paper' || type === 'spigot') baseRam = 0.6;
    
    const ramUsage = isOnline ? parseFloat((baseRam + currentPlayers * 0.15).toFixed(1)) : 0;
    const ramPercent = isOnline ? Math.round((ramUsage / 2) * 100) : 0; // Aternos = 2GB
    
    // CPU réaliste
    let cpuUsage = 0;
    if (isOnline) {
        if (type === 'forge') cpuUsage = Math.floor(Math.random() * 250) + 150; // 150-400%
        else if (type === 'fabric') cpuUsage = Math.floor(Math.random() * 80) + 30; // 30-110%
        else cpuUsage = Math.floor(Math.random() * 50) + 20; // 20-70%
    }
    
    // Uptime
    let uptime = 0;
    if (isOnline && aternosServer.startedAt) {
        const now = new Date();
        const started = new Date(aternosServer.startedAt);
        uptime = Math.floor((now - started) / 1000);
    } else if (isOnline) {
        uptime = Math.floor(Math.random() * 3600); // Simulation si pas d'info
    }
    
    return {
        id: serverId,
        name: aternosServer.displayName || aternosServer.id,
        version: version,
        type: type,
        modloader: type === 'forge' ? `forge-${version}` : null,
        gamemode: 'survival',
        plan: 'Aternos Free',
        ram: 2, // Aternos gratuit = 2GB
        cpuLimit: 100, // Simulation 100% = 1 coeur
        maxPlayers: maxPlayers,
        currentPlayers: currentPlayers,
        status: status,
        ip: aternosServer.ip || `${aternosServer.id}.aternos.me`,
        port: aternosServer.port || 25565,
        description: aternosServer.motd || '',
        storage: 4, // Aternos ~ 4GB
        createdAt: new Date().toISOString(),
        startedAt: aternosServer.startedAt || null,
        uptime: uptime,
        cpuUsage: cpuUsage,
        cpuPercent: cpuUsage,
        ramUsage: ramUsage,
        ramPercent: ramPercent,
        uptimeFormatted: formatUptime(uptime)
    };
}

// ============================================
// ROUTES API
// ============================================

// Santé de l'API
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API Aternos fonctionnelle',
        connected: isConnected,
        serversCount: aternosServers.size,
        timestamp: new Date().toISOString()
    });
});

// Créer un serveur (assigne un serveur Aternos pré-créé)
app.post('/api/servers/create', async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                message: 'Non connecté à Aternos'
            });
        }
        
        await refreshServerList();
        
        // Vérifier si des serveurs sont disponibles
        if (aternosServers.size === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun serveur Aternos disponible. Créez-en un sur aternos.org d\'abord !',
                info: 'Vous devez créer au moins 1 serveur sur aternos.org pour pouvoir l\'utiliser.'
            });
        }
        
        // Récupérer le premier serveur disponible
        const firstServer = Array.from(aternosServers.values())[0];
        const formattedServer = formatAternosServer(firstServer, '1');
        
        res.json({
            success: true,
            message: 'Serveur assigné avec succès ! Vous pouvez maintenant le démarrer.',
            server: formattedServer,
            info: 'Ce serveur était pré-créé sur Aternos. Vous pouvez le configurer et le démarrer !'
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
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                message: 'Non connecté à Aternos',
                servers: []
            });
        }
        
        await refreshServerList();
        
        const servers = [];
        let index = 1;
        for (const [serverId, aternosServer] of aternosServers) {
            servers.push(formatAternosServer(aternosServer, index.toString()));
            index++;
        }
        
        res.json({
            success: true,
            servers: servers
        });
    } catch (error) {
        console.error('Erreur récupération serveurs:', error);
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
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                message: 'Non connecté à Aternos'
            });
        }
        
        await refreshServerList();
        
        const serverIndex = parseInt(req.params.id) - 1;
        const serverArray = Array.from(aternosServers.values());
        
        if (serverIndex < 0 || serverIndex >= serverArray.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const aternosServer = serverArray[serverIndex];
        const server = formatAternosServer(aternosServer, req.params.id);
        
        res.json({
            success: true,
            server: server
        });
    } catch (error) {
        console.error('Erreur récupération serveur:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Démarrer un serveur
app.post('/api/servers/:id/start', async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                message: 'Non connecté à Aternos'
            });
        }
        
        const serverIndex = parseInt(req.params.id) - 1;
        const serverArray = Array.from(aternosServers.values());
        
        if (serverIndex < 0 || serverIndex >= serverArray.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const aternosServer = serverArray[serverIndex];
        
        // Vérifier si déjà en ligne
        await aternosServer.refresh();
        if (aternosServer.status === 'online') {
            return res.json({
                success: false,
                message: 'Le serveur est déjà en ligne'
            });
        }
        
        // Démarrer le serveur via Aternos API
        console.log(`🚀 Démarrage du serveur ${aternosServer.displayName}...`);
        await aternosServer.start();
        
        res.json({
            success: true,
            message: 'Serveur en cours de démarrage (peut prendre 3-5 minutes)',
            server: formatAternosServer(aternosServer, req.params.id)
        });
    } catch (error) {
        console.error('Erreur démarrage serveur:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Arrêter un serveur
app.post('/api/servers/:id/stop', async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                message: 'Non connecté à Aternos'
            });
        }
        
        const serverIndex = parseInt(req.params.id) - 1;
        const serverArray = Array.from(aternosServers.values());
        
        if (serverIndex < 0 || serverIndex >= serverArray.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const aternosServer = serverArray[serverIndex];
        
        // Vérifier si déjà hors ligne
        await aternosServer.refresh();
        if (aternosServer.status === 'offline') {
            return res.json({
                success: false,
                message: 'Le serveur est déjà arrêté'
            });
        }
        
        // Arrêter le serveur via Aternos API
        console.log(`🛑 Arrêt du serveur ${aternosServer.displayName}...`);
        await aternosServer.stop();
        
        res.json({
            success: true,
            message: 'Serveur arrêté',
            server: formatAternosServer(aternosServer, req.params.id)
        });
    } catch (error) {
        console.error('Erreur arrêt serveur:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Redémarrer un serveur
app.post('/api/servers/:id/restart', async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                message: 'Non connecté à Aternos'
            });
        }
        
        const serverIndex = parseInt(req.params.id) - 1;
        const serverArray = Array.from(aternosServers.values());
        
        if (serverIndex < 0 || serverIndex >= serverArray.length) {
            return res.status(404).json({
                success: false,
                message: 'Serveur non trouvé'
            });
        }
        
        const aternosServer = serverArray[serverIndex];
        
        console.log(`🔄 Redémarrage du serveur ${aternosServer.displayName}...`);
        await aternosServer.restart();
        
        res.json({
            success: true,
            message: 'Serveur en cours de redémarrage',
            server: formatAternosServer(aternosServer, req.params.id)
        });
    } catch (error) {
        console.error('Erreur redémarrage serveur:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Vérifier le statut d'un serveur (pour la page publique)
app.get('/api/status/:serverIp', async (req, res) => {
    try {
        if (!isConnected) {
            return res.json({
                status: 'offline',
                message: 'Service non disponible'
            });
        }
        
        const serverIp = decodeURIComponent(req.params.serverIp);
        
        // Trouver le serveur par IP
        let foundServer = null;
        for (const aternosServer of aternosServers.values()) {
            const ip = aternosServer.ip || `${aternosServer.id}.aternos.me`;
            if (ip === serverIp) {
                foundServer = aternosServer;
                break;
            }
        }
        
        if (!foundServer) {
            return res.json({
                status: 'offline',
                message: 'Serveur non trouvé'
            });
        }
        
        await foundServer.refresh();
        
        if (foundServer.status === 'online') {
            res.json({
                status: 'online',
                server: {
                    name: foundServer.displayName,
                    version: foundServer.software?.version || 'Unknown',
                    currentPlayers: foundServer.playersCurrent || 0,
                    maxPlayers: foundServer.playersMax || 20,
                    description: foundServer.motd || '',
                    ping: Math.floor(Math.random() * 50) + 10
                }
            });
        } else if (foundServer.status === 'starting') {
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

// Rafraîchir automatiquement les serveurs toutes les 30 secondes
setInterval(async () => {
    if (isConnected) {
        await refreshServerList();
    }
}, 30000);

// Démarrage du serveur
app.listen(PORT, async () => {
    console.log(`✅ Serveur API démarré sur le port ${PORT}`);
    console.log(`🔄 Initialisation de la connexion Aternos...`);
    await initAternos();
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non gérée:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promesse rejetée:', error);
});
