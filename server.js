const express = require("express");
const compression = require("compression"); // Importation du module compression
const config = require("./config/environnement");
const logger = require("./config/logger");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const { createAdapter } = require("@socket.io/redis-adapter");

const redisClient = require("./config/redisClient");
const authRoutes = require("./src/routes/authRoutes");
const apiRoutes = require("./src/routes/apiRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const { csrfErrorHandler } = require("./src/middleware/csrfMiddleware");
const UserModel = require("./src/models/UserModel");
const LoginAttemptModel = require("./src/models/LoginAttemptModel");
const MessageService = require("./src/services/MessageService");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const swaggerDocument = YAML.load("./swagger.yaml");

// --- Configuration du Serveur et de la Base de Données ---
const PORT = config.port;
const MONGODB_URI = config.mongodb_uri;
const DB_NAME = config.mongodb_uri.split("/").pop().split("?")[0];
const COLLECTION_NAME = "messages"; // Collection pour les messages du chat
const USERS_COLLECTION_NAME = "users"; // Collection pour les utilisateurs
const LOGIN_ATTEMPTS_COLLECTION_NAME = "login_attempts"; // Collection pour les tentatives de connexion

let app;
let httpServer;
let io;
let db; // Variable pour stocker l'objet de la base de données MongoDB
let mongoClientInstance; // Variable pour stocker l'instance du client MongoDB
let sessionMiddleware;

// Utiliser un Set pour garantir l'unicité des IDs d'utilisateur connectés
const connectedUsers = new Set();
// Objet pour stocker les sockets actifs par userId, permettant de gérer les connexions uniques
const userSockets = {};

// Fonction pour se connecter à MongoDB
async function connectDB() {
  try {
    logger.info("Tentative de connexion à MongoDB...");
    mongoClientInstance = await MongoClient.connect(MONGODB_URI); // Stocker l'instance du client
    db = mongoClientInstance.db(DB_NAME);

    logger.info("Connexion à MongoDB réussie ! Base de données :", DB_NAME);

    // Initialiser les modèles et services avec l'instance de la base de données
    UserModel.setDb(db);
    LoginAttemptModel.setDb(db);
    MessageService.setDb(db);

    // Création des index pour la collection 'users'
    await db
      .collection(USERS_COLLECTION_NAME)
      .createIndex({ username: 1 }, { unique: true });
    await db
      .collection(USERS_COLLECTION_NAME)
      .createIndex({ email: 1 }, { unique: true });
    logger.info('Index créés pour la collection "users" (username, email).');

    // Création des index pour la collection 'login_attempts'
    await db
      .collection(LOGIN_ATTEMPTS_COLLECTION_NAME)
      .createIndex({ username: 1 });
    await db.collection(LOGIN_ATTEMPTS_COLLECTION_NAME).createIndex({ ip: 1 });
    await db
      .collection(LOGIN_ATTEMPTS_COLLECTION_NAME)
      .createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: config.login_lock_time * 60 }
      ); // Index TTL
    logger.info(
      'Index créés pour la collection "login_attempts" (username, ip, timestamp).'
    );

    // Démarrer le serveur HTTP seulement après la connexion à la DB et la création des index
    startServer();
  } catch (error) {
    logger.error("Échec de la connexion à MongoDB:", error);
    logger.error(
      "Veuillez vérifier que votre service MongoDB est en cours d'exécution."
    );
    process.exit(1);
  }
}

// Fonction pour démarrer le serveur Socket.IO
function startServer() {
  io.use((socket, next) => {
    // Récupérer la session Express dans le contexte Socket.IO
    sessionMiddleware(socket.request, {}, () => {
      // Utiliser la même instance de middleware de session
      if (socket.request.session && socket.request.session.user) {
        socket.request.user = socket.request.session.user; // Attacher l'utilisateur à l'objet socket.request
        next();
      } else {
        next(new Error("Non autorisé")); // Refuser la connexion Socket.IO si non authentifié
      }
    });
  });

  io.on("connection", async (socket) => {
    const user = socket.request.user; // Récupérer l'utilisateur authentifié
    const userId = user.username; // Utiliser le pseudo comme ID utilisateur

    // Gérer la connexion unique: déconnecter l'ancien socket si l'utilisateur se connecte ailleurs
    if (userSockets[userId] && userSockets[userId] !== socket.id) {
      logger.info(
        `Déconnexion forcée de l'ancien socket pour ${userId}: ${userSockets[userId]}`
      );
      io.to(userSockets[userId]).emit(
        "force_disconnect",
        "Vous avez été connecté sur une autre machine."
      );
      // Optionnel: forcer la déconnexion côté serveur de l'ancien socket
      const oldSocket = io.sockets.sockets.get(userSockets[userId]);
      if (oldSocket) {
        oldSocket.disconnect(true);
      }
    }
    userSockets[userId] = socket.id; // Enregistrer le nouveau socket de l'utilisateur

    connectedUsers.add(userId);

    logger.info(`Utilisateur connecté: ${userId} (${socket.id})`, {
      userId,
      socketId: socket.id,
      type: "socket_connect",
    });

    // 1. Envoyer l'historique des messages au nouvel utilisateur
    try {
      const history = await MessageService.getChatHistory();
      socket.emit("history", history);

      // Annoncer la connexion à tout le monde
      const systemJoinMsg = {
        user: "Système",
        text: `${userId} a rejoint la discussion.`,
        type: "system",
        timestamp: new Date(),
      };
      io.emit("chat message", systemJoinMsg);
    } catch (error) {
      logger.error("Erreur lors du chargement de l'historique:", error);
    }

    // Mettre à jour et diffuser la liste des utilisateurs à tous
    MessageService.broadcastUserList(io, connectedUsers);

    // Envoyer l'objet utilisateur actuel au client pour affichage
    const currentUserProfile = await UserModel.getUserProfileFromCacheOrDB(
      user.username
    );
    socket.emit("current user", {
      username: currentUserProfile.username,
      profilePicture: currentUserProfile.profilePicture || "", // Envoyer la photo de profil si elle existe
    });

    // 2. Écouter les nouveaux messages
    socket.on("chat message", async (msg) => {
      if (!msg.text || msg.text.trim() === "") return;

      const messageToSave = {
        user: userId,
        text: msg.text.trim(),
        timestamp: new Date(),
      };

      // Diffuser le message à tous les clients
      io.emit("chat message", messageToSave);

      // Émettre un événement pour les messages non lus si le destinataire n'est pas actif
      // Cette logique est gérée côté client en vérifiant document.hasFocus()
      // Le serveur n'a pas besoin de savoir si la fenêtre est active ou non.

      // 3. Sauvegarder le message dans la base de données
      await MessageService.saveMessage(messageToSave);
    });

    // 4. Gérer la déconnexion
    socket.on("disconnect", () => {
      connectedUsers.delete(userId);
      // Supprimer l'entrée de userSockets si le socket déconnecté est celui enregistré
      if (userSockets[userId] === socket.id) {
        delete userSockets[userId];
      }
      logger.info(`Utilisateur déconnecté: ${userId} (${socket.id})`, {
        userId,
        socketId: socket.id,
        type: "socket_disconnect",
      });

      const systemLeaveMsg = {
        user: "Système",
        text: `${userId} a quitté la discussion.`,
        type: "system",
        timestamp: new Date(),
      };
      io.emit("chat message", systemLeaveMsg);

      // Mettre à jour et diffuser la liste des utilisateurs
      MessageService.broadcastUserList(io, connectedUsers);
    });
  });

  httpServer.listen(PORT, () => {
    logger.info(
      `Serveur Node.js en cours d'exécution sur http://localhost:${PORT}`
    );
  });
}

async function startApplication() {
  // --- Initialisation de l'application Express et du serveur HTTP ---
  app = express();
  httpServer = createServer(app);

  io = new Server(httpServer, {
    cors: {
      origin: config.allowed_origins,
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  // Stocker l'instance de Socket.IO dans l'application Express pour y accéder depuis les contrôleurs
  app.set("io", io);

  // Connecter le client Redis et configurer l'adaptateur Socket.IO
  (async () => {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Adaptateur Socket.IO Redis configuré.");
  })();

  // Middleware pour parser le JSON dans les requêtes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Utiliser le middleware de compression pour toutes les réponses HTTP
  app.use(compression());

  // Utiliser cookie-parser avant la session
  app.use(cookieParser());

  // Configuration de la session avec MongoStore (MongoDB)
  sessionMiddleware = session({
    store: MongoStore.create({ mongoUrl: MONGODB_URI }),
    secret: config.session_secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.node_env === "production",
      sameSite: "Lax",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });

  app.use(sessionMiddleware);

  // Middleware pour servir les fichiers statiques du dossier 'src/admin'
  app.use("/admin", express.static(path.join(__dirname, "src", "admin")));
  // Middleware pour servir les fichiers statiques du dossier 'src/assets'
  app.use("/assets", express.static(path.join(__dirname, "src", "assets")));

  // Utilisation des routes
  app.use("/auth", authRoutes); // Routes d'authentification
  app.use("/api", apiRoutes); // Routes API
  app.use("/admin", adminRoutes); // Routes d'administration

  // Servir la documentation Swagger
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Gestion des erreurs CSRF
  app.use(csrfErrorHandler);

  // Middleware pour servir les fichiers statiques depuis le dossier 'public' (déplacé après les routes)
  app.use(express.static(path.join(__dirname, "public")));

  // Lancer le processus de connexion à la base de données au démarrage
  connectDB();
}

if (process.env.NODE_ENV !== "test") {
  startApplication();
}

module.exports = {
  app,
  httpServer,
  io,
  mongoClientInstance,
  redisClient,
  connectDB,
};
