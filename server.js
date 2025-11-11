const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb'); // Ajout de ObjectId
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Importe connect-mongo
const csrf = require('csurf'); // Importe csurf
const cookieParser = require('cookie-parser'); // Importe cookie-parser

// --- Configuration du Serveur et de la Base de Données ---

const PORT = process.env.PORT || 3000;

// URI de connexion à MongoDB  
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_db';
const DB_NAME = 'chat_db';
const COLLECTION_NAME = 'messages';
const USERS_COLLECTION_NAME = 'users'; // Collection pour les utilisateurs

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {

// Configuration CORS si votre client est servi sur un domaine différent
cors: {
    origin: "*",
    methods: ["GET", "POST","UPDATE"]
}
});

// Middleware pour parser le JSON dans les requêtes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Utiliser cookie-parser avant la session et csurf
app.use(cookieParser());

// Configuration de la session
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'super_secret_key_for_chat_app', // Utiliser une variable d'environnement pour la clé secrète
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        dbName: DB_NAME,
        collectionName: 'sessions',
        ttl: 7 * 24 * 60 * 60 // = 7 jours. Par défaut
    }),
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Utiliser secure: true en production (HTTPS)
        sameSite: 'Lax', // 'Strict' ou 'Lax' pour la protection CSRF
        httpOnly: true // Empêche l'accès au cookie via JavaScript côté client
    }
});

app.use(sessionMiddleware);

// Configuration CSRF
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection); // Appliquer globalement après la session et cookie-parser

let db; // Variable pour stocker l'objet de la base de données MongoDB
let mongoClientInstance; // Variable pour stocker l'instance du client MongoDB

// Utiliser un Set pour garantir l'unicité des IDs d'utilisateur connectés
const connectedUsers = new Set();
// Objet pour stocker les sockets actifs par userId, permettant de gérer les connexions uniques
const userSockets = {}; 

// Middleware pour vérifier l'authentification pour les routes protégées (admin)
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        // Si la requête est pour une route d'administration, rediriger vers la page de connexion admin
        if (req.path.startsWith('/admin')) {
            res.redirect('/admin/login');
        } else {
            res.redirect('/login.html'); // Rediriger vers la page de connexion publique si non authentifié
        }
    }
}

// Middleware pour vérifier l'authentification pour accéder au chat
function isAuthenticatedChat(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        // Si la requête est pour une route publique, rediriger vers la page de connexion publique
        if (req.path.startsWith('/')) {
            res.redirect('/login.html');
        }  
    }
}

// Route pour la page de connexion publique
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route pour la page d'accueil (chat), protégée par l'authentification publique
app.get('/', isAuthenticatedChat, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour la page de connexion de l'administration
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'admin', 'login.html'), {
        csrfToken: req.csrfToken()
    });
});

// Route de déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Supprime le cookie de session
        res.redirect('/login.html');
    });
});

// Route pour obtenir le jeton CSRF
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Route d'enregistrement (pour les tests ou si l'utilisateur souhaite une fonctionnalité d'enregistrement)
app.post('/register', isAuthenticated, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Pseudo et mot de passe sont requis.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const existingUser = await usersCollection.findOne({ username });

        if (existingUser) {
            return res.status(409).json({ message: 'Ce pseudo est déjà pris.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10); // Hacher le mot de passe
        await usersCollection.insertOne({ username, password: hashedPassword, role: 'user' }); // Rôle par défaut 'user'

        res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement.' });
    }
});

// Route de connexion (chat)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Pseudo et mot de passe sont requis.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const user = await usersCollection.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        req.session.user = { id: user._id.toString(), username: user.username, role: user.role }; // Stocker l'utilisateur et son rôle dans la session
        res.status(200).json({ message: 'Connexion réussie.', username: user.username, role: user.role });
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});

// Middleware pour vérifier si l'utilisateur est un administrateur
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        // Rediriger vers la page de connexion admin si non authentifié ou non admin
        res.redirect('/admin/login');
    }
}

// Route pour la page d'administration, protégée par l'authentification et le rôle d'administrateur
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'admin', 'index.html'));
});

// Route de connexion pour l'administration
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Pseudo et mot de passe sont requis.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const user = await usersCollection.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent se connecter ici.' });
        }

        req.session.user = { id: user._id.toString(), username: user.username, role: user.role };
        console.log('Admin login successful, session user:', req.session.user);
        res.status(200).json({ message: 'Connexion réussie.' }); // Envoyer une réponse JSON pour le succès
    } catch (error) {
        console.error('Erreur lors de la connexion admin:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});

// API pour lister les utilisateurs (accessible uniquement aux administrateurs)
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray(); // Exclure les mots de passe
        res.status(200).json(users);
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
});

// API pour enregistrer un nouvel utilisateur (accessible uniquement aux administrateurs)
app.post('/api/admin/users', isAdmin, async (req, res) => {
    const { username, password, role } = req.body;

    // Validation des entrées
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ message: 'Pseudo invalide.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) { // Exiger une longueur minimale pour le mot de passe
        return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    if (!role || typeof role !== 'string' || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Rôle invalide.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const existingUser = await usersCollection.findOne({ username });

        if (existingUser) {
            return res.status(409).json({ message: 'Ce pseudo est déjà pris.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ username, password: hashedPassword, role });

        res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement d\'un utilisateur par l\'admin:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement de l\'utilisateur.' });
    }
});

// API pour supprimer un utilisateur (accessible uniquement aux administrateurs)
app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
    const { id } = req.params;

    // Valider si l'ID est un ObjectId MongoDB valide
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'ID utilisateur invalide.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        res.status(200).json({ message: 'Utilisateur supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression d\'un utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'utilisateur.' });
    }
});

// Route pour la page de modification d'utilisateur
app.get('/admin/edit-user', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'admin', 'edit-user.html'));
});

// API pour récupérer un utilisateur par son ID (pour le formulaire de modification)
app.get('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    console.log(`Serveur: Requête GET pour l'utilisateur avec ID: ${id}`); // Log l'ID reçu

    // Valider si l'ID est un ObjectId MongoDB valide
    if (!ObjectId.isValid(id)) {
        console.log(`Serveur: ID utilisateur invalide: ${id}`); // Log si l'ID est invalide
        return res.status(400).json({ message: 'ID utilisateur invalide.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const user = await usersCollection.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });
        if (!user) {
            console.log(`Serveur: Utilisateur non trouvé pour l'ID: ${id}`); // Log si l'utilisateur n'est pas trouvé
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        console.log(`Serveur: Utilisateur trouvé: ${user.username}`); // Log l'utilisateur trouvé
        res.status(200).json(user);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'utilisateur.' });
    }
});

// API pour modifier un utilisateur (accessible uniquement aux administrateurs)
app.put('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;

    // Valider si l'ID est un ObjectId MongoDB valide
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'ID utilisateur invalide.' });
    }

    // Validation des entrées
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ message: 'Pseudo invalide.' });
    }
    if (!role || typeof role !== 'string' || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Rôle invalide.' });
    }
    if (password && (typeof password !== 'string' || password.length < 8)) { // Le mot de passe est optionnel, mais s'il est fourni, il doit être valide
        return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const updateData = { username, role };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        res.status(200).json({ message: 'Utilisateur mis à jour avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.' });
    }
});

// Fonction pour se connecter à MongoDB
async function connectDB() {
    try {
            console.log('Tentative de connexion à MongoDB...');
            mongoClientInstance = await MongoClient.connect(MONGODB_URI); // Stocker l'instance du client
            db = mongoClientInstance.db(DB_NAME);
            
            console.log('Connexion à MongoDB réussie ! Base de données :', DB_NAME);
            // Démarrer le serveur HTTP seulement après la connexion à la DB
            startServer();
        } catch (error) {
            console.error('Échec de la connexion à MongoDB:', error);
            console.error('Veuillez vérifier que votre service MongoDB est en cours d\'exécution.');
            process.exit(1); 
    }
}

// Middleware pour servir les fichiers statiques du dossier 'src/admin'
app.use('/admin', express.static(path.join(__dirname, 'src', 'admin')));

// Gestion des erreurs CSRF
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).json({ message: 'Requête non autorisée (CSRF token manquant ou invalide).' });
    } else {
        next(err);
    }
});

// Fonction pour démarrer le serveur Socket.IO
function startServer() {
    io.use((socket, next) => {
        // Récupérer la session Express dans le contexte Socket.IO
        sessionMiddleware(socket.request, {}, () => { // Utiliser la même instance de middleware de session
            if (socket.request.session && socket.request.session.user) {
                socket.request.user = socket.request.session.user; // Attacher l'utilisateur à l'objet socket.request
                next();
            } else {
                next(new Error('Non autorisé')); // Refuser la connexion Socket.IO si non authentifié
            }
        });
    });

    io.on('connection', async (socket) => {
    const user = socket.request.user; // Récupérer l'utilisateur authentifié
    const userId = user.username; // Utiliser le pseudo comme ID utilisateur

    // Gérer la connexion unique: déconnecter l'ancien socket si l'utilisateur se connecte ailleurs
    if (userSockets[userId] && userSockets[userId] !== socket.id) {
        console.log(`Déconnexion forcée de l'ancien socket pour ${userId}: ${userSockets[userId]}`);
        io.to(userSockets[userId]).emit('force_disconnect', 'Vous avez été connecté sur une autre machine.');
        // Optionnel: forcer la déconnexion côté serveur de l'ancien socket
        const oldSocket = io.sockets.sockets.get(userSockets[userId]);
        if (oldSocket) {
            oldSocket.disconnect(true);
        }
    }
    userSockets[userId] = socket.id; // Enregistrer le nouveau socket de l'utilisateur

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

    // Envoyer l'ID de l'utilisateur actuel au client pour affichage
    socket.emit('current user', userId);

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
        // Supprimer l'entrée de userSockets si le socket déconnecté est celui enregistré
        if (userSockets[userId] === socket.id) {
            delete userSockets[userId];
        }
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

// Middleware pour servir les fichiers statiques depuis le dossier 'public' (déplacé après les routes)
app.use(express.static(path.join(__dirname, 'public')));

// Lancer le processus de connexion à la base de données au démarrage
connectDB();
