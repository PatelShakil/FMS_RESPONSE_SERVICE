/**
 * Analytics Controller
 * Handle analytics and reporting requests
 */

const analyticsService = require('../services/analytics.service');
const apiResponse = require('../utils/response');
const logger = require('../utils/logger');
const moment = require('moment');

class AnalyticsController {
  /**
   * Get form analytics
   * GET /api/analytics/form/:formId
   */
  async getFormAnalytics(req, res) {
    try {
      const { formId } = req.params;
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not provided
      const start = startDate || moment().subtract(30, 'days').format('YYYY-MM-DD');
      const end = endDate || moment().format('YYYY-MM-DD');

      const analytics = await analyticsService.getFormAnalytics(formId, start, end);

      return apiResponse.success(res, analytics, 'Form analytics fetched successfully');
    } catch (error) {
      logger.error('Error in getFormAnalytics controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get organization analytics
   * GET /api/analytics/org/:orgId
   */
  async getOrgAnalytics(req, res) {
    try {
      const { orgId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate org access
      if (!req.user.roles.includes('PLATFORM_ADMIN') && req.user.orgId !== parseInt(orgId, 10)) {
        return apiResponse.forbidden(res, 'Access denied to this organization analytics');
      }

      // Default to last 30 days
      const start = startDate || moment().subtract(30, 'days').format('YYYY-MM-DD');
      const end = endDate || moment().format('YYYY-MM-DD');

      const analytics = await analyticsService.getOrgAnalytics(parseInt(orgId, 10), start, end);

      return apiResponse.success(res, analytics, 'Organization analytics fetched successfully');
    } catch (error) {
      logger.error('Error in getOrgAnalytics controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get top forms by response count
   * GET /api/analytics/top-forms
   */
  async getTopForms(req, res) {
    try {
      const { orgId, startDate, endDate, limit } = req.query;

      // Validate org access
      const targetOrgId = req.user.roles.includes('PLATFORM_ADMIN')
        ? parseInt(orgId, 10)
        : req.user.orgId;

      // Default to last 30 days
      const start = startDate || moment().subtract(30, 'days').format('YYYY-MM-DD');
      const end = endDate || moment().format('YYYY-MM-DD');
      const topLimit = parseInt(limit, 10) || 10;

      const topForms = await analyticsService.getTopForms(targetOrgId, start, end, topLimit);

      return apiResponse.success(res, topForms, 'Top forms fetched successfully');
    } catch (error) {
      logger.error('Error in getTopForms controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get real-time statistics
   * GET /api/analytics/realtime
   */
  async getRealTimeStats(req, res) {
    try {
      const { formId, orgId } = req.query;

      // Validate org access
      const targetOrgId = req.user.roles.includes('PLATFORM_ADMIN')
        ? (orgId ? parseInt(orgId, 10) : null)
        : req.user.orgId;

      const stats = await analyticsService.getRealTimeStats(formId, targetOrgId);

      return apiResponse.success(res, stats, 'Real-time statistics fetched successfully');
    } catch (error) {
      logger.error('Error in getRealTimeStats controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get device breakdown
   * GET /api/analytics/device-breakdown
   */
  async getDeviceBreakdown(req, res) {
    try {
      const { formId, orgId } = req.query;

      // Validate org access
      const targetOrgId = req.user.roles.includes('PLATFORM_ADMIN')
        ? (orgId ? parseInt(orgId, 10) : null)
        : req.user.orgId;

      const breakdown = await analyticsService.getDeviceBreakdown(formId, targetOrgId);

      return apiResponse.success(res, breakdown, 'Device breakdown fetched successfully');
    } catch (error) {
      logger.error('Error in getDeviceBreakdown controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get hourly distribution
   * GET /api/analytics/hourly-distribution
   */
  async getHourlyDistribution(req, res) {
    try {
      const { formId, orgId } = req.query;

      // Validate org access
      const targetOrgId = req.user.roles.includes('PLATFORM_ADMIN')
        ? (orgId ? parseInt(orgId, 10) : null)
        : req.user.orgId;

      const distribution = await analyticsService.getHourlyDistribution(formId, targetOrgId);

      return apiResponse.success(res, distribution, 'Hourly distribution fetched successfully');
    } catch (error) {
      logger.error('Error in getHourlyDistribution controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get location breakdown
   * GET /api/analytics/location-breakdown
   */
  async getLocationBreakdown(req, res) {
    try {
      const { formId, orgId, limit } = req.query;

      // Validate org access
      const targetOrgId = req.user.roles.includes('PLATFORM_ADMIN')
        ? (orgId ? parseInt(orgId, 10) : null)
        : req.user.orgId;

      const topLimit = parseInt(limit, 10) || 10;

      const breakdown = await analyticsService.getLocationBreakdown(
        formId,
        targetOrgId,
        topLimit
      );

      return apiResponse.success(res, breakdown, 'Location breakdown fetched successfully');
    } catch (error) {
      logger.error('Error in getLocationBreakdown controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Get dashboard summary
   * GET /api/analytics/dashboard
   */
  async getDashboardSummary(req, res) {
    try {
      const { formId, orgId } = req.query;

      // Validate org access
      const targetOrgId = req.user.roles.includes('PLATFORM_ADMIN')
        ? (orgId ? parseInt(orgId, 10) : null)
        : req.user.orgId;

      // Fetch multiple metrics in parallel
      const [realTimeStats, deviceBreakdown, hourlyDistribution, locationBreakdown] =
        await Promise.all([
          analyticsService.getRealTimeStats(formId, targetOrgId),
          analyticsService.getDeviceBreakdown(formId, targetOrgId),
          analyticsService.getHourlyDistribution(formId, targetOrgId),
          analyticsService.getLocationBreakdown(formId, targetOrgId, 5),
        ]);

      const dashboard = {
        overview: realTimeStats,
        deviceBreakdown,
        hourlyDistribution,
        topLocations: locationBreakdown,
        lastUpdated: new Date().toISOString(),
      };

      return apiResponse.success(res, dashboard, 'Dashboard summary fetched successfully');
    } catch (error) {
      logger.error('Error in getDashboardSummary controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Trigger daily analytics aggregation (admin only)
   * POST /api/analytics/aggregate-daily
   */
  async aggregateDailyAnalytics(req, res) {
    try {
      const { date } = req.body;

      const targetDate = date ? new Date(date) : new Date();

      logger.info('Manually triggering daily analytics aggregation', {
        date: targetDate.toISOString(),
        triggeredBy: req.user.userId,
      });

      // Run aggregation in background (don't wait)
      analyticsService.aggregateDailyAnalytics(targetDate).catch((error) => {
        logger.error('Background analytics aggregation failed:', error);
      });

      return apiResponse.success(
        res,
        { date: targetDate.toISOString() },
        'Daily analytics aggregation triggered'
      );
    } catch (error) {
      logger.error('Error in aggregateDailyAnalytics controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }
}

module.exports = new AnalyticsController();
