const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const database = require('../database/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { asyncHandler, createValidationError, createNotFoundError } = require('../middleware/errorHandler');
const emailService = require('../services/EmailService');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('firstName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name is required and must be less than 50 characters'),
    body('lastName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Last name is required and must be less than 50 characters')
];

const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Register new user
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { username, email, password, firstName, lastName, phone, dateOfBirth } = req.body;

    // Check if user already exists
    const existingUser = await database.get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
    );

    if (existingUser) {
        throw createValidationError('Username or email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user (not verified initially)
    const userId = uuidv4();
    const result = await database.run(
        `INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone, date_of_birth, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, username, email, passwordHash, firstName, lastName, phone || null, dateOfBirth || null, 0] // Not verified initially
    );

    if (result.changes === 0) {
        throw new Error('Failed to create user');
    }

    // Send verification email
    try {
        await emailService.sendVerificationEmail(userId, email, firstName);
    } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails, but log the error
        // Still generate a token for manual verification
        try {
            await emailService.generateVerificationToken(userId, email);
        } catch (tokenError) {
            console.error('Failed to generate verification token:', tokenError);
        }
    }

    // Get created user (without password)
    const user = await database.get(
        'SELECT id, username, email, first_name, last_name, avatar, is_verified, is_admin, is_staff, is_security, role, created_at FROM users WHERE id = ?',
        [userId]
    );

    res.status(201).json({
        message: 'User registered successfully. Please check your email to verify your account.',
        user,
        requiresVerification: true
    });
}));

// Login user
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await database.get(
        'SELECT id, username, email, password_hash, first_name, last_name, avatar, is_active, is_verified, is_admin, is_staff, is_security, role FROM users WHERE email = ?',
        [email]
    );

    if (!user) {
        throw createValidationError('Invalid email or password');
    }

    if (!user.is_active) {
        throw createValidationError('Account has been deactivated');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        throw createValidationError('Invalid email or password');
    }

    // Check if user is verified
    if (!user.is_verified) {
        return res.status(403).json({
            message: 'Please verify your email address before logging in',
            requiresVerification: true,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                is_verified: user.is_verified
            }
        });
    }

    // Update last login
    await database.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
    );

    // Generate token
    const token = generateToken(user.id);

    // Remove password hash from response
    delete user.password_hash;

    res.json({
        message: 'Login successful',
        user,
        token
    });
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
    // This route requires authentication middleware
    // The user will be available in req.user from the auth middleware
    
    if (!req.user) {
        throw createNotFoundError('User not found');
    }

    res.json({
        user: req.user
    });
}));

// Update user profile
router.put('/me', authenticateToken, [
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name must be less than 50 characters'),
    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Last name must be less than 50 characters'),
    body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
    body('avatar')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Avatar URL is too long')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { firstName, lastName, phone, avatar, preferences } = req.body;
    const userId = req.user.id;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (firstName !== undefined) {
        updates.push('first_name = ?');
        params.push(firstName);
    }
    if (lastName !== undefined) {
        updates.push('last_name = ?');
        params.push(lastName);
    }
    if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone);
    }
    if (avatar !== undefined) {
        updates.push('avatar = ?');
        params.push(avatar);
    }
    if (preferences !== undefined) {
        updates.push('preferences = ?');
        params.push(JSON.stringify(preferences));
    }

    if (updates.length === 0) {
        throw createValidationError('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const result = await database.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
    );

    if (result.changes === 0) {
        throw createNotFoundError('User not found');
    }

    // Get updated user
    const updatedUser = await database.get(
        'SELECT id, username, email, first_name, last_name, avatar, phone, preferences, is_verified, is_admin, is_staff, is_security, role, updated_at FROM users WHERE id = ?',
        [userId]
    );

    res.json({
        message: 'Profile updated successfully',
        user: updatedUser
    });
}));

// Change password
router.put('/change-password', authenticateToken, [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current password hash
    const user = await database.get(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
    );

    if (!user) {
        throw createNotFoundError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
        throw createValidationError('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const result = await database.run(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, userId]
    );

    if (result.changes === 0) {
        throw new Error('Failed to update password');
    }

    res.json({
        message: 'Password changed successfully'
    });
}));

// Verify email address
router.post('/verify-email', [
    body('token')
        .notEmpty()
        .withMessage('Verification token is required')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { token } = req.body;

    try {
        // Verify the token
        const tokenRecord = await emailService.verifyToken(token);

        // Mark token as used
        await emailService.markTokenAsUsed(tokenRecord.id);

        // Update user verification status
        await database.run(
            'UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [tokenRecord.user_id]
        );

        // Get updated user
        const user = await database.get(
            'SELECT id, username, email, first_name, last_name, avatar, is_verified, is_admin, is_staff, is_security, role, created_at FROM users WHERE id = ?',
            [tokenRecord.user_id]
        );

        // Generate token for immediate login
        const authToken = generateToken(user.id);

        res.json({
            message: 'Email verified successfully',
            user,
            token: authToken
        });

    } catch (error) {
        throw createValidationError(error.message);
    }
}));

// Resend verification email
router.post('/resend-verification', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { email } = req.body;

    // Find user by email
    const user = await database.get(
        'SELECT id, email, first_name, is_verified FROM users WHERE email = ?',
        [email]
    );

    if (!user) {
        throw createNotFoundError('User not found');
    }

    if (user.is_verified) {
        throw createValidationError('Email is already verified');
    }

    // Clean up any existing tokens for this user
    await database.run(
        'DELETE FROM email_verification_tokens WHERE user_id = ?',
        [user.id]
    );

    // Send new verification email
    try {
        await emailService.sendVerificationEmail(user.id, user.email, user.first_name);
        
        res.json({
            message: 'Verification email sent successfully'
        });
    } catch (error) {
        console.error('Failed to send verification email:', error);
        
        // If email service is not configured, still generate token for manual verification
        if (error.message.includes('Email service not configured')) {
            try {
                await emailService.generateVerificationToken(user.id, user.email);
                res.json({
                    message: 'Email service not configured. Verification token generated for manual verification.',
                    requiresEmailConfig: true
                });
            } catch (tokenError) {
                console.error('Failed to generate verification token:', tokenError);
                throw new Error('Email service not configured and token generation failed');
            }
        } else {
            throw new Error('Failed to send verification email');
        }
    }
}));

// Logout (client-side token removal, but we can track it)
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just acknowledge the logout
    res.json({
        message: 'Logged out successfully'
    });
}));

module.exports = router;
