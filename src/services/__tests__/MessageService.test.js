const MessageService = require("../MessageService");
const redisClient = require("../../../config/redisClient");
const UserModel = require("../../models/UserModel");
const logger = require("../../../config/logger");

// Mock des dépendances
jest.mock("../../../config/redisClient", () => ({
  get: jest.fn(),
  set: jest.fn(),
}));
jest.mock("../../models/UserModel", () => ({
  setDb: jest.fn(), // Ajout de setDb pour satisfaire jest.setup.js
  getUserProfileFromCacheOrDB: jest.fn(),
}));
jest.mock("../../../config/logger", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("MessageService", () => {
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    jest.clearAllMocks();
    // Réinitialiser les mocks de redisClient, UserModel et logger
    redisClient.get.mockClear();
    redisClient.set.mockClear();
    UserModel.getUserProfileFromCacheOrDB.mockClear();
    logger.debug.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();

    mockCollection = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      insertOne: jest.fn().mockResolvedValue({}), // Mock insertOne pour retourner une promesse résolue
    };
    mockDb = {
      collection: jest.fn(() => mockCollection),
    };
    MessageService.setDb(mockDb);
  });

  describe("getChatHistory", () => {
    it("devrait récupérer l'historique du cache Redis si disponible", async () => {
      const mockHistory = [{ text: "Hello" }];
      redisClient.get.mockResolvedValue(JSON.stringify(mockHistory));

      const result = await MessageService.getChatHistory();

      expect(redisClient.get).toHaveBeenCalledWith("chat:history");
      expect(logger.debug).toHaveBeenCalledWith(
        "Historique des messages récupéré du cache Redis."
      );
      expect(mockDb.collection).not.toHaveBeenCalled();
      expect(result).toEqual(mockHistory);
    });

    it("devrait récupérer l'historique de la DB et le mettre en cache si non disponible dans Redis", async () => {
      const mockHistory = [{ text: "Hello from DB" }];
      redisClient.get.mockResolvedValue(null);
      mockCollection.toArray.mockResolvedValue(mockHistory);
      redisClient.set.mockResolvedValue("OK");

      const result = await MessageService.getChatHistory();

      expect(redisClient.get).toHaveBeenCalledWith("chat:history");
      expect(logger.debug).toHaveBeenCalledWith(
        "Historique des messages non trouvé dans le cache, récupération depuis la DB."
      );
      expect(mockDb.collection).toHaveBeenCalledWith("messages");
      expect(mockCollection.find).toHaveBeenCalledWith({});
      expect(mockCollection.sort).toHaveBeenCalledWith({ timestamp: 1 });
      expect(mockCollection.limit).toHaveBeenCalledWith(100);
      expect(mockCollection.toArray).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        "chat:history",
        JSON.stringify(mockHistory),
        { EX: 600 }
      );
      expect(result).toEqual(mockHistory);
    });

    it("devrait retourner un tableau vide en cas d'erreur", async () => {
      const mockError = new Error("Redis error");
      redisClient.get.mockRejectedValue(mockError);

      const result = await MessageService.getChatHistory();

      expect(redisClient.get).toHaveBeenCalledWith("chat:history");
      expect(logger.error).toHaveBeenCalledWith(
        "Erreur lors du chargement de l'historique des messages:",
        mockError
      );
      expect(result).toEqual([]);
    });

    it("devrait récupérer l'historique de la DB si la récupération du cache Redis échoue", async () => {
      const mockHistory = [{ text: "Hello from DB after Redis error" }];
      const mockRedisError = new Error("Redis connection error");
      redisClient.get.mockRejectedValue(mockRedisError);
      mockCollection.toArray.mockResolvedValue(mockHistory);
      redisClient.set.mockResolvedValue("OK");

      const result = await MessageService.getChatHistory();

      expect(redisClient.get).toHaveBeenCalledWith("chat:history");
      expect(logger.warn).toHaveBeenCalledWith(
        "Erreur lors de la récupération de l'historique depuis Redis, tentative de récupération depuis la DB:",
        mockRedisError
      );
      expect(mockDb.collection).toHaveBeenCalledWith("messages");
      expect(mockCollection.find).toHaveBeenCalledWith({});
      expect(mockCollection.sort).toHaveBeenCalledWith({ timestamp: 1 });
      expect(mockCollection.limit).toHaveBeenCalledWith(100);
      expect(mockCollection.toArray).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalledWith(
        "chat:history",
        JSON.stringify(mockHistory),
        { EX: 600 }
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe("saveMessage", () => {
    it("devrait sauvegarder un message dans la DB", async () => {
      const mockMessage = { user: "test", text: "Hi", timestamp: new Date() };
      mockCollection.insertOne.mockResolvedValue({});

      await MessageService.saveMessage(mockMessage);

      expect(mockDb.collection).toHaveBeenCalledWith("messages");
      expect(mockCollection.insertOne).toHaveBeenCalledWith(mockMessage);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("devrait logger une erreur si la sauvegarde échoue", async () => {
      const mockMessage = { user: "test", text: "Hi", timestamp: new Date() };
      const mockError = new Error("DB insert error");
      mockCollection.insertOne.mockRejectedValue(mockError);

      await MessageService.saveMessage(mockMessage);

      expect(mockDb.collection).toHaveBeenCalledWith("messages");
      expect(mockCollection.insertOne).toHaveBeenCalledWith(mockMessage);
      expect(logger.error).toHaveBeenCalledWith(
        "Erreur lors de la sauvegarde du message:",
        mockError
      );
    });
  });

  describe("broadcastUserList", () => {
    it("devrait diffuser la liste des utilisateurs connectés", async () => {
      const mockIo = { emit: jest.fn() };
      const connectedUsers = new Set(["user1", "user2"]);
      const mockUserProfile1 = {
        username: "user1",
        profilePicture: "pic1.png",
      };
      const mockUserProfile2 = {
        username: "user2",
        profilePicture: "pic2.png",
      };

      UserModel.getUserProfileFromCacheOrDB
        .mockResolvedValueOnce(mockUserProfile1)
        .mockResolvedValueOnce(mockUserProfile2);

      await MessageService.broadcastUserList(mockIo, connectedUsers);

      expect(UserModel.getUserProfileFromCacheOrDB).toHaveBeenCalledWith(
        "user1"
      );
      expect(UserModel.getUserProfileFromCacheOrDB).toHaveBeenCalledWith(
        "user2"
      );
      expect(mockIo.emit).toHaveBeenCalledWith("user list", [
        mockUserProfile1,
        mockUserProfile2,
      ]);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("devrait logger une erreur si la diffusion échoue", async () => {
      const mockIo = { emit: jest.fn() };
      const connectedUsers = new Set(["user1"]);
      const mockError = new Error("Broadcast error");

      // Utiliser mockImplementation pour retourner une promesse rejetée explicitement
      UserModel.getUserProfileFromCacheOrDB.mockImplementation(() => {
        return Promise.reject(mockError);
      });

      await MessageService.broadcastUserList(mockIo, connectedUsers);

      expect(UserModel.getUserProfileFromCacheOrDB).toHaveBeenCalledWith(
        "user1"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Erreur lors de la diffusion de la liste des utilisateurs:",
        mockError
      );
      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });
});
