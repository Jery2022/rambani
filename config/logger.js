const winston = require('winston');
const config = require('./environnement');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.log_level || 'info',
  format: logFormat,
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      format: config.node_env === 'development' ? consoleFormat : logFormat,
      silent: config.node_env === 'production' && config.log_level === 'silent'
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write security audit logs to audit.log
    new winston.transports.File({
      filename: 'logs/audit.log',
      level: 'info', // Ou un niveau plus spécifique si nécessaire
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// If we're not in production, don't write to file transports
if (config.node_env === 'development') {
  logger.transports = logger.transports.filter(t => t instanceof winston.transports.Console);
}

module.exports = logger;
