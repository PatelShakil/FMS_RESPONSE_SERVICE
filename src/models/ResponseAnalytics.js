/**
 * ResponseAnalytics Model (Mongoose Schema)
 * Daily aggregated analytics for responses
 */

const mongoose = require('mongoose');

const responseAnalyticsSchema = new mongoose.Schema(
  {
    // Form reference
    formId: {
      type: String,
      required: true,
      index: true,
    },

    // Organization reference
    orgId: {
      type: Number,
      required: true,
      index: true,
    },

    // Service reference
    serviceId: {
      type: Number,
      index: true,
    },

    // Date bucket (daily aggregation)
    date: {
      type: Date,
      required: true,
      index: true,
    },

    // Response counts
    totalResponses: {
      type: Number,
      default: 0,
    },

    anonymousResponses: {
      type: Number,
      default: 0,
    },

    registeredResponses: {
      type: Number,
      default: 0,
    },

    // Performance metrics
    avgResponseTime: {
      type: Number, // Average time to complete form (seconds)
      default: 0,
    },

    // Location breakdown
    topLocations: [
      {
        city: String,
        state: String,
        count: Number,
      },
    ],

    // Device breakdown
    deviceBreakdown: {
      Android: {
        type: Number,
        default: 0,
      },
      iOS: {
        type: Number,
        default: 0,
      },
      Desktop: {
        type: Number,
        default: 0,
      },
      Unknown: {
        type: Number,
        default: 0,
      },
    },

    // Browser breakdown
    browserBreakdown: {
      Chrome: {
        type: Number,
        default: 0,
      },
      Safari: {
        type: Number,
        default: 0,
      },
      Firefox: {
        type: Number,
        default: 0,
      },
      Edge: {
        type: Number,
        default: 0,
      },
      Other: {
        type: Number,
        default: 0,
      },
    },

    // Status breakdown
    statusBreakdown: {
      PENDING: {
        type: Number,
        default: 0,
      },
      REVIEWED: {
        type: Number,
        default: 0,
      },
      RESOLVED: {
        type: Number,
        default: 0,
      },
      REJECTED: {
        type: Number,
        default: 0,
      },
      SPAM: {
        type: Number,
        default: 0,
      },
    },

    // File uploads
    totalFileUploads: {
      type: Number,
      default: 0,
    },

    fileTypeBreakdown: {
      images: {
        type: Number,
        default: 0,
      },
      videos: {
        type: Number,
        default: 0,
      },
      audio: {
        type: Number,
        default: 0,
      },
    },

    // QR code analytics
    qrCodeScans: [
      {
        qrCodeId: String,
        scanCount: Number,
      },
    ],

    // Hourly distribution (24-hour format)
    hourlyDistribution: {
      type: Map,
      of: Number,
      default: {},
    },

    // Spam metrics
    spamDetected: {
      type: Number,
      default: 0,
    },

    flaggedResponses: {
      type: Number,
      default: 0,
    },

    // Reply metrics
    totalReplies: {
      type: Number,
      default: 0,
    },

    avgReplyTime: {
      type: Number, // Average time to reply (hours)
      default: 0,
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: 'responseanalytics',
  }
);

// ===========================
// INDEXES
// ===========================

// Compound indexes for queries
responseAnalyticsSchema.index({ formId: 1, date: -1 });
responseAnalyticsSchema.index({ orgId: 1, date: -1 });
responseAnalyticsSchema.index({ serviceId: 1, date: -1 });
responseAnalyticsSchema.index({ formId: 1, orgId: 1, date: -1 });

// Unique constraint: one analytics record per form per day
responseAnalyticsSchema.index({ formId: 1, date: 1 }, { unique: true });

// ===========================
// STATIC METHODS
// ===========================

// Static method: Get analytics for date range
responseAnalyticsSchema.statics.getAnalyticsByDateRange = function (
  formId,
  startDate,
  endDate
) {
  return this.find({
    formId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  }).sort({ date: 1 });
};

// Static method: Get org-wide analytics
responseAnalyticsSchema.statics.getOrgAnalytics = function (orgId, startDate, endDate) {
  const matchQuery = {
    orgId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalResponses: { $sum: '$totalResponses' },
        anonymousResponses: { $sum: '$anonymousResponses' },
        registeredResponses: { $sum: '$registeredResponses' },
        spamDetected: { $sum: '$spamDetected' },
        flaggedResponses: { $sum: '$flaggedResponses' },
        totalReplies: { $sum: '$totalReplies' },
        avgReplyTime: { $avg: '$avgReplyTime' },
      },
    },
  ]);
};

// Static method: Get top forms by response count
responseAnalyticsSchema.statics.getTopForms = function (orgId, startDate, endDate, limit = 10) {
  const matchQuery = {
    orgId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$formId',
        totalResponses: { $sum: '$totalResponses' },
        avgReplyTime: { $avg: '$avgReplyTime' },
      },
    },
    { $sort: { totalResponses: -1 } },
    { $limit: limit },
  ]);
};

// Static method: Aggregate daily stats
responseAnalyticsSchema.statics.aggregateDailyStats = async function (formId, date) {
  const Response = mongoose.model('Response');

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Aggregate responses for the day
  const responses = await Response.find({
    formId,
    submittedAt: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    deletedAt: null,
  });

  if (responses.length === 0) {
    return null;
  }

  // Calculate analytics
  const analytics = {
    formId,
    orgId: responses[0].orgId,
    serviceId: responses[0].serviceId,
    date: startOfDay,
    totalResponses: responses.length,
    anonymousResponses: responses.filter((r) => !r.citizenId).length,
    registeredResponses: responses.filter((r) => r.citizenId).length,
    deviceBreakdown: {
      Android: 0,
      iOS: 0,
      Desktop: 0,
      Unknown: 0,
    },
    statusBreakdown: {
      PENDING: 0,
      REVIEWED: 0,
      RESOLVED: 0,
      REJECTED: 0,
      SPAM: 0,
    },
    totalFileUploads: 0,
    spamDetected: 0,
    flaggedResponses: 0,
    totalReplies: 0,
    hourlyDistribution: {},
  };

  // Process each response
  responses.forEach((response) => {
    // Device breakdown
    const platform = response.device?.platform || 'Unknown';
    if (analytics.deviceBreakdown[platform] !== undefined) {
      analytics.deviceBreakdown[platform]++;
    }

    // Status breakdown
    if (analytics.statusBreakdown[response.status] !== undefined) {
      analytics.statusBreakdown[response.status]++;
    }

    // File uploads
    if (response.hasFiles && response.hasFiles()) {
      analytics.totalFileUploads += response.getFileCount();
    }

    // Spam and flags
    if (response.isSpam) analytics.spamDetected++;
    if (response.isFlagged) analytics.flaggedResponses++;

    // Replies
    if (response.orgReplies && response.orgReplies.length > 0) {
      analytics.totalReplies += response.orgReplies.length;
    }

    // Hourly distribution
    const hour = response.submittedAt.getHours();
    analytics.hourlyDistribution[hour] = (analytics.hourlyDistribution[hour] || 0) + 1;
  });

  return analytics;
};

// ===========================
// EXPORT MODEL
// ===========================

module.exports = mongoose.model('ResponseAnalytics', responseAnalyticsSchema);
