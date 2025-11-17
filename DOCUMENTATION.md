# Documentation Technique de l'Application Rambani Chat

## 1. Introduction

Cette documentation technique fournit un aperçu détaillé de l'architecture, des composants et des fonctionnalités de l'application de chat. Elle est destinée aux développeurs souhaitant comprendre, maintenir ou étendre le projet.

## 2. Architecture Générale

L'application est une application web basée sur Node.js, utilisant Express.js pour le backend et Socket.IO pour la communication en temps réel. MongoDB est utilisé comme base de données pour stocker les utilisateurs et les messages. Redis est utilisé pour la gestion des sessions et l'adaptateur Socket.IO.

L'architecture est divisée en plusieurs couches :

- **Frontend (Client)** : Pages HTML, CSS et JavaScript statiques pour l'interface utilisateur.
- **Backend (Serveur)** : API RESTful et gestion des événements Socket.IO.
- **Base de Données** : MongoDB pour la persistance des données, Redis pour le cache et les sessions.

## 3. Backend

Le backend est construit avec Node.js et le framework Express.js. Il gère l'authentification, la gestion des utilisateurs, la persistance des messages et la communication en temps réel via Socket.IO.

### 3.1. Structure des Dossiers Clés

- `server.js`: Point d'entrée principal de l'application, initialise le serveur Express, Socket.IO, la connexion à MongoDB et les middlewares.
- `config/`: Contient les fichiers de configuration de l'environnement, du logger et du client Redis.
  - `environnement.js`: Gère les variables d'environnement pour différents modes (développement, staging, production).
  - `logger.js`: Configuration du logger (Winston).
  - `redisClient.js`: Configuration et connexion au client Redis.
- `src/controllers/`: Contient la logique métier pour les routes Express.
  - `authController.js`: Gère les requêtes liées à l'authentification (connexion, inscription, déconnexion).
  - `userController.js`: Gère les requêtes liées aux utilisateurs (profil, administration des utilisateurs).
- `src/middleware/`: Contient les middlewares Express.
  - `authMiddleware.js`: Vérifie l'authentification et les rôles des utilisateurs.
  - `csrfMiddleware.js`: Protection CSRF.
  - `errorHandler.js`: Middleware centralisé pour la gestion des erreurs.
  - `uploadMiddleware.js`: Gère l'upload de fichiers (par exemple, photos de profil).
- `src/models/`: Définit les schémas et les méthodes d'interaction avec la base de données MongoDB.
  - `UserModel.js`: Modèle pour la collection `users`.
  - `LoginAttemptModel.js`: Modèle pour la collection `login_attempts` (gestion des tentatives de connexion).
- `src/routes/`: Définit les routes de l'API.
  - `authRoutes.js`: Routes pour l'authentification.
  - `apiRoutes.js`: Routes générales de l'API.
  - `adminRoutes.js`: Routes spécifiques à l'administration.
- `src/services/`: Contient la logique métier complexe et les interactions avec les modèles.
  - `AuthService.js`: Services liés à l'authentification (enregistrement, connexion, déconnexion).
  - `UserService.js`: Services liés à la gestion des utilisateurs (profil, CRUD utilisateurs).
  - `MessageService.js`: Services liés à la gestion des messages de chat.
- `src/utils/`: Contient des utilitaires et des constantes.
  - `errorCodes.js`: Codes d'erreur personnalisés.
- `public/`: Contient les fichiers statiques du frontend (HTML, CSS, JS, images).
- `src/admin/`: Contient les fichiers statiques pour l'interface d'administration.

### 3.2. API RESTful

L'application expose plusieurs endpoints RESTful pour l'authentification et la gestion des utilisateurs. La documentation Swagger est disponible via `/api-docs`.

**Exemples de Contrôleurs :**

#### `authController.js`

- `getLoginPage`: Sert la page de connexion (`public/login.html`).
- `getHomePage`: Sert la page de chat (`public/index.html`).
- `getAdminLoginPage`: Sert la page de connexion admin (`src/admin/login.html`).
- `logout`: Gère la déconnexion de l'utilisateur.
- `getCsrfToken`: Fournit un jeton CSRF.
- `register`: Enregistre un nouvel utilisateur.
- `login`: Gère la connexion des utilisateurs.
- `adminLogin`: Gère la connexion des administrateurs.

#### `userController.js`

- `getUserProfile`: Récupère le profil de l'utilisateur courant.
- `updateUserProfile`: Met à jour le profil de l'utilisateur courant, y compris la photo de profil.
- `getAdminPage`: Sert la page d'administration (`src/admin/index.html`).
- `getUsers`: Liste tous les utilisateurs (admin seulement).
- `createUser`: Crée un nouvel utilisateur (admin seulement).
- `deleteUser`: Supprime un utilisateur (admin seulement).
- `getEditUserPage`: Sert la page de modification d'utilisateur admin (`src/admin/edit-user.html`).
- `getUserById`: Récupère un utilisateur par ID (pour modification admin).
- `updateUser`: Met à jour un utilisateur par ID (admin seulement).

### 3.3. Services

Les services encapsulent la logique métier et interagissent avec les modèles de données.

#### `AuthService.js`

- `register(username, password, email)`: Gère l'enregistrement d'un nouvel utilisateur, y compris la vérification de l'unicité du pseudo et de l'email, et le hachage du mot de passe.
- `login(username, password, ip)`: Gère la connexion, y compris la vérification des identifiants, la gestion des tentatives de connexion échouées et le verrouillage du compte.
- `adminLogin(username, password, ip)`: Similaire à `login`, mais inclut une vérification du rôle `admin`.
- `logout(req)`: Détruit la session utilisateur.

#### `UserService.js`

- `getUserProfile(userId)`: Récupère les détails du profil d'un utilisateur.
- `updateUserProfile(userId, updateData, file)`: Met à jour les informations du profil, gère l'upload et la suppression des photos de profil, et vérifie l'unicité du pseudo/email.
- `getUsers()`: Récupère tous les utilisateurs (sans le mot de passe).
- `createUser(username, password, email, role)`: Crée un utilisateur via l'interface admin.
- `deleteUser(id)`: Supprime un utilisateur.
- `getUserById(id)`: Récupère un utilisateur par son ID.
- `updateUser(id, updateData)`: Met à jour les informations d'un utilisateur via l'interface admin.

### 3.4. Communication en Temps Réel (Socket.IO)

Le serveur utilise Socket.IO pour permettre une communication bidirectionnelle en temps réel entre le client et le serveur.

- **Événements Serveur :**
  - `connection`: Gère la connexion d'un nouvel utilisateur, envoie l'historique des messages, diffuse la liste des utilisateurs connectés et le profil de l'utilisateur. Gère également les connexions uniques (déconnexion forcée de l'ancien socket).
  - `chat message`: Reçoit les messages du client, les diffuse à tous les utilisateurs et les sauvegarde en base de données.
  - `disconnect`: Gère la déconnexion d'un utilisateur, met à jour et diffuse la liste des utilisateurs.
- **Événements Client :**
  - `history`: Reçoit l'historique des messages.
  - `chat message`: Reçoit les nouveaux messages.
  - `user list`: Reçoit la liste mise à jour des utilisateurs connectés.
  - `current user`: Reçoit les informations du profil de l'utilisateur courant.
  - `profile_updated`: Émis par le serveur via `io.emit` lorsqu'un profil est mis à jour.
  - `force_disconnect`: Émis par le serveur pour déconnecter un ancien socket.

### 3.5. Sécurité

- **Authentification par Session**: Utilise `express-session` avec `connect-mongo` pour stocker les sessions en base de données.
- **Hachage des Mots de Passe**: `bcrypt` est utilisé pour hacher les mots de passe avant de les stocker.
- **Protection CSRF**: `csurf` est utilisé pour protéger contre les attaques Cross-Site Request Forgery.
- **Limitation des Tentatives de Connexion**: Le service d'authentification implémente une logique pour limiter les tentatives de connexion et verrouiller les comptes après un certain nombre d'échecs.
- **Helmet**: Peut être activé en production pour sécuriser les en-têtes HTTP.
- **CORS**: Configuré pour autoriser les origines spécifiées.

## 4. Frontend

Le frontend est composé de fichiers HTML, CSS et JavaScript statiques servis par Express.

- `public/index.html`: Page principale de l'application de chat.
- `public/login.html`: Page de connexion pour les utilisateurs.
- `public/profile-modal.html`: Modale pour la gestion du profil utilisateur.
- `public/assets/style.css`, `public/assets/login.css`: Styles CSS de l'application.
- `src/admin/index.html`: Tableau de bord d'administration.
- `src/admin/login.html`: Page de connexion pour l'administration.
- `src/admin/edit-user.html`: Page de modification d'utilisateur pour l'administration.
- `src/assets/admin.css`, `src/assets/admin-login.css`: Styles CSS pour l'administration.

Le JavaScript côté client gère l'interaction avec l'API RESTful et les événements Socket.IO pour afficher les messages, gérer les utilisateurs connectés et mettre à jour l'interface utilisateur.

## 5. Base de Données

### 5.1. MongoDB

MongoDB est la base de données principale.

- **Collections :**
  - `users`: Stocke les informations des utilisateurs (username, email, password haché, rôle, photo de profil, etc.).
    - Index uniques sur `username` et `email`.
  - `messages`: Stocke l'historique des messages du chat.
  - `login_attempts`: Enregistre les tentatives de connexion échouées pour implémenter la limitation des tentatives.
    - Index sur `username` et `ip`.
    - Index TTL sur `timestamp` pour supprimer automatiquement les anciennes tentatives.
  - `sessions`: Utilisée par `connect-mongo` pour stocker les sessions Express.

### 5.2. Redis

Redis est utilisé pour :

- **Cache de Profils Utilisateur**: `UserModel.getUserProfileFromCacheOrDB` utilise Redis pour cacher les profils utilisateur afin de réduire la charge sur MongoDB.
- **Adaptateur Socket.IO**: Permet de faire évoluer l'application Socket.IO sur plusieurs instances de serveur en diffusant les événements entre elles.

## 6. Configuration et Environnement

Le fichier `config/environnement.js` gère les configurations spécifiques à l'environnement (développement, staging, production).

- **Variables d'environnement clés :**
  - `NODE_ENV`: Définit l'environnement d'exécution.
  - `PORT`: Port sur lequel le serveur écoute.
  - `MONGODB_URI`: URI de connexion à MongoDB.
  - `SESSION_SECRET`: Secret pour les sessions Express.
  - `ALLOWED_ORIGINS`: Origines autorisées pour CORS.
  - `JWT_SECRET`, `JWT_EXPIRY`: Secrets et expiration pour les JSON Web Tokens (si utilisés pour d'autres API).
  - `LOG_LEVEL`: Niveau de journalisation (debug, info, error).
  - `HELMET_ENABLED`, `RATE_LIMIT_ENABLED`: Activation de Helmet et de la limitation de débit.
  - `LOGIN_ATTEMPTS_LIMIT`, `LOGIN_LOCK_TIME`: Configuration de la limitation des tentatives de connexion.
  - `REDIS_URI`: URI de connexion à Redis.

Les variables sensibles sont chargées depuis un fichier `.env` via `dotenv`. En production, des vérifications sont effectuées pour s'assurer que les variables d'environnement requises sont définies.

## 7. Déploiement

Le fichier `ecosystem.config.js` est fourni pour la gestion du processus avec PM2, facilitant le déploiement et la gestion en production.

### 7.1. Prérequis

Avant de déployer l'application, assurez-vous que les éléments suivants sont installés et configurés sur votre serveur :

- **Node.js** (version 18 ou supérieure recommandée)
- **npm** (Node Package Manager)
- **MongoDB** : Une instance de MongoDB en cours d'exécution et accessible.
- **Redis** : Une instance de Redis en cours d'exécution et accessible.
- **PM2** : Un gestionnaire de processus Node.js (installation globale : `npm install -g pm2`).
- **Variables d'environnement** : Un fichier `.env` configuré avec les variables sensibles pour l'environnement de production.

### 7.2. Configuration des Variables d'Environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes (exemple pour la production) :

```
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
MONGODB_URI=mongodb://user:password@your_mongodb_host:27017/chat_db?authSource=admin
SESSION_SECRET=your_strong_session_secret
ALLOWED_ORIGINS=https://your_domain.com,https://another_domain.com
JWT_SECRET=your_strong_jwt_secret
JWT_EXPIRY=24h
LOG_LEVEL=info
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true
LOGIN_ATTEMPTS_LIMIT=5
LOGIN_LOCK_TIME=15
REDIS_URI=redis://your_redis_host:6379
```

Assurez-vous que `MONGODB_URI`, `SESSION_SECRET`, `JWT_SECRET` et `REDIS_URI` sont correctement définis pour l'environnement de production.

### 7.3. Étapes de Déploiement

1.  **Cloner le dépôt** :

    ```bash
    git clone https://github.com/Jery2022/rambani.git
    cd rambani
    ```

2.  **Installer les dépendances** :

    ```bash
    npm install --production
    ```

    Utilisez `--production` pour n'installer que les dépendances nécessaires à l'exécution en production.

3.  **Démarrer l'application avec PM2** :
    L'application est configurée pour être gérée par PM2 via le fichier `ecosystem.config.js`.

    ```bash
    pm2 start ecosystem.config.js --env production
    ```

    Cette commande démarre l'application en mode cluster (utilisant tous les cœurs du CPU disponibles) et applique les variables d'environnement définies dans la section `env_production` du fichier `ecosystem.config.js` et celles du fichier `.env`.

4.  **Vérifier le statut de PM2** :

    ```bash
    pm2 status
    ```

    Vous devriez voir votre application `node-chat-app` listée avec le statut `online`.

5.  **Configurer un proxy inverse (Nginx/Apache)** :
    Il est fortement recommandé de placer un proxy inverse (comme Nginx ou Apache) devant votre application Node.js pour gérer le SSL, la mise en cache, la compression et la distribution de charge.

    **Exemple de configuration Nginx (simplifié) :**

    ```nginx
    server {
        listen 80;
        server_name your_domain.com;

        location / {
            proxy_pass http://localhost:3000; # Le port sur lequel votre application Node.js écoute
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```

    N'oubliez pas de configurer le SSL (par exemple avec Let's Encrypt) pour votre domaine.

### 7.4. Gestion de l'Application avec PM2

- **Voir les logs** :
  ```bash
  pm2 logs node-chat-app
  ```
- **Redémarrer l'application** :
  ```bash
  pm2 restart node-chat-app
  ```
- **Arrêter l'application** :
  ```bash
  pm2 stop node-chat-app
  ```
- **Supprimer l'application de PM2** :
  ```bash
  pm2 delete node-chat-app
  ```
- **Sauvegarder la configuration PM2** (pour redémarrer automatiquement après un reboot du serveur) :
  ```bash
  pm2 save
  ```
  Puis, pour configurer le démarrage automatique au boot :
  ```bash
  pm2 startup
  ```

## 8. Tests

Le dossier `src/services/__tests__/` contient des tests unitaires pour les services, utilisant Jest ainsi qu'un test d'intégration pour l'utilisation des APIs.
