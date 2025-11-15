/* Contient la logique métier pour les routes d'authentification. */ 

const path = require('path');
const { validationResult } = require('express-validator');
const logger = require('../../config/logger');
const AuthService = require('../services/AuthService');

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
exports.logout = async (req, res) => {
    try {
        await AuthService.logout(req);
        res.redirect('/login.html');
    } catch (err) {
        res.redirect('/');
    }
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
        const result = await AuthService.register(username, password, email);
        res.status(result.status).json({ message: result.message });
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
    const ip = req.ip;

    try {
        const result = await AuthService.login(username, password, ip);
        if (result.status === 200) {
            req.session.user = result.user;
            res.status(result.status).json({ message: result.message, username: result.user.username, role: result.user.role });
        } else {
            res.status(result.status).json({ message: result.message });
        }
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
    const ip = req.ip;

    try {
        const result = await AuthService.adminLogin(username, password, ip);
        if (result.status === 200) {
            req.session.user = result.user;
            res.status(result.status).json({ message: result.message });
        } else {
            res.status(result.status).json({ message: result.message });
        }
    } catch (error) {
        logger.error('Erreur lors de la connexion admin:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
};
