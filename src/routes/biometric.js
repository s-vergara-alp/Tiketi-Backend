const express = require('express');
const router = express.Router();
const biometricService = require('../services/BiometricService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');

/**
 * @route POST /api/biometric/enroll
 * @desc Enroll biometric data for a user
 * @access User only
 */
router.post('/enroll', authenticateToken, async (req, res) => {
    try {
        const { biometricType, templateData, qualityScore, metadata } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!biometricType || !templateData || qualityScore === undefined) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['biometricType', 'templateData', 'qualityScore']
            });
        }

        // Validate biometric type
        const supportedTypes = ['face', 'fingerprint', 'voice', 'iris'];
        if (!supportedTypes.includes(biometricType)) {
            return res.status(400).json({
                error: 'Unsupported biometric type',
                supportedTypes
            });
        }

        // Validate quality score
        if (qualityScore < 0 || qualityScore > 1) {
            return res.status(400).json({
                error: 'Quality score must be between 0 and 1'
            });
        }

        const result = await biometricService.enrollBiometric(
            userId,
            biometricType,
            templateData,
            qualityScore,
            {
                ...metadata,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                enrolledAt: new Date().toISOString()
            }
        );

        res.status(201).json({
            message: 'Biometric enrolled successfully',
            result
        });
    } catch (error) {
        console.error('Error enrolling biometric:', error);
        
        if (error instanceof ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        if (error instanceof BusinessLogicError) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to enroll biometric' });
    }
});

/**
 * @route POST /api/biometric/verify
 * @desc Verify biometric data
 * @access Public
 */
router.post('/verify', async (req, res) => {
    try {
        const { userId, biometricType, templateData, sessionId } = req.body;

        // Validate required fields
        if (!userId || !biometricType || !templateData) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['userId', 'biometricType', 'templateData']
            });
        }

        const result = await biometricService.verifyBiometric(
            userId,
            biometricType,
            templateData,
            sessionId,
            {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                verifiedAt: new Date().toISOString()
            }
        );

        res.json({
            message: result.verified ? 'Biometric verification successful' : 'Biometric verification failed',
            result
        });
    } catch (error) {
        console.error('Error verifying biometric:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to verify biometric' });
    }
});

/**
 * @route GET /api/biometric/status/:userId
 * @desc Get biometric enrollment status for a user
 * @access User/Admin/Staff only
 */
router.get('/status/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if user can access this data
        if (req.user.id !== userId && !['admin', 'staff'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const status = await biometricService.getBiometricStatus(userId);

        res.json({
            message: 'Biometric status retrieved successfully',
            status
        });
    } catch (error) {
        console.error('Error getting biometric status:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to get biometric status' });
    }
});

/**
 * @route DELETE /api/biometric/:biometricType
 * @desc Delete biometric data for a user
 * @access User only
 */
router.delete('/:biometricType', authenticateToken, async (req, res) => {
    try {
        const { biometricType } = req.params;
        const userId = req.user.id;

        // Validate biometric type
        const supportedTypes = ['face', 'fingerprint', 'voice', 'iris'];
        if (!supportedTypes.includes(biometricType)) {
            return res.status(400).json({
                error: 'Unsupported biometric type',
                supportedTypes
            });
        }

        const result = await biometricService.deleteBiometric(userId, biometricType);

        res.json({
            message: 'Biometric data deleted successfully',
            result
        });
    } catch (error) {
        console.error('Error deleting biometric:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to delete biometric data' });
    }
});

/**
 * @route GET /api/biometric/statistics
 * @desc Get biometric verification statistics
 * @access Admin/Staff only
 */
router.get('/statistics', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
    try {
        const { userId, biometricType } = req.query;
        
        const statistics = await biometricService.getVerificationStatistics(userId, biometricType);

        res.json({
            message: 'Biometric statistics retrieved successfully',
            statistics
        });
    } catch (error) {
        console.error('Error getting biometric statistics:', error);
        res.status(500).json({ error: 'Failed to get biometric statistics' });
    }
});

/**
 * @route GET /api/biometric/supported-types
 * @desc Get supported biometric types
 * @access Public
 */
router.get('/supported-types', (req, res) => {
    res.json({
        message: 'Supported biometric types retrieved successfully',
        supportedTypes: [
            {
                type: 'face',
                name: 'Facial Recognition',
                description: 'Face-based biometric authentication'
            },
            {
                type: 'fingerprint',
                name: 'Fingerprint',
                description: 'Fingerprint-based biometric authentication'
            },
            {
                type: 'voice',
                name: 'Voice Recognition',
                description: 'Voice-based biometric authentication'
            },
            {
                type: 'iris',
                name: 'Iris Recognition',
                description: 'Iris-based biometric authentication'
            }
        ]
    });
});

/**
 * @route GET /api/biometric/consent-info
 * @desc Get biometric consent information
 * @access Public
 */
router.get('/consent-info', (req, res) => {
    res.json({
        message: 'Biometric consent information retrieved successfully',
        consentInfo: {
            version: '1.0',
            title: 'Biometric Data Collection Consent',
            description: 'By enrolling your biometric data, you consent to the collection, storage, and use of your biometric information for identity verification purposes.',
            dataTypes: [
                'Facial recognition data',
                'Fingerprint data',
                'Voice recognition data',
                'Iris recognition data'
            ],
            purposes: [
                'Identity verification at event entry points',
                'Fraud prevention and security',
                'Enhanced user experience'
            ],
            retentionPeriod: 'Data will be retained for the duration of the event plus 30 days',
            rights: [
                'Right to withdraw consent at any time',
                'Right to delete biometric data',
                'Right to access your data',
                'Right to data portability'
            ],
            contact: {
                email: 'privacy@tiikii.com',
                phone: '+1-800-TIIKII'
            }
        }
    });
});

module.exports = router;




