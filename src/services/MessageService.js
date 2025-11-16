const logger = require("../../config/logger");
const redisClient = require("../../config/redisClient");
const UserModel = require("../models/UserModel");

let dbInstance;
const COLLECTION_NAME = "messages";

class MessageService {
  static setDb(db) {
    dbInstance = db;
  }

  static async getChatHistory() {
    let history = [];
    try {
      const cachedHistory = await redisClient.get("chat:history");
      if (cachedHistory) {
        history = JSON.parse(cachedHistory);
        logger.debug("Historique des messages récupéré du cache Redis.");
        return history;
      } else {
        logger.debug(
          "Historique des messages non trouvé dans le cache, tentative de récupération depuis la DB."
        );
      }
    } catch (redisError) {
      logger.warn(
        "Erreur lors de la récupération de l'historique depuis Redis, tentative de récupération depuis la DB:",
        redisError
      );
    }

    try {
      history = await dbInstance
        .collection(COLLECTION_NAME)
        .find({})
        .sort({ timestamp: 1 })
        .limit(100)
        .toArray();
      // Tenter de mettre en cache même si la récupération Redis initiale a échoué
      if (history.length > 0) {
        await redisClient.set("chat:history", JSON.stringify(history), {
          EX: 600,
        });
      }
      logger.debug("Historique des messages récupéré de la DB.");
      return history;
    } catch (dbError) {
      logger.error(
        "Erreur lors du chargement de l'historique des messages depuis la DB:",
        dbError
      );
      return [];
    }
  }

  static async saveMessage(message) {
    try {
      await dbInstance.collection(COLLECTION_NAME).insertOne(message);
    } catch (error) {
      logger.error("Erreur lors de la sauvegarde du message:", error);
    }
  }

  static async broadcastUserList(io, connectedUsers) {
    try {
      const connectedUserProfiles = await Promise.all(
        Array.from(connectedUsers).map(async (username) => {
          return await UserModel.getUserProfileFromCacheOrDB(username);
        })
      );
      io.emit("user list", connectedUserProfiles);
    } catch (error) {
      logger.error(
        "Erreur lors de la diffusion de la liste des utilisateurs:",
        error
      );
    }
  }
}

module.exports = MessageService;
