/* Contient les fonctions d'interaction avec la collection `users` de MongoDB. */

const { ObjectId } = require('mongodb');
const logger = require('../../config/logger');
const redisClient = require('../../config/redisClient'); // Assurez-vous que redisClient est exporté de config/redisClient.js

let db; // Variable pour stocker l'objet de la base de données MongoDB
const USERS_COLLECTION_NAME = 'users';

// Fonction pour initialiser la connexion à la base de données
function setDb(database) {
    db = database;
}

// Fonction pour récupérer un profil utilisateur depuis le cache Redis ou la base de données
async function getUserProfileFromCacheOrDB(username) {
    const cacheKey = `user:${username}:profile`;
    let userProfile = await redisClient.get(cacheKey);

    if (userProfile) {
        logger.debug(`Profil utilisateur ${username} récupéré du cache.`);
        return JSON.parse(userProfile);
    }

    logger.debug(`Profil utilisateur ${username} non trouvé dans le cache, récupération depuis la DB.`);
    const usersCollection = db.collection(USERS_COLLECTION_NAME);
    const user = await usersCollection.findOne(
        { username: username },
        { projection: { username: 1, profilePicture: 1, _id: 0 } }
    );

    if (user) {
        await redisClient.set(cacheKey, JSON.stringify(user), { EX: 3600 }); // Cache pendant 1 heure
        return user;
    }
    return { username: username, profilePicture: '/images/default_avatar.png' }; // Fallback
}

async function findByUsername(username) {
    return db.collection(USERS_COLLECTION_NAME).findOne({ username });
}

async function findByEmail(email) {
    return db.collection(USERS_COLLECTION_NAME).findOne({ email });
}

async function create(userData) {
    return db.collection(USERS_COLLECTION_NAME).insertOne(userData);
}

async function findById(id, projection = {}) {
    return db.collection(USERS_COLLECTION_NAME).findOne({ _id: new ObjectId(id) }, { projection });
}

async function findByUsernameExcludingId(username, id) {
    return db.collection(USERS_COLLECTION_NAME).findOne({ username, _id: { $ne: new ObjectId(id) } });
}

async function findByEmailExcludingId(email, id) {
    return db.collection(USERS_COLLECTION_NAME).findOne({ email, _id: { $ne: new ObjectId(id) } });
}

async function update(id, updateData) {
    return db.collection(USERS_COLLECTION_NAME).updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
    );
}

async function findAll(projection = {}) {
    return db.collection(USERS_COLLECTION_NAME).find({}, { projection }).toArray();
}

async function deleteUser(id) {
    return db.collection(USERS_COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) });
}

module.exports = {
    setDb,
    getUserProfileFromCacheOrDB,
    findByUsername,
    findByEmail,
    create,
    findById,
    findByUsernameExcludingId,
    findByEmailExcludingId,
    update,
    findAll,
    deleteUser
};
