/**
 * File Service
 * MinIO file upload/download operations
 */

const minioManager = require('../config/minio');
const logger = require('../utils/logger');
const { generateFileName } = require('../utils/idGenerator');
const config = require('../config/env');

class FileService {
  /**
   * Upload file to MinIO
   */
  async uploadFile(file, folder = 'responses') {
    try {
      if (!file || !file.buffer) {
        throw new Error('Invalid file object');
      }

      // Generate unique filename
      const fileName = generateFileName(file.originalname);
      const filePath = `${folder}/${fileName}`;

      logger.info('Uploading file to MinIO', {
        originalName: file.originalname,
        fileName,
        size: file.size,
        mimeType: file.mimetype,
      });

      // Upload to MinIO
      const result = await minioManager.uploadFile(
        filePath,
        null,
        file.buffer,
        file.mimetype,
        {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        }
      );

      logger.info('File uploaded successfully', {
        fileName,
        fileUrl: result.fileUrl,
      });

      return {
        url: result.fileUrl,
        fileName: file.originalname,
        storedFileName: fileName,
        fileSize: file.size,
        mimeType: file.mimetype,
        bucket: result.bucket,
        uploadedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error uploading file to MinIO:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files to MinIO
   */
  async uploadMultipleFiles(files, folder = 'responses') {
    try {
      if (!Array.isArray(files) || files.length === 0) {
        throw new Error('Invalid files array');
      }

      logger.info(`Uploading ${files.length} files to MinIO`);

      const uploadPromises = files.map((file) => this.uploadFile(file, folder));
      const results = await Promise.all(uploadPromises);

      logger.info(`Successfully uploaded ${results.length} files`);

      return results;
    } catch (error) {
      logger.error('Error uploading multiple files:', error);
      throw error;
    }
  }

  /**
   * Delete file from MinIO
   */
  async deleteFile(fileName) {
    try {
      logger.info('Deleting file from MinIO', { fileName });

      await minioManager.deleteFile(fileName);

      logger.info('File deleted successfully', { fileName });

      return true;
    } catch (error) {
      logger.error('Error deleting file from MinIO:', error);
      throw error;
    }
  }

  /**
   * Delete multiple files from MinIO
   */
  async deleteMultipleFiles(fileNames) {
    try {
      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        return true;
      }

      logger.info(`Deleting ${fileNames.length} files from MinIO`);

      const deletePromises = fileNames.map((fileName) => this.deleteFile(fileName));
      await Promise.all(deletePromises);

      logger.info(`Successfully deleted ${fileNames.length} files`);

      return true;
    } catch (error) {
      logger.error('Error deleting multiple files:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from MinIO
   */
  async getFileMetadata(fileName) {
    try {
      const metadata = await minioManager.getFileMetadata(fileName);
      return metadata;
    } catch (error) {
      logger.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Generate presigned URL for temporary file access
   */
  async getPresignedUrl(fileName, expirySeconds = 3600) {
    try {
      const url = await minioManager.getPresignedUrl(fileName, expirySeconds);
      
      logger.info('Presigned URL generated', {
        fileName,
        expirySeconds,
      });

      return url;
    } catch (error) {
      logger.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file, category = 'image') {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    // Check file size
    const maxSize = config.upload.maxSize[category] || config.upload.maxSize.image;
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
      errors.push(`File size exceeds maximum limit of ${maxSizeMB}MB`);
    }

    // Check MIME type
    const allowedTypes = config.upload.allowedTypes[category] || config.upload.allowedTypes.image;
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed for ${category}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract file info from uploaded file
   */
  extractFileInfo(file) {
    return {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      encoding: file.encoding,
    };
  }

  /**
   * Get file category from MIME type
   */
  getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'unknown';
  }
}

module.exports = new FileService();
