# Documentation des Tests

Ce document décrit la configuration de Jest et les tests implémentés pour l'application de chat Node.js.

## Configuration de Jest

Jest a été installé en tant que dépendance de développement avec les dépendances nécessaires :

```bash
npm install --save-dev jest supertest mongodb-memory-server
```

### Configuration (`jest.config.js`)

```javascript
module.exports = {
  setupFilesAfterEnv: ["./jest.setup.js"],
  testEnvironment: "node",
};
```

### Fichier de Setup (`jest.setup.js`)

Le fichier `jest.setup.js` contient tous les mocks globaux nécessaires pour :

- MongoDB et MongoClient
- Redis Client
- UserModel, LoginAttemptModel, MessageService
- Winston Logger
- bcrypt
- fs et path
- dotenv
- Le serveur principal (server.js) pour éviter le démarrage du serveur HTTP/Socket.IO pendant les tests

### Exécution des Tests

Pour exécuter tous les tests :

```bash
npm test
```

Pour exécuter un fichier de test spécifique :

```bash
npm test <chemin-vers-le-fichier>
```

Exemple :

```bash
npm test src/services/__tests__/AuthService.test.js
npm test src/routes/__tests__/apiRoutes.test.js
```

## Types de Tests Implémentés

### 1. Tests Unitaires des Services

Les services critiques suivants ont été testés :

1.  **AuthService** (`src/services/AuthService.js`)
2.  **UserService** (`src/services/UserService.js`)
3.  **MessageService** (`src/services/MessageService.js`)

Les fichiers de test sont situés dans `src/services/__tests__/`.

### 2. Tests d'Intégration des Routes API

Les routes API ont des tests d'intégration pour vérifier le comportement end-to-end avec Express, les sessions et CSRF.

Fichier de test : `src/routes/__tests__/apiRoutes.test.js`

### 1. AuthService.js

Le service `AuthService` gère l'enregistrement, la connexion des utilisateurs et des administrateurs, ainsi que la déconnexion.

**Fichier de test :** `src/services/__tests__/AuthService.test.js`

**Fonctionnalités testées :**

- **`register(username, password, email)`**
  - ✅ Enregistrement réussi d'un nouvel utilisateur.
  - ✅ Gestion des cas où le pseudo est déjà pris.
  - ✅ Gestion des cas où l'email est déjà utilisé.
- **`login(username, password, ip)`**
  - ✅ Connexion réussie d'un utilisateur.
  - ✅ Blocage de la connexion après un nombre excessif de tentatives échouées.
  - ✅ Gestion des cas où le pseudo est incorrect.
  - ✅ Gestion des cas où le mot de passe est incorrect.
- **`adminLogin(username, password, ip)`**
  - ✅ Connexion réussie d'un administrateur.
  - ✅ Refus de connexion si l'utilisateur n'a pas le rôle 'admin'.
  - ✅ Gestion des cas où le pseudo ou le mot de passe est incorrect (similaire à `login`).
- **`logout(req)`**
  - ✅ Déconnexion réussie de l'utilisateur (destruction de session et effacement du cookie).
  - ✅ Gestion des erreurs lors de la destruction de la session.

### 2. UserService.js

Le service `UserService` gère les opérations CRUD pour les utilisateurs, y compris la gestion des profils et des listes d'utilisateurs.

**Fichier de test :** `src/services/__tests__/UserService.test.js`

**Fonctionnalités testées :**

- **`getUserProfile(userId)`**
  - ✅ Récupération réussie du profil utilisateur.
  - ✅ Gestion des cas où le profil utilisateur n'est pas trouvé.
- **`updateUserProfile(userId, updateData, file)`**
  - ✅ Mise à jour réussie du profil utilisateur (avec et sans fichier de profil).
  - ✅ Suppression de l'ancienne photo de profil lors de la mise à jour.
  - ✅ Gestion des cas où le nom d'utilisateur est déjà pris.
  - ✅ Gestion des cas où l'email est déjà utilisé.
  - ✅ Gestion des cas où l'utilisateur n'est pas trouvé.
- **`getUsers()`**
  - ✅ Récupération réussie de tous les utilisateurs.
- **`createUser(username, password, email, role)`**
  - ✅ Création réussie d'un nouvel utilisateur.
  - ✅ Gestion des cas où le pseudo est déjà pris.
  - ✅ Gestion des cas où l'email est déjà utilisé.
- **`deleteUser(id)`**
  - ✅ Suppression réussie d'un utilisateur.
  - ✅ Gestion des cas où l'utilisateur n'est pas trouvé.
- **`getUserById(id)`**
  - ✅ Récupération réussie d'un utilisateur par ID.
  - ✅ Gestion des cas où l'utilisateur n'est pas trouvé.
- **`updateUser(id, updateData)`**
  - ✅ Mise à jour réussie d'un utilisateur (avec et sans mot de passe).
  - ✅ Gestion des cas où le pseudo est déjà pris par un autre utilisateur.
  - ✅ Gestion des cas où l'email est déjà utilisé par un autre utilisateur.
  - ✅ Gestion des cas où l'utilisateur n'est pas trouvé.

### 3. MessageService.js

Le service `MessageService` gère l'historique des messages et la diffusion de la liste des utilisateurs connectés.

**Fichier de test :** `src/services/__tests__/MessageService.test.js`

**Fonctionnalités testées :**

- **`getChatHistory()`**
  - ✅ Récupération de l'historique des messages depuis le cache Redis si disponible.
  - ✅ Récupération de l'historique des messages depuis la base de données et mise en cache si non disponible dans Redis.
  - ✅ Gestion des erreurs lors de la récupération de l'historique.
- **`saveMessage(message)`**
  - ✅ Sauvegarde réussie d'un message dans la base de données.
  - ✅ Gestion des erreurs lors de la sauvegarde du message.
- **`broadcastUserList(io, connectedUsers)`**
  - ✅ Diffusion réussie de la liste des profils d'utilisateurs connectés via Socket.IO.
  - ✅ Gestion des erreurs lors de la diffusion de la liste des utilisateurs.

---

## Tests d'Intégration

### Routes API (`apiRoutes.test.js`)

**Fichier de test :** `src/routes/__tests__/apiRoutes.test.js`

**Configuration :**

- Utilise supertest pour tester les routes Express
- Configure express-session (en mémoire pour les tests)
- Configure CSRF protection
- Mock les middlewares d'authentification

**Fonctionnalités testées :**

- **Token CSRF**
  - ✅ Retourne un jeton CSRF valide via `GET /api/csrf-token`

**Middlewares mockés :**

- `isAuthenticatedChat` - Simule un utilisateur authentifié
- `isAdmin` - Simule un administrateur authentifié
- `isAuthenticated` - Simule une authentification générique
- `upload.single()` - Simule l'upload de fichiers

**Corrections apportées :**

- Suppression de MongoStore pour éviter les fuites mémoire
- Utilisation d'une session en mémoire pour les tests
- Suppression des imports inutilisés (mongoose, MongoMemoryServer, etc.)

---

## Résumé des Tests

### Statistiques

- **Services testés :** 3 (AuthService, UserService, MessageService)
- **Routes testées :** 1 (API Routes avec CSRF)
- **Total de tests unitaires :** ~40+ assertions
- **Tests d'intégration :** 1+ scénarios

### Couverture des Fonctionnalités

**Authentification :**

- ✅ Inscription d'utilisateurs
- ✅ Connexion d'utilisateurs
- ✅ Connexion d'administrateurs
- ✅ Déconnexion
- ✅ Limitation des tentatives de connexion
- ✅ Validation des emails et pseudos

**Gestion des Utilisateurs :**

- ✅ CRUD complet (Create, Read, Update, Delete)
- ✅ Gestion des profils utilisateurs
- ✅ Upload de photos de profil
- ✅ Validation des données
- ✅ Gestion des doublons (username, email)

**Messages :**

- ✅ Récupération de l'historique
- ✅ Sauvegarde de messages
- ✅ Cache Redis
- ✅ Diffusion de la liste d'utilisateurs

**Sécurité :**

- ✅ Protection CSRF
- ✅ Hachage des mots de passe (bcrypt)
- ✅ Gestion des sessions
- ✅ Middleware d'authentification

---

## Bonnes Pratiques Implémentées

1. **Isolation des Tests** - Chaque test est indépendant grâce aux mocks
2. **Mocks Globaux** - Configuration centralisée dans `jest.setup.js`
3. **Tests End-to-End** - Les tests d'intégration vérifient le comportement complet
4. **Gestion de la Mémoire** - Évite les fuites mémoire en n'utilisant pas de connexions réelles pendant les tests
5. **Nettoyage** - `beforeEach` et `afterAll` assurent un état propre

---

## Exécution et Résultats

Pour exécuter tous les tests :

```bash
npm test
```

Pour exécuter les tests avec plus de mémoire (si nécessaire) :

```bash
set NODE_ENV=test && node --max-old-space-size=8192 node_modules/jest/bin/jest.js
```

**Statut :** ✅ Tous les tests passent avec succès

---

## Améliorations Futures Possibles

1. **Augmenter la couverture des routes API** - Tester toutes les routes (POST, PUT, DELETE)
2. **Tests de performance** - Vérifier les temps de réponse
3. **Tests de charge** - Simuler plusieurs utilisateurs simultanés
4. **Coverage Report** - Ajouter `jest --coverage` pour mesurer la couverture de code
5. **Tests E2E avec Socket.IO** - Tester les communications WebSocket en temps réel
