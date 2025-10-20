// server.js - Backend API pour hébergement Minecraft avec système CPU
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Base de données simulée (en mémoire)
let serversDB = [];
let serverIdCounter = 1;

// Spécifications par plan
function getServerSpecs(plan) {
    const specs = {
        'Basique': { 
            ram: 4, 
            cpuLimit: 50,      // 50% = 0.5 cœur
            maxPlayers: 20,
            storage: 10        // 10 GB
        },
        'Super': { 
            ram: 8, 
            cpuLimit: 200,     // 200% = 2 cœurs
            maxPlayers: 50,
            storage: 25        // 25 GB
        },
        'Gamer': { 
            ram: 16, 
            cpuLimit: 400,     // 400% = 4 cœurs
            maxPlayers: 100,
            storage: 50        // 50 GB
        }
    };
    return specs[plan] || specs['Basique'];
}

// Générer une IP de serveur
function generateServerIP(id) {
    return {
        ip: `mc-${id}.mccloud.fr:${25565 + parseInt(id)}`,
        port: 25565 + parseInt(id)
    };
}

// Simuler l'utilisation CPU RÉALISTE selon le type de serveur
function simulateCPUUsage(server, cpuLimit) {
    if (server.status !== 'online') return 0;

    let baseUsage = cpuLimit * 0.2; // 20% de base
    let maxUsage = cpuLimit * 0.7;  // 70% max
    
    // Forge/mods consomment BEAUCOUP plus de CPU
    if (server.type === 'forge' || server.type === 'neoforge') {
        baseUsage = cpuLimit * 0.4;  // 40% de base
        maxUsage = cpuLimit * 1.5;   // Peut dépasser la limite (600% sur Gamer!)
    } else if (server.type === 'fabric' || server.type === 'quilt') {
        baseUsage = cpuLimit * 0.3;  // 30% de base
        maxUsage = cpuLimit * 0.9;   // 90% max
    }
    
    const minUsage = Math.floor(baseUsage);
    const maxUsageFloor = Math.floor(maxUsage);
    
    return Math.floor(Math.random() * (maxUsageFloor - minUsage + 1)) + minUsage;
}

// Simuler l'utilisation RAM RÉALISTE selon le type de serveur et les joueurs
function simulateRAMUsage(server, specs) {
    if (server.status !== 'online') {
        return 0;
    }

    // RAM de base selon le type (serveur vide, stable)
    let baseRam = 0.5; // Vanilla de base : 0.5 GB
    
    if (server.type === 'forge' || server.type === 'neoforge') {
        baseRam = 1.2; // Forge sans mods : 1-1.5 GB
    } else if (server.type === 'fabric' || server.type === 'quilt') {
        baseRam = 0.8; // Fabric plus léger : 0.8 GB
    } else if (server.type === 'paper' || server.type === 'spigot') {
        baseRam = 0.6; // Paper optimisé : 0.6 GB
    }
    
    // Ajouter selon les joueurs (0.15 GB par joueur)
    let playersRam = server.currentPlayers * 0.15;
    
    // Variation aléatoire légère (+/- 10%)
    let variation = (Math.random() * 0.2 - 0.1) * baseRam;
    
    let ramUsage = baseRam + playersRam + variation;
    ramUsage = Math.max(0.3, Math.min(ramUsage, specs.ram * 0.95)); // Min 0.3 GB, Max 95% de la limite
    
    return parseFloat(ramUsage.toFixed(1));
}

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API fonctionnelle',
        timestamp: new Date().toISOString()
    });
});

// Créer un serveur
app.post('/api/servers/create', (req, res) => {
    try {
        const { name, version, serverType, modloaderVersion, gamemode, plan, description } = req.body;
        
        // Validation
        if (!name || !version || !serverType || !plan) {
            return res.status(400).json({ 
                success: false, 
                message: 'Données manquantes' 
            });
        }

        const specs = getServerSpecs(plan);
        const serverIP = generateServerIP(serverIdCounter);
        
        const newServer = {
            id: serverIdCounter.toString(),
            name,
            version,
            type: serverType,
            modloader: modloaderVersion || null,
            gamemode: gamemode || 'survival',
            plan,
            ram: specs.ram,
            cpuLimit: specs.cpuLimit,
            maxPlayers: specs.maxPlayers,
            currentPlayers: 0,
            status: 'offline',
            ip: serverIP.ip,
            port: serverIP.port,
            description: description || '',
            storage: specs.storage,
            createdAt: new Date().toISOString(),
            startedAt: null,
            uptime: 0
        };
        
        serversDB.push(newServer);
        serverIdCounter++;
        
        res.json({ 
            success: true, 
            message: 'Serveur créé avec succès',
            server: newServer
        });
    } catch (error) {
        console.error('Erreur création serveur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Obtenir tous les serveurs
app.get('/api/servers', (req, res) => {
    try {
        // Ajouter les stats en temps réel
        const serversWithStats = serversDB.map(server => {
            const specs = getServerSpecs(server.plan);
            
            const cpuUsage = server.status === 'online' 
                ? simulateCPUUsage(server.cpuLimit) 
                : 0;
            
            const ramUsage = simulateRAMUsage(server, specs);

            // Calculer uptime si en ligne
            let uptime = 0;
            if (server.status === 'online' && server.startedAt) {
                const now = new Date();
                const started = new Date(server.startedAt);
                uptime = Math.floor((now - started) / 1000); // en secondes
            }

            return {
                ...server,
                cpuUsage,           // % d'utilisation actuelle
                cpuPercent: ((cpuUsage / server.cpuLimit) * 100).toFixed(0), // % de la limite
                ramUsage,           // GB utilisés
                ramPercent: ((ramUsage / server.ram) * 100).toFixed(0),      // % de la limite
                uptime,             // en secondes
                uptimeFormatted: formatUptime(uptime)
            };
        });
        
        res.json({ 
            success: true, 
            servers: serversWithStats 
        });
    } catch (error) {
        console.error('Erreur récupération serveurs:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Obtenir un serveur par ID
app.get('/api/servers/:id', (req, res) => {
    try {
        const server = serversDB.find(s => s.id === req.params.id);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Serveur non trouvé' 
            });
        }

        const specs = getServerSpecs(server.plan);

        // Ajouter les stats en temps réel
        const cpuUsage = server.status === 'online' 
            ? simulateCPUUsage(server.cpuLimit) 
            : 0;
        
        const ramUsage = simulateRAMUsage(server, specs);

        let uptime = 0;
        if (server.status === 'online' && server.startedAt) {
            const now = new Date();
            const started = new Date(server.startedAt);
            uptime = Math.floor((now - started) / 1000);
        }

        const serverWithStats = {
            ...server,
            cpuUsage,
            cpuPercent: ((cpuUsage / server.cpuLimit) * 100).toFixed(0),
            ramUsage,
            ramPercent: ((ramUsage / server.ram) * 100).toFixed(0),
            uptime,
            uptimeFormatted: formatUptime(uptime)
        };
        
        res.json({ 
            success: true, 
            server: serverWithStats 
        });
    } catch (error) {
        console.error('Erreur récupération serveur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Démarrer un serveur
app.post('/api/servers/:id/start', (req, res) => {
    try {
        const server = serversDB.find(s => s.id === req.params.id);
        
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

        // Passer en mode "starting"
        server.status = 'starting';
        server.startedAt = new Date().toISOString();
        
        // Simuler le démarrage (3 secondes)
        setTimeout(() => {
            server.status = 'online';
        }, 3000);
        
        res.json({ 
            success: true, 
            message: 'Serveur en cours de démarrage',
            server 
        });
    } catch (error) {
        console.error('Erreur démarrage serveur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Arrêter un serveur
app.post('/api/servers/:id/stop', (req, res) => {
    try {
        const server = serversDB.find(s => s.id === req.params.id);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Serveur non trouvé' 
            });
        }

        if (server.status === 'offline') {
            return res.json({ 
                success: false, 
                message: 'Le serveur est déjà arrêté' 
            });
        }

        server.status = 'offline';
        server.currentPlayers = 0;
        server.startedAt = null;
        
        res.json({ 
            success: true, 
            message: 'Serveur arrêté',
            server 
        });
    } catch (error) {
        console.error('Erreur arrêt serveur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Redémarrer un serveur
app.post('/api/servers/:id/restart', (req, res) => {
    try {
        const server = serversDB.find(s => s.id === req.params.id);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Serveur non trouvé' 
            });
        }

        server.status = 'starting';
        server.currentPlayers = 0;
        server.startedAt = new Date().toISOString();
        
        // Simuler le redémarrage (5 secondes)
        setTimeout(() => {
            server.status = 'online';
        }, 5000);
        
        res.json({ 
            success: true, 
            message: 'Serveur en cours de redémarrage',
            server 
        });
    } catch (error) {
        console.error('Erreur redémarrage serveur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Supprimer un serveur
app.delete('/api/servers/:id', (req, res) => {
    try {
        const index = serversDB.findIndex(s => s.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Serveur non trouvé' 
            });
        }

        serversDB.splice(index, 1);
        
        res.json({ 
            success: true, 
            message: 'Serveur supprimé' 
        });
    } catch (error) {
        console.error('Erreur suppression serveur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Vérifier le statut d'un serveur (pour la page publique)
app.get('/api/status/:serverIp', (req, res) => {
    try {
        const serverIp = decodeURIComponent(req.params.serverIp);
        const server = serversDB.find(s => s.ip === serverIp);
        
        if (!server) {
            return res.json({
                status: 'offline',
                message: 'Serveur non trouvé'
            });
        }

        if (server.status === 'online') {
            res.json({
                status: 'online',
                server: {
                    name: server.name,
                    version: server.version,
                    currentPlayers: server.currentPlayers,
                    maxPlayers: server.maxPlayers,
                    description: server.description,
                    ping: Math.floor(Math.random() * 50) + 10
                }
            });
        } else if (server.status === 'starting') {
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
            message: 'Erreur serveur' 
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

// Simuler des joueurs qui se connectent/déconnectent
setInterval(() => {
    serversDB.forEach(server => {
        if (server.status === 'online' && Math.random() > 0.7) {
            const change = Math.random() > 0.5 ? 1 : -1;
            server.currentPlayers = Math.max(0, Math.min(server.maxPlayers, server.currentPlayers + change));
        }
    });
}, 30000); // Toutes les 30 secondes

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`✅ Serveur API démarré sur le port ${PORT}`);
    console.log(`📊 Stats système:`);
    console.log(`   - Basique: 50% CPU (0.5 cœur)`);
    console.log(`   - Super: 200% CPU (2 cœurs)`);
    console.log(`   - Gamer: 400% CPU (4 cœurs)`);
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
    console.error('Erreur non gérée:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Promesse rejetée:', error);
});
