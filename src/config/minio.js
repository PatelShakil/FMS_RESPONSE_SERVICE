/**
 * MinIO Configuration
 * S3-compatible object storage for file uploads
 */

const Minio = require('minio');
const config = require('./env');
const logger = require('../utils/logger');

class MinIOManager {
  constructor() {
    this.client = null;
    this.isInitialized = false;
  }

  /**
   * Initialize MinIO client
   */
  initialize() {
    try {
      this.client = new Minio.Client({
        endPoint: config.minio.endPoint,
        port: config.minio.port,
        useSSL: config.minio.useSSL,
        accessKey: config.minio.accessKey,
        secretKey: config.minio.secretKey,
      });

      this.isInitialized = true;
      logger.info('✅ MinIO client initialized successfully');

      // Ensure bucket exists
      this.ensureBucketExists();
    } catch (error) {
      logger.error('❌ MinIO initialization error:', error);
      throw error;
    }
  }

  /**
   * Ensure bucket exists, create if not
   */
  async ensureBucketExists() {
    try {
      const bucketExists = await this.client.bucketExists(config.minio.bucketName);

      if (!bucketExists) {
        await this.client.makeBucket(config.minio.bucketName, 'us-east-1');
        logger.info(`✅ MinIO bucket created: ${config.minio.bucketName}`);

        // Set bucket policy to allow public read (optional)
        // await this.setBucketPolicy();
      } else {
        logger.info(`✅ MinIO bucket exists: ${config.minio.bucketName}`);
      }
    } catch (error) {
      logger.error('Error ensuring bucket exists:', error);
    }
  }

  /**
   * Set bucket policy (optional - for public access)
   */
  async setBucketPolicy() {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${config.minio.bucketName}/*`],
        },
      ],
    };

    try {
      await this.client.setBucketPolicy(config.minio.bucketName, JSON.stringify(policy));
      logger.info('MinIO bucket policy set for public read access');
    } catch (error) {
      logger.error('Error setting bucket policy:', error);
    }
  }

  /**
   * Upload file to MinIO
   */
  async uploadFile(fileName, filePath, fileBuffer, mimeType, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('MinIO client not initialized');
    }

    try {
      const metaData = {
        'Content-Type': mimeType,
        ...metadata,
      };

      await this.client.putObject(
        config.minio.bucketName,
        fileName,
        fileBuffer,
        fileBuffer.length,
        metaData
      );

      const fileUrl = `${config.minio.publicUrl}/${config.minio.bucketName}/${fileName}`;

      logger.info(`✅ File uploaded to MinIO: ${fileName}`);

      return {
        success: true,
        fileName,
        fileUrl,
        bucket: config.minio.bucketName,
        size: fileBuffer.length,
        mimeType,
      };
    } catch (error) {
      logger.error('Error uploading file to MinIO:', error);
      throw error;
    }
  }

  /**
   * Delete file from MinIO
   */
  async deleteFile(fileName) {
    if (!this.isInitialized) {
      throw new Error('MinIO client not initialized');
    }

    try {
      await this.client.removeObject(config.minio.bucketName, fileName);
      logger.info(`✅ File deleted from MinIO: ${fileName}`);
      return true;
    } catch (error) {
      logger.error('Error deleting file from MinIO:', error);
      throw error;
    }
  }

  /**
   * Get file from MinIO
   */
  async getFile(fileName) {
    if (!this.isInitialized) {
      throw new Error('MinIO client not initialized');
    }

    try {
      const stream = await this.client.getObject(config.minio.bucketName, fileName);
      return stream;
    } catch (error) {
      logger.error('Error getting file from MinIO:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileName) {
    if (!this.isInitialized) {
      throw new Error('MinIO client not initialized');
    }

    try {
      const stat = await this.client.statObject(config.minio.bucketName, fileName);
      return stat;
    } catch (error) {
      logger.error('Error getting file metadata from MinIO:', error);
      throw error;
    }
  }

  /**
   * Generate presigned URL (for temporary access)
   */
  async getPresignedUrl(fileName, expirySeconds = 3600) {
    if (!this.isInitialized) {
      throw new Error('MinIO client not initialized');
    }

    try {
      const url = await this.client.presignedGetObject(
        config.minio.bucketName,
        fileName,
        expirySeconds
      );
      return url;
    } catch (error) {
      logger.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  /**
   * List files in bucket
   */
  async listFiles(prefix = '') {
    if (!this.isInitialized) {
      throw new Error('MinIO client not initialized');
    }

    try {
      const files = [];
      const stream = this.client.listObjects(config.minio.bucketName, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => files.push(obj));
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Error listing files from MinIO:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: 'down', message: 'MinIO client not initialized' };
      }

      // Check if bucket exists
      const bucketExists = await this.client.bucketExists(config.minio.bucketName);

      if (!bucketExists) {
        return { status: 'down', message: 'Bucket does not exist' };
      }

      return {
        status: 'up',
        message: 'MinIO is healthy',
        details: {
          bucket: config.minio.bucketName,
          endpoint: config.minio.endPoint,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        message: 'MinIO health check failed',
        error: error.message,
      };
    }
  }
}

// Export singleton instance
module.exports = new MinIOManager();
