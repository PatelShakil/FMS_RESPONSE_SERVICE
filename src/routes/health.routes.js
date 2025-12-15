/**
 * Health Routes
 * Health check and service status endpoints
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');
const kafkaManager = require('../config/kafka');
const minioManager = require('../config/minio');
const config = require('../config/env');

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Health check endpoints
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Check if service is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    service: config.serviceName,
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Check service and dependencies health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 */
router.get('/detailed', async (req, res) => {
  try {
    // Check MongoDB
    const mongoHealth = await database.healthCheck();

    // Check Kafka
    const kafkaHealth = kafkaManager.getHealthStatus();

    // Check MinIO
    const minioHealth = await minioManager.healthCheck();

    // Overall status
    const isHealthy =
      mongoHealth.status === 'up' &&
      kafkaHealth.producer === 'up' &&
      kafkaHealth.consumer === 'up' &&
      minioHealth.status === 'up';

    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: isHealthy,
      service: config.serviceName,
      status: isHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: mongoHealth,
        kafka: kafkaHealth,
        minio: minioHealth,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: config.serviceName,
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     summary: Kubernetes liveness probe
 *     description: Check if service should be restarted
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/liveness', (req, res) => {
  res.json({
    success: true,
    status: 'ALIVE',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     summary: Kubernetes readiness probe
 *     description: Check if service is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/readiness', async (req, res) => {
  try {
    // Check critical dependencies
    const mongoHealth = await database.healthCheck();

    if (mongoHealth.status !== 'up') {
      return res.status(503).json({
        success: false,
        status: 'NOT_READY',
        reason: 'MongoDB not available',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      status: 'READY',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'NOT_READY',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
