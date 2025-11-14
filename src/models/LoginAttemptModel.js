/* Contient les fonctions d'interaction avec la collection `login_attempts` de MongoDB. */

const { ObjectId } = require('mongodb');
const logger = require('../../config/logger');

let db; // Variable pour stocker l'objet de la base de données MongoDB
const LOGIN_ATTEMPTS_COLLECTION_NAME = 'login_attempts'; // Nom de la collection pour les tentatives de connexion

// Fonction pour initialiser la connexion à la base de données
function setDb(database) {
    db = database;
}

async function cleanOldAttempts(username, ip, lockTimeThreshold) {
    return db.collection(LOGIN_ATTEMPTS_COLLECTION_NAME).deleteMany({
        $or: [
            { username: username, timestamp: { $lt: lockTimeThreshold } },
            { ip: ip, timestamp: { $lt: lockTimeThreshold } }
        ]
    });
}

async function countFailedAttempts(username, lockTimeThreshold) {
    return db.collection(LOGIN_ATTEMPTS_COLLECTION_NAME).countDocuments({
        username: username,
        success: false,
        timestamp: { $gt: lockTimeThreshold }
    });
}

async function create(attemptData) {
    return db.collection(LOGIN_ATTEMPTS_COLLECTION_NAME).insertOne(attemptData);
}

async function deleteAttemptsByUsername(username) {
    return db.collection(LOGIN_ATTEMPTS_COLLECTION_NAME).deleteMany({ username: username });
}

module.exports = {
    setDb,
    cleanOldAttempts,
    countFailedAttempts,
    create,
    deleteAttemptsByUsername
};
