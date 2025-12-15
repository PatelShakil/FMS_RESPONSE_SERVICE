/**
 * Analytics Service
 * Response analytics and aggregations
 */

const Response = require('../models/Response');
const ResponseAnalytics = require('../models/ResponseAnalytics');
const logger = require('../utils/logger');
const moment = require('moment');

class AnalyticsService {
  /**
   * Get analytics for a form
   */
  async getFormAnalytics(formId, startDate, endDate) {
    try {
      logger.info('Fetching form analytics', {
        formId,
        startDate,
        endDate,
      });

      const analytics = await ResponseAnalytics.getAnalyticsByDateRange(
        formId,
        startDate,
        endDate
      );

      // Calculate totals
      const totals = analytics.reduce(
        (acc, day) => {
          acc.totalResponses += day.totalResponses || 0;
          acc.anonymousResponses += day.anonymousResponses || 0;
          acc.registeredResponses += day.registeredResponses || 0;
          acc.spamDetected += day.spamDetected || 0;
          acc.flaggedResponses += day.flaggedResponses || 0;
          return acc;
        },
        {
          totalResponses: 0,
          anonymousResponses: 0,
          registeredResponses: 0,
          spamDetected: 0,
          flaggedResponses: 0,
        }
      );

      return {
        formId,
        dateRange: {
          startDate,
          endDate,
        },
        totals,
        dailyData: analytics,
      };
    } catch (error) {
      logger.error('Error fetching form analytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics for an organization
   */
  async getOrgAnalytics(orgId, startDate, endDate) {
    try {
      logger.info('Fetching org analytics', {
        orgId,
        startDate,
        endDate,
      });

      const analytics = await ResponseAnalytics.getOrgAnalytics(
        orgId,
        startDate,
        endDate
      );

      return analytics[0] || {
        totalResponses: 0,
        anonymousResponses: 0,
        registeredResponses: 0,
        spamDetected: 0,
        flaggedResponses: 0,
        totalReplies: 0,
        avgReplyTime: 0,
      };
    } catch (error) {
      logger.error('Error fetching org analytics:', error);
      throw error;
    }
  }

  /**
   * Get top forms by response count
   */
  async getTopForms(orgId, startDate, endDate, limit = 10) {
    try {
      logger.info('Fetching top forms', {
        orgId,
        startDate,
        endDate,
        limit,
      });

      return await ResponseAnalytics.getTopForms(orgId, startDate, endDate, limit);
    } catch (error) {
      logger.error('Error fetching top forms:', error);
      throw error;
    }
  }

  /**
   * Get real-time statistics (from Response collection)
   */
  async getRealTimeStats(formId = null, orgId = null) {
    try {
      logger.info('Fetching real-time stats', { formId, orgId });

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
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] },
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
            flagged: {
              $sum: { $cond: ['$isFlagged', 1, 0] },
            },
          },
        },
      ]);

      return stats[0] || {
        total: 0,
        pending: 0,
        reviewed: 0,
        resolved: 0,
        rejected: 0,
        spam: 0,
        anonymous: 0,
        registered: 0,
        flagged: 0,
      };
    } catch (error) {
      logger.error('Error fetching real-time stats:', error);
      throw error;
    }
  }

  /**
   * Get device breakdown
   */
  async getDeviceBreakdown(formId = null, orgId = null) {
    try {
      const query = { deletedAt: null };
      if (formId) query.formId = formId;
      if (orgId) query.orgId = orgId;

      const breakdown = await Response.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$device.platform',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      return breakdown.map((item) => ({
        platform: item._id || 'Unknown',
        count: item.count,
      }));
    } catch (error) {
      logger.error('Error fetching device breakdown:', error);
      throw error;
    }
  }

  /**
   * Get hourly distribution
   */
  async getHourlyDistribution(formId = null, orgId = null) {
    try {
      const query = { deletedAt: null };
      if (formId) query.formId = formId;
      if (orgId) query.orgId = orgId;

      const distribution = await Response.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $hour: '$submittedAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Fill in missing hours with 0
      const hourlyData = Array(24).fill(0);
      distribution.forEach((item) => {
        hourlyData[item._id] = item.count;
      });

      return hourlyData.map((count, hour) => ({
        hour,
        count,
      }));
    } catch (error) {
      logger.error('Error fetching hourly distribution:', error);
      throw error;
    }
  }

  /**
   * Get location breakdown (top cities)
   */
  async getLocationBreakdown(formId = null, orgId = null, limit = 10) {
    try {
      const query = {
        deletedAt: null,
        'location.address': { $exists: true, $ne: null },
      };
      if (formId) query.formId = formId;
      if (orgId) query.orgId = orgId;

      const locations = await Response.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$location.address',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);

      return locations.map((item) => ({
        location: item._id,
        count: item.count,
      }));
    } catch (error) {
      logger.error('Error fetching location breakdown:', error);
      throw error;
    }
  }

  /**
   * Aggregate daily analytics (background job - called by scheduler)
   */
  async aggregateDailyAnalytics(date = new Date()) {
    try {
      const targetDate = moment(date).startOf('day').toDate();
      
      logger.info('Aggregating daily analytics', {
        date: targetDate.toISOString(),
      });

      // Get all forms that received responses on this date
      const forms = await Response.distinct('formId', {
        submittedAt: {
          $gte: targetDate,
          $lt: moment(targetDate).add(1, 'day').toDate(),
        },
      });

      logger.info(`Found ${forms.length} forms with responses on ${targetDate.toISOString()}`);

      // Aggregate analytics for each form
      for (const formId of forms) {
        const analytics = await ResponseAnalytics.aggregateDailyStats(formId, targetDate);
        
        if (analytics) {
          // Upsert analytics document
          await ResponseAnalytics.findOneAndUpdate(
            { formId, date: targetDate },
            analytics,
            { upsert: true, new: true }
          );

          logger.info(`Daily analytics aggregated for form ${formId}`);
        }
      }

      logger.info('Daily analytics aggregation completed');
    } catch (error) {
      logger.error('Error aggregating daily analytics:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
