/**
 * Rate Limiting Middleware
 * In-memory rate limiting for anonymous and authenticated users
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const logger = require('../utils/logger');
const { getClientIP } = require('./auth.middleware');

/**
 * Rate limiter for anonymous submissions (IP-based)
 */
const anonymousRateLimiter = rateLimit({
  windowMs: config.rateLimit.anonymous.windowMs, // 1 hour
  max: config.rateLimit.anonymous.max, // 5 requests
  message: {
    success: false,
    error: 'Too many submissions from this IP address. Please try again later.',
    retryAfter: 'Please wait before submitting again',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  
  // Use custom key generator (IP address)
  keyGenerator: (req) => {
    return getClientIP(req);
  },

  // Skip rate limiting for authenticated users
  skip: (req) => {
    return req.user !== null && req.user !== undefined;
  },

  handler: (req, res) => {
    logger.warn('Anonymous rate limit exceeded', {
      ip: getClientIP(req),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: 'Too many submissions from this IP address. Please try again later.',
      retryAfter: Math.ceil(config.rateLimit.anonymous.windowMs / 1000 / 60), // minutes
    });
  },
});

/**
 * Rate limiter for authenticated submissions (user-based)
 */
const authenticatedRateLimiter = rateLimit({
  windowMs: config.rateLimit.authenticated.windowMs, // 1 hour
  max: config.rateLimit.authenticated.max, // 20 requests
  message: {
    success: false,
    error: 'Too many submissions. Please try again later.',
    retryAfter: 'Please wait before submitting again',
  },
  standardHeaders: true,
  legacyHeaders: false,

  // Use custom key generator (user ID)
  keyGenerator: (req) => {
    if (req.user && req.user.userId) {
      return `user_${req.user.userId}`;
    }
    // Fallback to IP if somehow user is not set
    return getClientIP(req);
  },

  // Skip rate limiting for anonymous users (they have separate limiter)
  skip: (req) => {
    return !req.user;
  },

  handler: (req, res) => {
    logger.warn('Authenticated rate limit exceeded', {
      userId: req.user?.userId,
      email: req.user?.email,
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: 'Too many submissions. Please try again later.',
      retryAfter: Math.ceil(config.rateLimit.authenticated.windowMs / 1000 / 60), // minutes
    });
  },
});

/**
 * Combined rate limiter (applies both anonymous and authenticated limits)
 */
const combinedRateLimiter = (req, res, next) => {
  if (req.user) {
    // Authenticated user
    authenticatedRateLimiter(req, res, next);
  } else {
    // Anonymous user
    anonymousRateLimiter(req, res, next);
  }
};

/**
 * Strict rate limiter for sensitive operations (e.g., flagging, deleting)
 */
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    if (req.user && req.user.userId) {
      return `strict_user_${req.user.userId}`;
    }
    return `strict_ip_${getClientIP(req)}`;
  },

  handler: (req, res) => {
    logger.warn('Strict rate limit exceeded', {
      userId: req.user?.userId,
      ip: getClientIP(req),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again in 15 minutes.',
    });
  },
});

/**
 * Export rate limiter for analytics/export (heavier operations)
 */
const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  message: {
    success: false,
    error: 'Export limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    if (req.user && req.user.userId) {
      return `export_user_${req.user.userId}`;
    }
    return `export_ip_${getClientIP(req)}`;
  },

  handler: (req, res) => {
    logger.warn('Export rate limit exceeded', {
      userId: req.user?.userId,
      ip: getClientIP(req),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      error: 'Export limit exceeded. You can only export 5 times per hour.',
    });
  },
});

module.exports = {
  anonymousRateLimiter,
  authenticatedRateLimiter,
  combinedRateLimiter,
  strictRateLimiter,
  exportRateLimiter,
};
