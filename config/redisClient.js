/* Contient l'initialisation du client Redis. */

const redis = require('redis');
const config = require('./environnement');
const logger = require('./logger');

const REDIS_URI = config.redis_uri;

const redisClient = redis.createClient({ url: REDIS_URI });

redisClient.on('error', (err) => logger.error('Erreur Redis:', err));
redisClient.on('connect', () => logger.info('Connexion à Redis réussie !'));

(async () => {
    await redisClient.connect();
})();

module.exports = redisClient;
