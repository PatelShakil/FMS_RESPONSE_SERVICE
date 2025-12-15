/**
 * Response Routes
 * API endpoints for response operations with Swagger documentation
 */

const express = require('express');
const router = express.Router();
const responseController = require('../controllers/response.controller');
const { optionalAuth, verifyToken, isOrgAdmin, checkOrgAccess } = require('../middlewares/auth.middleware');
const { combinedRateLimiter, strictRateLimiter } = require('../middlewares/ratelimit.middleware');
const { singleFileUpload } = require('../middlewares/upload.middleware');
const { validate, validateQuery, submitResponseSchema, reviewResponseSchema, resolveResponseSchema, flagResponseSchema, replyResponseSchema, listResponsesQuerySchema } = require('../utils/validation');

/**
 * @swagger
 * tags:
 *   name: Responses
 *   description: Response submission and management
 */

/**
 * @swagger
 * /api/responses:
 *   post:
 *     summary: Submit a new response
 *     description: Submit a response to a form (anonymous or authenticated)
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - formId
 *               - serviceId
 *               - orgId
 *               - answers
 *             properties:
 *               formId:
 *                 type: string
 *                 example: FORM-ABC123
 *               qrCodeId:
 *                 type: string
 *                 example: QR-XYZ789
 *               serviceId:
 *                 type: integer
 *                 example: 3
 *               orgId:
 *                 type: integer
 *                 example: 3
 *               citizenEmail:
 *                 type: string
 *                 format: email
 *                 example: citizen@example.com
 *               citizenPhone:
 *                 type: string
 *                 example: "+919876543210"
 *               answers:
 *                 type: object
 *                 example: { "field1": "Answer text", "field2": "Location" }
 *               location:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     example: 21.1702
 *                   longitude:
 *                     type: number
 *                     example: 72.8311
 *                   accuracy:
 *                     type: number
 *                     example: 10.5
 *                   address:
 *                     type: string
 *                     example: "Athwa, Surat"
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Response submitted successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  optionalAuth, // Allow both anonymous and authenticated
  combinedRateLimiter, // Apply rate limiting
  validate(submitResponseSchema),
  responseController.submitResponse
);

/**
 * @swagger
 * /api/responses/{responseId}:
 *   get:
 *     summary: Get response by ID
 *     description: Get a specific response by its ID
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Response ID
 *     responses:
 *       200:
 *         description: Response fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Response not found
 */
router.get(
  '/:responseId',
  verifyToken,
  isOrgAdmin,
  responseController.getResponseById
);

/**
 * @swagger
 * /api/responses:
 *   get:
 *     summary: List responses with filters
 *     description: Get paginated list of responses with optional filters
 *     tags: [Responses]
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
 *         name: serviceId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: qrCodeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, REVIEWED, RESOLVED, REJECTED, SPAM]
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: submittedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Responses fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  verifyToken,
  isOrgAdmin,
  validateQuery(listResponsesQuerySchema),
  responseController.listResponses
);

/**
 * @swagger
 * /api/responses/form/{formId}:
 *   get:
 *     summary: Get responses by form
 *     description: Get all responses for a specific form
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Responses fetched successfully
 */
router.get(
  '/form/:formId',
  verifyToken,
  isOrgAdmin,
  responseController.getResponsesByForm
);

/**
 * @swagger
 * /api/responses/qr/{qrCodeId}:
 *   get:
 *     summary: Get responses by QR code
 *     description: Get all responses submitted via a specific QR code
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: qrCodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Responses fetched successfully
 */
router.get(
  '/qr/:qrCodeId',
  verifyToken,
  isOrgAdmin,
  responseController.getResponsesByQR
);

/**
 * @swagger
 * /api/responses/{responseId}/review:
 *   put:
 *     summary: Review a response
 *     description: Mark a response as reviewed
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Response reviewed successfully
 *       404:
 *         description: Response not found
 */
router.put(
  '/:responseId/review',
  verifyToken,
  isOrgAdmin,
  validate(reviewResponseSchema),
  responseController.reviewResponse
);

/**
 * @swagger
 * /api/responses/{responseId}/resolve:
 *   put:
 *     summary: Resolve a response
 *     description: Mark a response as resolved with resolution notes
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolutionNotes
 *             properties:
 *               resolutionNotes:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Response resolved successfully
 *       404:
 *         description: Response not found
 */
router.put(
  '/:responseId/resolve',
  verifyToken,
  isOrgAdmin,
  validate(resolveResponseSchema),
  responseController.resolveResponse
);

/**
 * @swagger
 * /api/responses/{responseId}/flag:
 *   post:
 *     summary: Flag a response
 *     description: Flag a response as spam or inappropriate
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [SPAM, INAPPROPRIATE, DUPLICATE, FAKE, OTHER]
 *               comments:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Response flagged successfully
 *       404:
 *         description: Response not found
 */
router.post(
  '/:responseId/flag',
  verifyToken,
  isOrgAdmin,
  strictRateLimiter,
  validate(flagResponseSchema),
  responseController.flagResponse
);

/**
 * @swagger
 * /api/responses/{responseId}/reply:
 *   post:
 *     summary: Add reply to response
 *     description: Add an organization reply to a response
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Reply added successfully
 *       404:
 *         description: Response not found
 */
router.post(
  '/:responseId/reply',
  verifyToken,
  isOrgAdmin,
  validate(replyResponseSchema),
  responseController.addReply
);

/**
 * @swagger
 * /api/responses/{responseId}:
 *   delete:
 *     summary: Delete a response
 *     description: Soft delete a response
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Response deleted successfully
 *       404:
 *         description: Response not found
 */
router.delete(
  '/:responseId',
  verifyToken,
  isOrgAdmin,
  strictRateLimiter,
  responseController.deleteResponse
);

/**
 * @swagger
 * /api/responses/stats:
 *   get:
 *     summary: Get response statistics
 *     description: Get aggregated statistics for responses
 *     tags: [Responses]
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
 *         description: Statistics fetched successfully
 */
router.get(
  '/stats',
  verifyToken,
  isOrgAdmin,
  responseController.getResponseStats
);

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a file
 *     description: Upload a file to MinIO storage
 *     tags: [Responses]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid file
 */
router.post(
  '/upload',
  optionalAuth,
  singleFileUpload('file'),
  responseController.uploadFile
);

module.exports = router;
