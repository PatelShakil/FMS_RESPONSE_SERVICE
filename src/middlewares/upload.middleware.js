/**
 * File Upload Middleware
 * Multer configuration for handling multipart/form-data
 */

const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const logger = require('../utils/logger');
const { generateFileName } = require('../utils/idGenerator');

/**
 * Memory storage (files stored in memory as Buffer objects)
 * Suitable for direct upload to MinIO
 */
const memoryStorage = multer.memoryStorage();

/**
 * File filter - validate file types
 */
const fileFilter = (req, file, cb) => {
  try {
    const mimeType = file.mimetype;

    // Determine file category
    let isValid = false;
    let category = 'unknown';

    if (config.upload.allowedTypes.image.includes(mimeType)) {
      isValid = true;
      category = 'image';
    } else if (config.upload.allowedTypes.video.includes(mimeType)) {
      isValid = true;
      category = 'video';
    } else if (config.upload.allowedTypes.audio.includes(mimeType)) {
      isValid = true;
      category = 'audio';
    }

    if (!isValid) {
      logger.warn('File upload rejected: Invalid file type', {
        mimeType,
        originalName: file.originalname,
      });
      return cb(
        new Error(
          `Invalid file type: ${mimeType}. Allowed types: images, videos, audio files.`
        ),
        false
      );
    }

    // Attach category to file object
    file.category = category;

    cb(null, true);
  } catch (error) {
    logger.error('Error in file filter:', error);
    cb(error, false);
  }
};

/**
 * File size limits based on file category
 */
const fileSizeLimits = (req, file, cb) => {
  let maxSize;

  if (file.mimetype.startsWith('image/')) {
    maxSize = config.upload.maxSize.image;
  } else if (file.mimetype.startsWith('video/')) {
    maxSize = config.upload.maxSize.video;
  } else if (file.mimetype.startsWith('audio/')) {
    maxSize = config.upload.maxSize.audio;
  } else {
    maxSize = config.upload.maxSize.image; // Default
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    return cb(
      new Error(`File too large. Maximum size: ${maxSizeMB}MB for ${file.mimetype}`),
      false
    );
  }

  cb(null, true);
};

/**
 * Multer upload instance for single file
 */
const uploadSingle = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize.video, // Use max limit (video)
    files: 1,
  },
});

/**
 * Multer upload instance for multiple files
 */
const uploadMultiple = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize.video, // Use max limit
    files: 10, // Max 10 files
  },
});

/**
 * Multer upload instance for form submissions (multiple fields with files)
 */
const uploadFields = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize.video,
    files: 20, // Max 20 files total across all fields
  },
});

/**
 * Middleware to handle single file upload
 */
const singleFileUpload = (fieldName) => {
  return (req, res, next) => {
    uploadSingle.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Multer error:', err);
        return res.status(400).json({
          success: false,
          error: `File upload error: ${err.message}`,
        });
      } else if (err) {
        logger.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed',
        });
      }

      next();
    });
  };
};

/**
 * Middleware to handle multiple file uploads
 */
const multipleFileUpload = (fieldName, maxCount = 10) => {
  return (req, res, next) => {
    uploadMultiple.array(fieldName, maxCount)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Multer error:', err);
        return res.status(400).json({
          success: false,
          error: `File upload error: ${err.message}`,
        });
      } else if (err) {
        logger.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed',
        });
      }

      next();
    });
  };
};

/**
 * Middleware to handle form with multiple file fields
 * Example: [{ name: 'photo', maxCount: 5 }, { name: 'audio', maxCount: 2 }]
 */
const formFileUpload = (fields) => {
  return (req, res, next) => {
    uploadFields.fields(fields)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        logger.error('Multer error:', err);
        return res.status(400).json({
          success: false,
          error: `File upload error: ${err.message}`,
        });
      } else if (err) {
        logger.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed',
        });
      }

      next();
    });
  };
};

/**
 * Validate uploaded file
 */
const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file uploaded' };
  }

  // Check file size based on type
  let maxSize;
  if (file.mimetype.startsWith('image/')) {
    maxSize = config.upload.maxSize.image;
  } else if (file.mimetype.startsWith('video/')) {
    maxSize = config.upload.maxSize.video;
  } else if (file.mimetype.startsWith('audio/')) {
    maxSize = config.upload.maxSize.audio;
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  singleFileUpload,
  multipleFileUpload,
  formFileUpload,
  validateFile,
};
