const logger = require("../../config/logger");
const errorCodes = require("../utils/errorCodes");

class AppError extends Error {
  constructor(errorCode, message, details = {}) {
    super(message || errorCode.message);
    this.name = "AppError";
    this.code = errorCode.code;
    this.statusCode = errorCode.statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    logger.error(`AppError: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      details: err.details,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  // Gérer les erreurs de validation d'Express-validator
  if (err.array && typeof err.array === "function") {
    const errors = err.array();
    logger.warn("Erreur de validation:", errors);
    return res.status(errorCodes.INVALID_INPUT.statusCode).json({
      code: errorCodes.INVALID_INPUT.code,
      message: errorCodes.INVALID_INPUT.message,
      details: errors,
    });
  }

  logger.error(`Erreur serveur inattendue: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack,
    error: err,
  });

  res.status(errorCodes.UNKNOWN_ERROR.statusCode).json({
    code: errorCodes.UNKNOWN_ERROR.code,
    message: errorCodes.UNKNOWN_ERROR.message,
  });
};

module.exports = { AppError, errorHandler };
