const { v4: uuidv4 } = require('uuid');
const database = require('../database/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');

class BLEService {
    constructor() {
        this.sessionTimeout = 300; // 5 minutes
        this.proximityThreshold = -70; // RSSI threshold for proximity
        this.maxSessionsPerUser = 3; // Maximum active sessions per user
    }

    /**
     * Register a BLE beacon
     * @param {string} festivalId - Festival ID
     * @param {Object} beaconData - Beacon data
     * @returns {Promise<Object>} Created beacon
     */
    async registerBeacon(festivalId, beaconData) {
        try {
            // Validate festival exists
            const festival = await database.get(
                'SELECT id, name, ble_enabled FROM festivals WHERE id = ? AND is_active = 1',
                [festivalId]
            );

            if (!festival) {
                throw new NotFoundError('Festival not found or inactive');
            }

            if (!festival.ble_enabled) {
                throw new BusinessLogicError('BLE is not enabled for this festival');
            }

            // Check if MAC address already exists
            const existingBeacon = await database.get(
                'SELECT id FROM ble_beacons WHERE mac_address = ?',
                [beaconData.macAddress]
            );

            if (existingBeacon) {
                throw new ValidationError('Beacon with this MAC address already exists');
            }

            const beaconId = uuidv4();
            const result = await database.run(`
                INSERT INTO ble_beacons (
                    id, festival_id, name, location_name, latitude, longitude,
                    mac_address, uuid, major, minor, tx_power, rssi_threshold
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                beaconId, festivalId, beaconData.name, beaconData.locationName,
                beaconData.latitude, beaconData.longitude, beaconData.macAddress,
                beaconData.uuid, beaconData.major, beaconData.minor,
                beaconData.txPower || -59, beaconData.rssiThreshold || -70
            ]);

            if (result.changes === 0) {
                throw new Error('Failed to create beacon');
            }

            return await this.getBeaconById(beaconId);
        } catch (error) {
            console.error('Error registering beacon:', error);
            throw error;
        }
    }

    /**
     * Get beacon by ID
     * @param {string} beaconId - Beacon ID
     * @returns {Promise<Object>} Beacon data
     */
    async getBeaconById(beaconId) {
        const beacon = await database.get(`
            SELECT 
                b.*,
                f.name as festival_name,
                f.ble_enabled as festival_ble_enabled
            FROM ble_beacons b
            JOIN festivals f ON b.festival_id = f.id
            WHERE b.id = ?
        `, [beaconId]);

        if (!beacon) {
            throw new NotFoundError('Beacon not found');
        }

        return this.formatBeacon(beacon);
    }

    /**
     * Get all beacons for a festival
     * @param {string} festivalId - Festival ID
     * @returns {Promise<Array>} Array of beacons
     */
    async getFestivalBeacons(festivalId) {
        const beacons = await database.all(`
            SELECT 
                b.*,
                f.name as festival_name
            FROM ble_beacons b
            JOIN festivals f ON b.festival_id = f.id
            WHERE b.festival_id = ? AND b.is_active = 1
            ORDER BY b.name
        `, [festivalId]);

        return beacons.map(beacon => this.formatBeacon(beacon));
    }

    /**
     * Start BLE validation session
     * @param {string} beaconId - Beacon ID
     * @param {string} userId - User ID (optional)
     * @param {string} deviceId - Device ID
     * @param {Object} proximityData - Proximity data (RSSI, distance, etc.)
     * @returns {Promise<Object>} Validation session
     */
    async startValidationSession(beaconId, userId = null, deviceId, proximityData = {}) {
        try {
            // Validate beacon exists and is active
            const beacon = await database.get(
                'SELECT * FROM ble_beacons WHERE id = ? AND is_active = 1',
                [beaconId]
            );

            if (!beacon) {
                throw new NotFoundError('Beacon not found or inactive');
            }

            // Check proximity threshold
            if (proximityData.rssi && proximityData.rssi < beacon.rssi_threshold) {
                throw new BusinessLogicError('Device too far from beacon');
            }

            // Clean up expired sessions for this user
            if (userId) {
                await this.cleanupExpiredSessions(userId);
                
                // Check max sessions per user
                const activeSessions = await database.get(
                    'SELECT COUNT(*) as count FROM ble_validation_sessions WHERE user_id = ? AND status = "active"',
                    [userId]
                );

                if (activeSessions.count >= this.maxSessionsPerUser) {
                    throw new BusinessLogicError('Maximum active sessions reached');
                }
            }

            const sessionId = uuidv4();
            const sessionToken = this.generateSessionToken();
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + this.sessionTimeout);

            const result = await database.run(`
                INSERT INTO ble_validation_sessions (
                    id, beacon_id, user_id, device_id, session_token, proximity_data, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                sessionId, beaconId, userId, deviceId, sessionToken,
                JSON.stringify(proximityData), expiresAt.toISOString()
            ]);

            if (result.changes === 0) {
                throw new Error('Failed to create validation session');
            }

            return {
                sessionId,
                sessionToken,
                beaconId,
                userId,
                deviceId,
                expiresAt: expiresAt.toISOString(),
                proximityData
            };
        } catch (error) {
            console.error('Error starting validation session:', error);
            throw error;
        }
    }

    /**
     * Validate BLE session
     * @param {string} sessionToken - Session token
     * @param {Object} validationData - Additional validation data
     * @returns {Promise<Object>} Validation result
     */
    async validateSession(sessionToken, validationData = {}) {
        try {
            const session = await database.get(`
                SELECT 
                    s.*,
                    b.name as beacon_name,
                    b.location_name,
                    b.latitude,
                    b.longitude
                FROM ble_validation_sessions s
                JOIN ble_beacons b ON s.beacon_id = b.id
                WHERE s.session_token = ? AND s.status = 'active'
            `, [sessionToken]);

            if (!session) {
                return {
                    valid: false,
                    message: 'Session not found or expired',
                    code: 'SESSION_NOT_FOUND'
                };
            }

            // Check if session expired
            const now = new Date();
            const expiresAt = new Date(session.expires_at);
            if (now > expiresAt) {
                await this.expireSession(session.id);
                return {
                    valid: false,
                    message: 'Session expired',
                    code: 'SESSION_EXPIRED'
                };
            }

            // Update session status
            await database.run(
                'UPDATE ble_validation_sessions SET status = "validated", validated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [session.id]
            );

            return {
                valid: true,
                message: 'Session validated successfully',
                code: 'SESSION_VALID',
                sessionId: session.id,
                beaconId: session.beacon_id,
                userId: session.user_id,
                deviceId: session.device_id,
                beaconName: session.beacon_name,
                locationName: session.location_name,
                coordinates: {
                    latitude: session.latitude,
                    longitude: session.longitude
                },
                proximityData: JSON.parse(session.proximity_data || '{}')
            };
        } catch (error) {
            console.error('Error validating session:', error);
            return {
                valid: false,
                message: 'Session validation failed',
                code: 'SESSION_VALIDATION_ERROR'
            };
        }
    }

    /**
     * Get active sessions for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Active sessions
     */
    async getUserActiveSessions(userId) {
        const sessions = await database.all(`
            SELECT 
                s.*,
                b.name as beacon_name,
                b.location_name
            FROM ble_validation_sessions s
            JOIN ble_beacons b ON s.beacon_id = b.id
            WHERE s.user_id = ? AND s.status = 'active'
            ORDER BY s.created_at DESC
        `, [userId]);

        return sessions.map(session => ({
            ...session,
            proximityData: JSON.parse(session.proximity_data || '{}')
        }));
    }

    /**
     * Clean up expired sessions
     * @param {string} userId - User ID (optional)
     * @returns {Promise<number>} Number of cleaned up sessions
     */
    async cleanupExpiredSessions(userId = null) {
        try {
            let query = 'UPDATE ble_validation_sessions SET status = "expired" WHERE status = "active" AND expires_at < CURRENT_TIMESTAMP';
            const params = [];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            const result = await database.run(query, params);
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            throw new Error('Failed to cleanup expired sessions');
        }
    }

    /**
     * Expire a specific session
     * @param {string} sessionId - Session ID
     * @returns {Promise<void>}
     */
    async expireSession(sessionId) {
        await database.run(
            'UPDATE ble_validation_sessions SET status = "expired" WHERE id = ?',
            [sessionId]
        );
    }

    /**
     * Cancel a session
     * @param {string} sessionToken - Session token
     * @returns {Promise<Object>} Result
     */
    async cancelSession(sessionToken) {
        try {
            const result = await database.run(
                'UPDATE ble_validation_sessions SET status = "cancelled" WHERE session_token = ? AND status = "active"',
                [sessionToken]
            );

            if (result.changes === 0) {
                return {
                    success: false,
                    message: 'Session not found or already processed'
                };
            }

            return {
                success: true,
                message: 'Session cancelled successfully'
            };
        } catch (error) {
            console.error('Error cancelling session:', error);
            throw new Error('Failed to cancel session');
        }
    }

    /**
     * Get beacon statistics
     * @param {string} festivalId - Festival ID
     * @returns {Promise<Object>} Beacon statistics
     */
    async getBeaconStatistics(festivalId) {
        try {
            const stats = await database.get(`
                SELECT 
                    COUNT(*) as total_beacons,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_beacons,
                    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_beacons
                FROM ble_beacons
                WHERE festival_id = ?
            `, [festivalId]);

            const sessionStats = await database.get(`
                SELECT 
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
                    SUM(CASE WHEN status = 'validated' THEN 1 ELSE 0 END) as validated_sessions,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_sessions
                FROM ble_validation_sessions s
                JOIN ble_beacons b ON s.beacon_id = b.id
                WHERE b.festival_id = ?
            `, [festivalId]);

            return {
                beacons: {
                    total: stats.total_beacons || 0,
                    active: stats.active_beacons || 0,
                    inactive: stats.inactive_beacons || 0
                },
                sessions: {
                    total: sessionStats.total_sessions || 0,
                    active: sessionStats.active_sessions || 0,
                    validated: sessionStats.validated_sessions || 0,
                    expired: sessionStats.expired_sessions || 0
                }
            };
        } catch (error) {
            console.error('Error getting beacon statistics:', error);
            throw new Error('Failed to get beacon statistics');
        }
    }

    /**
     * Generate session token
     * @returns {string} Session token
     */
    generateSessionToken() {
        return uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
    }

    /**
     * Format beacon data
     * @param {Object} beacon - Raw beacon data
     * @returns {Object} Formatted beacon
     */
    formatBeacon(beacon) {
        return {
            id: beacon.id,
            festivalId: beacon.festival_id,
            festivalName: beacon.festival_name,
            name: beacon.name,
            locationName: beacon.location_name,
            coordinates: {
                latitude: beacon.latitude,
                longitude: beacon.longitude
            },
            macAddress: beacon.mac_address,
            uuid: beacon.uuid,
            major: beacon.major,
            minor: beacon.minor,
            txPower: beacon.tx_power,
            rssiThreshold: beacon.rssi_threshold,
            isActive: beacon.is_active === 1,
            createdAt: beacon.created_at,
            updatedAt: beacon.updated_at
        };
    }
}

module.exports = new BLEService();




