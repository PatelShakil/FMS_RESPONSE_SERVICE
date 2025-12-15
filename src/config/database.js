/**
 * MongoDB Database Configuration
 * Mongoose connection with retry logic and event handlers
 */

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    try {
      mongoose.set('strictQuery', false);

      await mongoose.connect(config.mongodb.uri, config.mongodb.options);

      this.isConnected = true;
      logger.info(`✅ MongoDB connected successfully to database: ${config.mongodb.dbName}`);

      // Setup event handlers
      this.setupEventHandlers();
    } catch (error) {
      logger.error('❌ MongoDB connection error:', error);
      
      // Retry connection after 5 seconds
      logger.info('Retrying MongoDB connection in 5 seconds...');
      setTimeout(() => this.connect(), 5000);
    }
  }

  /**
   * Setup MongoDB event handlers
   */
  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
      this.isConnected = false;
      
      // Attempt to reconnect
      logger.info('Attempting to reconnect to MongoDB...');
      setTimeout(() => this.connect(), 5000);
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB connection closed gracefully');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'down', message: 'Not connected to MongoDB' };
      }

      // Ping database
      await mongoose.connection.db.admin().ping();

      return {
        status: 'up',
        message: 'MongoDB is healthy',
        details: {
          database: config.mongodb.dbName,
          host: mongoose.connection.host,
          readyState: mongoose.connection.readyState,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        message: 'MongoDB health check failed',
        error: error.message,
      };
    }
  }
}

// Export singleton instance
module.exports = new Database();
