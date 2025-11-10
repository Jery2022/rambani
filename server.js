const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const path = require('path');

// --- Configuration du Serveur et de la Base de Données ---

const PORT = process.env.PORT || 3000;

// URI de connexion à MongoDB  
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_db';
const DB_NAME = 'chat_db';
const COLLECTION_NAME = 'messages';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {

// Configuration CORS si votre client est servi sur un domaine différent
cors: {
origin: "*",
methods: ["GET", "POST"]
}
});

let db; // Variable pour stocker l'objet de la base de données MongoDB

// Utiliser un Set pour garantir l'unicité des IDs d'utilisateur connectés
const connectedUsers = new Set();

// Middleware pour servir les fichiers statiques (index.html) depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Route simple pour la page d'accueil
app.get('/', (req, res) => {

//    'index.html' dans le répertoire 'public'
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fonction pour se connecter à MongoDB
async function connectDB() {
    try {
            console.log('Tentative de connexion à MongoDB...');
            const client = await MongoClient.connect(MONGODB_URI);
            db = client.db(DB_NAME);
            console.log('Connexion à MongoDB réussie ! Base de données :', DB_NAME);
            // Démarrer le serveur HTTP seulement après la connexion à la DB
            startServer();
        } catch (error) {
            console.error('Échec de la connexion à MongoDB:', error);
            console.error('Veuillez vérifier que votre service MongoDB est en cours d\'exécution.');
            process.exit(1); 
    }
}

// Fonction pour démarrer le serveur Socket.IO
function startServer() {
    io.on('connection', async (socket) => {
    // Définir un userId court
    const userId = socket.id.substring(0, 4);
    connectedUsers.add(userId);

    console.log(`Utilisateur connecté: ${userId} (${socket.id})`);

    // Fonction utilitaire pour diffuser la liste des utilisateurs
    const broadcastUserList = () => {
        // Convertir le Set en Array avant l'émission
        io.emit('user list', Array.from(connectedUsers));
    };
    
    // 1. Envoyer l'historique des messages au nouvel utilisateur
    try {
            const history = await db.collection(COLLECTION_NAME)
                                    .find({})
                                    .sort({ timestamp: 1 }) // Trier par timestamp croissant
                                    .limit(100) 
                                    .toArray();
            socket.emit('history', history);
        
            // Annoncer la connexion à tout le monde
            const systemJoinMsg = {
                user: 'Système',
                text: `${userId} a rejoint la discussion.`,
                type: 'system',
                timestamp: new Date()
            };
            io.emit('chat message', systemJoinMsg);
            
        } catch (error) {
        console.error('Erreur lors du chargement de l\'historique:', error);
    }
    
    // Mettre à jour et diffuser la liste des utilisateurs à tous
    broadcastUserList();

    // 2. Écouter les nouveaux messages
    socket.on('chat message', async (msg) => {
        if (!msg.text || msg.text.trim() === '') return;

        const messageToSave = {
            user: userId,
            text: msg.text.trim(),
            timestamp: new Date()
        };
        
        // Diffuser le message à tous les clients
        io.emit('chat message', messageToSave);

        // Émettre un événement pour les messages non lus si le destinataire n'est pas actif
        // Cette logique est gérée côté client en vérifiant document.hasFocus()
        // Le serveur n'a pas besoin de savoir si la fenêtre est active ou non.

        // 3. Sauvegarder le message dans la base de données
        try {
            await db.collection(COLLECTION_NAME).insertOne(messageToSave);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du message:', error);
        }
    });

    // 4. Gérer la déconnexion
    socket.on('disconnect', () => {
        connectedUsers.delete(userId);
        console.log(`Utilisateur déconnecté: ${userId} (${socket.id})`);
        
        const systemLeaveMsg = {
            user: 'Système',
            text: `${userId} a quitté la discussion.`,
            type: 'system',
            timestamp: new Date()
        };
        io.emit('chat message', systemLeaveMsg);
        
        // Mettre à jour et diffuser la liste des utilisateurs
        broadcastUserList();
    });
});

httpServer.listen(PORT, () => {
    console.log(`Serveur Node.js en cours d'exécution sur http://localhost:${PORT}`);
});


}

// Lancer le processus de connexion à la base de données au démarrage
connectDB();
