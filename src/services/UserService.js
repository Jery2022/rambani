const { ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const logger = require("../../config/logger");
const UserModel = require("../models/UserModel");

class UserService {
  static async getUserProfile(userId) {
    const user = await UserModel.findById(userId, { password: 0, role: 0 });
    if (!user) {
      return {
        success: false,
        status: 404,
        message: "Profil utilisateur non trouvé.",
      };
    }
    return { success: true, status: 200, profile: user };
  }

  static async updateUserProfile(userId, updateData, file) {
    let profilePicturePath = file
      ? `/images/profile_pictures/${file.filename}`
      : null;

    // Vérifier si le nom d'utilisateur est déjà pris par un autre utilisateur
    const existingUserByUsername = await UserModel.findByUsernameExcludingId(
      updateData.username,
      userId
    );
    if (existingUserByUsername) {
      if (file) fs.unlinkSync(file.path);
      return {
        success: false,
        status: 409,
        message: "Ce nom d'utilisateur est déjà pris.",
      };
    }

    // Vérifier si l'email est déjà pris par un autre utilisateur
    const existingUserByEmail = await UserModel.findByEmailExcludingId(
      updateData.email,
      userId
    );
    if (existingUserByEmail) {
      if (file) fs.unlinkSync(file.path);
      return {
        success: false,
        status: 409,
        message: "Cet email est déjà utilisé par un autre utilisateur.",
      };
    }

    const finalUpdateData = {
      ...updateData,
      lastUpdated: new Date(),
    };

    // Si une nouvelle photo de profil est uploadée
    if (profilePicturePath) {
      const oldUser = await UserModel.findById(userId);
      // Supprimer l'ancienne photo de profil si elle existe et n'est pas une image par défaut
      if (
        oldUser &&
        oldUser.profilePicture &&
        !oldUser.profilePicture.startsWith("/images/default_avatar")
      ) {
        const oldImagePath = path.join(
          __dirname,
          "..",
          "..",
          "public",
          oldUser.profilePicture
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      finalUpdateData.profilePicture = profilePicturePath;
    }

    const result = await UserModel.update(userId, finalUpdateData);

    if (result.matchedCount === 0) {
      if (file) fs.unlinkSync(file.path);
      return {
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      };
    }

    return {
      success: true,
      status: 200,
      message: "Profil mis à jour avec succès.",
      updatedData: finalUpdateData,
    };
  }

  static async getUsers() {
    const users = await UserModel.findAll({ password: 0 });
    return { success: true, status: 200, users };
  }

  static async createUser(username, password, email, role) {
    // Vérifier l'unicité du pseudo
    const existingUserByUsername = await UserModel.findByUsername(username);
    if (existingUserByUsername) {
      return {
        success: false,
        status: 409,
        message: "Ce pseudo est déjà pris.",
      };
    }

    // Vérifier l'unicité de l'email
    const existingUserByEmail = await UserModel.findByEmail(email);
    if (existingUserByEmail) {
      return {
        success: false,
        status: 409,
        message: "Cet email est déjà utilisé.",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await UserModel.create({ username, password: hashedPassword, email, role });

    return {
      success: true,
      status: 201,
      message: "Utilisateur enregistré avec succès.",
    };
  }

  static async deleteUser(id) {
    const result = await UserModel.deleteUser(id);
    if (result.deletedCount === 0) {
      return {
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      };
    }
    return {
      success: true,
      status: 200,
      message: "Utilisateur supprimé avec succès.",
    };
  }

  static async getUserById(id) {
    const user = await UserModel.findById(id, { password: 0 });
    if (!user) {
      logger.info(`Serveur: Utilisateur non trouvé pour l'ID: ${id}`);
      return {
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      };
    }
    logger.debug(`Serveur: Utilisateur trouvé: ${user.username}`);
    return { success: true, status: 200, user };
  }

  static async updateUser(id, updateData) {
    const { username, password, email, role } = updateData;

    // Vérifier si le nouveau pseudo est déjà pris par un autre utilisateur
    const existingUserByUsername = await UserModel.findByUsernameExcludingId(
      username,
      id
    );
    if (existingUserByUsername) {
      return {
        success: false,
        status: 409,
        message: "Ce pseudo est déjà pris par un autre utilisateur.",
      };
    }

    // Vérifier si l'email est déjà pris par un autre utilisateur
    const existingUserByEmail = await UserModel.findByEmailExcludingId(
      email,
      id
    );
    if (existingUserByEmail) {
      return {
        success: false,
        status: 409,
        message: "Cet email est déjà utilisé par un autre utilisateur.",
      };
    }

    const finalUpdateData = { username, email, role };

    if (password) {
      finalUpdateData.password = await bcrypt.hash(password, 10);
    }

    const result = await UserModel.update(id, finalUpdateData);

    if (result.matchedCount === 0) {
      return {
        success: false,
        status: 404,
        message: "Utilisateur non trouvé.",
      };
    }

    return {
      success: true,
      status: 200,
      message: "Utilisateur mis à jour avec succès.",
    };
  }
}

module.exports = UserService;
