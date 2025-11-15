# Documentation des Tests Unitaires

Ce document décrit la configuration de Jest et les tests unitaires implémentés pour les services critiques de l'application.

## Configuration de Jest

Jest a été installé en tant que dépendance de développement :

```bash
npm install --save-dev jest
```

Pour exécuter les tests, vous pouvez ajouter un script à votre `package.json` :

```json
{
  "scripts": {
    "test": "jest"
  }
}
```

Ensuite, vous pouvez exécuter les tests avec :

```bash
npm test
```

## Services Critiques Testés

Les services suivants ont été identifiés comme critiques et des tests unitaires ont été écrits pour eux :

1.  `AuthService` (src/services/AuthService.js)
2.  `UserService` (src/services/UserService.js)
3.  `MessageService` (src/services/MessageService.js)

Les fichiers de test sont situés dans le répertoire `src/services/__tests__/`.

### 1. AuthService.js

Le service `AuthService` gère l'enregistrement, la connexion des utilisateurs et des administrateurs, ainsi que la déconnexion.

**Fichier de test :** `src/services/__tests__/AuthService.test.js`

**Fonctionnalités testées :**

- **`register(username, password, email)`**
  - Enregistrement réussi d'un nouvel utilisateur.
  - Gestion des cas où le pseudo est déjà pris.
  - Gestion des cas où l'email est déjà utilisé.
- **`login(username, password, ip)`**
  - Connexion réussie d'un utilisateur.
  - Blocage de la connexion après un nombre excessif de tentatives échouées.
  - Gestion des cas où le pseudo est incorrect.
  - Gestion des cas où le mot de passe est incorrect.
- **`adminLogin(username, password, ip)`**
  - Connexion réussie d'un administrateur.
  - Refus de connexion si l'utilisateur n'a pas le rôle 'admin'.
  - Gestion des cas où le pseudo ou le mot de passe est incorrect (similaire à `login`).
- **`logout(req)`**
  - Déconnexion réussie de l'utilisateur (destruction de session et effacement du cookie).
  - Gestion des erreurs lors de la destruction de la session.

### 2. UserService.js

Le service `UserService` gère les opérations CRUD pour les utilisateurs, y compris la gestion des profils et des listes d'utilisateurs.

**Fichier de test :** `src/services/__tests__/UserService.test.js`

**Fonctionnalités testées :**

- **`getUserProfile(userId)`**
  - Récupération réussie du profil utilisateur.
  - Gestion des cas où le profil utilisateur n'est pas trouvé.
- **`updateUserProfile(userId, updateData, file)`**
  - Mise à jour réussie du profil utilisateur (avec et sans fichier de profil).
  - Suppression de l'ancienne photo de profil lors de la mise à jour.
  - Gestion des cas où le nom d'utilisateur est déjà pris.
  - Gestion des cas où l'email est déjà utilisé.
  - Gestion des cas où l'utilisateur n'est pas trouvé.
- **`getUsers()`**
  - Récupération réussie de tous les utilisateurs.
- **`createUser(username, password, email, role)`**
  - Création réussie d'un nouvel utilisateur.
  - Gestion des cas où le pseudo est déjà pris.
  - Gestion des cas où l'email est déjà utilisé.
- **`deleteUser(id)`**
  - Suppression réussie d'un utilisateur.
  - Gestion des cas où l'utilisateur n'est pas trouvé.
- **`getUserById(id)`**
  - Récupération réussie d'un utilisateur par ID.
  - Gestion des cas où l'utilisateur n'est pas trouvé.
- **`updateUser(id, updateData)`**
  - Mise à jour réussie d'un utilisateur (avec et sans mot de passe).
  - Gestion des cas où le pseudo est déjà pris par un autre utilisateur.
  - Gestion des cas où l'email est déjà utilisé par un autre utilisateur.
  - Gestion des cas où l'utilisateur n'est pas trouvé.

### 3. MessageService.js

Le service `MessageService` gère l'historique des messages et la diffusion de la liste des utilisateurs connectés.

**Fichier de test :** `src/services/__tests__/MessageService.test.js`

**Fonctionnalités testées :**

- **`getChatHistory()`**
  - Récupération de l'historique des messages depuis le cache Redis si disponible.
  - Récupération de l'historique des messages depuis la base de données et mise en cache si non disponible dans Redis.
  - Gestion des erreurs lors de la récupération de l'historique.
- **`saveMessage(message)`**
  - Sauvegarde réussie d'un message dans la base de données.
  - Gestion des erreurs lors de la sauvegarde du message.
- **`broadcastUserList(io, connectedUsers)`**
  - Diffusion réussie de la liste des profils d'utilisateurs connectés via Socket.IO.
  - Gestion des erreurs lors de la diffusion de la liste des utilisateurs.

## Exécution des Tests

Pour exécuter tous les tests unitaires, naviguez jusqu'à la racine du projet et exécutez la commande suivante :

```bash
npm test
```

Jest détectera automatiquement les fichiers de test dans le répertoire `src/services/__tests__/` et exécutera les tests.
