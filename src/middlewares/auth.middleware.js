/**
 * Authentication Middleware
 * JWT verification with MicroProfile JWT compatibility
 * Optional authentication for anonymous submissions
 */

const fs = require('fs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');
const { unauthorized, forbidden } = require('../utils/response');

// Load JWT public key
let publicKey;
try {
  publicKey = fs.readFileSync(config.jwt.publicKeyPath, 'utf8');
  logger.info('✅ JWT public key loaded successfully');
} catch (error) {
  logger.error('❌ Failed to load JWT public key:', error);
  // Don't crash the app, but log the error
}

/**
 * Verify JWT token (required authentication)
 */
const verifyToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Authorization token is required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!publicKey) {
      logger.error('JWT public key not loaded');
      return res.status(500).json({
        success: false,
        error: 'Authentication service temporarily unavailable',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    // Attach user info to request
    req.user = {
      userId: parseInt(decoded.sub, 10), // User ID from 'sub' claim
      email: decoded.email,
      roles: decoded.groups || [], // Roles from 'groups' claim
      orgId: decoded.orgId ? parseInt(decoded.orgId, 10) : null,
      name: decoded.name || decoded.email,
    };

    logger.debug('JWT verified successfully', {
      userId: req.user.userId,
      email: req.user.email,
      roles: req.user.roles,
    });

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Invalid token');
    } else {
      logger.error('JWT verification error:', error);
      return unauthorized(res, 'Authentication failed');
    }
  }
};

/**
 * Optional JWT verification (for anonymous + authenticated endpoints)
 * Does NOT reject if token is missing, but verifies if present
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // No token provided - allow anonymous access
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null; // Mark as anonymous
      return next();
    }

    const token = authHeader.substring(7);

    if (!publicKey) {
      logger.warn('JWT public key not loaded, allowing anonymous access');
      req.user = null;
      return next();
    }

    // Verify token if present
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    // Attach user info to request
    req.user = {
      userId: parseInt(decoded.sub, 10),
      email: decoded.email,
      roles: decoded.groups || [],
      orgId: decoded.orgId ? parseInt(decoded.orgId, 10) : null,
      name: decoded.name || decoded.email,
    };

    logger.debug('Optional auth: JWT verified', {
      userId: req.user.userId,
      email: req.user.email,
    });

    next();
  } catch (error) {
    // Token is invalid, but allow anonymous access
    logger.warn('Optional auth: Invalid token, allowing anonymous access', {
      error: error.message,
    });
    req.user = null;
    next();
  }
};

/**
 * Check if user has specific role(s)
 */
const hasRole = (...requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Authentication required');
    }

    const userRoles = req.user.roles || [];

    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      return forbidden(
        res,
        `Access denied. Required role(s): ${requiredRoles.join(', ')}`
      );
    }

    next();
  };
};

/**
 * Check if user is PLATFORM_ADMIN
 */
const isPlatformAdmin = (req, res, next) => {
  if (!req.user) {
    return unauthorized(res, 'Authentication required');
  }

  if (!req.user.roles.includes('PLATFORM_ADMIN')) {
    return forbidden(res, 'Access denied. Platform admin privileges required');
  }

  next();
};

/**
 * Check if user is ORG_OWNER or ORG_ADMIN
 */
const isOrgAdmin = (req, res, next) => {
  if (!req.user) {
    return unauthorized(res, 'Authentication required');
  }

  const allowedRoles = ['ORG_OWNER', 'ORG_ADMIN'];
  const hasAllowedRole = req.user.roles.some((role) => allowedRoles.includes(role));

  if (!hasAllowedRole) {
    return forbidden(res, 'Access denied. Organization admin privileges required');
  }

  next();
};

/**
 * Check if user belongs to specific organization
 * Used to ensure org admins can only access their own org's data
 */
const checkOrgAccess = (orgIdParam = 'orgId') => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Authentication required');
    }

    // Platform admins can access any org
    if (req.user.roles.includes('PLATFORM_ADMIN')) {
      return next();
    }

    // Get org ID from request params, query, or body
    const requestedOrgId = parseInt(
      req.params[orgIdParam] || req.query[orgIdParam] || req.body[orgIdParam],
      10
    );

    if (!requestedOrgId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
    }

    // Check if user belongs to the requested org
    if (req.user.orgId !== requestedOrgId) {
      return forbidden(res, 'Access denied. You can only access your own organization data');
    }

    next();
  };
};

/**
 * Extract client IP address
 */
const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip
  );
};

module.exports = {
  verifyToken,
  optionalAuth,
  hasRole,
  isPlatformAdmin,
  isOrgAdmin,
  checkOrgAccess,
  getClientIP,
};
