const AuthService = require("../AuthService");
const UserModel = require("../../models/UserModel");
const LoginAttemptModel = require("../../models/LoginAttemptModel");
const bcrypt = require("bcrypt");
const logger = require("../../../config/logger");
const config = require("../../../config/environnement");

// Mock des dépendances
jest.mock("../../models/UserModel");
jest.mock("../../models/LoginAttemptModel");
jest.mock("bcrypt");
jest.mock("../../../config/logger");
jest.mock("../../../config/environnement", () => ({
  login_lock_time: 5,
  login_attempts_limit: 3,
}));

describe("AuthService", () => {
  beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("devrait enregistrer un nouvel utilisateur avec succès", async () => {
      UserModel.findByUsername.mockResolvedValue(null);
      UserModel.findByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedPassword123");
      UserModel.create.mockResolvedValue({});

      const result = await AuthService.register(
        "testuser",
        "password123",
        "test@example.com"
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith("testuser");
      expect(UserModel.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(UserModel.create).toHaveBeenCalledWith({
        username: "testuser",
        password: "hashedPassword123",
        email: "test@example.com",
        role: "user",
      });
      expect(result).toEqual({
        status: 201,
        message: "Utilisateur enregistré avec succès.",
      });
    });

    it("devrait retourner une erreur si le pseudo est déjà pris", async () => {
      UserModel.findByUsername.mockResolvedValue({ username: "testuser" });

      const result = await AuthService.register(
        "testuser",
        "password123",
        "test@example.com"
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith("testuser");
      expect(UserModel.findByEmail).not.toHaveBeenCalled(); // Ne devrait pas vérifier l'email si le pseudo est déjà pris
      expect(result).toEqual({
        status: 409,
        message: "Ce pseudo est déjà pris.",
      });
    });

    it("devrait retourner une erreur si l'email est déjà utilisé", async () => {
      UserModel.findByUsername.mockResolvedValue(null);
      UserModel.findByEmail.mockResolvedValue({ email: "test@example.com" });

      const result = await AuthService.register(
        "testuser",
        "password123",
        "test@example.com"
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith("testuser");
      expect(UserModel.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(result).toEqual({
        status: 409,
        message: "Cet email est déjà utilisé.",
      });
    });
  });

  describe("login", () => {
    const mockIp = "127.0.0.1";
    const mockUsername = "testuser";
    const mockPassword = "password123";
    const mockHashedPassword = "hashedPassword123";

    it("devrait connecter un utilisateur avec succès", async () => {
      LoginAttemptModel.cleanOldAttempts.mockResolvedValue();
      LoginAttemptModel.countFailedAttempts.mockResolvedValue(0);
      UserModel.findByUsername.mockResolvedValue({
        _id: "someId",
        username: mockUsername,
        password: mockHashedPassword,
        role: "user",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        profilePicture: "pic.png",
      });
      bcrypt.compare.mockResolvedValue(true);
      LoginAttemptModel.deleteAttemptsByUsername.mockResolvedValue();

      const result = await AuthService.login(
        mockUsername,
        mockPassword,
        mockIp
      );

      expect(LoginAttemptModel.cleanOldAttempts).toHaveBeenCalled();
      expect(LoginAttemptModel.countFailedAttempts).toHaveBeenCalled();
      expect(UserModel.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        mockPassword,
        mockHashedPassword
      );
      expect(LoginAttemptModel.deleteAttemptsByUsername).toHaveBeenCalledWith(
        mockUsername
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Connexion utilisateur réussie",
        expect.any(Object)
      );
      expect(result).toEqual({
        status: 200,
        message: "Connexion réussie.",
        user: {
          id: "someId",
          username: mockUsername,
          role: "user",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          profilePicture: "pic.png",
        },
      });
    });

    it("devrait bloquer la connexion si trop de tentatives échouées", async () => {
      LoginAttemptModel.cleanOldAttempts.mockResolvedValue();
      LoginAttemptModel.countFailedAttempts.mockResolvedValue(
        config.login_attempts_limit
      );

      const result = await AuthService.login(
        mockUsername,
        mockPassword,
        mockIp
      );

      expect(LoginAttemptModel.cleanOldAttempts).toHaveBeenCalled();
      expect(LoginAttemptModel.countFailedAttempts).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Tentative de connexion bloquée")
      );
      expect(result).toEqual({
        status: 429,
        message: `Trop de tentatives de connexion. Veuillez réessayer dans ${config.login_lock_time} minutes.`,
      });
      expect(UserModel.findByUsername).not.toHaveBeenCalled();
    });

    it("devrait retourner une erreur si le pseudo est incorrect", async () => {
      LoginAttemptModel.cleanOldAttempts.mockResolvedValue();
      LoginAttemptModel.countFailedAttempts.mockResolvedValue(0);
      UserModel.findByUsername.mockResolvedValue(null);
      LoginAttemptModel.create.mockResolvedValue({});

      const result = await AuthService.login(
        mockUsername,
        mockPassword,
        mockIp
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(LoginAttemptModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: mockUsername,
          ip: mockIp,
          success: false,
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Tentative de connexion échouée (pseudo incorrect)",
        expect.objectContaining({
          username: mockUsername,
          ip: mockIp,
          type: "login_attempt",
        })
      );
      expect(result).toEqual({
        status: 401,
        message: "Pseudo ou mot de passe incorrect.",
      });
    });

    it("devrait retourner une erreur si le mot de passe est incorrect", async () => {
      LoginAttemptModel.cleanOldAttempts.mockResolvedValue();
      LoginAttemptModel.countFailedAttempts.mockResolvedValue(0);
      UserModel.findByUsername.mockResolvedValue({
        _id: "someId",
        username: mockUsername,
        password: mockHashedPassword,
        role: "user",
      });
      bcrypt.compare.mockResolvedValue(false);
      LoginAttemptModel.create.mockResolvedValue({});

      const result = await AuthService.login(
        mockUsername,
        mockPassword,
        mockIp
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        mockPassword,
        mockHashedPassword
      );
      expect(LoginAttemptModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: mockUsername,
          ip: mockIp,
          success: false,
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Tentative de connexion échouée (mot de passe incorrect)",
        expect.objectContaining({
          username: mockUsername,
          ip: mockIp,
          type: "login_attempt",
        })
      );
      expect(result).toEqual({
        status: 401,
        message: "Pseudo ou mot de passe incorrect.",
      });
    });
  });

  describe("adminLogin", () => {
    const mockIp = "127.0.0.1";
    const mockAdminUsername = "adminuser";
    const mockAdminPassword = "adminpassword";
    const mockHashedAdminPassword = "hashedAdminPassword123";

    it("devrait connecter un administrateur avec succès", async () => {
      LoginAttemptModel.cleanOldAttempts.mockResolvedValue();
      LoginAttemptModel.countFailedAttempts.mockResolvedValue(0);
      UserModel.findByUsername.mockResolvedValue({
        _id: "adminId",
        username: mockAdminUsername,
        password: mockHashedAdminPassword,
        role: "admin",
      });
      bcrypt.compare.mockResolvedValue(true);
      LoginAttemptModel.deleteAttemptsByUsername.mockResolvedValue();

      const result = await AuthService.adminLogin(
        mockAdminUsername,
        mockAdminPassword,
        mockIp
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith(mockAdminUsername);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        mockAdminPassword,
        mockHashedAdminPassword
      );
      expect(LoginAttemptModel.deleteAttemptsByUsername).toHaveBeenCalledWith(
        mockAdminUsername
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Connexion administrateur réussie",
        expect.any(Object)
      );
      expect(result).toEqual({
        status: 200,
        message: "Connexion réussie.",
        user: {
          id: "adminId",
          username: mockAdminUsername,
          role: "admin",
        },
      });
    });

    it("devrait refuser la connexion si l'utilisateur n'est pas un administrateur", async () => {
      LoginAttemptModel.cleanOldAttempts.mockResolvedValue();
      LoginAttemptModel.countFailedAttempts.mockResolvedValue(0);
      UserModel.findByUsername.mockResolvedValue({
        _id: "userId",
        username: "normaluser",
        password: mockHashedAdminPassword,
        role: "user",
      });
      bcrypt.compare.mockResolvedValue(true);
      LoginAttemptModel.deleteAttemptsByUsername.mockResolvedValue();

      const result = await AuthService.adminLogin(
        "normaluser",
        mockAdminPassword,
        mockIp
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith("normaluser");
      expect(bcrypt.compare).toHaveBeenCalledWith(
        mockAdminPassword,
        mockHashedAdminPassword
      );
      expect(LoginAttemptModel.deleteAttemptsByUsername).toHaveBeenCalledWith(
        "normaluser"
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Tentative de connexion admin échouée (rôle non autorisé)",
        expect.objectContaining({
          username: "normaluser",
          ip: mockIp,
          type: "admin_login_attempt",
        })
      );
      expect(result).toEqual({
        status: 403,
        message:
          "Accès refusé. Seuls les administrateurs peuvent se connecter ici.",
      });
    });
  });

  describe("logout", () => {
    it("devrait déconnecter l'utilisateur avec succès", async () => {
      const mockReq = {
        session: {
          destroy: jest.fn((cb) => cb(null)),
        },
        res: {
          clearCookie: jest.fn(),
        },
      };

      await AuthService.logout(mockReq);

      expect(mockReq.session.destroy).toHaveBeenCalled();
      expect(mockReq.res.clearCookie).toHaveBeenCalledWith("connect.sid");
    });

    it("devrait gérer les erreurs de déconnexion", async () => {
      const mockError = new Error("Session destroy failed");
      const mockReq = {
        session: {
          destroy: jest.fn((cb) => cb(mockError)),
        },
        res: {
          clearCookie: jest.fn(),
        },
      };

      await expect(AuthService.logout(mockReq)).rejects.toThrow(mockError);
      expect(mockReq.session.destroy).toHaveBeenCalled();
      expect(mockReq.res.clearCookie).not.toHaveBeenCalled(); // Ne devrait pas être appelé en cas d'erreur
      expect(logger.error).toHaveBeenCalledWith(
        "Erreur lors de la déconnexion:",
        mockError
      );
    });
  });
});
