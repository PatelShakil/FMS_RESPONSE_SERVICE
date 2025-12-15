/**
 * ID Generator Utility
 * Generate unique IDs for responses
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Generate response ID
 * Format: RESP-XXXXXX (uppercase alphanumeric)
 */
const generateResponseId = () => {
  // Generate random 6-character alphanumeric string
  const randomString = crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()
    .substring(0, 6);

  return `RESP-${randomString}`;
};

/**
 * Generate UUID v4
 */
const generateUUID = () => {
  return uuidv4();
};

/**
 * Generate short ID (8 characters)
 */
const generateShortId = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Generate file name for uploads
 * Format: {timestamp}_{randomString}_{originalName}
 */
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = originalName.split('.').pop();
  const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
  
  // Sanitize filename (remove special characters)
  const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `${timestamp}_${randomString}_${sanitizedName}.${extension}`;
};

/**
 * Generate tracking code (for anonymous responses - future use)
 */
const generateTrackingCode = () => {
  return crypto
    .randomBytes(16)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 12)
    .toUpperCase();
};

module.exports = {
  generateResponseId,
  generateUUID,
  generateShortId,
  generateFileName,
  generateTrackingCode,
};
