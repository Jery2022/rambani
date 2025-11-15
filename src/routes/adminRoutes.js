const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const csrfMiddleware = require('../middleware/csrfMiddleware');
const { body } = require('express-validator');

const router = express.Router();

// Route pour la page de connexion de l'administration
router.get('/login', csrfMiddleware.csrfProtection, authController.getAdminLoginPage);

// Route de connexion pour l'administration
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
    authController.adminLogin
);

// Route pour la page d'administration, protégée par l'authentification et le rôle d'administrateur
router.get('/', authMiddleware.isAuthenticated, authMiddleware.isAdmin, userController.getAdminPage);

// Route pour la page de modification d'utilisateur
router.get('/edit-user', authMiddleware.isAuthenticated, authMiddleware.isAdmin, userController.getEditUserPage);

module.exports = router;
