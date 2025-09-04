/**
 * Custom error classes for the application
 */

class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.field = field;
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404, 'NOT_FOUND');
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized access') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}

class BusinessLogicError extends AppError {
    constructor(message) {
        super(message, 422, 'BUSINESS_LOGIC_ERROR');
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

class DatabaseError extends AppError {
    constructor(message, originalError = null) {
        super(message, 500, 'DATABASE_ERROR');
        this.originalError = originalError;
    }
}

class ExternalServiceError extends AppError {
    constructor(message, service = 'external') {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
    }
}

/**
 * Error response formatter
 * @param {Error} error - Error object
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(error) {
    const response = {
        error: {
            message: error.message,
            code: error.code || 'INTERNAL_ERROR',
            timestamp: error.timestamp || new Date().toISOString()
        }
    };

    // Add field information for validation errors
    if (error.field) {
        response.error.field = error.field;
    }

    // Add service information for external service errors
    if (error.service) {
        response.error.service = error.service;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
        response.error.stack = error.stack;
    }

    return response;
}

/**
 * Error logger
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logError(error, context = {}) {
    const logData = {
        timestamp: new Date().toISOString(),
        error: {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        },
        context
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.error('Error occurred:', JSON.stringify(logData, null, 2));
    } else {
        // In production, you might want to log to a file or external service
        console.error(`[${logData.timestamp}] ${error.name}: ${error.message}`);
    }
}

/**
 * Handle async errors in Express routes
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
 * @returns {ValidationError} Validation error
 */
function createValidationError(errors) {
    if (Array.isArray(errors) && errors.length > 0) {
        return new ValidationError(errors[0].msg, errors[0].param);
    }
    return new ValidationError('Validation failed');
}

/**
 * Create not found error
 * @param {string} message - Error message
 * @returns {NotFoundError} Not found error
 */
function createNotFoundError(message) {
    return new NotFoundError(message);
}

/**
 * Create unauthorized error
 * @param {string} message - Error message
 * @returns {UnauthorizedError} Unauthorized error
 */
function createUnauthorizedError(message) {
    return new UnauthorizedError(message);
}

/**
 * Create forbidden error
 * @param {string} message - Error message
 * @returns {ForbiddenError} Forbidden error
 */
function createForbiddenError(message) {
    return new ForbiddenError(message);
}

/**
 * Create conflict error
 * @param {string} message - Error message
 * @returns {ConflictError} Conflict error
 */
function createConflictError(message) {
    return new ConflictError(message);
}

/**
 * Create business logic error
 * @param {string} message - Error message
 * @returns {BusinessLogicError} Business logic error
 */
function createBusinessLogicError(message) {
    return new BusinessLogicError(message);
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    BusinessLogicError,
    RateLimitError,
    DatabaseError,
    ExternalServiceError,
    formatErrorResponse,
    logError,
    asyncHandler,
    createValidationError,
    createNotFoundError,
    createUnauthorizedError,
    createForbiddenError,
    createConflictError,
    createBusinessLogicError
};

