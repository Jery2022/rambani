/* Contient le middleware CSRF et son gestionnaire d'erreurs. */

const csrf = require('csurf'); // Importe csurf

// Configuration CSRF
const csrfProtection = csrf({ cookie: true });

// Middleware pour gérer les erreurs CSRF
function csrfErrorHandler(err, req, res, next) {
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).json({ message: 'Requête non autorisée (CSRF token manquant ou invalide).' });
    } else {
        next(err);
    }
}

module.exports = {
    csrfProtection,
    csrfErrorHandler
};
