const errorCodes = {
  // Erreurs générales
  UNKNOWN_ERROR: {
    code: "GEN-0001",
    message: "Une erreur inattendue est survenue.",
    statusCode: 500,
  },
  INVALID_INPUT: {
    code: "GEN-0002",
    message: "Données d'entrée invalides.",
    statusCode: 400,
  },
  UNAUTHORIZED: {
    code: "GEN-0003",
    message: "Authentification requise.",
    statusCode: 401,
  },
  FORBIDDEN: {
    code: "GEN-0004",
    message: "Accès refusé.",
    statusCode: 403,
  },
  NOT_FOUND: {
    code: "GEN-0005",
    message: "Ressource non trouvée.",
    statusCode: 404,
  },
  SERVICE_UNAVAILABLE: {
    code: "GEN-0006",
    message: "Service temporairement indisponible.",
    statusCode: 503,
  },

  // Erreurs d'authentification
  AUTH_USERNAME_TAKEN: {
    code: "AUTH-0001",
    message: "Ce pseudo est déjà pris.",
    statusCode: 409,
  },
  AUTH_EMAIL_TAKEN: {
    code: "AUTH-0002",
    message: "Cet email est déjà utilisé.",
    statusCode: 409,
  },
  AUTH_INVALID_CREDENTIALS: {
    code: "AUTH-0003",
    message: "Pseudo ou mot de passe incorrect.",
    statusCode: 401,
  },
  AUTH_TOO_MANY_ATTEMPTS: {
    code: "AUTH-0004",
    message: "Trop de tentatives de connexion. Veuillez réessayer plus tard.",
    statusCode: 429,
  },
  AUTH_ADMIN_REQUIRED: {
    code: "AUTH-0005",
    message:
      "Accès refusé. Seuls les administrateurs peuvent se connecter ici.",
    statusCode: 403,
  },
  AUTH_LOGOUT_FAILED: {
    code: "AUTH-0006",
    message: "Échec de la déconnexion.",
    statusCode: 500,
  },

  // Erreurs utilisateur
  USER_NOT_FOUND: {
    code: "USER-0001",
    message: "Utilisateur non trouvé.",
    statusCode: 404,
  },
  USER_UPDATE_FAILED: {
    code: "USER-0002",
    message: "Échec de la mise à jour de l'utilisateur.",
    statusCode: 500,
  },
  USER_DELETE_FAILED: {
    code: "USER-0003",
    message: "Échec de la suppression de l'utilisateur.",
    statusCode: 500,
  },

  // Erreurs de message
  MESSAGE_SEND_FAILED: {
    code: "MSG-0001",
    message: "Échec de l'envoi du message.",
    statusCode: 500,
  },
  MESSAGE_NOT_FOUND: {
    code: "MSG-0002",
    message: "Message non trouvé.",
    statusCode: 404,
  },
};

module.exports = errorCodes;
