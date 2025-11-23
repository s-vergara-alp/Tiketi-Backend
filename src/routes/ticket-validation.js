const express = require('express');
const router = express.Router();
const ticketService = require('../services/TicketService');
const bleService = require('../services/BLEService');
const biometricService = require('../services/BiometricService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');

/**
 * @route POST /api/ticket-validation/validate
 * @desc Validate ticket with BLE and biometric support
 * @access Public
 */
router.post('/validate', async (req, res) => {
    try {
        const { 
            qrPayload, 
            sessionToken, 
            biometricData, 
            validatorId, 
            location, 
            deviceInfo 
        } = req.body;

        // Validate required fields
        if (!qrPayload) {
            return res.status(400).json({
                error: 'QR payload is required'
            });
        }

        const validationOptions = {
            sessionToken,
            biometricData,
            validatorId,
            location,
            deviceInfo,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        };

        const result = await ticketService.validateTicket(qrPayload, validationOptions);

        res.json({
            message: result.valid ? 'Ticket validation successful' : 'Ticket validation failed',
            result
        });
    } catch (error) {
        console.error('Error validating ticket:', error);
        res.status(500).json({ error: 'Failed to validate ticket' });
    }
});

/**
 * @route POST /api/ticket-validation/ble/start
 * @desc Start BLE validation session for a ticket
 * @access User only
 */
router.post('/ble/start', authenticateToken, async (req, res) => {
    try {
        const { ticketId, beaconId, proximityData } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!ticketId || !beaconId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['ticketId', 'beaconId']
            });
        }

        const result = await ticketService.startBLEValidation(ticketId, userId, beaconId, proximityData);

        res.json({
            message: 'BLE validation session started successfully',
            result
        });
    } catch (error) {
        console.error('Error starting BLE validation:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to start BLE validation' });
    }
});

/**
 * @route POST /api/ticket-validation/biometric/enroll
 * @desc Enroll biometric data for a ticket holder
 * @access User only
 */
router.post('/biometric/enroll', authenticateToken, async (req, res) => {
    try {
        const { 
            ticketId, 
            biometricType, 
            templateData, 
            qualityScore, 
            metadata 
        } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!ticketId || !biometricType || !templateData || qualityScore === undefined) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['ticketId', 'biometricType', 'templateData', 'qualityScore']
            });
        }

        const result = await ticketService.enrollBiometricForTicket(
            ticketId,
            userId,
            biometricType,
            templateData,
            qualityScore,
            {
                ...metadata,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        );

        res.status(201).json({
            message: 'Biometric enrolled successfully for ticket',
            result
        });
    } catch (error) {
        console.error('Error enrolling biometric for ticket:', error);
        
        if (error instanceof ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        if (error instanceof BusinessLogicError) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to enroll biometric for ticket' });
    }
});

/**
 * @route GET /api/ticket-validation/requirements/:ticketId
 * @desc Get ticket validation requirements
 * @access User only
 */
router.get('/requirements/:ticketId', authenticateToken, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const userId = req.user.id;

        // Verify ticket belongs to user
        const ticket = await ticketService.getTicketById(ticketId, userId);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const requirements = await ticketService.getTicketValidationRequirements(ticketId);

        res.json({
            message: 'Ticket validation requirements retrieved successfully',
            requirements
        });
    } catch (error) {
        console.error('Error getting ticket validation requirements:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to get ticket validation requirements' });
    }
});

/**
 * @route GET /api/ticket-validation/history/:ticketId
 * @desc Get ticket validation history
 * @access User/Admin/Staff only
 */
router.get('/history/:ticketId', authenticateToken, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const userId = req.user.id;

        // Check if user can access this data
        const ticket = await ticketService.getTicketById(ticketId, userId);
        if (!ticket && !['admin', 'staff'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const history = await ticketService.getTicketValidationHistory(ticketId);

        res.json({
            message: 'Ticket validation history retrieved successfully',
            history
        });
    } catch (error) {
        console.error('Error getting ticket validation history:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to get ticket validation history' });
    }
});

/**
 * @route POST /api/ticket-validation/ble/sessions/validate
 * @desc Validate BLE session for ticket validation
 * @access Public
 */
router.post('/ble/sessions/validate', async (req, res) => {
    try {
        const { sessionToken, validationData } = req.body;

        if (!sessionToken) {
            return res.status(400).json({
                error: 'Session token is required'
            });
        }

        const validation = await bleService.validateSession(sessionToken, validationData);

        res.json({
            message: validation.valid ? 'BLE session validated successfully' : 'BLE session validation failed',
            validation
        });
    } catch (error) {
        console.error('Error validating BLE session:', error);
        res.status(500).json({ error: 'Failed to validate BLE session' });
    }
});

/**
 * @route POST /api/ticket-validation/biometric/verify
 * @desc Verify biometric data for ticket validation
 * @access Public
 */
router.post('/biometric/verify', async (req, res) => {
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
 * @route GET /api/ticket-validation/statistics
 * @desc Get ticket validation statistics
 * @access Admin/Staff only
 */
router.get('/statistics', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
    try {
        const { festivalId, startDate, endDate } = req.query;
        
        // This would require implementing statistics methods in the services
        // For now, return a placeholder response
        res.json({
            message: 'Ticket validation statistics retrieved successfully',
            statistics: {
                totalValidations: 0,
                successfulValidations: 0,
                failedValidations: 0,
                bleValidations: 0,
                biometricValidations: 0,
                averageValidationTime: 0,
                topValidationLocations: [],
                validationMethods: {
                    qr_only: 0,
                    qr_ble: 0,
                    qr_biometric: 0,
                    qr_ble_biometric: 0
                }
            }
        });
    } catch (error) {
        console.error('Error getting ticket validation statistics:', error);
        res.status(500).json({ error: 'Failed to get ticket validation statistics' });
    }
});

/**
 * @route GET /api/ticket-validation/beacons/:festivalId
 * @desc Get available beacons for a festival
 * @access Public
 */
router.get('/beacons/:festivalId', async (req, res) => {
    try {
        const { festivalId } = req.params;
        const beacons = await bleService.getFestivalBeacons(festivalId);

        res.json({
            message: 'Available beacons retrieved successfully',
            beacons
        });
    } catch (error) {
        console.error('Error getting beacons:', error);
        res.status(500).json({ error: 'Failed to get beacons' });
    }
});

module.exports = router;




