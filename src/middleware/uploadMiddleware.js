/* Contient la configuration de Multer pour l'upload de fichiers. */

const multer = require('multer'); // Pour la gestion de l'upload de fichiers
const path = require('path');
const fs = require('fs'); // Pour la gestion des fichiers (suppression d'anciennes photos)

// Créer le dossier pour les photos de profil s'il n'existe pas
const profilePicturesDir = path.join(__dirname, '..', '..', 'public', 'images', 'profile_pictures');
if (!fs.existsSync(profilePicturesDir)) {
    fs.mkdirSync(profilePicturesDir, { recursive: true });
}

// Configuration de Multer pour l'upload de photos de profil
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/profile_pictures/'); // Dossier où les images seront stockées
    },
    filename: (req, file, cb) => {
        // Nom de fichier unique pour éviter les conflits
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limite de 5 MB
        files: 1 // Un seul fichier à la fois
    },
    fileFilter: (req, file, cb) => {
        // Accepter uniquement les images
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé. Seules les images (jpeg, png, gif, webp, svg) sont acceptées.'), false);
        }
    }
});

module.exports = {
    upload
};
