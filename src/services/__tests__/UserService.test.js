const UserService = require("../UserService");
const UserModel = require("../../models/UserModel");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const logger = require("../../../config/logger");

// Mock des dépendances
jest.mock("../../models/UserModel");
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
jest.mock("fs", () => ({
  unlinkSync: jest.fn(),
  existsSync: jest.fn(),
}));
jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
  resolve: jest.fn((...args) => args.join("/")),
  basename: jest.fn((p, ext) => {
    // Ajout du mock pour path.basename
    const parts = p.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return ext ? filename.replace(ext, "") : filename;
  }),
}));
jest.mock("../../../config/logger");

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserProfile", () => {
    it("devrait retourner le profil utilisateur si trouvé", async () => {
      const mockUser = {
        _id: "userId1",
        username: "testuser",
        email: "test@example.com",
      };
      UserModel.findById.mockResolvedValue(mockUser);

      const result = await UserService.getUserProfile("userId1");

      expect(UserModel.findById).toHaveBeenCalledWith("userId1", {
        password: 0,
        role: 0,
      });
      expect(result).toEqual({ success: true, status: 200, profile: mockUser });
    });

    it("devrait retourner une erreur si le profil utilisateur n'est pas trouvé", async () => {
      UserModel.findById.mockResolvedValue(null);

      const result = await UserService.getUserProfile("nonExistentId");

      expect(UserModel.findById).toHaveBeenCalledWith("nonExistentId", {
        password: 0,
        role: 0,
      });
      expect(result).toEqual({
        success: false,
        status: 404,
        message: "Profil utilisateur non trouvé.",
      });
    });
  });

  describe("updateUserProfile", () => {
    const mockUserId = "userId1";
    const mockUpdateData = {
      username: "newusername",
      email: "new@example.com",
    };
    const mockFile = { filename: "newpic.png", path: "/tmp/newpic.png" };

    it("devrait mettre à jour le profil utilisateur avec succès (sans fichier)", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue(null);
      UserModel.update.mockResolvedValue({ matchedCount: 1 });

      const result = await UserService.updateUserProfile(
        mockUserId,
        mockUpdateData,
        null
      );

      expect(UserModel.findByUsernameExcludingId).toHaveBeenCalledWith(
        mockUpdateData.username,
        mockUserId
      );
      expect(UserModel.findByEmailExcludingId).toHaveBeenCalledWith(
        mockUpdateData.email,
        mockUserId
      );
      expect(UserModel.update).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          username: mockUpdateData.username,
          email: mockUpdateData.email,
          lastUpdated: expect.any(Date),
        })
      );
      expect(result).toEqual({
        success: true,
        status: 200,
        message: "Profil mis à jour avec succès.",
        updatedData: expect.any(Object),
      });
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("devrait mettre à jour le profil utilisateur avec succès (avec nouveau fichier)", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue(null);
      UserModel.findById.mockResolvedValue({
        profilePicture: "/images/profile_pictures/old_pic.png",
      });
      fs.existsSync.mockReturnValue(true);
      path.join.mockReturnValueOnce(
        "public/images/profile_pictures/old_pic.png"
      ); // Mock spécifique pour ce test
      UserModel.update.mockResolvedValue({ matchedCount: 1 });

      const result = await UserService.updateUserProfile(
        mockUserId,
        mockUpdateData,
        mockFile
      );

      expect(UserModel.findById).toHaveBeenCalledWith(mockUserId);
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        "public/images/profile_pictures/old_pic.png"
      );
      expect(UserModel.update).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          ...mockUpdateData,
          profilePicture: `/images/profile_pictures/${mockFile.filename}`,
        })
      );
      expect(result).toEqual({
        success: true,
        status: 200,
        message: "Profil mis à jour avec succès.",
        updatedData: expect.any(Object),
      });
    });

    it("devrait retourner une erreur si le nom d'utilisateur est déjà pris", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue({
        _id: "anotherUserId",
      });

      const result = await UserService.updateUserProfile(
        mockUserId,
        mockUpdateData,
        mockFile
      );

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
      expect(result).toEqual({
        success: false,
        status: 409,
        message: "Ce nom d'utilisateur est déjà pris.",
      });
    });

    it("devrait retourner une erreur si l'email est déjà utilisé", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue({
        _id: "anotherUserId",
      });

      const result = await UserService.updateUserProfile(
        mockUserId,
        mockUpdateData,
        mockFile
      );

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
      expect(result).toEqual({
        success: false,
        status: 409,
        message: "Cet email est déjà utilisé par un autre utilisateur.",
      });
    });

    it("devrait retourner une erreur si l'utilisateur n'est pas trouvé", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue(null);
      UserModel.update.mockResolvedValue({ matchedCount: 0 });

      const result = await UserService.updateUserProfile(
        mockUserId,
        mockUpdateData,
        mockFile
      );

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockFile.path);
      expect(result).toEqual({
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      });
    });
  });

  describe("getUsers", () => {
    it("devrait retourner tous les utilisateurs", async () => {
      const mockUsers = [
        { _id: "u1", username: "user1" },
        { _id: "u2", username: "user2" },
      ];
      UserModel.findAll.mockResolvedValue(mockUsers);

      const result = await UserService.getUsers();

      expect(UserModel.findAll).toHaveBeenCalledWith({ password: 0 });
      expect(result).toEqual({ success: true, status: 200, users: mockUsers });
    });
  });

  describe("createUser", () => {
    const mockUsername = "newuser";
    const mockPassword = "newpassword";
    const mockEmail = "new@example.com";
    const mockRole = "user";

    it("devrait créer un nouvel utilisateur avec succès", async () => {
      UserModel.findByUsername.mockResolvedValue(null);
      UserModel.findByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedNewPassword");
      UserModel.create.mockResolvedValue({});

      const result = await UserService.createUser(
        mockUsername,
        mockPassword,
        mockEmail,
        mockRole
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(UserModel.findByEmail).toHaveBeenCalledWith(mockEmail);
      expect(bcrypt.hash).toHaveBeenCalledWith(mockPassword, 10);
      expect(UserModel.create).toHaveBeenCalledWith({
        username: mockUsername,
        password: "hashedNewPassword",
        email: mockEmail,
        role: mockRole,
      });
      expect(result).toEqual({
        success: true,
        status: 201,
        message: "Utilisateur enregistré avec succès.",
      });
    });

    it("devrait retourner une erreur si le pseudo est déjà pris", async () => {
      UserModel.findByUsername.mockResolvedValue({ username: mockUsername });

      const result = await UserService.createUser(
        mockUsername,
        mockPassword,
        mockEmail,
        mockRole
      );

      expect(UserModel.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(result).toEqual({
        success: false,
        status: 409,
        message: "Ce pseudo est déjà pris.",
      });
    });

    it("devrait retourner une erreur si l'email est déjà utilisé", async () => {
      UserModel.findByUsername.mockResolvedValue(null);
      UserModel.findByEmail.mockResolvedValue({ email: mockEmail });

      const result = await UserService.createUser(
        mockUsername,
        mockPassword,
        mockEmail,
        mockRole
      );

      expect(UserModel.findByEmail).toHaveBeenCalledWith(mockEmail);
      expect(result).toEqual({
        success: false,
        status: 409,
        message: "Cet email est déjà utilisé.",
      });
    });
  });

  describe("deleteUser", () => {
    it("devrait supprimer un utilisateur avec succès", async () => {
      UserModel.delete = jest.fn().mockResolvedValue({ deletedCount: 1 });

      const result = await UserService.deleteUser("userId1");

      expect(UserModel.delete).toHaveBeenCalledWith("userId1");
      expect(result).toEqual({
        success: true,
        status: 200,
        message: "Utilisateur supprimé avec succès.",
      });
    });

    it("devrait retourner une erreur si l'utilisateur n'est pas trouvé", async () => {
      UserModel.delete = jest.fn().mockResolvedValue({ deletedCount: 0 });

      const result = await UserService.deleteUser("nonExistentId");

      expect(UserModel.delete).toHaveBeenCalledWith("nonExistentId");
      expect(result).toEqual({
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      });
    });
  });

  describe("getUserById", () => {
    it("devrait retourner l'utilisateur si trouvé", async () => {
      const mockUser = { _id: "userId1", username: "testuser" };
      UserModel.findById.mockResolvedValue(mockUser);

      const result = await UserService.getUserById("userId1");

      expect(UserModel.findById).toHaveBeenCalledWith("userId1", {
        password: 0,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        `Serveur: Utilisateur trouvé: ${mockUser.username}`
      );
      expect(result).toEqual({ success: true, status: 200, user: mockUser });
    });

    it("devrait retourner une erreur si l'utilisateur n'est pas trouvé", async () => {
      UserModel.findById.mockResolvedValue(null);

      const result = await UserService.getUserById("nonExistentId");

      expect(UserModel.findById).toHaveBeenCalledWith("nonExistentId", {
        password: 0,
      });
      expect(logger.info).toHaveBeenCalledWith(
        `Serveur: Utilisateur non trouvé pour l'ID: nonExistentId`
      );
      expect(result).toEqual({
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      });
    });
  });

  describe("updateUser", () => {
    const mockUserId = "userId1";
    const mockUpdateData = {
      username: "updateduser",
      email: "updated@example.com",
      role: "admin",
      password: "newpass",
    };

    it("devrait mettre à jour l'utilisateur avec succès (avec mot de passe)", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedNewPass");
      UserModel.update.mockResolvedValue({ matchedCount: 1 });

      const result = await UserService.updateUser(mockUserId, mockUpdateData);

      expect(UserModel.findByUsernameExcludingId).toHaveBeenCalledWith(
        mockUpdateData.username,
        mockUserId
      );
      expect(UserModel.findByEmailExcludingId).toHaveBeenCalledWith(
        mockUpdateData.email,
        mockUserId
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(mockUpdateData.password, 10);
      expect(UserModel.update).toHaveBeenCalledWith(mockUserId, {
        username: mockUpdateData.username,
        email: mockUpdateData.email,
        role: mockUpdateData.role,
        password: "hashedNewPass",
      });
      expect(result).toEqual({
        success: true,
        status: 200,
        message: "Utilisateur mis à jour avec succès.",
      });
    });

    it("devrait mettre à jour l'utilisateur avec succès (sans mot de passe)", async () => {
      const updateDataWithoutPassword = {
        username: "updateduser",
        email: "updated@example.com",
        role: "admin",
      };
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue(null);
      UserModel.update.mockResolvedValue({ matchedCount: 1 });

      const result = await UserService.updateUser(
        mockUserId,
        updateDataWithoutPassword
      );

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(UserModel.update).toHaveBeenCalledWith(mockUserId, {
        username: updateDataWithoutPassword.username,
        email: updateDataWithoutPassword.email,
        role: updateDataWithoutPassword.role,
      });
      expect(result).toEqual({
        success: true,
        status: 200,
        message: "Utilisateur mis à jour avec succès.",
      });
    });

    it("devrait retourner une erreur si le pseudo est déjà pris par un autre utilisateur", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue({
        _id: "anotherUserId",
      });

      const result = await UserService.updateUser(mockUserId, mockUpdateData);

      expect(result).toEqual({
        success: false,
        status: 409,
        message: "Ce pseudo est déjà pris par un autre utilisateur.",
      });
    });

    it("devrait retourner une erreur si l'email est déjà utilisé par un autre utilisateur", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue({
        _id: "anotherUserId",
      });

      const result = await UserService.updateUser(mockUserId, mockUpdateData);

      expect(result).toEqual({
        success: false,
        status: 409,
        message: "Cet email est déjà utilisé par un autre utilisateur.",
      });
    });

    it("devrait retourner une erreur si l'utilisateur n'est pas trouvé", async () => {
      UserModel.findByUsernameExcludingId.mockResolvedValue(null);
      UserModel.findByEmailExcludingId.mockResolvedValue(null);
      UserModel.update.mockResolvedValue({ matchedCount: 0 });

      const result = await UserService.updateUser(mockUserId, mockUpdateData);

      expect(result).toEqual({
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      });
    });
  });
});
