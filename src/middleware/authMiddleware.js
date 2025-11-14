/* Contient les middlewares d'authentification (`isAuthenticated`, `isAuthenticatedChat`, `isAdmin`). */

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        // Si la requête est pour une route d'administration, rediriger vers la page de connexion admin
        if (req.path.startsWith('/admin')) {
            res.redirect('/admin/login');
        } else {
            res.redirect('/login.html'); // Rediriger vers la page de connexion publique si non authentifié
        }
    }
}

function isAuthenticatedChat(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        // Si la requête est pour une route publique, rediriger vers la page de connexion publique
        if (req.path.startsWith('/')) {
            res.redirect('/login.html');
        }  
    }
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        // Rediriger vers la page de connexion admin si non authentifié ou non admin
        res.redirect('/admin/login');
    }
}

module.exports = {
    isAuthenticated,
    isAuthenticatedChat,
    isAdmin
};
