/* Contient les routes liées à l'authentification (login, register, logout, csrf-token, admin/login). */

const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const csrfMiddleware = require('../middleware/csrfMiddleware');

const router = express.Router();

// Route pour la page de connexion publique
router.get('/login.html', authController.getLoginPage);

// Route pour la page d'accueil (chat), protégée par l'authentification publique
router.get('/', authMiddleware.isAuthenticatedChat, authController.getHomePage);

// Route de déconnexion
router.get('/logout', authController.logout);

// Route d'enregistrement (pour les tests ou si l'utilisateur souhaite une fonctionnalité d'enregistrement)
router.post('/register', 
    authMiddleware.isAuthenticated, 
    csrfMiddleware.csrfProtection,
    [
        body('username')
            .trim()
            .isLength({ min: 3 }).withMessage('Le pseudo doit contenir au moins 3 caractères.')
            .escape(), // Protection XSS
        body('email')
            .isEmail().withMessage('Veuillez fournir une adresse email valide.')
            .normalizeEmail()
            .escape(), // Protection XSS
        body('password')
            .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.')
            .escape() // Protection XSS
    ],
    authController.register
);

// Route de connexion (chat)
router.post('/login', 
    csrfMiddleware.csrfProtection,
    [
        body('username')
            .trim()
            .notEmpty().withMessage('Le pseudo est requis.')
            .escape(), // Protection XSS
        body('password')
            .notEmpty().withMessage('Le mot de passe est requis.')
            .escape() // Protection XSS
    ],
    authController.login
);

module.exports = router;
