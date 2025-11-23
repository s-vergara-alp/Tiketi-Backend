const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');
const database = require('../database/database');
const config = require('../config');

const JWT_SECRET = config.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next(new UnauthorizedError('Please provide a valid authentication token'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user from database to ensure they still exist and are active
        const user = await database.get(
            'SELECT id, username, email, first_name, last_name, avatar, is_active, is_verified, is_admin, is_staff, is_security, role FROM users WHERE id = ?',
            [decoded.id || decoded.userId]
        );

        if (!user) {
            return next(new UnauthorizedError('User not found'));
        }

        if (!user.is_active) {
            return next(new UnauthorizedError('Your account has been deactivated'));
        }

        // Add user info to request object
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Your session has expired. Please log in again.'));
        } else if (error.name === 'JsonWebTokenError') {
            return next(new UnauthorizedError('Invalid authentication token'));
        } else if (error instanceof UnauthorizedError) {
            // Pass our custom errors to error handler
            return next(error);
        } else {
            console.error('Token verification error:', error);
            return next(new UnauthorizedError('An error occurred during authentication'));
        }
    }
};

// Middleware to check if user is verified
const requireVerified = (req, res, next) => {
    if (!req.user.is_verified) {
        return next(new UnauthorizedError('Please verify your email address before accessing this resource'));
    }
    next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user.is_admin && req.user.role !== 'admin') {
        return next(new UnauthorizedError('Admin access required'));
    }
    next();
};

// Middleware to check if user is staff (admin or staff)
const requireStaff = (req, res, next) => {
    if (!req.user.is_staff && !req.user.is_admin && !['staff', 'admin'].includes(req.user.role)) {
        return next(new UnauthorizedError('Staff access required'));
    }
    next();
};

// Middleware to check if user is security personnel (admin, staff, or security)
const requireSecurity = (req, res, next) => {
    if (!req.user.is_security && !req.user.is_staff && !req.user.is_admin && 
        !['security', 'staff', 'admin'].includes(req.user.role)) {
        return next(new UnauthorizedError('Security access required'));
    }
    next();
};

// Middleware to check if user has any elevated privileges
const requireElevated = (req, res, next) => {
    if (!req.user.is_security && !req.user.is_staff && !req.user.is_admin && 
        !['security', 'staff', 'admin'].includes(req.user.role)) {
        return next(new UnauthorizedError('Elevated privileges required'));
    }
    next();
};

// Middleware to check if user has specific role(s)
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user.role;
        const hasRole = allowedRoles.includes(userRole) || 
                       (allowedRoles.includes('admin') && req.user.is_admin) ||
                       (allowedRoles.includes('staff') && req.user.is_staff) ||
                       (allowedRoles.includes('security') && req.user.is_security);
        
        if (!hasRole) {
            return next(new UnauthorizedError(`Access denied. Required roles: ${allowedRoles.join(', ')}`));
        }
        next();
    };
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        JWT_SECRET,
        { expiresIn: '7d' } // Token expires in 7 days
    );
};

// Generate refresh token (for future implementation)
const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '30d' } // Refresh token expires in 30 days
    );
};

module.exports = {
    authenticateToken,
    requireVerified,
    requireAdmin,
    requireStaff,
    requireSecurity,
    requireElevated,
    requireRole,
    generateToken,
    generateRefreshToken
};
