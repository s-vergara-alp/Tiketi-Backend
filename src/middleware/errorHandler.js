const { formatErrorResponse, logError } = require('../utils/errors');

/**
 * Global error handling middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(error, req, res, next) {
    // Log the error
    logError(error, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id
    });

    // Handle different types of errors
    if (error.name === 'ValidationError') {
        return res.status(400).json(formatErrorResponse(error));
    }

    if (error.name === 'NotFoundError') {
        return res.status(404).json(formatErrorResponse(error));
    }

    if (error.name === 'UnauthorizedError') {
        return res.status(401).json(formatErrorResponse(error));
    }

    if (error.name === 'ForbiddenError') {
        return res.status(403).json(formatErrorResponse(error));
    }

    if (error.name === 'ConflictError') {
        return res.status(409).json(formatErrorResponse(error));
    }

    if (error.name === 'BusinessLogicError') {
        return res.status(422).json(formatErrorResponse(error));
    }

    if (error.name === 'RateLimitError') {
        return res.status(429).json(formatErrorResponse(error));
    }

    if (error.name === 'DatabaseError') {
        return res.status(500).json(formatErrorResponse(error));
    }

    if (error.name === 'ExternalServiceError') {
        return res.status(502).json(formatErrorResponse(error));
    }

    // Handle validation errors from express-validator
    if (error.array && Array.isArray(error.array())) {
        const validationError = {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            timestamp: new Date().toISOString(),
            field: error.array()[0]?.param,
            details: error.array()
        };
        return res.status(400).json({ error: validationError });
    }

    // Handle SQLite errors
    if (error.code && error.code.startsWith('SQLITE_')) {
        const databaseError = {
            message: 'Database operation failed',
            code: 'DATABASE_ERROR',
            timestamp: new Date().toISOString()
        };
        return res.status(500).json({ error: databaseError });
    }

    // Default error response
    const defaultError = {
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
        defaultError.stack = error.stack;
    }

    res.status(500).json({ error: defaultError });
}

/**
 * Async error handler wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Create validation error from express-validator
 * @param {Array} errors - Validation errors array
 * @returns {Error} Validation error
 */
function createValidationError(message) {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    return error;
}

/**
 * Create not found error
 * @param {string} message - Error message
 * @returns {Error} Not found error
 */
function createNotFoundError(message) {
    const error = new Error(message);
    error.name = 'NotFoundError';
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    return error;
}

/**
 * Create unauthorized error
 * @param {string} message - Error message
 * @returns {Error} Unauthorized error
 */
function createUnauthorizedError(message) {
    const error = new Error(message);
    error.name = 'UnauthorizedError';
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    return error;
}

/**
 * Create forbidden error
 * @param {string} message - Error message
 * @returns {Error} Forbidden error
 */
function createForbiddenError(message) {
    const error = new Error(message);
    error.name = 'ForbiddenError';
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    return error;
}

/**
 * Create conflict error
 * @param {string} message - Error message
 * @returns {Error} Conflict error
 */
function createConflictError(message) {
    const error = new Error(message);
    error.name = 'ConflictError';
    error.statusCode = 409;
    error.code = 'CONFLICT';
    return error;
}

/**
 * Create business logic error
 * @param {string} message - Error message
 * @returns {Error} Business logic error
 */
function createBusinessLogicError(message) {
    const error = new Error(message);
    error.name = 'BusinessLogicError';
    error.statusCode = 422;
    error.code = 'BUSINESS_LOGIC_ERROR';
    return error;
}

module.exports = {
    errorHandler,
    asyncHandler,
    createValidationError,
    createNotFoundError,
    createUnauthorizedError,
    createForbiddenError,
    createConflictError,
    createBusinessLogicError
};
