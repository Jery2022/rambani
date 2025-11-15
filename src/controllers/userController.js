/*  */
const path = require('path');
const { validationResult } = require('express-validator');
const fs = require('fs');
const logger = require('../../config/logger');
const UserService = require('../services/UserService');
// API pour récupérer le profil de l'utilisateur courant
exports.getUserProfile = async (req, res) => {
    try {
        const result = await UserService.getUserProfile(req.session.user.id);
        res.status(result.status).json(result);
    } catch (error) {
        logger.error('Erreur lors de la récupération du profil:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération du profil.' });
    }
};

// API pour mettre à jour le profil de l'utilisateur courant
exports.updateUserProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de la mise à jour du profil:', errors.array());
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.session.user.id;
    const { firstName, lastName, username, email } = req.body;
    const updateData = { firstName, lastName, username, email };

    try {
        const result = await UserService.updateUserProfile(userId, updateData, req.file);

        if (result.status === 200) {
            req.session.user = {
                ...req.session.user,
                ...result.updatedData,
                id: userId
            };
            req.app.get('io').emit('profile_updated', { userId: userId, profile: req.session.user });
            res.status(result.status).json({ success: true, message: result.message, profile: req.session.user });
        } else {
            res.status(result.status).json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Erreur lors de la mise à jour du profil:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour du profil.' });
    }
};

// Contrôleur pour la page d'administration
exports.getAdminPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'src', 'admin', 'index.html'));
};

// API pour lister les utilisateurs (accessible uniquement aux administrateurs)
exports.getUsers = async (req, res) => {
    try {
        const result = await UserService.getUsers();
        res.status(result.status).json(result.users);
    } catch (error) {
        logger.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
};

// API pour enregistrer un nouvel utilisateur (accessible uniquement aux administrateurs)
exports.createUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de l\'enregistrement admin:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, email, role } = req.body;

    try {
        const result = await UserService.createUser(username, password, email, role);
        res.status(result.status).json({ message: result.message });
    } catch (error) {
        logger.error('Erreur lors de l\'enregistrement d\'un utilisateur par l\'admin:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement de l\'utilisateur.' });
    }
};

// API pour supprimer un utilisateur (accessible uniquement aux administrateurs)
exports.deleteUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de la suppression d\'un utilisateur:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    try {
        const result = await UserService.deleteUser(id);
        res.status(result.status).json({ message: result.message });
    } catch (error) {
        logger.error('Erreur lors de la suppression d\'un utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'utilisateur.' });
    }
};

// Contrôleur pour la page de modification d'utilisateur
exports.getEditUserPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'src', 'admin', 'edit-user.html'));
};

// API pour récupérer un utilisateur par son ID (pour le formulaire de modification)
exports.getUserById = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de la récupération d\'un utilisateur par ID:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    logger.debug(`Serveur: Requête GET pour l'utilisateur avec ID: ${id}`);

    try {
        const result = await UserService.getUserById(id);
        if (result.status === 200) {
            res.status(result.status).json(result.user);
        } else {
            res.status(result.status).json({ message: result.message });
        }
    } catch (error) {
        logger.error('Erreur lors de la récupération de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'utilisateur.' });
    }
};

// API pour modifier un utilisateur (accessible uniquement aux administrateurs)
exports.updateUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de la mise à jour d\'un utilisateur par ID:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { username, password, email, role } = req.body;
    const updateData = { username, password, email, role };

    try {
        const result = await UserService.updateUser(id, updateData);
        res.status(result.status).json({ message: result.message });
    } catch (error) {
        logger.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.' });
    }
};
