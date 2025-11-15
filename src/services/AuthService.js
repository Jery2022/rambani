const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const logger = require('../../config/logger');
const UserModel = require('../models/UserModel');
const LoginAttemptModel = require('../models/LoginAttemptModel');
const config = require('../../config/environnement');

class AuthService {
    static async register(username, password, email) {
        // Vérifier l'unicité du pseudo
        const existingUserByUsername = await UserModel.findByUsername(username);
        if (existingUserByUsername) {
            return { status: 409, message: 'Ce pseudo est déjà pris.' };
        }

        // Vérifier l'unicité de l'email
        const existingUserByEmail = await UserModel.findByEmail(email);
        if (existingUserByEmail) {
            return { status: 409, message: 'Cet email est déjà utilisé.' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await UserModel.create({ username, password: hashedPassword, email, role: 'user' });

        return { status: 201, message: 'Utilisateur enregistré avec succès.' };
    }

    static async login(username, password, ip) {
        const now = new Date();
        const lockTimeMinutes = config.login_lock_time;
        const lockTimeThreshold = new Date(now.getTime() - lockTimeMinutes * 60 * 1000);

        await LoginAttemptModel.cleanOldAttempts(username, ip, lockTimeThreshold);

        const recentFailedAttempts = await LoginAttemptModel.countFailedAttempts(username, lockTimeThreshold);

        if (recentFailedAttempts >= config.login_attempts_limit) {
            logger.warn(`Tentative de connexion bloquée pour l'utilisateur ${username} (compte verrouillé).`);
            return { status: 429, message: `Trop de tentatives de connexion. Veuillez réessayer dans ${lockTimeMinutes} minutes.` };
        }

        const user = await UserModel.findByUsername(username);

        if (!user) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion échouée (pseudo incorrect)', { username, ip, type: 'login_attempt' });
            return { status: 401, message: 'Pseudo ou mot de passe incorrect.' };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion échouée (mot de passe incorrect)', { username, ip, type: 'login_attempt' });
            return { status: 401, message: 'Pseudo ou mot de passe incorrect.' };
        }

        await LoginAttemptModel.deleteAttemptsByUsername(username);

        logger.info('Connexion utilisateur réussie', { username: user.username, ip, type: 'user_login' });
        return { 
            status: 200, 
            message: 'Connexion réussie.', 
            user: { 
                id: user._id.toString(), 
                username: user.username, 
                role: user.role,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                profilePicture: user.profilePicture || ''
            } 
        };
    }

    static async adminLogin(username, password, ip) {
        const now = new Date();
        const lockTimeMinutes = config.login_lock_time;
        const lockTimeThreshold = new Date(now.getTime() - lockTimeMinutes * 60 * 1000);

        await LoginAttemptModel.cleanOldAttempts(username, ip, lockTimeThreshold);

        const recentFailedAttempts = await LoginAttemptModel.countFailedAttempts(username, lockTimeThreshold);

        if (recentFailedAttempts >= config.login_attempts_limit) {
            logger.warn(`Tentative de connexion admin bloquée pour l'utilisateur ${username} (compte verrouillé).`);
            return { status: 429, message: `Trop de tentatives de connexion. Veuillez réessayer dans ${lockTimeMinutes} minutes.` };
        }

        const user = await UserModel.findByUsername(username);

        if (!user) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion admin échouée (pseudo incorrect)', { username, ip, type: 'admin_login_attempt' });
            return { status: 401, message: 'Pseudo ou mot de passe incorrect.' };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            await LoginAttemptModel.create({ username, ip, timestamp: now, success: false });
            logger.warn('Tentative de connexion admin échouée (mot de passe incorrect)', { username, ip, type: 'admin_login_attempt' });
            return { status: 401, message: 'Pseudo ou mot de passe incorrect.' };
        }

        await LoginAttemptModel.deleteAttemptsByUsername(username);

        if (user.role !== 'admin') {
            logger.warn('Tentative de connexion admin échouée (rôle non autorisé)', { username, ip, type: 'admin_login_attempt' });
            return { status: 403, message: 'Accès refusé. Seuls les administrateurs peuvent se connecter ici.' };
        }

        logger.info('Connexion administrateur réussie', { username: user.username, ip, type: 'admin_login' });
        return { status: 200, message: 'Connexion réussie.', user: { id: user._id.toString(), username: user.username, role: user.role } };
    }

    static logout(req) {
        return new Promise((resolve, reject) => {
            req.session.destroy(err => {
                if (err) {
                    logger.error('Erreur lors de la déconnexion:', err);
                    return reject(err);
                }
                req.res.clearCookie('connect.sid');
                resolve();
            });
        });
    }
}

module.exports = AuthService;
