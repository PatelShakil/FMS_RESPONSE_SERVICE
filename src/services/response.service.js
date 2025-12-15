/**
 * Response Service
 * Business logic for response operations
 */

const Response = require('../models/Response');
const logger = require('../utils/logger');
const { generateResponseId } = require('../utils/idGenerator');
const { detectSpam, parseDeviceInfo } = require('../utils/spamDetector');
const kafkaManager = require('../config/kafka');

class ResponseService {
  /**
   * Submit a new response
   */
  async submitResponse(data, userInfo = null) {
    try {
      logger.info('Submitting new response', {
        formId: data.formId,
        serviceId: data.serviceId,
        orgId: data.orgId,
        isAnonymous: !userInfo,
      });

      // Generate unique response ID
      const responseId = generateResponseId();

      // Parse device information
      const deviceInfo = parseDeviceInfo(data.userAgent);

      // Prepare response document
      const responseData = {
        responseId,
        formId: data.formId,
        qrCodeId: data.qrCodeId || null,
        serviceId: data.serviceId,
        orgId: data.orgId,
        answers: data.answers,
        submittedAt: new Date(),
        
        // Device information
        device: {
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          platform: deviceInfo.platform,
          browser: deviceInfo.browser,
          deviceType: deviceInfo.deviceType,
        },

        // Location (optional)
        location: data.location || null,

        // Metadata
        metadata: data.metadata || null,
      };

      // Citizen info (if authenticated)
      if (userInfo) {
        responseData.citizenId = userInfo.userId;
        responseData.citizenEmail = userInfo.email || data.citizenEmail;
        responseData.citizenPhone = data.citizenPhone || null;
      } else {
        // Anonymous submission
        responseData.citizenEmail = data.citizenEmail || null;
        responseData.citizenPhone = data.citizenPhone || null;
      }

      // Detect spam
      const spamResult = await detectSpam(responseData);
      responseData.spamScore = spamResult.spamScore;
      responseData.isSpam = spamResult.isSpam;
      responseData.spamReasons = spamResult.spamReasons;

      // Create response
      const response = new Response(responseData);
      await response.save();

      logger.info('Response submitted successfully', {
        responseId: response.responseId,
        formId: response.formId,
        spamScore: response.spamScore,
      });

      // Add to Kafka batch for event publishing
      kafkaManager.addToBatch({
        responseId: response.responseId,
        formName: response.formId,
        formId: response.formId,
        qrCodeId: response.qrCodeId,
        serviceId: response.serviceId,
        orgId: response.orgId,
        orgAdminEmail: response.orgAdminEmail || null,
        citizenId: response.citizenId || null,
        submittedAt: response.submittedAt.toISOString(),
        hasFiles: response.hasFiles(),
        isAnonymous: !response.citizenId,
        isSpam: response.isSpam,
        location: response.location || null,
      });

      return response;
    } catch (error) {
      logger.error('Error submitting response:', error);
      throw error;
    }
  }

  /**
   * Get response by ID
   */
  async getResponseById(responseId, userOrgId = null) {
    try {
      const response = await Response.findOne({
        responseId,
        deletedAt: null,
      });

      if (!response) {
        return null;
      }

      // Check org access (if not platform admin)
      if (userOrgId && response.orgId !== userOrgId) {
        throw new Error('Access denied to this response');
      }

      return response;
    } catch (error) {
      logger.error('Error fetching response by ID:', error);
      throw error;
    }
  }

  /**
   * List responses with filters and pagination
   */
  async listResponses(filters, pagination) {
    try {
      const {
        formId,
        orgId,
        serviceId,
        qrCodeId,
        citizenId,
        status,
        startDate,
        endDate,
      } = filters;

      const { page = 1, limit = 20, sortBy = 'submittedAt', sortOrder = 'desc' } = pagination;

      // Build query
      const query = { deletedAt: null };

      if (formId) query.formId = formId;
      if (orgId) query.orgId = orgId;
      if (serviceId) query.serviceId = serviceId;
      if (qrCodeId) query.qrCodeId = qrCodeId;
      if (citizenId) query.citizenId = citizenId;
      if (status) query.status = status;

      if (startDate || endDate) {
        query.submittedAt = {};
        if (startDate) query.submittedAt.$gte = new Date(startDate);
        if (endDate) query.submittedAt.$lte = new Date(endDate);
      }

      // Count total documents
      const total = await Response.countDocuments(query);

      // Fetch paginated results
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      const responses = await Response.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      logger.info('Responses listed successfully', {
        total,
        page,
        limit,
        filters,
      });

      return {
        responses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error listing responses:', error);
      throw error;
    }
  }

  /**
   * Review a response
   */
  async reviewResponse(responseId, userId, notes = null) {
    try {
      const response = await Response.findOne({
        responseId,
        deletedAt: null,
      });

      if (!response) {
        throw new Error('Response not found');
      }

      // Mark as reviewed
      response.markAsReviewed(userId);
      
      if (notes) {
        response.resolutionNotes = notes;
      }

      await response.save();

      logger.info('Response reviewed', {
        responseId: response.responseId,
        reviewedBy: userId,
      });

      // Publish Kafka event
      await kafkaManager.publishResponseReviewed({
        responseId: response.responseId,
        formId: response.formId,
        orgId: response.orgId,
        reviewedBy: userId,
        reviewedAt: response.reviewedAt.toISOString(),
      });

      return response;
    } catch (error) {
      logger.error('Error reviewing response:', error);
      throw error;
    }
  }

  /**
   * Resolve a response
   */
  async resolveResponse(responseId, userId, resolutionNotes) {
    try {
      const response = await Response.findOne({
        responseId,
        deletedAt: null,
      });

      if (!response) {
        throw new Error('Response not found');
      }

      // Mark as resolved
      response.markAsResolved(userId, resolutionNotes);
      await response.save();

      logger.info('Response resolved', {
        responseId: response.responseId,
        resolvedBy: userId,
      });

      // Publish Kafka event
      await kafkaManager.publishResponseResolved({
        responseId: response.responseId,
        formId: response.formId,
        orgId: response.orgId,
        citizenId: response.citizenId,
        citizenEmail: response.citizenEmail,
        resolvedBy: userId,
        resolutionNotes,
        resolvedAt: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      logger.error('Error resolving response:', error);
      throw error;
    }
  }

  /**
   * Flag a response
   */
  async flagResponse(responseId, userId, reason, comments = null) {
    try {
      const response = await Response.findOne({
        responseId,
        deletedAt: null,
      });

      if (!response) {
        throw new Error('Response not found');
      }

      // Flag response
      response.flag(userId, reason, comments);
      
      // If flagged as SPAM, update status
      if (reason === 'SPAM') {
        response.status = 'SPAM';
        response.isSpam = true;
      }

      await response.save();

      logger.info('Response flagged', {
        responseId: response.responseId,
        flaggedBy: userId,
        reason,
      });

      // Publish Kafka event
      await kafkaManager.publishResponseFlagged({
        responseId: response.responseId,
        formId: response.formId,
        orgId: response.orgId,
        flaggedBy: userId,
        flagReason: reason,
        flagComments: comments,
        flaggedAt: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      logger.error('Error flagging response:', error);
      throw error;
    }
  }

  /**
   * Add reply to response
   */
  async addReply(responseId, userId, userEmail, replyMessage, isPublic = true) {
    try {
      const response = await Response.findOne({
        responseId,
        deletedAt: null,
      });

      if (!response) {
        throw new Error('Response not found');
      }

      // Add reply
      response.addReply({
        message: replyMessage,
        repliedBy: userId,
        repliedByEmail: userEmail,
        isPublic,
      });

      await response.save();

      logger.info('Reply added to response', {
        responseId: response.responseId,
        repliedBy: userId,
        isPublic,
      });

      // Publish Kafka event (for notification service)
      if (isPublic && response.citizenEmail) {
        await kafkaManager.publishEvent('response.reply.created', responseId, {
          responseId: response.responseId,
          formId: response.formId,
          orgId: response.orgId,
          citizenEmail: response.citizenEmail,
          replyMessage,
          repliedBy: userId,
          repliedByEmail: userEmail,
          repliedAt: new Date().toISOString(),
        });
      }

      return response;
    } catch (error) {
      logger.error('Error adding reply:', error);
      throw error;
    }
  }

  /**
   * Delete response (soft delete)
   */
  async deleteResponse(responseId, userId) {
    try {
      const response = await Response.findOne({
        responseId,
        deletedAt: null,
      });

      if (!response) {
        throw new Error('Response not found');
      }

      // Soft delete
      response.softDelete(userId);
      await response.save();

      logger.info('Response deleted', {
        responseId: response.responseId,
        deletedBy: userId,
      });

      return true;
    } catch (error) {
      logger.error('Error deleting response:', error);
      throw error;
    }
  }

  /**
   * Get response statistics
   */
  async getResponseStats(formId, orgId) {
    try {
      const query = { deletedAt: null };
      
      if (formId) query.formId = formId;
      if (orgId) query.orgId = orgId;

      const stats = await Response.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
            },
            reviewed: {
              $sum: { $cond: [{ $eq: ['$status', 'REVIEWED'] }, 1, 0] },
            },
            resolved: {
              $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] },
            },
            spam: {
              $sum: { $cond: [{ $eq: ['$status', 'SPAM'] }, 1, 0] },
            },
            anonymous: {
              $sum: { $cond: [{ $eq: ['$citizenId', null] }, 1, 0] },
            },
            registered: {
              $sum: { $cond: [{ $ne: ['$citizenId', null] }, 1, 0] },
            },
          },
        },
      ]);

      return stats[0] || {
        total: 0,
        pending: 0,
        reviewed: 0,
        resolved: 0,
        spam: 0,
        anonymous: 0,
        registered: 0,
      };
    } catch (error) {
      logger.error('Error fetching response stats:', error);
      throw error;
    }
  }

  /**
   * Get responses by form
   */
  async getResponsesByForm(formId, options = {}) {
    try {
      return await Response.findByForm(formId, options);
    } catch (error) {
      logger.error('Error fetching responses by form:', error);
      throw error;
    }
  }

  /**
   * Get responses by organization
   */
  async getResponsesByOrg(orgId, options = {}) {
    try {
      return await Response.findByOrg(orgId, options);
    } catch (error) {
      logger.error('Error fetching responses by org:', error);
      throw error;
    }
  }
}

module.exports = new ResponseService();
