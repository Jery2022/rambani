# Historique des tâches - Mise en place du monitoring (PM2, health checks)

Date : 17/11/2025

## Objectif

Mettre en place le monitoring de l'application Node.js avec PM2 et ajouter une route de health check.

## Tâches réalisées

1.  **Installation de PM2**

    - Commande exécutée : `npm install pm2 --save`
    - PM2 a été installé en tant que dépendance du projet.

2.  **Création du fichier de configuration PM2 (`ecosystem.config.js`)**

    - Un fichier `ecosystem.config.js` a été créé à la racine du projet pour configurer PM2.
    - Configuration initiale :
      ```javascript
      module.exports = {
        apps: [
          {
            name: "node-chat-app",
            script: "./server.js",
            instances: "max",
            exec_mode: "cluster",
            watch: true,
            env: {
              NODE_ENV: "development",
            },
            env_production: {
              NODE_ENV: "production",
            },
          },
        ],
      };
      ```

3.  **Ajout d'une route de health check (`/health`)**

    - La route `/health` a été ajoutée au fichier `server.js` pour permettre la vérification de l'état de l'application.
    - Code ajouté dans `server.js` :
      ```javascript
      app.get("/health", (req, res) => {
        res.status(200).send("OK");
      });
      ```
    - La route a été initialement placée au mauvais endroit, puis déplacée dans la fonction `startApplication` pour être correctement initialisée avec l'instance `app` d'Express.

4.  **Mise à jour de `package.json` avec des scripts PM2**

    - Les scripts `start` et `dev:pm2` ont été ajoutés ou modifiés dans `package.json` pour utiliser PM2.
    - Scripts ajoutés/modifiés :
      ```json
      "start": "pm2 start ecosystem.config.js --env production",
      "dev:pm2": "pm2 start ecosystem.config.js --env development"
      ```

5.  **Démarrage et vérification de l'application avec PM2**

    - L'application a été démarrée en mode développement via `npm run dev:pm2`.
    - Vérification des processus PM2 avec `npx pm2 list`.
    - Vérification de la route de health check via `http://localhost:3000/health`, qui a renvoyé "OK".

6.  **Correction du fichier `ecosystem.config.js` pour les environnements**

    - Le fichier `ecosystem.config.js` a été corrigé pour utiliser `env_development` au lieu de `env` pour l'environnement de développement, afin de résoudre l'avertissement `[PM2][WARN] Environment [development] is not defined in process file`.
    - Modification :
      ```javascript
      // Avant
      env: {
        NODE_ENV: "development"
      },
      // Après
      env_development: {
        NODE_ENV: "development",
      },
      ```

7.  **Redémarrage de l'application avec la configuration PM2 mise à jour**
    - L'application a été redémarrée avec la nouvelle configuration PM2 via `npx pm2 restart ecosystem.config.js --env development`.
    - Le statut des processus PM2 a été vérifié après le redémarrage.

## Résultat final

Le monitoring avec PM2 est configuré, l'application peut être démarrée en mode production ou développement via les scripts `npm`, et la route de health check `/health` est fonctionnelle.

---

Vous pouvez utiliser les commandes suivantes pour gérer l'application avec PM2 :

- `npm run start` pour démarrer l'application en mode production avec PM2.
- `npm run dev:pm2` pour démarrer l'application en mode développement avec PM2.
- `npx pm2 list` pour lister les processus PM2 et vérifier leur statut.
- `npx pm2 stop all` pour arrêter tous les processus PM2.
- `npx pm2 restart all` pour redémarrer tous les processus PM2.

---

## Analyse des résultats du test de charge K6 (nouvelle exécution)

Cette nouvelle exécution du test de charge K6 montre une performance encore améliorée par rapport à la précédente, avec une charge plus élevée :

- **Scénario** : Le test a été exécuté avec 100 utilisateurs virtuels (contre 70 précédemment) pendant 1 minute et 40 secondes (contre 1 minute et 10 secondes).
- **Vérifications réussies à 100%** : Toutes les 19860 vérifications (statut 200 et présence de "Chat Privé" sur la page) ont réussi. Cela confirme la robustesse de l'application même sous une charge accrue.
- **Durée moyenne des requêtes HTTP** : La durée moyenne est de seulement 6.01ms (contre 92.13ms précédemment). 90% des requêtes sont complétées en moins de 7.99ms et 95% en moins de 14.1ms. C'est une amélioration significative des temps de réponse, indiquant une excellente réactivité de l'application.
- **Aucune requête HTTP échouée** : Le taux d'échec reste à 0.00%, ce qui est crucial pour la fiabilité de l'application.
- **Débit** : L'application a géré 9930 requêtes HTTP à un rythme de 98.32 requêtes par seconde (contre 60.52 requêtes/s précédemment). L'augmentation du débit est proportionnelle à l'augmentation de la charge, ce qui est un signe de bonne scalabilité.
- **Utilisateurs virtuels** : Le test a simulé jusqu'à 100 utilisateurs virtuels, avec une moyenne de 73 VUs actifs.

**Conclusion :**

Les résultats de ce second test de charge sont exceptionnels. L'application gère une charge plus importante (100 VUs) avec des temps de réponse considérablement réduits et un débit accru, tout en maintenant un taux d'erreur de 0%. Cela démontre que l'application est très performante et stable, capable de gérer un nombre significatif d'utilisateurs simultanés de manière efficace.
