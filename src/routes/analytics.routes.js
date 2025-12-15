/**
 * Analytics Routes
 * API endpoints for analytics and reporting with Swagger documentation
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { verifyToken, isOrgAdmin, isPlatformAdmin } = require('../middlewares/auth.middleware');
const { validateQuery, analyticsQuerySchema } = require('../utils/validation');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Response analytics and reporting
 */

/**
 * @swagger
 * /api/analytics/form/{formId}:
 *   get:
 *     summary: Get form analytics
 *     description: Get aggregated analytics for a specific form
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (defaults to 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (defaults to today)
 *     responses:
 *       200:
 *         description: Form analytics fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/form/:formId',
  verifyToken,
  isOrgAdmin,
  analyticsController.getFormAnalytics
);

/**
 * @swagger
 * /api/analytics/org/{orgId}:
 *   get:
 *     summary: Get organization analytics
 *     description: Get aggregated analytics for an organization
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: integer
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
 *     responses:
 *       200:
 *         description: Organization analytics fetched successfully
 *       403:
 *         description: Access denied
 */
router.get(
  '/org/:orgId',
  verifyToken,
  isOrgAdmin,
  analyticsController.getOrgAnalytics
);

/**
 * @swagger
 * /api/analytics/top-forms:
 *   get:
 *     summary: Get top forms by response count
 *     description: Get list of top forms ordered by response count
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top forms fetched successfully
 */
router.get(
  '/top-forms',
  verifyToken,
  isOrgAdmin,
  analyticsController.getTopForms
);

/**
 * @swagger
 * /api/analytics/realtime:
 *   get:
 *     summary: Get real-time statistics
 *     description: Get current statistics from live data
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Real-time stats fetched successfully
 */
router.get(
  '/realtime',
  verifyToken,
  isOrgAdmin,
  analyticsController.getRealTimeStats
);

/**
 * @swagger
 * /api/analytics/device-breakdown:
 *   get:
 *     summary: Get device breakdown
 *     description: Get breakdown of responses by device platform
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Device breakdown fetched successfully
 */
router.get(
  '/device-breakdown',
  verifyToken,
  isOrgAdmin,
  analyticsController.getDeviceBreakdown
);

/**
 * @swagger
 * /api/analytics/hourly-distribution:
 *   get:
 *     summary: Get hourly distribution
 *     description: Get breakdown of responses by hour of day
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Hourly distribution fetched successfully
 */
router.get(
  '/hourly-distribution',
  verifyToken,
  isOrgAdmin,
  analyticsController.getHourlyDistribution
);

/**
 * @swagger
 * /api/analytics/location-breakdown:
 *   get:
 *     summary: Get location breakdown
 *     description: Get breakdown of responses by location
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Location breakdown fetched successfully
 */
router.get(
  '/location-breakdown',
  verifyToken,
  isOrgAdmin,
  analyticsController.getLocationBreakdown
);

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard summary
 *     description: Get comprehensive dashboard data with multiple metrics
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formId
 *         schema:
 *           type: string
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dashboard summary fetched successfully
 */
router.get(
  '/dashboard',
  verifyToken,
  isOrgAdmin,
  analyticsController.getDashboardSummary
);

/**
 * @swagger
 * /api/analytics/aggregate-daily:
 *   post:
 *     summary: Trigger daily analytics aggregation
 *     description: Manually trigger daily analytics aggregation (Platform Admin only)
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Aggregation triggered successfully
 *       403:
 *         description: Access denied
 */
router.post(
  '/aggregate-daily',
  verifyToken,
  isPlatformAdmin,
  analyticsController.aggregateDailyAnalytics
);

module.exports = router;
