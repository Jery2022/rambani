// Import des modules nécessaires
const mongoose = require('mongoose');

// --- Configuration ---
// Remplacez cette URI si votre instance MongoDB n'est pas sur localhost:27017
const MONGODB_URI = 'mongodb://localhost:27017/chat_db'; 
const COLLECTION_NAME = 'messages'; // Le nom par défaut de la collection sera 'messages'

// --- 1. Définition du Schéma ---
// Le schéma que vous avez fourni
const MessageSchema = new mongoose.Schema({
    user: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Création du modèle
const Message = mongoose.model(COLLECTION_NAME, MessageSchema);

// --- 2. Jeu de Données Initial ---
const initialMessages = [
    { 
        user: 'Alpha', 
        text: 'Bonjour à tous ! Je suis le premier utilisateur.', 
        // Utilisation d'un timestamp précis pour garantir l'ordre
        timestamp: new Date(Date.now() - 30000) 
    },
    { 
        user: 'Bravo', 
        text: 'Salut Alpha ! Bienvenue sur ce super chat.',
        timestamp: new Date(Date.now() - 20000) 
    },
    { 
        user: 'Charlie', 
        text: 'Ravi de vous voir tous les deux. Prêt pour le temps réel !',
        timestamp: new Date(Date.now() - 10000) 
    }
];

// --- 3. Fonction d'Amorçage (Seeding) ---
async function seedDatabase() {
    try {
        // Connexion à MongoDB
        console.log(`Tentative de connexion à MongoDB à l'adresse: ${MONGODB_URI}`);
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Connexion à MongoDB établie avec succès.");

        // Nettoyage : Suppression des messages existants
        await Message.deleteMany({});
        console.log(`🧹 Collection '${COLLECTION_NAME}' nettoyée.`);

        // Insertion du jeu de données initial
        const result = await Message.insertMany(initialMessages);
        console.log(`✨ ${result.length} messages insérés avec succès.`);
        
        // Affichage des données insérées pour vérification
        const check = await Message.find().sort({ timestamp: 1 });
        console.log("\n--- Contenu de la collection (Vérification) ---");
        check.forEach(msg => {
            console.log(`[${msg.user}] ${msg.text}`);
        });
        console.log("----------------------------------------------\n");


    } catch (error) {
        console.error("❌ ERREUR lors de l'amorçage de la base de données :", error.message);
        
    } finally {
        // Déconnexion de la base de données
        await mongoose.disconnect();
        console.log("🚀 Déconnexion de MongoDB effectuée. Script terminé.");
    }
}

// Exécution de la fonction principale
seedDatabase();