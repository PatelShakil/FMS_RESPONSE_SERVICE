/**
 * Response Controller
 * Handle HTTP requests for response operations
 */

const responseService = require('../services/response.service');
const fileService = require('../services/file.service');
const { getClientIP } = require('../middlewares/auth.middleware');
const apiResponse = require('../utils/response');
const logger = require('../utils/logger');

class ResponseController {
  /**
   * Submit a new response
   * POST /api/responses
   * Public endpoint (anonymous + authenticated)
   */
  async submitResponse(req, res) {
    try {
      const {
        formId,
        qrCodeId,
        serviceId,
        orgId,
        citizenEmail,
        citizenPhone,
        answers,
        location,
        metadata,
      } = req.body;

      // Get user info (null if anonymous)
      const userInfo = req.user;

      // Get device info
      const ipAddress = getClientIP(req);
      const userAgent = req.get('user-agent');

      // Prepare submission data
      const submissionData = {
        formId,
        qrCodeId,
        serviceId,
        orgId,
        citizenEmail,
        citizenPhone,
        answers,
        location,
        metadata,
        ipAddress,
        userAgent,
      };

      // Submit response
      const response = await responseService.submitResponse(submissionData, userInfo);

      logger.info('Response submitted successfully via API', {
        responseId: response.responseId,
        formId: response.formId,
        isAnonymous: !userInfo,
      });

      return apiResponse.created(res, {
        responseId: response.responseId,
        formId: response.formId,
        status: response.status,
        submittedAt: response.submittedAt,
        isSpam: response.isSpam,
        spamScore: response.spamScore,
      }, 'Response submitted successfully');
    } catch (error) {
      logger.error('Error in submitResponse controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get response by ID
   * GET /api/responses/:responseId
   */
  async getResponseById(req, res) {
    try {
      const { responseId } = req.params;
      const userOrgId = req.user?.orgId;

      const response = await responseService.getResponseById(responseId, userOrgId);

      if (!response) {
        return apiResponse.notFound(res, 'Response not found');
      }

      return apiResponse.success(res, response);
    } catch (error) {
      logger.error('Error in getResponseById controller:', error);
      
      if (error.message === 'Access denied to this response') {
        return apiResponse.forbidden(res, error.message);
      }
      
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * List responses with filters
   * GET /api/responses
   */
  async listResponses(req, res) {
    try {
      const filters = {
        formId: req.query.formId,
        orgId: req.query.orgId,
        serviceId: req.query.serviceId,
        qrCodeId: req.query.qrCodeId,
        citizenId: req.query.citizenId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const pagination = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        sortBy: req.query.sortBy || 'submittedAt',
        sortOrder: req.query.sortOrder || 'desc',
      };

      // If user is not platform admin, restrict to their org
      if (req.user && !req.user.roles.includes('PLATFORM_ADMIN')) {
        filters.orgId = req.user.orgId;
      }

      const result = await responseService.listResponses(filters, pagination);

      return apiResponse.paginated(
        res,
        result.responses,
        result.pagination,
        'Responses fetched successfully'
      );
    } catch (error) {
      logger.error('Error in listResponses controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get responses by form
   * GET /api/responses/form/:formId
   */
  async getResponsesByForm(req, res) {
    try {
      const { formId } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const status = req.query.status;

      const options = {
        status,
        limit,
        skip: (page - 1) * limit,
      };

      const responses = await responseService.getResponsesByForm(formId, options);

      return apiResponse.success(res, responses, 'Responses fetched successfully');
    } catch (error) {
      logger.error('Error in getResponsesByForm controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get responses by QR code
   * GET /api/responses/qr/:qrCodeId
   */
  async getResponsesByQR(req, res) {
    try {
      const { qrCodeId } = req.params;

      const filters = { qrCodeId };
      const pagination = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
      };

      const result = await responseService.listResponses(filters, pagination);

      return apiResponse.paginated(
        res,
        result.responses,
        result.pagination,
        'Responses fetched successfully'
      );
    } catch (error) {
      logger.error('Error in getResponsesByQR controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Review a response
   * PUT /api/responses/:responseId/review
   */
  async reviewResponse(req, res) {
    try {
      const { responseId } = req.params;
      const { notes } = req.body;
      const userId = req.user.userId;

      const response = await responseService.reviewResponse(responseId, userId, notes);

      return apiResponse.success(res, response, 'Response reviewed successfully');
    } catch (error) {
      logger.error('Error in reviewResponse controller:', error);
      
      if (error.message === 'Response not found') {
        return apiResponse.notFound(res, error.message);
      }
      
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Resolve a response
   * PUT /api/responses/:responseId/resolve
   */
  async resolveResponse(req, res) {
    try {
      const { responseId } = req.params;
      const { resolutionNotes } = req.body;
      const userId = req.user.userId;

      const response = await responseService.resolveResponse(
        responseId,
        userId,
        resolutionNotes
      );

      return apiResponse.success(res, response, 'Response resolved successfully');
    } catch (error) {
      logger.error('Error in resolveResponse controller:', error);
      
      if (error.message === 'Response not found') {
        return apiResponse.notFound(res, error.message);
      }
      
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Flag a response
   * POST /api/responses/:responseId/flag
   */
  async flagResponse(req, res) {
    try {
      const { responseId } = req.params;
      const { reason, comments } = req.body;
      const userId = req.user.userId;

      const response = await responseService.flagResponse(
        responseId,
        userId,
        reason,
        comments
      );

      return apiResponse.success(res, response, 'Response flagged successfully');
    } catch (error) {
      logger.error('Error in flagResponse controller:', error);
      
      if (error.message === 'Response not found') {
        return apiResponse.notFound(res, error.message);
      }
      
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Add reply to response
   * POST /api/responses/:responseId/reply
   */
  async addReply(req, res) {
    try {
      const { responseId } = req.params;
      const { message, isPublic } = req.body;
      const userId = req.user.userId;
      const userEmail = req.user.email;

      const response = await responseService.addReply(
        responseId,
        userId,
        userEmail,
        message,
        isPublic
      );

      return apiResponse.success(
        res,
        {
          responseId: response.responseId,
          replies: response.orgReplies,
          replyCount: response.replyCount,
        },
        'Reply added successfully'
      );
    } catch (error) {
      logger.error('Error in addReply controller:', error);
      
      if (error.message === 'Response not found') {
        return apiResponse.notFound(res, error.message);
      }
      
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Delete response (soft delete)
   * DELETE /api/responses/:responseId
   */
  async deleteResponse(req, res) {
    try {
      const { responseId } = req.params;
      const userId = req.user.userId;

      await responseService.deleteResponse(responseId, userId);

      return apiResponse.success(res, null, 'Response deleted successfully');
    } catch (error) {
      logger.error('Error in deleteResponse controller:', error);
      
      if (error.message === 'Response not found') {
        return apiResponse.notFound(res, error.message);
      }
      
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get response statistics
   * GET /api/responses/stats
   */
  async getResponseStats(req, res) {
    try {
      const { formId, orgId } = req.query;

      // If user is not platform admin, restrict to their org
      const targetOrgId = req.user.roles.includes('PLATFORM_ADMIN')
        ? orgId
        : req.user.orgId;

      const stats = await responseService.getResponseStats(formId, targetOrgId);

      return apiResponse.success(res, stats, 'Statistics fetched successfully');
    } catch (error) {
      logger.error('Error in getResponseStats controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Upload file (standalone endpoint)
   * POST /api/upload
   */
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return apiResponse.badRequest(res, 'No file uploaded');
      }

      const file = req.file;

      // Validate file
      const validation = fileService.validateFile(file,fileService.getFileCategory(file.mimetype || file.mimeType));
      if (!validation.valid) {
        return apiResponse.badRequest(res, validation.error);
      }

      // Upload to MinIO
      const result = await fileService.uploadFile(file, 'responses');

      logger.info('File uploaded via standalone endpoint', {
        fileName: result.fileName,
        fileSize: result.fileSize,
      });

      return apiResponse.success(res, result, 'File uploaded successfully');
    } catch (error) {
      logger.error('Error in uploadFile controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }
}

module.exports = new ResponseController();
