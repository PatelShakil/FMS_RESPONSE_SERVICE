/**
 * Global Error Handling Middleware
 * Centralized error handler for the application
 */

const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Error response formatter
 */
const formatErrorResponse = (error, includeStack = false) => {
  const response = {
    success: false,
    error: error.message || 'Internal server error',
  };

  // Include stack trace in development
  if (includeStack && config.env === 'development') {
    response.stack = error.stack;
  }

  // Include additional error details if available
  if (error.errors) {
    response.errors = error.errors;
  }

  if (error.code) {
    response.code = error.code;
  }

  return response;
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error caught by global handler:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId,
  });

  // Default status code
  let statusCode = err.statusCode || 500;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 422;
    const errors = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
    return res.status(statusCode).json({
      success: false,
      error: 'Validation failed',
      errors,
    });
  }

  if (err.name === 'CastError') {
    // Mongoose cast error (invalid ID format)
    statusCode = 400;
    return res.status(statusCode).json({
      success: false,
      error: 'Invalid ID format',
    });
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    return res.status(statusCode).json({
      success: false,
      error: `Duplicate value for field: ${field}`,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    // JWT errors
    statusCode = 401;
    return res.status(statusCode).json({
      success: false,
      error: 'Invalid authentication token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    return res.status(statusCode).json({
      success: false,
      error: 'Authentication token has expired',
    });
  }

  if (err.name === 'MulterError') {
    // Multer file upload errors
    statusCode = 400;
    return res.status(statusCode).json({
      success: false,
      error: `File upload error: ${err.message}`,
    });
  }

  if (err.type === 'entity.parse.failed') {
    // JSON parse error
    statusCode = 400;
    return res.status(statusCode).json({
      success: false,
      error: 'Invalid JSON in request body',
    });
  }

  // Default error response
  const includeStack = config.env === 'development';
  res.status(statusCode).json(formatErrorResponse(err, includeStack));
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  ApiError,
};
