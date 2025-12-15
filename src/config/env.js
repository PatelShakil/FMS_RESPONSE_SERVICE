/**
 * Environment Configuration
 * Centralized environment variable management
 */

require('dotenv').config();

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8089,
  serviceName: process.env.SERVICE_NAME || 'response-service',

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://boloindia:responsepass@localhost:27017/responsedb?authSource=responsedb',
    dbName: process.env.MONGODB_DB_NAME || 'responsedb',
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  // JWT
  jwt: {
    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || './keys/jwt-public-key.pem',
    issuer: process.env.JWT_ISSUER || 'boloindia-auth-service',
    audience: process.env.JWT_AUDIENCE || 'boloindia-services',
  },

  // MinIO
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'boloindia',
    secret_or_secretKey: process.env.MINIO_SECRET_KEY || 'boloindiapass123',
    bucketName: process.env.MINIO_BUCKET_NAME || 'responses',
    publicUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
  },

  // Kafka
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'response-service',
    groupId: process.env.KAFKA_GROUP_ID || 'response-service-group',
    topics: {
      // Producer topics
      responseSubmitted: process.env.KAFKA_TOPIC_RESPONSE_SUBMITTED || 'response.submitted',
      responseReviewed: process.env.KAFKA_TOPIC_RESPONSE_REVIEWED || 'response.reviewed',
      responseResolved: process.env.KAFKA_TOPIC_RESPONSE_RESOLVED || 'response.resolved',
      responseFlagged: process.env.KAFKA_TOPIC_RESPONSE_FLAGGED || 'response.flagged',
      // Consumer topics
      formCreated: process.env.KAFKA_TOPIC_FORM_CREATED || 'feedback.form.created',
      formDeleted: process.env.KAFKA_TOPIC_FORM_DELETED || 'feedback.form.deleted',
      qrGenerated: process.env.KAFKA_TOPIC_QR_GENERATED || 'qr.generated',
      orgSuspended: process.env.KAFKA_TOPIC_ORG_SUSPENDED || 'org.suspended',
    },
    batch: {
      size: parseInt(process.env.KAFKA_BATCH_SIZE, 10) || 50,
      intervalMs: parseInt(process.env.KAFKA_BATCH_INTERVAL_MS, 10) || 120000, // 2 minutes
    },
  },

  // File Upload
  upload: {
    maxSize: {
      image: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_IMAGE, 10) || 5 * 1024 * 1024, // 5MB
      video: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_VIDEO, 10) || 50 * 1024 * 1024, // 50MB
      audio: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_AUDIO, 10) || 10 * 1024 * 1024, // 10MB
    },
    allowedTypes: {
      image: (process.env.UPLOAD_ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg,image/webp').split(','),
      video: (process.env.UPLOAD_ALLOWED_VIDEO_TYPES || 'video/mp4,video/webm,video/quicktime').split(','),
      audio: (process.env.UPLOAD_ALLOWED_AUDIO_TYPES || 'audio/mpeg,audio/wav,audio/webm,audio/mp3').split(','),
    },
  },

  // Rate Limiting
  rateLimit: {
    anonymous: {
      max: parseInt(process.env.RATE_LIMIT_ANONYMOUS_MAX, 10) || 5,
      windowMs: parseInt(process.env.RATE_LIMIT_ANONYMOUS_WINDOW_MS, 10) || 3600000, // 1 hour
    },
    authenticated: {
      max: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_MAX, 10) || 20,
      windowMs: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_WINDOW_MS, 10) || 3600000, // 1 hour
    },
  },

  // Spam Detection
  spam: {
    ipMaxSubmissionsPerHour: parseInt(process.env.SPAM_IP_MAX_SUBMISSIONS_PER_HOUR, 10) || 10,
    scoreThreshold: parseInt(process.env.SPAM_SCORE_THRESHOLD, 10) || 75,
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001').split(','),
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  // Export
  export: {
    maxRecords: parseInt(process.env.EXPORT_MAX_RECORDS, 10) || 10000,
    tempDir: process.env.EXPORT_TEMP_DIR || './tmp/exports',
  },

  // Health Check
  healthCheck: {
    intervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS, 10) || 30000,
  },
};

module.exports = config;
