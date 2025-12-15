/**
 * Export Routes
 * API endpoints for data export with Swagger documentation
 */

const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { verifyToken, isOrgAdmin } = require('../middlewares/auth.middleware');
const { exportRateLimiter } = require('../middlewares/ratelimit.middleware');
const { validateQuery, exportQuerySchema } = require('../utils/validation');

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Data export endpoints
 */

/**
 * @swagger
 * /api/export/csv:
 *   get:
 *     summary: Export responses as CSV
 *     description: Export filtered responses to CSV file
 *     tags: [Export]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, REVIEWED, RESOLVED, REJECTED, SPAM]
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       404:
 *         description: No responses found
 */
router.get(
  '/csv',
  verifyToken,
  isOrgAdmin,
  exportRateLimiter,
  exportController.exportCSV
);

/**
 * @swagger
 * /api/export/excel:
 *   get:
 *     summary: Export responses as Excel
 *     description: Export filtered responses to Excel file
 *     tags: [Export]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: No responses found
 */
router.get(
  '/excel',
  verifyToken,
  isOrgAdmin,
  exportRateLimiter,
  exportController.exportExcel
);

/**
 * @swagger
 * /api/export/pdf:
 *   get:
 *     summary: Export responses as PDF
 *     description: Export filtered responses to PDF file (limited to 100 records)
 *     tags: [Export]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: No responses found
 */
router.get(
  '/pdf',
  verifyToken,
  isOrgAdmin,
  exportRateLimiter,
  exportController.exportPDF
);

module.exports = router;
