/**
 * Swagger/OpenAPI Configuration
 * API Documentation
 */

const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BoloIndia Response Service API',
      version: '1.0.0',
      description: 'Citizen Feedback Response Submission & Management Microservice',
      contact: {
        name: 'Shakil Patel',
        email: 'shakil@boloindia.in',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'http://localhost:8089',
        description: 'Local Docker server',
      },
    ],
    tags: [
      {
        name: 'Responses',
        description: 'Response submission and management endpoints',
      },
      {
        name: 'Analytics',
        description: 'Response analytics and reporting endpoints',
      },
      {
        name: 'Export',
        description: 'Data export endpoints (CSV, Excel, PDF)',
      },
      {
        name: 'Health',
        description: 'Service health check endpoints',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'MicroProfile JWT token from auth-service',
        },
      },
      schemas: {
        Response: {
          type: 'object',
          properties: {
            responseId: { type: 'string', example: 'RESP-ABC123' },
            formId: { type: 'string', example: 'FORM-XYZ789' },
            qrCodeId: { type: 'string', example: 'QR-DEF456' },
            serviceId: { type: 'integer', example: 3 },
            orgId: { type: 'integer', example: 3 },
            citizenId: { type: 'integer', nullable: true, example: null },
            citizenEmail: { type: 'string', nullable: true, example: 'citizen@example.com' },
            citizenPhone: { type: 'string', nullable: true, example: '+919876543210' },
            answers: { type: 'object', example: { field1: 'Answer text', field2: 'Location' } },
            status: { type: 'string', enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED', 'SPAM'], example: 'PENDING' },
            submittedAt: { type: 'string', format: 'date-time' },
            location: {
              type: 'object',
              properties: {
                latitude: { type: 'number', example: 21.1702 },
                longitude: { type: 'number', example: 72.8311 },
                accuracy: { type: 'number', example: 10.5 },
                address: { type: 'string', example: 'Athwa, Surat' },
              },
            },
            orgReplies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Issue resolved' },
                  repliedBy: { type: 'integer', example: 19 },
                  repliedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to route files with JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
