/**
 * Response Model (Mongoose Schema)
 * Citizen feedback response submissions
 */

const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
  {
    // Unique identifier
    responseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Form reference
    formId: {
      type: String,
      required: true,
      index: true,
    },

    // QR Code reference (optional - direct form submission without QR)
    qrCodeId: {
      type: String,
      index: true,
    },

    // Service reference (from service-service PostgreSQL)
    serviceId: {
      type: Number,
      required: true,
      index: true,
    },

    // Organization reference (from org-service PostgreSQL)
    orgId: {
      type: Number,
      required: true,
      index: true,
    },

    // Citizen info (optional - anonymous submissions allowed)
    citizenId: {
      type: Number,
      index: true,
      sparse: true, // Allow null values in index
    },

    citizenEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    citizenPhone: {
      type: String,
      trim: true,
    },

    // Dynamic response data (JSON object matching form fields)
    // Structure: { "fieldId": "value" or { url, fileName, fileSize, mimeType } }
    answers: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Submission metadata
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Location data (optional - captured if citizen allows)
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
      accuracy: {
        type: Number, // meters
      },
      address: {
        type: String,
        trim: true,
      },
    },

    // Device information
    device: {
      ipAddress: {
        type: String,
        index: true,
      },
      userAgent: {
        type: String,
      },
      platform: {
        type: String,
        enum: ['Android', 'iOS', 'Windows', 'MacOS', 'Linux', 'Unknown'],
      },
      browser: {
        type: String,
      },
      deviceType: {
        type: String,
        enum: ['MOBILE', 'TABLET', 'DESKTOP', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
    },

    // Processing status
    status: {
      type: String,
      enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED', 'SPAM'],
      default: 'PENDING',
      index: true,
    },

    // Review information
    reviewedBy: {
      type: Number, // User ID from auth-service
    },

    reviewedAt: {
      type: Date,
    },

    // Resolution information
    resolution: {
      type: String,
      enum: ['RESOLVED', 'REJECTED', 'SPAM', null],
    },

    resolutionNotes: {
      type: String,
      maxlength: 2000,
    },

    // Organization replies (audit trail - array of replies)
    orgReplies: [
      {
        message: {
          type: String,
          required: true,
          maxlength: 2000,
        },
        repliedBy: {
          type: Number, // User ID from auth-service
          required: true,
        },
        repliedByEmail: {
          type: String, // For display purposes
        },
        repliedAt: {
          type: Date,
          default: Date.now,
        },
        isPublic: {
          type: Boolean,
          default: true, // Public replies visible to citizen
        },
        notificationSent: {
          type: Boolean,
          default: false, // Track if email/SMS was sent
        },
      },
    ],

    // Flags
    isFlagged: {
      type: Boolean,
      default: false,
      index: true,
    },

    flagReason: {
      type: String,
      enum: ['SPAM', 'INAPPROPRIATE', 'DUPLICATE', 'FAKE', 'OTHER', null],
    },

    flaggedBy: {
      type: Number, // User ID from auth-service
    },

    flaggedAt: {
      type: Date,
    },

    flagComments: {
      type: String,
      maxlength: 500,
    },

    // Spam detection
    isSpam: {
      type: Boolean,
      default: false,
      index: true,
    },

    spamScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    spamReasons: [
      {
        type: String,
      },
    ],

    // Soft delete
    deletedAt: {
      type: Date,
      index: true,
    },

    deletedBy: {
      type: Number,
    },

    // Additional metadata (flexible for future extensions)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'responses',
  }
);

// ===========================
// INDEXES
// ===========================

// Compound indexes for common queries
responseSchema.index({ formId: 1, submittedAt: -1 });
responseSchema.index({ orgId: 1, status: 1 });
responseSchema.index({ orgId: 1, submittedAt: -1 });
responseSchema.index({ qrCodeId: 1, submittedAt: -1 });
responseSchema.index({ citizenId: 1, submittedAt: -1 });
responseSchema.index({ 'device.ipAddress': 1, submittedAt: -1 });
responseSchema.index({ status: 1, submittedAt: -1 });

// Geospatial index for location-based queries
responseSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

// Text index for full-text search (optional)
responseSchema.index({ 'answers': 'text', 'resolutionNotes': 'text' });

// ===========================
// VIRTUALS
// ===========================

// Virtual for response age (in hours)
responseSchema.virtual('ageInHours').get(function () {
  if (!this.submittedAt) return 0;
  const now = new Date();
  const diff = now - this.submittedAt;
  return Math.floor(diff / (1000 * 60 * 60));
});

// Virtual for reply count
responseSchema.virtual('replyCount').get(function () {
  return this.orgReplies ? this.orgReplies.length : 0;
});

// Virtual for public replies only
responseSchema.virtual('publicReplies').get(function () {
  return this.orgReplies ? this.orgReplies.filter((reply) => reply.isPublic) : [];
});

// ===========================
// METHODS
// ===========================

// Instance method: Check if response is anonymous
responseSchema.methods.isAnonymous = function () {
  return !this.citizenId;
};

// Instance method: Check if response has files
responseSchema.methods.hasFiles = function () {
  if (!this.answers) return false;
  
  return Object.values(this.answers).some((value) => {
    return typeof value === 'object' && value.url && value.fileName;
  });
};

// Instance method: Get file count
responseSchema.methods.getFileCount = function () {
  if (!this.answers) return 0;
  
  return Object.values(this.answers).filter((value) => {
    return typeof value === 'object' && value.url && value.fileName;
  }).length;
};

// Instance method: Add reply
responseSchema.methods.addReply = function (replyData) {
  if (!this.orgReplies) {
    this.orgReplies = [];
  }
  
  this.orgReplies.push({
    message: replyData.message,
    repliedBy: replyData.repliedBy,
    repliedByEmail: replyData.repliedByEmail,
    repliedAt: new Date(),
    isPublic: replyData.isPublic !== undefined ? replyData.isPublic : true,
    notificationSent: false,
  });
};

// Instance method: Mark as reviewed
responseSchema.methods.markAsReviewed = function (userId) {
  this.status = 'REVIEWED';
  this.reviewedBy = userId;
  this.reviewedAt = new Date();
};

// Instance method: Mark as resolved
responseSchema.methods.markAsResolved = function (userId, notes) {
  this.status = 'RESOLVED';
  this.resolution = 'RESOLVED';
  this.resolutionNotes = notes;
  this.reviewedBy = userId;
  this.reviewedAt = new Date();
};

// Instance method: Flag response
responseSchema.methods.flag = function (userId, reason, comments) {
  this.isFlagged = true;
  this.flagReason = reason;
  this.flaggedBy = userId;
  this.flaggedAt = new Date();
  this.flagComments = comments;
};

// Instance method: Soft delete
responseSchema.methods.softDelete = function (userId) {
  this.deletedAt = new Date();
  this.deletedBy = userId;
};

// ===========================
// STATIC METHODS
// ===========================

// Static method: Find responses by form
responseSchema.statics.findByForm = function (formId, options = {}) {
  const query = { formId, deletedAt: null };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ submittedAt: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);
};

// Static method: Find responses by org
responseSchema.statics.findByOrg = function (orgId, options = {}) {
  const query = { orgId, deletedAt: null };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.formId) {
    query.formId = options.formId;
  }
  
  return this.find(query)
    .sort({ submittedAt: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);
};

// Static method: Count responses by status
responseSchema.statics.countByStatus = function (orgId, formId = null) {
  const matchQuery = { orgId, deletedAt: null };
  
  if (formId) {
    matchQuery.formId = formId;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
};

// Static method: Find spam responses
responseSchema.statics.findSpam = function (orgId, threshold = 75) {
  return this.find({
    orgId,
    spamScore: { $gte: threshold },
    deletedAt: null,
  }).sort({ spamScore: -1 });
};

// Static method: Find recent responses by IP
responseSchema.statics.findRecentByIP = function (ipAddress, hours = 1) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    'device.ipAddress': ipAddress,
    submittedAt: { $gte: cutoffTime },
    deletedAt: null,
  });
};

// ===========================
// MIDDLEWARE (HOOKS)
// ===========================

// Pre-save: Auto-calculate spam score
responseSchema.pre('save', function (next) {
  if (this.isNew && !this.spamScore) {
    // Basic spam detection logic (can be enhanced)
    let score = 0;
    
    // Check for suspicious patterns
    if (this.device && this.device.ipAddress) {
      // TODO: Check IP against spam database
    }
    
    // Check for duplicate content
    if (this.answers) {
      const textContent = JSON.stringify(this.answers).toLowerCase();
      
      // Very short responses
      if (textContent.length < 10) {
        score += 20;
      }
      
      // Repeated characters
      if (/(.)\1{10,}/.test(textContent)) {
        score += 30;
      }
      
      // Common spam keywords
      const spamKeywords = ['viagra', 'casino', 'lottery', 'click here', 'buy now'];
      if (spamKeywords.some((keyword) => textContent.includes(keyword))) {
        score += 40;
      }
    }
    
    this.spamScore = Math.min(score, 100);
    
    if (this.spamScore >= 75) {
      this.isSpam = true;
      this.spamReasons = ['High spam score detected'];
    }
  }
  
  next();
});

// Post-save: Log activity
responseSchema.post('save', function (doc) {
  // Can be used for analytics or logging
  // logger.info(`Response saved: ${doc.responseId}`);
});

// ===========================
// EXPORT MODEL
// ===========================

module.exports = mongoose.model('Response', responseSchema);
