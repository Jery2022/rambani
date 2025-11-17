/*  */
const path = require("path");
const { validationResult } = require("express-validator");
const fs = require("fs");
const logger = require("../../config/logger");
const UserService = require("../services/UserService");
const { AppError } = require("../middleware/errorHandler");
const errorCodes = require("../utils/errorCodes");

// API pour récupérer le profil de l'utilisateur courant
exports.getUserProfile = async (req, res, next) => {
  try {
    const result = await UserService.getUserProfile(req.session.user.id);
    res.status(result.statusCode).json(result);
  } catch (error) {
    next(error);
  }
};

// API pour mettre à jour le profil de l'utilisateur courant
exports.updateUserProfile = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) fs.unlinkSync(req.file.path);
    return next(
      new AppError(
        errorCodes.INVALID_INPUT,
        "Erreur de validation lors de la mise à jour du profil.",
        errors.array()
      )
    );
  }

  const userId = req.session.user.id;
  const { firstName, lastName, username, email } = req.body;
  const updateData = { firstName, lastName, username, email };

  try {
    const result = await UserService.updateUserProfile(
      userId,
      updateData,
      req.file
    );

    req.session.user = {
      ...req.session.user,
      ...result.updatedData,
      id: userId,
    };
    req.app
      .get("io")
      .emit("profile_updated", { userId: userId, profile: req.session.user });
    res
      .status(result.statusCode)
      .json({
        success: true,
        message: result.message,
        profile: req.session.user,
      });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(error);
  }
};

// Contrôleur pour la page d'administration
exports.getAdminPage = (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "src", "admin", "index.html"));
};

// API pour lister les utilisateurs (accessible uniquement aux administrateurs)
exports.getUsers = async (req, res, next) => {
  try {
    const result = await UserService.getUsers();
    res.status(result.statusCode).json(result.users);
  } catch (error) {
    next(error);
  }
};

// API pour enregistrer un nouvel utilisateur (accessible uniquement aux administrateurs)
exports.createUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new AppError(
        errorCodes.INVALID_INPUT,
        "Erreur de validation lors de l'enregistrement admin.",
        errors.array()
      )
    );
  }

  const { username, password, email, role } = req.body;

  try {
    const result = await UserService.createUser(
      username,
      password,
      email,
      role
    );
    res.status(result.statusCode).json({ message: result.message });
  } catch (error) {
    next(error);
  }
};

// API pour supprimer un utilisateur (accessible uniquement aux administrateurs)
exports.deleteUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new AppError(
        errorCodes.INVALID_INPUT,
        "Erreur de validation lors de la suppression d'un utilisateur.",
        errors.array()
      )
    );
  }

  const { id } = req.params;

  try {
    const result = await UserService.deleteUser(id);
    res.status(result.statusCode).json({ message: result.message });
  } catch (error) {
    next(error);
  }
};

// Contrôleur pour la page de modification d'utilisateur
exports.getEditUserPage = (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "..", "src", "admin", "edit-user.html")
  );
};

// API pour récupérer un utilisateur par son ID (pour le formulaire de modification)
exports.getUserById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new AppError(
        errorCodes.INVALID_INPUT,
        "Erreur de validation lors de la récupération d'un utilisateur par ID.",
        errors.array()
      )
    );
  }

  const { id } = req.params;
  logger.debug(`Serveur: Requête GET pour l'utilisateur avec ID: ${id}`);

  try {
    const result = await UserService.getUserById(id);
    res.status(result.statusCode).json(result.user);
  } catch (error) {
    next(error);
  }
};

// API pour modifier un utilisateur (accessible uniquement aux administrateurs)
exports.updateUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new AppError(
        errorCodes.INVALID_INPUT,
        "Erreur de validation lors de la mise à jour d'un utilisateur par ID.",
        errors.array()
      )
    );
  }

  const { id } = req.params;
  const { username, password, email, role } = req.body;
  const updateData = { username, password, email, role };

  try {
    const result = await UserService.updateUser(id, updateData);
    res.status(result.statusCode).json({ message: result.message });
  } catch (error) {
    next(error);
  }
};
