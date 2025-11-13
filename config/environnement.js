require('dotenv').config();

const environments = {
  development: {
    node_env: 'development',
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_db',
    session_secret: process.env.SESSION_SECRET || 'dev-secret-key',
    allowed_origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    cors_enabled: true,
    jwt_secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    jwt_expiry: process.env.JWT_EXPIRY || '7d',
    log_level: process.env.LOG_LEVEL || 'debug',
    helmet_enabled: false,
    rate_limit_enabled: false,
    login_attempts_limit: parseInt(process.env.LOGIN_ATTEMPTS_LIMIT || '5', 10),
    login_lock_time: parseInt(process.env.LOGIN_LOCK_TIME || '15', 10), // en minutes
  },
  staging: {
    node_env: 'staging',
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    mongodb_uri: process.env.MONGODB_URI,
    session_secret: process.env.SESSION_SECRET,
    allowed_origins: (process.env.ALLOWED_ORIGINS || '').split(','),
    cors_enabled: true,
    jwt_secret: process.env.JWT_SECRET,
    jwt_expiry: process.env.JWT_EXPIRY || '24h',
    log_level: process.env.LOG_LEVEL || 'info',
    helmet_enabled: true,
    rate_limit_enabled: true,
    login_attempts_limit: parseInt(process.env.LOGIN_ATTEMPTS_LIMIT || '5', 10),
    login_lock_time: parseInt(process.env.LOGIN_LOCK_TIME || '15', 10), // en minutes
  },
  production: {
    node_env: 'production',
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    mongodb_uri: process.env.MONGODB_URI,
    session_secret: process.env.SESSION_SECRET,
    allowed_origins: (process.env.ALLOWED_ORIGINS || '').split(','),
    cors_enabled: true,
    jwt_secret: process.env.JWT_SECRET,
    jwt_expiry: process.env.JWT_EXPIRY || '24h',
    log_level: process.env.LOG_LEVEL || 'error',
    helmet_enabled: true,
    rate_limit_enabled: true,
    login_attempts_limit: parseInt(process.env.LOGIN_ATTEMPTS_LIMIT || '5', 10),
    login_lock_time: parseInt(process.env.LOGIN_LOCK_TIME || '15', 10), // en minutes
  },
};

const env = process.env.NODE_ENV || 'development';
const config = environments[env] || environments.development;

// Validation des variables requises en production
if (env === 'production') {
  const required = ['MONGODB_URI', 'SESSION_SECRET', 'JWT_SECRET'];
  required.forEach(variable => {
    if (!process.env[variable]) {
      throw new Error(`Variable d'environnement requise manquante: ${variable}`);
    }
  });
}

module.exports = config;
