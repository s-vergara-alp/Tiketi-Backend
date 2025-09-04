const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced security middleware configuration
 * Based on industry standards from Spotify, Ticketmaster, and other major APIs
 */

// Request ID middleware for tracking
const requestId = (req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
};

// Enhanced rate limiting (industry standard)
const createRateLimiters = () => {
    // General API rate limit (more restrictive)
    const generalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: (req) => {
            // Allow higher limits for authenticated users and during tests
            if (process.env.NODE_ENV === 'test') {
                return 1000; // Very high limit for tests
            }
            if (req.user?.id) {
                return 200; // Higher limit for authenticated users
            }
            return 50; // Default limit for unauthenticated users
        },
        message: {
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(15 * 60 / 60) // minutes
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise IP
            return req.user?.id || req.ip;
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === '/health';
        }
    });

    // Stricter limits for authentication endpoints
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per 15 minutes
        message: {
            error: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later.',
            retryAfter: Math.ceil(15 * 60 / 60)
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.ip
    });

    // API key rate limiting (for future use)
    const apiKeyLimiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        message: {
            error: 'API_KEY_RATE_LIMIT_EXCEEDED',
            message: 'API key rate limit exceeded.',
            retryAfter: Math.ceil(60 / 60)
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.headers['x-api-key'] || req.ip
    });

    return { generalLimiter, authLimiter, apiKeyLimiter };
};

// Request speed limiting (prevent abuse)
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: (req) => {
        // Allow more requests without delay during tests
        if (process.env.NODE_ENV === 'test') {
            return 500; // Very high limit for tests
        }
        if (req.user?.id) {
            return 100; // Higher limit for authenticated users
        }
        return 25; // Default limit for unauthenticated users
    },
    delayMs: (used, req) => {
        const delayAfter = req.slowDown.limit;
        return (used - delayAfter) * 500;
    },
    maxDelayMs: 20000, // Maximum delay of 20 seconds
    skip: (req) => req.path === '/health'
});

// Enhanced CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.CLIENT_URL || "http://localhost:3000",
            "http://localhost:8081",
            "https://tiikii.com",
            "https://www.tiikii.com"
        ];

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Request-ID', 
        'X-API-Key',
        'X-Client-Version',
        'X-Platform'
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
};

// Enhanced Helmet configuration
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // API-specific headers
    res.setHeader('X-API-Version', '1.0.0');
    res.setHeader('X-Response-Time', Date.now() - req.startTime);
    
    next();
};

// Request timing middleware
const requestTiming = (req, res, next) => {
    req.startTime = Date.now();
    next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key].trim();
            }
        });
    }

    // Sanitize body parameters
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }

    next();
};

// API versioning middleware
const apiVersioning = (req, res, next) => {
    const version = req.headers['x-api-version'] || '1.0.0';
    req.apiVersion = version;
    
    // Add version to response headers
    res.setHeader('X-API-Version', version);
    
    next();
};

// Request size limiting
const requestSizeLimit = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (contentLength > maxSize) {
        return res.status(413).json({
            error: 'PAYLOAD_TOO_LARGE',
            message: 'Request entity too large',
            maxSize: '10MB'
        });
    }
    
    next();
};

// Enhanced logging middleware
const enhancedLogging = (req, res, next) => {
    // Skip logging during tests to avoid "Cannot log after tests are done" errors
    if (process.env.NODE_ENV === 'test') {
        return next();
    }
    
    const start = Date.now();
    
    // Log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.id} - ${req.ip}`);
    
    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.id}`);
    });
    
    next();
};

// Export all security middleware
module.exports = {
    requestId,
    createRateLimiters,
    speedLimiter,
    corsOptions,
    helmetConfig,
    securityHeaders,
    requestTiming,
    sanitizeInput,
    apiVersioning,
    requestSizeLimit,
    enhancedLogging
};

