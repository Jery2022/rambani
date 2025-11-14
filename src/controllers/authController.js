/* Contient la logique métier pour les routes d'authentification. */ 

const path = require('path');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const logger = require('../../config/logger');
const UserModel = require('../models/UserModel');
const LoginAttemptModel = require('../models/LoginAttemptModel');
const config = require('../../config/environnement');

// Contrôleur pour la page de connexion publique
exports.getLoginPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'login.html'));
};

// Contrôleur pour la page d'accueil (chat)
exports.getHomePage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
};

// Contrôleur pour la page de connexion de l'administration
exports.getAdminLoginPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'src', 'admin', 'login.html'), {
        csrfToken: req.csrfToken()
    });
};

// Contrôleur de déconnexion
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Supprime le cookie de session
        res.redirect('/login.html');
    });
};

// Contrôleur pour obtenir le jeton CSRF
exports.getCsrfToken = (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
};

// Contrôleur d'enregistrement
exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de l\'enregistrement:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, email } = req.body;

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
        await UserModel.create({ username, password: hashedPassword, email, role: 'user' });

        res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
    } catch (error) {
        logger.error('Erreur lors de l\'enregistrement:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement.' });
    }
};

// Contrôleur de connexion (chat)
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de la connexion:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
        const ip = req.ip;
        const now = new Date();
        const lockTimeMinutes = config.login_lock_time;
        const lockTimeThreshold = new Date(now.getTime() - lockTimeMinutes * 60 * 1000);

        await LoginAttemptModel.cleanOldAttempts(username, ip, lockTimeThreshold);

        const recentFailedAttempts = await LoginAttemptModel.countFailedAttempts(username, lockTimeThreshold);

        if (recentFailedAttempts >= config.login_attempts_limit) {
            logger.warn(`Tentative de connexion bloquée pour l'utilisateur ${username} (compte verrouillé).`);
            return res.status(429).json({ message: `Trop de tentatives de connexion. Veuillez réessayer dans ${lockTimeMinutes} minutes.` });
        }

        const user = await UserModel.findByUsername(username);

        if (!user) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion échouée (pseudo incorrect)', { username, ip, type: 'login_attempt' });
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion échouée (mot de passe incorrect)', { username, ip, type: 'login_attempt' });
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        await LoginAttemptModel.deleteAttemptsByUsername(username);

        req.session.user = { 
            id: user._id.toString(), 
            username: user.username, 
            role: user.role,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            profilePicture: user.profilePicture || ''
        };
        logger.info('Connexion utilisateur réussie', { username: user.username, ip, type: 'user_login' });
        res.status(200).json({ message: 'Connexion réussie.', username: user.username, role: user.role });
    } catch (error) {
        logger.error('Erreur lors de la connexion:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
};

// Contrôleur de connexion pour l'administration
exports.adminLogin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Erreur de validation lors de la connexion admin:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
        const ip = req.ip;
        const now = new Date();
        const lockTimeMinutes = config.login_lock_time;
        const lockTimeThreshold = new Date(now.getTime() - lockTimeMinutes * 60 * 1000);

        await LoginAttemptModel.cleanOldAttempts(username, ip, lockTimeThreshold);

        const recentFailedAttempts = await LoginAttemptModel.countFailedAttempts(username, lockTimeThreshold);

        if (recentFailedAttempts >= config.login_attempts_limit) {
            logger.warn(`Tentative de connexion admin bloquée pour l'utilisateur ${username} (compte verrouillé).`);
            return res.status(429).json({ message: `Trop de tentatives de connexion. Veuillez réessayer dans ${lockTimeMinutes} minutes.` });
        }

        const user = await UserModel.findByUsername(username);

        if (!user) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion admin échouée (pseudo incorrect)', { username, ip, type: 'admin_login_attempt' });
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion admin échouée (mot de passe incorrect)', { username, ip, type: 'admin_login_attempt' });
            return res.status(401).json({ message: 'Pseudo ou mot de passe incorrect.' });
        }

        await LoginAttemptModel.deleteAttemptsByUsername(username);

        if (user.role !== 'admin') {
            logger.warn('Tentative de connexion admin échouée (rôle non autorisé)', { username, ip, type: 'admin_login_attempt' });
            return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent se connecter ici.' });
        }

        req.session.user = { id: user._id.toString(), username: user.username, role: user.role };
        logger.info('Connexion administrateur réussie', { username: user.username, ip, type: 'admin_login' });
        res.status(200).json({ message: 'Connexion réussie.' });
    } catch (error) {
        logger.error('Erreur lors de la connexion admin:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
};
