const express = require('express');
const router = express.Router();
const bleService = require('../services/BLEService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');

/**
 * @route POST /api/ble/beacons
 * @desc Register a new BLE beacon
 * @access Admin only
 */
router.post('/beacons', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { festivalId, name, locationName, latitude, longitude, macAddress, uuid, major, minor, txPower, rssiThreshold } = req.body;

        // Validate required fields
        if (!festivalId || !name || !locationName || !latitude || !longitude || !macAddress || !uuid || !major || !minor) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['festivalId', 'name', 'locationName', 'latitude', 'longitude', 'macAddress', 'uuid', 'major', 'minor']
            });
        }

        const beaconData = {
            name,
            locationName,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            macAddress,
            uuid,
            major: parseInt(major),
            minor: parseInt(minor),
            txPower: txPower ? parseInt(txPower) : -59,
            rssiThreshold: rssiThreshold ? parseInt(rssiThreshold) : -70
        };

        const beacon = await bleService.registerBeacon(festivalId, beaconData);

        res.status(201).json({
            message: 'Beacon registered successfully',
            beacon
        });
    } catch (error) {
        console.error('Error registering beacon:', error);
        
        if (error instanceof ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        if (error instanceof BusinessLogicError) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to register beacon' });
    }
});

/**
 * @route GET /api/ble/beacons/:festivalId
 * @desc Get all beacons for a festival
 * @access Public
 */
router.get('/beacons/:festivalId', async (req, res) => {
    try {
        const { festivalId } = req.params;
        const beacons = await bleService.getFestivalBeacons(festivalId);

        res.json({
            message: 'Beacons retrieved successfully',
            beacons
        });
    } catch (error) {
        console.error('Error getting beacons:', error);
        res.status(500).json({ error: 'Failed to get beacons' });
    }
});

/**
 * @route GET /api/ble/beacons/:beaconId
 * @desc Get beacon by ID
 * @access Public
 */
router.get('/beacon/:beaconId', async (req, res) => {
    try {
        const { beaconId } = req.params;
        const beacon = await bleService.getBeaconById(beaconId);

        res.json({
            message: 'Beacon retrieved successfully',
            beacon
        });
    } catch (error) {
        console.error('Error getting beacon:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to get beacon' });
    }
});

/**
 * @route POST /api/ble/sessions
 * @desc Start BLE validation session
 * @access Public
 */
router.post('/sessions', async (req, res) => {
    try {
        const { beaconId, userId, deviceId, proximityData } = req.body;

        // Validate required fields
        if (!beaconId || !deviceId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['beaconId', 'deviceId']
            });
        }

        const session = await bleService.startValidationSession(beaconId, userId, deviceId, proximityData);

        res.status(201).json({
            message: 'BLE validation session started',
            session
        });
    } catch (error) {
        console.error('Error starting BLE session:', error);
        
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        if (error instanceof BusinessLogicError) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to start BLE session' });
    }
});

/**
 * @route POST /api/ble/sessions/validate
 * @desc Validate BLE session
 * @access Public
 */
router.post('/sessions/validate', async (req, res) => {
    try {
        const { sessionToken, validationData } = req.body;

        if (!sessionToken) {
            return res.status(400).json({
                error: 'Session token is required'
            });
        }

        const validation = await bleService.validateSession(sessionToken, validationData);

        res.json({
            message: validation.valid ? 'Session validated successfully' : 'Session validation failed',
            validation
        });
    } catch (error) {
        console.error('Error validating BLE session:', error);
        res.status(500).json({ error: 'Failed to validate BLE session' });
    }
});

/**
 * @route GET /api/ble/sessions/user/:userId
 * @desc Get active sessions for a user
 * @access User only
 */
router.get('/sessions/user/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if user can access this data
        if (req.user.id !== userId && !['admin', 'staff'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const sessions = await bleService.getUserActiveSessions(userId);

        res.json({
            message: 'Active sessions retrieved successfully',
            sessions
        });
    } catch (error) {
        console.error('Error getting user sessions:', error);
        res.status(500).json({ error: 'Failed to get user sessions' });
    }
});

/**
 * @route DELETE /api/ble/sessions/:sessionToken
 * @desc Cancel BLE session
 * @access Public
 */
router.delete('/sessions/:sessionToken', async (req, res) => {
    try {
        const { sessionToken } = req.params;
        const result = await bleService.cancelSession(sessionToken);

        res.json({
            message: result.success ? 'Session cancelled successfully' : 'Session not found or already processed',
            success: result.success
        });
    } catch (error) {
        console.error('Error cancelling BLE session:', error);
        res.status(500).json({ error: 'Failed to cancel BLE session' });
    }
});

/**
 * @route GET /api/ble/statistics/:festivalId
 * @desc Get BLE statistics for a festival
 * @access Admin/Staff only
 */
router.get('/statistics/:festivalId', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
    try {
        const { festivalId } = req.params;
        const statistics = await bleService.getBeaconStatistics(festivalId);

        res.json({
            message: 'BLE statistics retrieved successfully',
            statistics
        });
    } catch (error) {
        console.error('Error getting BLE statistics:', error);
        res.status(500).json({ error: 'Failed to get BLE statistics' });
    }
});

/**
 * @route POST /api/ble/cleanup
 * @desc Clean up expired sessions
 * @access Admin only
 */
router.post('/cleanup', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.body;
        const cleanedCount = await bleService.cleanupExpiredSessions(userId);

        res.json({
            message: 'Cleanup completed successfully',
            cleanedSessions: cleanedCount
        });
    } catch (error) {
        console.error('Error cleaning up sessions:', error);
        res.status(500).json({ error: 'Failed to cleanup sessions' });
    }
});

module.exports = router;




