const express = require('express');
const config = require('./config/environnement');
const logger = require('./config/logger');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb'); // Ajout de ObjectId
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Importe connect-mongo
const csrf = require('csurf'); // Importe csurf
const cookieParser = require('cookie-parser'); // Importe cookie-parser
const multer = require('multer'); // Pour la gestion de l'upload de fichiers
const fs = require('fs'); // Pour la gestion des fichiers (suppression d'anciennes photos)
const { body, validationResult } = require('express-validator'); // Importe express-validator
// --- Configuration du Serveur et de la Base de Données ---

const PORT = config.port;
const MONGODB_URI = config.mongodb_uri;
const DB_NAME = config.mongodb_uri.split('/').pop().split('?')[0];
const COLLECTION_NAME = 'messages';
const USERS_COLLECTION_NAME = 'users'; // Collection pour les utilisateurs
const LOGIN_ATTEMPTS_COLLECTION_NAME = 'login_attempts'; // Nouvelle collection pour les tentatives de connexion

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
// Configuration CORS avec liste de domaines autorisés
cors: {
    origin: config.allowed_origins,
    methods: ["GET", "POST","PUT","DELETE"]
}
});

// Middleware pour parser le JSON dans les requêtes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Utiliser cookie-parser avant la session et csurf
app.use(cookieParser());

// Configuration de la session
const sessionMiddleware = session({
    secret: config.session_secret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        dbName: DB_NAME,
        collectionName: 'sessions',
        ttl: 7 * 24 * 60 * 60 // = 7 jours. Par défaut
    }),
    cookie: { 
        secure: config.node_env === 'production', // Utiliser secure: true en production (HTTPS)
        sameSite: 'Lax', // 'Strict' ou 'Lax' pour la protection CSRF
        httpOnly: true // Empêche l'accès au cookie via JavaScript côté client
    }
});

app.use(sessionMiddleware);

// Configuration CSRF
const csrfProtection = csrf({ cookie: true });
// app.use(csrfProtection); // Appliquer globalement après la session et cookie-parser (désactivé pour gérer les routes individuellement)

// Configuration de Multer pour l'upload de photos de profil
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/profile_pictures/'); // Dossier où les images seront stockées
    },
    filename: (req, file, cb) => {
        // Nom de fichier unique pour éviter les conflits
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limite de 5 MB
        files: 1 // Un seul fichier à la fois
    },
    fileFilter: (req, file, cb) => {
        // Accepter uniquement les images
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé. Seules les images sont acceptées.'), false);
        }
    }
});

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
app.get('/admin/login', csrfProtection, (req, res) => {
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
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Route d'enregistrement (pour les tests ou si l'utilisateur souhaite une fonctionnalité d'enregistrement)
app.post('/register', 
    isAuthenticated, 
    csrfProtection,
    [
        body('username')
            .trim()
            .isLength({ min: 3 }).withMessage('Le pseudo doit contenir au moins 3 caractères.')
            .escape(), // Protection XSS
        body('email')
            .isEmail().withMessage('Veuillez fournir une adresse email valide.')
            .normalizeEmail()
            .escape(), // Protection XSS
        body('password')
            .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.')
            .escape() // Protection XSS
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de l\'enregistrement:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password, email } = req.body;

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            
            // Vérifier l'unicité du pseudo
            const existingUserByUsername = await usersCollection.findOne({ username });
            if (existingUserByUsername) {
                return res.status(409).json({ message: 'Ce pseudo est déjà pris.' });
            }

            // Vérifier l'unicité de l'email
            const existingUserByEmail = await usersCollection.findOne({ email });
            if (existingUserByEmail) {
                return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await usersCollection.insertOne({ username, password: hashedPassword, email, role: 'user' });

            res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
        } catch (error) {
            logger.error('Erreur lors de l\'enregistrement:', error);
            res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement.' });
        }
    }
);

// Route de connexion (chat)
app.post('/login', 
    csrfProtection,
    [
        body('username')
            .trim()
            .notEmpty().withMessage('Le pseudo est requis.')
            .escape(), // Protection XSS
        body('password')
            .notEmpty().withMessage('Le mot de passe est requis.')
            .escape() // Protection XSS
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de la connexion:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            const loginAttemptsCollection = db.collection(LOGIN_ATTEMPTS_COLLECTION_NAME);

            // Nettoyer les anciennes tentatives de connexion pour cet utilisateur/IP
            const ip = req.ip; // Récupérer l'adresse IP du client
            const now = new Date();
            const lockTimeMinutes = config.login_lock_time;
            const lockTimeThreshold = new Date(now.getTime() - lockTimeMinutes * 60 * 1000);

            // Supprimer les tentatives de connexion expirées
            await loginAttemptsCollection.deleteMany({
                $or: [
                    { username: username, timestamp: { $lt: lockTimeThreshold } },
                    { ip: ip, timestamp: { $lt: lockTimeThreshold } }
                ]
            });

            // Vérifier si le compte est verrouillé
            const recentFailedAttempts = await loginAttemptsCollection.countDocuments({
                username: username,
                success: false,
                timestamp: { $gt: lockTimeThreshold }
            });

            if (recentFailedAttempts >= config.login_attempts_limit) {
                logger.warn(`Tentative de connexion bloquée pour l'utilisateur ${username} (compte verrouillé).`);
                return res.status(429).json({ message: `Trop de tentatives de connexion. Veuillez réessayer dans ${lockTimeMinutes} minutes.` });
            }

            const user = await usersCollection.findOne({ username });

            if (!user) {
                await loginAttemptsCollection.insertOne({ username, ip, timestamp: now, success: false });
                logger.warn('Tentative de connexion échouée (pseudo incorrect)', { username, ip, type: 'login_attempt' });
                return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                await loginAttemptsCollection.insertOne({ username, ip, timestamp: now, success: false });
                logger.warn('Tentative de connexion échouée (mot de passe incorrect)', { username, ip, type: 'login_attempt' });
                return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
            }

            // Si la connexion est réussie, supprimer toutes les tentatives de connexion échouées pour cet utilisateur
            await loginAttemptsCollection.deleteMany({ username: username });

            req.session.user = { 
                id: user._id.toString(), 
                username: user.username, 
                role: user.role,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                profilePicture: user.profilePicture || ''
            };
            logger.info('Connexion utilisateur réussie', { username: user.username, ip, type: 'user_login' });
            res.status(200).json({ message: 'Connexion réussie.', username: user.username, role: user.role });
        } catch (error) {
            logger.error('Erreur lors de la connexion:', error);
            res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
        }
    }
);

// API pour récupérer le profil de l'utilisateur courant
app.get('/api/profile', isAuthenticatedChat, async (req, res) => {
    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const user = await usersCollection.findOne(
            { _id: new ObjectId(req.session.user.id) },
            { projection: { password: 0, role: 0 } }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'Profil utilisateur non trouvé.' });
        }

        res.status(200).json({ success: true, profile: user });
    } catch (error) {
        logger.error('Erreur lors de la récupération du profil:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération du profil.' });
    }
});

// API pour mettre à jour le profil de l'utilisateur courant
app.put('/api/profile', 
    isAuthenticatedChat, 
    upload.single('profilePicture'), 
    csrfProtection,
    [
        body('firstName')
            .trim()
            .isLength({ min: 1 }).withMessage('Le prénom est requis.')
            .escape(), // Protection XSS
        body('lastName')
            .trim()
            .isLength({ min: 1 }).withMessage('Le nom est requis.')
            .escape(), // Protection XSS
        body('username')
            .trim()
            .isLength({ min: 3 }).withMessage('Le pseudo doit contenir au moins 3 caractères.')
            .escape(), // Protection XSS
        body('email')
            .isEmail().withMessage('Veuillez fournir une adresse email valide.')
            .normalizeEmail()
            .escape() // Protection XSS
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de la mise à jour du profil:', errors.array());
            // Supprimer le fichier uploadé si la validation échoue
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.session.user.id;
        const { firstName, lastName, username, email } = req.body;
        let profilePicturePath = req.file ? `/images/profile_pictures/${req.file.filename}` : null;

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            // Vérifier si le nom d'utilisateur est déjà pris par un autre utilisateur
            const existingUserByUsername = await usersCollection.findOne({ username, _id: { $ne: new ObjectId(userId) } });
            if (existingUserByUsername) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(409).json({ success: false, message: 'Ce nom d\'utilisateur est déjà pris.' });
            }

            // Vérifier si l'email est déjà pris par un autre utilisateur
            const existingUserByEmail = await usersCollection.findOne({ email, _id: { $ne: new ObjectId(userId) } });
            if (existingUserByEmail) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé par un autre utilisateur.' });
            }

            const updateData = {
                firstName,
                lastName,
                username,
                email,
                lastUpdated: new Date()
            };

            // Si une nouvelle photo de profil est uploadée
            if (profilePicturePath) {
                const oldUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
                // Supprimer l'ancienne photo de profil si elle existe et n'est pas une image par défaut
                if (oldUser && oldUser.profilePicture && !oldUser.profilePicture.startsWith('/images/default_avatar')) {
                    const oldImagePath = path.join(__dirname, 'public', oldUser.profilePicture);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                updateData.profilePicture = profilePicturePath;
            }

            const result = await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
            }

            // Mettre à jour la session de l'utilisateur
            req.session.user = {
                ...req.session.user,
                ...updateData,
                id: userId
            };

            // Émettre un événement Socket.IO pour informer les clients de la mise à jour du profil
            io.emit('profile_updated', { userId: userId, profile: req.session.user });

            res.status(200).json({ success: true, message: 'Profil mis à jour avec succès.', profile: req.session.user });
        } catch (error) {
            logger.error('Erreur lors de la mise à jour du profil:', error);
            if (req.file) fs.unlinkSync(req.file.path);
            res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour du profil.' });
        }
    }
);

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
app.post('/admin/login', 
    csrfProtection,
    [
        body('username')
            .trim()
            .notEmpty().withMessage('Le pseudo est requis.')
            .escape(), // Protection XSS
        body('password')
            .notEmpty().withMessage('Le mot de passe est requis.')
            .escape() // Protection XSS
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de la connexion admin:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            const loginAttemptsCollection = db.collection(LOGIN_ATTEMPTS_COLLECTION_NAME);

            // Nettoyer les anciennes tentatives de connexion pour cet utilisateur/IP
            const ip = req.ip; // Récupérer l'adresse IP du client
            const now = new Date();
            const lockTimeMinutes = config.login_lock_time;
            const lockTimeThreshold = new Date(now.getTime() - lockTimeMinutes * 60 * 1000);

            // Supprimer les tentatives de connexion expirées
            await loginAttemptsCollection.deleteMany({
                $or: [
                    { username: username, timestamp: { $lt: lockTimeThreshold } },
                    { ip: ip, timestamp: { $lt: lockTimeThreshold } }
                ]
            });

            // Vérifier si le compte est verrouillé
            const recentFailedAttempts = await loginAttemptsCollection.countDocuments({
                username: username,
                success: false,
                timestamp: { $gt: lockTimeThreshold }
            });

            if (recentFailedAttempts >= config.login_attempts_limit) {
                logger.warn(`Tentative de connexion admin bloquée pour l'utilisateur ${username} (compte verrouillé).`);
                return res.status(429).json({ message: `Trop de tentatives de connexion. Veuillez réessayer dans ${lockTimeMinutes} minutes.` });
            }

            const user = await usersCollection.findOne({ username });

            if (!user) {
                await loginAttemptsCollection.insertOne({ username, ip, timestamp: now, success: false });
                logger.warn('Tentative de connexion admin échouée (pseudo incorrect)', { username, ip, type: 'admin_login_attempt' });
                return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                await loginAttemptsCollection.insertOne({ username, ip, timestamp: now, success: false });
                logger.warn('Tentative de connexion admin échouée (mot de passe incorrect)', { username, ip, type: 'admin_login_attempt' });
                return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
            }

            // Si la connexion est réussie, supprimer toutes les tentatives de connexion échouées pour cet utilisateur
            await loginAttemptsCollection.deleteMany({ username: username });

            if (user.role !== 'admin') {
                logger.warn('Tentative de connexion admin échouée (rôle non autorisé)', { username, ip, type: 'admin_login_attempt' });
                return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent se connecter ici.' });
            }

            req.session.user = { id: user._id.toString(), username: user.username, role: user.role };
            logger.info('Connexion administrateur réussie', { username: user.username, ip, type: 'admin_login' });
            res.status(200).json({ message: 'Connexion réussie.' });
        } catch (error) {
            logger.error('Erreur lors de la connexion admin:', error);
            res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
        }
    }
);

// API pour lister les utilisateurs (accessible uniquement aux administrateurs)
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const usersCollection = db.collection(USERS_COLLECTION_NAME);
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
        res.status(200).json(users);
    } catch (error) {
        logger.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
});

// API pour enregistrer un nouvel utilisateur (accessible uniquement aux administrateurs)
app.post('/api/admin/users', 
    isAdmin, 
    csrfProtection,
    [
        body('username')
            .trim()
            .isLength({ min: 3 }).withMessage('Le pseudo doit contenir au moins 3 caractères.')
            .escape(), // Protection XSS
        body('email')
            .isEmail().withMessage('Veuillez fournir une adresse email valide.')
            .normalizeEmail()
            .escape(), // Protection XSS
        body('password')
            .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.')
            .escape(), // Protection XSS
        body('role')
            .isIn(['user', 'admin']).withMessage('Le rôle doit être "user" ou "admin".')
            .escape() // Protection XSS
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de l\'enregistrement admin:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password, email, role } = req.body;

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            
            // Vérifier l'unicité du pseudo
            const existingUserByUsername = await usersCollection.findOne({ username });
            if (existingUserByUsername) {
                return res.status(409).json({ message: 'Ce pseudo est déjà pris.' });
            }

            // Vérifier l'unicité de l'email
            const existingUserByEmail = await usersCollection.findOne({ email });
            if (existingUserByEmail) {
                return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await usersCollection.insertOne({ username, password: hashedPassword, email, role });

            res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
        } catch (error) {
            logger.error('Erreur lors de l\'enregistrement d\'un utilisateur par l\'admin:', error);
            res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement de l\'utilisateur.' });
        }
    }
);

// API pour supprimer un utilisateur (accessible uniquement aux administrateurs)
app.delete('/api/admin/users/:id', 
    isAdmin, 
    csrfProtection,
    [
        body('id') // Validation de l'ID dans les paramètres de l'URL
            .custom(value => ObjectId.isValid(value)).withMessage('ID utilisateur invalide.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de la suppression d\'un utilisateur:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ message: 'Utilisateur non trouvé.' });
            }

            res.status(200).json({ message: 'Utilisateur supprimé avec succès.' });
        } catch (error) {
            logger.error('Erreur lors de la suppression d\'un utilisateur:', error);
            res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'utilisateur.' });
        }
    }
);

// Route pour la page de modification d'utilisateur
app.get('/admin/edit-user', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'admin', 'edit-user.html'));
});

// API pour récupérer un utilisateur par son ID (pour le formulaire de modification)
app.get('/api/admin/users/:id', 
    isAuthenticated, 
    isAdmin,
    [
        body('id') // Validation de l'ID dans les paramètres de l'URL
            .custom(value => ObjectId.isValid(value)).withMessage('ID utilisateur invalide.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de la récupération d\'un utilisateur par ID:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        logger.debug(`Serveur: Requête GET pour l'utilisateur avec ID: ${id}`);

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            const user = await usersCollection.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });
            if (!user) {
                logger.info(`Serveur: Utilisateur non trouvé pour l'ID: ${id}`);
                return res.status(404).json({ message: 'Utilisateur non trouvé.' });
            }
            logger.debug(`Serveur: Utilisateur trouvé: ${user.username}`);
            res.status(200).json(user);
        } catch (error) {
            logger.error('Erreur lors de la récupération de l\'utilisateur:', error);
            res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'utilisateur.' });
        }
    }
);

// API pour modifier un utilisateur (accessible uniquement aux administrateurs)
app.put('/api/admin/users/:id', 
    isAuthenticated, 
    isAdmin, 
    csrfProtection,
    [
        body('id') // Validation de l'ID dans les paramètres de l'URL
            .custom(value => ObjectId.isValid(value)).withMessage('ID utilisateur invalide.'),
        body('username')
            .trim()
            .isLength({ min: 3 }).withMessage('Le pseudo doit contenir au moins 3 caractères.')
            .escape(), // Protection XSS
        body('email')
            .isEmail().withMessage('Veuillez fournir une adresse email valide.')
            .normalizeEmail()
            .escape(), // Protection XSS
        body('password')
            .optional({ checkFalsy: true }) // Le mot de passe est optionnel
            .isLength({ min: 8 }).withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères.')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .withMessage('Le nouveau mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.')
            .escape(), // Protection XSS
        body('role')
            .isIn(['user', 'admin']).withMessage('Le rôle doit être "user" ou "admin".')
            .escape() // Protection XSS
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Erreur de validation lors de la mise à jour d\'un utilisateur par ID:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { username, password, email, role } = req.body;

        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            
            // Vérifier si le nouveau pseudo est déjà pris par un autre utilisateur
            const existingUserByUsername = await usersCollection.findOne({
                username: username,
                _id: { $ne: new ObjectId(id) }
            });
            if (existingUserByUsername) {
                return res.status(409).json({ message: 'Ce pseudo est déjà pris par un autre utilisateur.' });
            }

            // Vérifier si l'email est déjà pris par un autre utilisateur
            const existingUserByEmail = await usersCollection.findOne({
                email: email,
                _id: { $ne: new ObjectId(id) }
            });
            if (existingUserByEmail) {
                return res.status(409).json({ message: 'Cet email est déjà utilisé par un autre utilisateur.' });
            }

            const updateData = { username, email, role };

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
            logger.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
            res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.' });
        }
    }
);

// Fonction pour se connecter à MongoDB
async function connectDB() {
    try {
            logger.info('Tentative de connexion à MongoDB...');
            mongoClientInstance = await MongoClient.connect(MONGODB_URI); // Stocker l'instance du client
            db = mongoClientInstance.db(DB_NAME);
            
            logger.info('Connexion à MongoDB réussie ! Base de données :', DB_NAME);
            // Démarrer le serveur HTTP seulement après la connexion à la DB
            startServer();
        } catch (error) {
            logger.error('Échec de la connexion à MongoDB:', error);
            logger.error('Veuillez vérifier que votre service MongoDB est en cours d\'exécution.');
            process.exit(1); 
    }
}

// Créer le dossier pour les photos de profil s'il n'existe pas
const profilePicturesDir = path.join(__dirname, 'public', 'images', 'profile_pictures');
if (!fs.existsSync(profilePicturesDir)) {
    fs.mkdirSync(profilePicturesDir, { recursive: true });
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
        logger.info(`Déconnexion forcée de l'ancien socket pour ${userId}: ${userSockets[userId]}`);
        io.to(userSockets[userId]).emit('force_disconnect', 'Vous avez été connecté sur une autre machine.');
        // Optionnel: forcer la déconnexion côté serveur de l'ancien socket
        const oldSocket = io.sockets.sockets.get(userSockets[userId]);
        if (oldSocket) {
            oldSocket.disconnect(true);
        }
    }
    userSockets[userId] = socket.id; // Enregistrer le nouveau socket de l'utilisateur

    connectedUsers.add(userId);

    logger.info(`Utilisateur connecté: ${userId} (${socket.id})`, { userId, socketId: socket.id, type: 'socket_connect' });

    // Fonction utilitaire pour diffuser la liste des utilisateurs avec leurs photos de profil
    const broadcastUserList = async () => {
        try {
            const usersCollection = db.collection(USERS_COLLECTION_NAME);
            const connectedUserProfiles = await Promise.all(
                Array.from(connectedUsers).map(async (username) => {
                    const user = await usersCollection.findOne(
                        { username: username },
                        { projection: { username: 1, profilePicture: 1, _id: 0 } }
                    );
                    return user || { username: username, profilePicture: '/images/default_avatar.png' }; // Fallback
                })
            );
            io.emit('user list', connectedUserProfiles);
        } catch (error) {
            logger.error('Erreur lors de la diffusion de la liste des utilisateurs:', error);
        }
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
        logger.error('Erreur lors du chargement de l\'historique:', error);
    }
    
    // Mettre à jour et diffuser la liste des utilisateurs à tous
    broadcastUserList();

    // Envoyer l'objet utilisateur actuel au client pour affichage
    socket.emit('current user', {
        username: user.username,
        profilePicture: user.profilePicture || '' // Envoyer la photo de profil si elle existe
    });

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
            logger.error('Erreur lors de la sauvegarde du message:', error);
        }
    });

    // 4. Gérer la déconnexion
    socket.on('disconnect', () => {
        connectedUsers.delete(userId);
        // Supprimer l'entrée de userSockets si le socket déconnecté est celui enregistré
        if (userSockets[userId] === socket.id) {
            delete userSockets[userId];
        }
        logger.info(`Utilisateur déconnecté: ${userId} (${socket.id})`, { userId, socketId: socket.id, type: 'socket_disconnect' });
        
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
    logger.info(`Serveur Node.js en cours d'exécution sur http://localhost:${PORT}`);
});


}

// Middleware pour servir les fichiers statiques depuis le dossier 'public' (déplacé après les routes)
app.use(express.static(path.join(__dirname, 'public')));

// Lancer le processus de connexion à la base de données au démarrage
connectDB();
