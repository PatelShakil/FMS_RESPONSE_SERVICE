/**
 * Response Utility
 * Standardized API response formatter
 */

/**
 * Success response
 */
const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Error response
 */
const error = (res, message = 'Internal server error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    error: message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated response
 */
const paginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1,
    },
  });
};

/**
 * Created response (201)
 */
const created = (res, data, message = 'Resource created successfully') => {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
};

/**
 * No content response (204)
 */
const noContent = (res) => {
  return res.status(204).send();
};

/**
 * Bad request response (400)
 */
const badRequest = (res, message = 'Bad request', errors = null) => {
  return error(res, message, 400, errors);
};

/**
 * Unauthorized response (401)
 */
const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, message, 401);
};

/**
 * Forbidden response (403)
 */
const forbidden = (res, message = 'Forbidden') => {
  return error(res, message, 403);
};

/**
 * Not found response (404)
 */
const notFound = (res, message = 'Resource not found') => {
  return error(res, message, 404);
};

/**
 * Conflict response (409)
 */
const conflict = (res, message = 'Resource already exists') => {
  return error(res, message, 409);
};

/**
 * Validation error response (422)
 */
const validationError = (res, errors) => {
  return error(res, 'Validation failed', 422, errors);
};

/**
 * Too many requests response (429)
 */
const tooManyRequests = (res, message = 'Too many requests, please try again later') => {
  return error(res, message, 429);
};

/**
 * Internal server error response (500)
 */
const serverError = (res, message = 'Internal server error') => {
  return error(res, message, 500);
};

/**
 * Service unavailable response (503)
 */
const serviceUnavailable = (res, message = 'Service temporarily unavailable') => {
  return error(res, message, 503);
};

module.exports = {
  success,
  error,
  paginated,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  tooManyRequests,
  serverError,
  serviceUnavailable,
};
