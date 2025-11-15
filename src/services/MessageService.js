const logger = require('../../config/logger');
const redisClient = require('../../config/redisClient');
const UserModel = require('../models/UserModel');

let dbInstance;
const COLLECTION_NAME = 'messages';

class MessageService {
    static setDb(db) {
        dbInstance = db;
    }

    static async getChatHistory() {
        try {
            let history = await redisClient.get('chat:history');
            if (history) {
                history = JSON.parse(history);
                logger.debug('Historique des messages récupéré du cache Redis.');
            } else {
                logger.debug('Historique des messages non trouvé dans le cache, récupération depuis la DB.');
                history = await dbInstance.collection(COLLECTION_NAME)
                                    .find({})
                                    .sort({ timestamp: 1 })
                                    .limit(100)
                                    .toArray();
                await redisClient.set('chat:history', JSON.stringify(history), { EX: 600 });
            }
            return history;
        } catch (error) {
            logger.error('Erreur lors du chargement de l\'historique des messages:', error);
            return [];
        }
    }

    static async saveMessage(message) {
        try {
            await dbInstance.collection(COLLECTION_NAME).insertOne(message);
        } catch (error) {
            logger.error('Erreur lors de la sauvegarde du message:', error);
        }
    }

    static async broadcastUserList(io, connectedUsers) {
        try {
            const connectedUserProfiles = await Promise.all(
                Array.from(connectedUsers).map(async (username) => {
                    return await UserModel.getUserProfileFromCacheOrDB(username);
                })
            );
            io.emit('user list', connectedUserProfiles);
        } catch (error) {
            logger.error('Erreur lors de la diffusion de la liste des utilisateurs:', error);
        }
    }
}

module.exports = MessageService;
