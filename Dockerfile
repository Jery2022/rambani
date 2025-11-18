# Utiliser une image Node.js officielle comme base
FROM node:18-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier package.json et package-lock.json pour installer les dépendances
# Utiliser COPY --chown=node:node pour s'assurer que les fichiers appartiennent à l'utilisateur 'node'
COPY --chown=node:node package*.json ./

# Installer les dépendances de production
RUN npm install --production

# Copier le reste du code source de l'application
COPY --chown=node:node . .

# Exposer le port sur lequel l'application s'exécute
EXPOSE 3000

# Définir l'utilisateur non-root
USER node

# Commande pour démarrer l'application en production avec PM2
# Assurez-vous que PM2 est installé globalement dans l'image si vous l'utilisez ici,
# ou démarrez directement avec `node server.js` si PM2 est géré en dehors du conteneur.
# Pour cet exemple, nous allons démarrer directement avec node server.js
CMD ["node", "server.js"]
