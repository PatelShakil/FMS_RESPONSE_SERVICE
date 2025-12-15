/**
 * Server Entry Point
 * Initialize connections and start the server
 */

const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const database = require('./config/database');
const kafkaManager = require('./config/kafka');
const minioManager = require('./config/minio');
const kafkaService = require('./services/kafka.service');

// ===========================
// STARTUP BANNER
// ===========================
const printBanner = () => {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║     BoloIndia Response Service - Microservice v1.0        ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
};

// ===========================
// INITIALIZE CONNECTIONS
// ===========================
const initializeConnections = async () => {
  try {
    logger.info('🚀 Starting Response Service...');
    logger.info(`Environment: ${config.env}`);
    logger.info(`Port: ${config.port}`);

    // 1. Connect to MongoDB
    logger.info('📦 Connecting to MongoDB...');
    await database.connect();

    // 2. Initialize MinIO
    logger.info('📦 Initializing MinIO...');
    minioManager.initialize();

    // 3. Initialize Kafka
    logger.info('📦 Initializing Kafka...');
    kafkaManager.initialize();

    // 4. Connect Kafka Producer
    logger.info('📦 Connecting Kafka Producer...');
    await kafkaManager.connectProducer();

    // 5. Connect Kafka Consumer
    logger.info('📦 Connecting Kafka Consumer...');
    await kafkaManager.connectConsumer();

    // 6. Start consuming Kafka messages
    logger.info('📦 Starting Kafka message consumption...');
    await kafkaManager.startConsuming(async (topic, message) => {
      await kafkaService.handleMessage(topic, message);
    });

    logger.info('✅ All connections initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize connections:', error);
    throw error;
  }
};

// ===========================
// GRACEFUL SHUTDOWN
// ===========================
const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // 1. Stop accepting new requests
    logger.info('Stopping HTTP server...');
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // 2. Disconnect Kafka
    logger.info('Disconnecting Kafka...');
    await kafkaManager.disconnect();

    // 3. Disconnect MongoDB
    logger.info('Disconnecting MongoDB...');
    await database.disconnect();

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// ===========================
// UNCAUGHT ERROR HANDLERS
// ===========================
process.on('uncaughtException', (error) => {
  logger.error('💥 UNCAUGHT EXCEPTION! Shutting down...', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 UNHANDLED REJECTION! Shutting down...', {
    reason,
    promise,
  });
  process.exit(1);
});

// ===========================
// SHUTDOWN SIGNALS
// ===========================
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===========================
// START SERVER
// ===========================
let server;

const startServer = async () => {
  try {
    // Print banner
    printBanner();

    // Initialize all connections
    await initializeConnections();

    // Start HTTP server
    server = app.listen(config.port, () => {
      logger.info('\n');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`✅ Response Service is running!`);
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`🌐 Server:        http://localhost:${config.port}`);
      logger.info(`📚 API Docs:      http://localhost:${config.port}/api-docs`);
      logger.info(`❤️  Health:        http://localhost:${config.port}/health`);
      logger.info(`📊 Detailed:      http://localhost:${config.port}/health/detailed`);
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('\n');
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${config.port} is already in use`);
      } else {
        logger.error('❌ Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ===========================
// RUN SERVER
// ===========================
startServer();

// Export for testing
module.exports = server;
