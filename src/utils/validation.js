/**
 * Validation Utility
 * Joi validation schemas for request validation
 */

const Joi = require('joi');

/**
 * Submit response validation schema
 */
const submitResponseSchema = Joi.object({
  formId: Joi.string().required().messages({
    'string.empty': 'Form ID is required',
    'any.required': 'Form ID is required',
  }),

  qrCodeId: Joi.string().optional().allow(null, ''),

  serviceId: Joi.number().integer().required().messages({
    'number.base': 'Service ID must be a number',
    'any.required': 'Service ID is required',
  }),

  orgId: Joi.number().integer().required().messages({
    'number.base': 'Organization ID must be a number',
    'any.required': 'Organization ID is required',
  }),

  citizenEmail: Joi.string().email().optional().allow(null, ''),

  citizenPhone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Invalid phone number format',
    }),

  answers: Joi.object().required().messages({
    'object.base': 'Answers must be an object',
    'any.required': 'Answers are required',
  }),

  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).optional(),
    address: Joi.string().max(500).optional(),
  }).optional().allow(null),

  metadata: Joi.object().optional(),
});

/**
 * Review response validation schema
 */
const reviewResponseSchema = Joi.object({
  notes: Joi.string().max(2000).optional().allow(null, ''),
});

/**
 * Resolve response validation schema
 */
const resolveResponseSchema = Joi.object({
  resolutionNotes: Joi.string().max(2000).required().messages({
    'string.empty': 'Resolution notes are required',
    'any.required': 'Resolution notes are required',
  }),
});

/**
 * Flag response validation schema
 */
const flagResponseSchema = Joi.object({
  reason: Joi.string()
    .valid('SPAM', 'INAPPROPRIATE', 'DUPLICATE', 'FAKE', 'OTHER')
    .required()
    .messages({
      'any.only': 'Invalid flag reason',
      'any.required': 'Flag reason is required',
    }),

  comments: Joi.string().max(500).optional().allow(null, ''),
});

/**
 * Reply to response validation schema
 */
const replyResponseSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required().messages({
    'string.empty': 'Reply message is required',
    'string.min': 'Reply message must be at least 1 character',
    'string.max': 'Reply message must not exceed 2000 characters',
    'any.required': 'Reply message is required',
  }),

  isPublic: Joi.boolean().optional().default(true),
});

/**
 * List responses query validation schema
 */
const listResponsesQuerySchema = Joi.object({
  formId: Joi.string().optional(),
  orgId: Joi.number().integer().optional(),
  serviceId: Joi.number().integer().optional(),
  qrCodeId: Joi.string().optional(),
  citizenId: Joi.number().integer().optional(),
  status: Joi.string()
    .valid('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED', 'SPAM')
    .optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('submittedAt', 'updatedAt', 'status').default('submittedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Analytics query validation schema
 */
const analyticsQuerySchema = Joi.object({
  formId: Joi.string().optional(),
  startDate: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'any.required': 'Start date is required',
  }),
  endDate: Joi.date().iso().required().messages({
    'date.base': 'End date must be a valid date',
    'any.required': 'End date is required',
  }),
});

/**
 * Export query validation schema
 */
const exportQuerySchema = Joi.object({
  formId: Joi.string().required().messages({
    'string.empty': 'Form ID is required',
    'any.required': 'Form ID is required',
  }),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  status: Joi.string()
    .valid('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED', 'SPAM')
    .optional(),
  format: Joi.string().valid('csv', 'excel', 'pdf').default('csv'),
});

/**
 * Validate request data against schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(422).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Validate query parameters against schema
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(422).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    // Replace req.query with validated data
    req.query = value;
    next();
  };
};

module.exports = {
  // Schemas
  submitResponseSchema,
  reviewResponseSchema,
  resolveResponseSchema,
  flagResponseSchema,
  replyResponseSchema,
  listResponsesQuerySchema,
  analyticsQuerySchema,
  exportQuerySchema,

  // Middleware
  validate,
  validateQuery,
};
