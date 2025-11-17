const logger = require("../../config/logger");
const redisClient = require("../../config/redisClient");
const UserModel = require("../models/UserModel");
const { AppError } = require("../middleware/errorHandler");
const errorCodes = require("../utils/errorCodes");

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
      }
      logger.debug(
        "Historique des messages non trouvé dans le cache, tentative de récupération depuis la DB."
      );
    } catch (redisError) {
      logger.warn(
        "Erreur lors de la récupération de l'historique depuis Redis, tentative de récupération depuis la DB:",
        redisError
      );
      // Continuer à essayer de récupérer depuis la DB même si Redis échoue
    }

    try {
      history = await dbInstance
        .collection(COLLECTION_NAME)
        .find({})
        .sort({ timestamp: 1 })
        .limit(100)
        .toArray();
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
      throw new AppError(
        errorCodes.UNKNOWN_ERROR,
        "Échec du chargement de l'historique des messages."
      );
    }
  }

  static async saveMessage(message) {
    try {
      await dbInstance.collection(COLLECTION_NAME).insertOne(message);
    } catch (error) {
      logger.error("Erreur lors de la sauvegarde du message:", error);
      throw new AppError(
        errorCodes.MESSAGE_SEND_FAILED,
        "Échec de la sauvegarde du message."
      );
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
      throw new AppError(
        errorCodes.UNKNOWN_ERROR,
        "Échec de la diffusion de la liste des utilisateurs."
      );
    }
  }
}

module.exports = MessageService;
