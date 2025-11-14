/* Contient les routes liées à la gestion des utilisateurs (profil, admin/users, admin/edit-user). */

const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const csrfMiddleware = require('../middleware/csrfMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');

const router = express.Router();

// API pour récupérer le profil de l'utilisateur courant
router.get('/api/profile', authMiddleware.isAuthenticatedChat, userController.getUserProfile);

// API pour mettre à jour le profil de l'utilisateur courant
router.put('/api/profile', 
    authMiddleware.isAuthenticatedChat, 
    uploadMiddleware.upload.single('profilePicture'), 
    csrfMiddleware.csrfProtection,
    [
        body('firstName')
            .trim()
            .isLength({ min: 1 }).withMessage('Le prénom est requis.')
            .escape(), // Protection XSS
        body('lastName')
            .trim()
            .isLength({ min: 1 }).withMessage('Le nom est requis.')
            .escape(), // Protection XSS
        body('username')
            .trim()
            .isLength({ min: 3 }).withMessage('Le pseudo doit contenir au moins 3 caractères.')
            .escape(), // Protection XSS
        body('email')
            .isEmail().withMessage('Veuillez fournir une adresse email valide.')
            .normalizeEmail()
            .escape() // Protection XSS
    ],
    userController.updateUserProfile
);

// Route pour la page d'administration, protégée par l'authentification et le rôle d'administrateur
router.get('/admin', authMiddleware.isAuthenticated, authMiddleware.isAdmin, userController.getAdminPage);

// API pour lister les utilisateurs (accessible uniquement aux administrateurs)
router.get('/api/admin/users', authMiddleware.isAdmin, userController.getUsers);

// API pour enregistrer un nouvel utilisateur (accessible uniquement aux administrateurs)
router.post('/api/admin/users', 
    authMiddleware.isAdmin, 
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
            .escape(), // Protection XSS
        body('role')
            .isIn(['user', 'admin']).withMessage('Le rôle doit être "user" ou "admin".')
            .escape() // Protection XSS
    ],
    userController.createUser
);

// API pour supprimer un utilisateur (accessible uniquement aux administrateurs)
router.delete('/api/admin/users/:id', 
    authMiddleware.isAdmin, 
    csrfMiddleware.csrfProtection,
    [
        body('id') // Validation de l'ID dans les paramètres de l'URL
            .custom(value => ObjectId.isValid(value)).withMessage('ID utilisateur invalide.')
    ],
    userController.deleteUser
);

// Route pour la page de modification d'utilisateur
router.get('/admin/edit-user', authMiddleware.isAuthenticated, authMiddleware.isAdmin, userController.getEditUserPage);

// API pour récupérer un utilisateur par son ID (pour le formulaire de modification)
router.get('/api/admin/users/:id', 
    authMiddleware.isAuthenticated, 
    authMiddleware.isAdmin,
    [
        body('id') // Validation de l'ID dans les paramètres de l'URL
            .custom(value => ObjectId.isValid(value)).withMessage('ID utilisateur invalide.')
    ],
    userController.getUserById
);

// API pour modifier un utilisateur (accessible uniquement aux administrateurs)
router.put('/api/admin/users/:id', 
    authMiddleware.isAuthenticated, 
    authMiddleware.isAdmin, 
    csrfMiddleware.csrfProtection,
    [
        body('id') // Validation de l'ID dans les paramètres de l'URL
            .custom(value => ObjectId.isValid(value)).withMessage('ID utilisateur invalide.'),
        body('username')
            .trim()
            .isLength({ min: 3 }).withMessage('Le pseudo doit contenir au moins 3 caractères.')
            .escape(), // Protection XSS
        body('email')
            .isEmail().withMessage('Veuillez fournir une adresse email valide.')
            .normalizeEmail()
            .escape(), // Protection XSS
        body('password')
            .optional({ checkFalsy: true }) // Le mot de passe est optionnel
            .isLength({ min: 8 }).withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères.')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .withMessage('Le nouveau mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.')
            .escape(), // Protection XSS
        body('role')
            .isIn(['user', 'admin']).withMessage('Le rôle doit être "user" ou "admin".')
            .escape() // Protection XSS
    ],
    userController.updateUser
);

module.exports = router;
