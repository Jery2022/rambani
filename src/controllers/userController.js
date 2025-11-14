/*  */
const path = require('path');
const { ObjectId } = require('mongodb');
const { validationResult } = require('express-validator');
const fs = require('fs');
const logger = require('../../config/logger');
const UserModel = require('../models/UserModel');
// API pour récupérer le profil de l'utilisateur courant
exports.getUserProfile = async (req, res) => {
    try {
        const user = await UserModel.findById(req.session.user.id, { password: 0, role: 0 });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Profil utilisateur non trouvé.' });
        }

        res.status(200).json({ success: true, profile: user });
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
        // Supprimer le fichier uploadé si la validation échoue
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.session.user.id;
    const { firstName, lastName, username, email } = req.body;
    let profilePicturePath = req.file ? `/images/profile_pictures/${req.file.filename}` : null;

    try {
        // Vérifier si le nom d'utilisateur est déjà pris par un autre utilisateur
        const existingUserByUsername = await UserModel.findByUsernameExcludingId(username, userId);
        if (existingUserByUsername) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(409).json({ success: false, message: 'Ce nom d\'utilisateur est déjà pris.' });
        }

        // Vérifier si l'email est déjà pris par un autre utilisateur
        const existingUserByEmail = await UserModel.findByEmailExcludingId(email, userId);
        if (existingUserByEmail) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé par un autre utilisateur.' });
        }

        const updateData = {
            firstName,
            lastName,
            username,
            email,
            lastUpdated: new Date()
        };

        // Si une nouvelle photo de profil est uploadée
        if (profilePicturePath) {
            const oldUser = await UserModel.findById(userId);
            // Supprimer l'ancienne photo de profil si elle existe et n'est pas une image par défaut
            if (oldUser && oldUser.profilePicture && !oldUser.profilePicture.startsWith('/images/default_avatar')) {
                const oldImagePath = path.join(__dirname, '..', '..', 'public', oldUser.profilePicture);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.profilePicture = profilePicturePath;
        }

        const result = await UserModel.update(userId, updateData);

        if (result.matchedCount === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }

        // Mettre à jour la session de l'utilisateur
        req.session.user = {
            ...req.session.user,
            ...updateData,
            id: userId
        };

        // Émettre un événement Socket.IO pour informer les clients de la mise à jour du profil
        req.app.get('io').emit('profile_updated', { userId: userId, profile: req.session.user });

        res.status(200).json({ success: true, message: 'Profil mis à jour avec succès.', profile: req.session.user });
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
        const users = await UserModel.findAll({ password: 0 });
        res.status(200).json(users);
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
        // Vérifier l'unicité du pseudo
        const existingUserByUsername = await UserModel.findByUsername(username);
        if (existingUserByUsername) {
            return res.status(409).json({ message: 'Ce pseudo est déjà pris.' });
        }

        // Vérifier l'unicité de l'email
        const existingUserByEmail = await UserModel.findByEmail(email);
        if (existingUserByEmail) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await UserModel.create({ username, password: hashedPassword, email, role });

        res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
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
        const result = await UserModel.delete(id);

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        res.status(200).json({ message: 'Utilisateur supprimé avec succès.' });
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
        const user = await UserModel.findById(id, { password: 0 });
        if (!user) {
            logger.info(`Serveur: Utilisateur non trouvé pour l'ID: ${id}`);
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        logger.debug(`Serveur: Utilisateur trouvé: ${user.username}`);
        res.status(200).json(user);
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

    try {
        // Vérifier si le nouveau pseudo est déjà pris par un autre utilisateur
        const existingUserByUsername = await UserModel.findByUsernameExcludingId(username, id);
        if (existingUserByUsername) {
            return res.status(409).json({ message: 'Ce pseudo est déjà pris par un autre utilisateur.' });
        }

        // Vérifier si l'email est déjà pris par un autre utilisateur
        const existingUserByEmail = await UserModel.findByEmailExcludingId(email, id);
        if (existingUserByEmail) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé par un autre utilisateur.' });
        }

        const updateData = { username, email, role };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const result = await UserModel.update(id, updateData);

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        res.status(200).json({ message: 'Utilisateur mis à jour avec succès.' });
    } catch (error) {
        logger.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.' });
    }
};
