const path = require("path");
const { mongoClientInstance, redisClient } = require("./server");
const { MongoClient } = require("mongodb"); // Importez MongoClient pour le mock

// Mock global pour path.resolve et path.basename
jest.mock("path", () => ({
  ...jest.requireActual("path"), // Garde les implémentations réelles pour les autres fonctions de path
  resolve: jest.fn((...args) => args.join("/")),
  basename: jest.fn((p, ext) => {
    const parts = p.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return ext ? filename.replace(ext, "") : filename;
  }),
}));

// Mock global pour dotenv.config
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Mock pour fs (pour éviter les erreurs ENOENT)
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(() => true), // Simuler que les fichiers existent pour les tests
}));

// Mock pour bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn((password, saltRounds) => Promise.resolve(`hashed${password}`)),
  compare: jest.fn((password, hash) =>
    Promise.resolve(password === "correctpassword")
  ),
}));

// Mock pour winston logger
jest.mock("./config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(), // Ajout de la méthode warn
}));

// Mock pour l'objet db de MongoDB
const mockCollection = {
  findOne: jest.fn((query) => {
    if (query && query._id) {
      // Simuler la recherche par ID
      if (query._id.toString() === "60d5ec49f8c7a7001c8e4d7a") {
        return Promise.resolve({
          _id: query._id,
          username: "testuser",
          email: "test@example.com",
          profilePicture: "/images/profile_pictures/old_pic.png",
        });
      }
    }
    if (query && query.username === "existinguser") {
      return Promise.resolve({
        _id: "60d5ec49f8c7a7001c8e4d7b",
        username: "existinguser",
        email: "existing@example.com",
      });
    }
    if (query && query.email === "existing@example.com") {
      return Promise.resolve({
        _id: "60d5ec49f8c7a7001c8e4d7b",
        username: "existinguser",
        email: "existing@example.com",
      });
    }
    return Promise.resolve(null);
  }),
  insertOne: jest.fn(() => Promise.resolve({ insertedId: "newUserId" })),
  updateOne: jest.fn((query, update) => {
    if (query._id && query._id.toString() === "60d5ec49f8c7a7001c8e4d7a") {
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    }
    return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
  }),
  deleteOne: jest.fn((query) => {
    if (query._id && query._id.toString() === "60d5ec49f8c7a7001c8e4d7a") {
      return Promise.resolve({ deletedCount: 1 });
    }
    return Promise.resolve({ deletedCount: 0 });
  }),
  find: jest.fn(() => ({
    toArray: jest.fn(() =>
      Promise.resolve([
        { _id: "user1", username: "user1" },
        { _id: "user2", username: "user2" },
      ])
    ),
  })),
  createIndex: jest.fn(() => Promise.resolve()),
};

const mockDb = {
  collection: jest.fn(() => mockCollection),
};

// Mock pour MongoClient
jest.mock("mongodb", () => ({
  ...jest.requireActual("mongodb"),
  MongoClient: {
    connect: jest.fn(async () => {
      const mockClient = {
        db: jest.fn(() => mockDb),
        close: jest.fn(() => Promise.resolve()),
        isConnected: jest.fn(() => true),
      };
      return mockClient;
    }),
  },
}));

// Mock pour le module UserModel
jest.mock("./src/models/UserModel", () => ({
  setDb: jest.fn(), // Simplement mock setDb pour qu'il existe
  getUserProfileFromCacheOrDB: jest.fn((username) => {
    if (username === "testuser") {
      return Promise.resolve({
        username: "testuser",
        profilePicture: "/images/default_avatar.png",
      });
    }
    return Promise.resolve(null);
  }),
  findByUsername: jest.fn((username) => {
    if (username === "existinguser") {
      return Promise.resolve({
        _id: "60d5ec49f8c7a7001c8e4d7b",
        username: "existinguser",
        email: "existing@example.com",
      });
    }
    return Promise.resolve(null);
  }),
  findByEmail: jest.fn((email) => {
    if (email === "existing@example.com") {
      return Promise.resolve({
        _id: "60d5ec49f8c7a7001c8e4d7b",
        email: "existing@example.com",
      });
    }
    return Promise.resolve(null);
  }),
  create: jest.fn((userData) => Promise.resolve({ insertedId: "newUserId" })),
  findById: jest.fn((id, projection) => {
    if (id === "60d5ec49f8c7a7001c8e4d7a") {
      return Promise.resolve({
        _id: "60d5ec49f8c7a7001c8e4d7a",
        username: "testuser",
        email: "test@example.com",
        profilePicture: "/images/profile_pictures/old_pic.png",
      });
    }
    return Promise.resolve(null);
  }),
  findByUsernameExcludingId: jest.fn((username, id) => {
    if (username === "existinguser" && id !== "60d5ec49f8c7a7001c8e4d7b") {
      return Promise.resolve({
        _id: "60d5ec49f8c7a7001c8e4d7b",
        username: "existinguser",
      });
    }
    return Promise.resolve(null);
  }),
  findByEmailExcludingId: jest.fn((email, id) => {
    if (email === "existing@example.com" && id !== "60d5ec49f8c7a7001c8e4d7b") {
      return Promise.resolve({
        _id: "60d5ec49f8c7a7001c8e4d7b",
        email: "existing@example.com",
      });
    }
    return Promise.resolve(null);
  }),
  update: jest.fn((id, updateData) => {
    if (id === "60d5ec49f8c7a7001c8e4d7a") {
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    }
    return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
  }),
  findAll: jest.fn(() =>
    Promise.resolve([
      { _id: "user1", username: "user1" },
      { _id: "user2", username: "user2" },
    ])
  ),
  deleteUser: jest.fn((id) => {
    if (id === "60d5ec49f8c7a7001c8e4d7a") {
      return Promise.resolve({ deletedCount: 1 });
    }
    return Promise.resolve({ deletedCount: 0 });
  }),
}));

// Mock pour le module LoginAttemptModel
jest.mock("./src/models/LoginAttemptModel", () => ({
  setDb: jest.fn(),
  recordLoginAttempt: jest.fn(),
  getLoginAttempts: jest.fn(),
  clearLoginAttempts: jest.fn(),
}));

// Mock pour le module MessageService
jest.mock("./src/services/MessageService", () => ({
  setDb: jest.fn(),
  getChatHistory: jest.fn(),
  saveMessage: jest.fn(),
  broadcastUserList: jest.fn(),
}));

// Mock pour redisClient
jest.mock("./config/redisClient", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(() => Promise.resolve()),
  duplicate: jest.fn(() => ({
    connect: jest.fn(() => Promise.resolve()),
    quit: jest.fn(() => Promise.resolve()),
    psubscribe: jest.fn(), // Ajout de psubscribe
  })),
  connect: jest.fn(() => Promise.resolve()),
  isReady: true, // Simuler que Redis est prêt
}));

// Mock pour le module server.js afin d'empêcher le démarrage du serveur HTTP/Socket.IO
jest.mock("./server", () => {
  const mockApp = {
    use: jest.fn(),
    set: jest.fn(),
  };
  const mockHttpServer = {
    listen: jest.fn((port, callback) => {
      if (callback) callback();
    }),
  };
  const mockIo = {
    use: jest.fn((middleware) => middleware({}, () => {})),
    on: jest.fn(),
    adapter: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    emit: jest.fn(),
    sockets: {
      sockets: {
        get: jest.fn(() => ({ disconnect: jest.fn() })),
      },
    },
  };
  const mockMongoClientInstance = {
    close: jest.fn(() => Promise.resolve()),
    isConnected: jest.fn(() => true),
  };
  const mockRedisClient = {
    quit: jest.fn(() => Promise.resolve()),
    isReady: true,
  };

  return {
    app: mockApp,
    httpServer: mockHttpServer,
    io: mockIo,
    mongoClientInstance: mockMongoClientInstance,
    redisClient: mockRedisClient,
    connectDB: jest.fn(() => Promise.resolve()),
  };
});

// Initialiser les modèles avec le mockDb avant chaque test
beforeEach(() => {
  const UserModel = require("./src/models/UserModel");
  const LoginAttemptModel = require("./src/models/LoginAttemptModel");
  const MessageService = require("./src/services/MessageService");

  UserModel.setDb(mockDb);
  LoginAttemptModel.setDb(mockDb);
  MessageService.setDb(mockDb);

  // Réinitialiser les mocks avant chaque test
  jest.clearAllMocks();
});

afterAll(async () => {
  // Les mocks de mongoClientInstance et redisClient dans server.js sont déjà gérés
  // par le mock de "./server" ci-dessus.
  // Nous n'avons pas besoin de les fermer ici directement car ils sont mockés.
});
