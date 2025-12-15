/**
 * Express Application Setup
 * Main application configuration and middleware setup
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');
require('express-async-errors'); // Handle async errors automatically

const config = require('./config/env');
const swaggerSpec = require('./config/swagger');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

// Import routes
const responseRoutes = require('./routes/response.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const exportRoutes = require('./routes/export.routes');
const healthRoutes = require('./routes/health.routes');

// Create Express app
const app = express();

// ===========================
// TRUST PROXY
// ===========================
// Trust first proxy (for correct IP detection behind reverse proxy)
app.set('trust proxy', 1);

// ===========================
// SECURITY MIDDLEWARE
// ===========================

// Helmet - Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for Swagger UI
    crossOriginEmbedderPolicy: false,
  })
);

// CORS - Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Mongo Sanitize - Prevent NoSQL injection
app.use(mongoSanitize());

// ===========================
// BODY PARSING MIDDLEWARE
// ===========================

// JSON body parser
app.use(express.json({ limit: '10mb' }));

// URL-encoded body parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===========================
// COMPRESSION
// ===========================
app.use(compression());

// ===========================
// REQUEST LOGGING
// ===========================
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ===========================
// API ROUTES
// ===========================

// Health check routes (no /api prefix)
app.use('/health', healthRoutes);
// app.use('/metrics', metricsRoutes);

// API routes
app.use('/api/responses', responseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: config.serviceName,
    version: '1.0.0',
    message: 'BoloIndia Response Service API',
    documentation: '/api-docs',
    health: '/health',
    timestamp: new Date().toISOString(),
  });
});

// ===========================
// SWAGGER DOCUMENTATION
// ===========================
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Response Service API',
    customfavIcon: '/favicon.ico',
  })
);

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ===========================
// ERROR HANDLING
// ===========================

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ===========================
// EXPORT APP
// ===========================
module.exports = app;
