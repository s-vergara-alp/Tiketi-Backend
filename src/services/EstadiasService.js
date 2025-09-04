/**
 * EstadiasService.js
 * 
 * Service for managing Estadias (stays/room access) system
 * Handles room access control, permissions, and logging for festival venues
 */

const crypto = require('crypto');
const database = require('../database/database');

class EstadiasService {
    constructor() {
        this.db = database;
    }

    /**
     * Create a new estadia (room/area)
     * @param {Object} estadiaData - Estadia data
     * @returns {Promise<Object>} Created estadia
     */
    async createEstadia(estadiaData) {
        const {
            festivalId,
            name,
            description,
            type,
            location,
            latitude,
            longitude,
            capacity,
            accessLevel
        } = estadiaData;

        try {
            const estadiaId = crypto.randomUUID();
            
            await this.db.run(
                `INSERT INTO estadias 
                 (id, festival_id, name, description, type, location, latitude, longitude, capacity, access_level)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    estadiaId, festivalId, name, description, type, location,
                    latitude, longitude, capacity, accessLevel
                ]
            );

            const newEstadia = await this.db.get(
                'SELECT * FROM estadias WHERE id = ?',
                [estadiaId]
            );

            return newEstadia;
        } catch (error) {
            console.error('Error creating estadia:', error);
            throw error;
        }
    }

    /**
     * Get all estadias for a festival
     * @param {string} festivalId - Festival ID
     * @returns {Promise<Array>} List of estadias
     */
    async getEstadias(festivalId) {
        try {
            return await this.db.all(
                'SELECT * FROM estadias WHERE festival_id = ? AND is_active = 1 ORDER BY name',
                [festivalId]
            );
        } catch (error) {
            console.error('Error getting estadias:', error);
            throw error;
        }
    }

    /**
     * Get estadia by ID
     * @param {string} estadiaId - Estadia ID
     * @returns {Promise<Object>} Estadia data
     */
    async getEstadiaById(estadiaId) {
        try {
            return await this.db.get(
                'SELECT * FROM estadias WHERE id = ? AND is_active = 1',
                [estadiaId]
            );
        } catch (error) {
            console.error('Error getting estadia by ID:', error);
            throw error;
        }
    }

    /**
     * Grant access to an estadia
     * @param {Object} accessData - Access data
     * @returns {Promise<Object>} Created access record
     */
    async grantAccess(accessData) {
        const {
            estadiaId,
            userId,
            ticketId,
            accessType,
            grantedBy,
            expiresAt,
            notes
        } = accessData;

        try {
            // Check if estadia exists
            const estadia = await this.getEstadiaById(estadiaId);
            if (!estadia) {
                throw new Error('Estadia not found');
            }

            // Check if user already has access
            const existingAccess = await this.db.get(
                `SELECT * FROM estadia_access 
                 WHERE estadia_id = ? AND user_id = ? AND is_active = 1`,
                [estadiaId, userId]
            );

            if (existingAccess) {
                // Update existing access
                await this.db.run(
                    `UPDATE estadia_access 
                     SET access_type = ?, expires_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [accessType, expiresAt, notes, existingAccess.id]
                );

                return await this.db.get(
                    'SELECT * FROM estadia_access WHERE id = ?',
                    [existingAccess.id]
                );
            } else {
                // Create new access
                const accessId = crypto.randomUUID();
                
                await this.db.run(
                    `INSERT INTO estadia_access 
                     (id, estadia_id, user_id, ticket_id, access_type, granted_by, expires_at, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        accessId, estadiaId, userId, ticketId, accessType,
                        grantedBy, expiresAt, notes
                    ]
                );

                return await this.db.get(
                    'SELECT * FROM estadia_access WHERE id = ?',
                    [accessId]
                );
            }
        } catch (error) {
            console.error('Error granting access:', error);
            throw error;
        }
    }

    /**
     * Revoke access to an estadia
     * @param {string} accessId - Access ID
     * @param {string} revokedBy - User ID who revoked access
     * @returns {Promise<boolean>} Success status
     */
    async revokeAccess(accessId, revokedBy) {
        try {
            const result = await this.db.run(
                `UPDATE estadia_access 
                 SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [accessId]
            );

            // Log the revocation
            const access = await this.db.get(
                'SELECT * FROM estadia_access WHERE id = ?',
                [accessId]
            );

            if (access) {
                await this.logAccess(access.estadia_id, access.user_id, 'revoked', null, null, revokedBy);
            }

            return result.changes > 0;
        } catch (error) {
            console.error('Error revoking access:', error);
            throw error;
        }
    }

    /**
     * Get user's access to estadias
     * @param {string} userId - User ID
     * @returns {Promise<Array>} List of access records
     */
    async getUserAccess(userId) {
        try {
            return await this.db.all(
                `SELECT ea.*, e.name as estadia_name, e.type as estadia_type, e.location, e.capacity
                 FROM estadia_access ea
                 JOIN estadias e ON ea.estadia_id = e.id
                 WHERE ea.user_id = ? AND ea.is_active = 1
                 AND (ea.expires_at IS NULL OR ea.expires_at > CURRENT_TIMESTAMP)
                 ORDER BY e.name`,
                [userId]
            );
        } catch (error) {
            console.error('Error getting user access:', error);
            throw error;
        }
    }

    /**
     * Check if user has access to an estadia
     * @param {string} userId - User ID
     * @param {string} estadiaId - Estadia ID
     * @returns {Promise<Object|null>} Access record or null
     */
    async checkUserAccess(userId, estadiaId) {
        try {
            return await this.db.get(
                `SELECT ea.*, e.name as estadia_name, e.type as estadia_type
                 FROM estadia_access ea
                 JOIN estadias e ON ea.estadia_id = e.id
                 WHERE ea.user_id = ? AND ea.estadia_id = ? AND ea.is_active = 1
                 AND (ea.expires_at IS NULL OR ea.expires_at > CURRENT_TIMESTAMP)`,
                [userId, estadiaId]
            );
        } catch (error) {
            console.error('Error checking user access:', error);
            throw error;
        }
    }

    /**
     * Log access event (entry, exit, denied, etc.)
     * @param {string} estadiaId - Estadia ID
     * @param {string} userId - User ID
     * @param {string} accessType - Type of access (entry, exit, denied, granted, revoked)
     * @param {number} latitude - Location latitude (optional)
     * @param {number} longitude - Location longitude (optional)
     * @param {string} meshIdentityId - Mesh identity ID (optional)
     * @param {string} notes - Additional notes (optional)
     * @returns {Promise<Object>} Created log entry
     */
    async logAccess(estadiaId, userId, accessType, latitude = null, longitude = null, meshIdentityId = null, notes = null) {
        try {
            const logId = crypto.randomUUID();
            
            await this.db.run(
                `INSERT INTO estadia_access_logs 
                 (id, estadia_id, user_id, access_type, timestamp, location_latitude, location_longitude, mesh_identity_id, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    logId, estadiaId, userId, accessType, new Date().toISOString(),
                    latitude, longitude, meshIdentityId, notes
                ]
            );

            return await this.db.get(
                'SELECT * FROM estadia_access_logs WHERE id = ?',
                [logId]
            );
        } catch (error) {
            console.error('Error logging access:', error);
            throw error;
        }
    }

    /**
     * Get access logs for an estadia
     * @param {string} estadiaId - Estadia ID
     * @param {number} limit - Number of records to return
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Array>} List of access logs
     */
    async getAccessLogs(estadiaId, limit = 100, offset = 0) {
        try {
            return await this.db.all(
                `SELECT eal.*, u.username, u.first_name, u.last_name, e.name as estadia_name
                 FROM estadia_access_logs eal
                 JOIN users u ON eal.user_id = u.id
                 JOIN estadias e ON eal.estadia_id = e.id
                 WHERE eal.estadia_id = ?
                 ORDER BY eal.timestamp DESC
                 LIMIT ? OFFSET ?`,
                [estadiaId, limit, offset]
            );
        } catch (error) {
            console.error('Error getting access logs:', error);
            throw error;
        }
    }

    /**
     * Get access logs for a user
     * @param {string} userId - User ID
     * @param {number} limit - Number of records to return
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Array>} List of access logs
     */
    async getUserAccessLogs(userId, limit = 100, offset = 0) {
        try {
            return await this.db.all(
                `SELECT eal.*, e.name as estadia_name, e.type as estadia_type
                 FROM estadia_access_logs eal
                 JOIN estadias e ON eal.estadia_id = e.id
                 WHERE eal.user_id = ?
                 ORDER BY eal.timestamp DESC
                 LIMIT ? OFFSET ?`,
                [userId, limit, offset]
            );
        } catch (error) {
            console.error('Error getting user access logs:', error);
            throw error;
        }
    }

    /**
     * Get estadia occupancy statistics
     * @param {string} estadiaId - Estadia ID
     * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
     * @returns {Promise<Object>} Occupancy statistics
     */
    async getEstadiaOccupancy(estadiaId, date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];
            
            // Get current occupancy
            const currentOccupancy = await this.db.get(
                `SELECT COUNT(*) as count
                 FROM estadia_access_logs
                 WHERE estadia_id = ? AND access_type = 'entry' 
                 AND DATE(timestamp) = ? AND timestamp > (
                     SELECT COALESCE(MAX(timestamp), '1900-01-01')
                     FROM estadia_access_logs
                     WHERE estadia_id = ? AND access_type = 'exit' 
                     AND DATE(timestamp) = ? AND timestamp < (
                         SELECT MAX(timestamp) FROM estadia_access_logs
                         WHERE estadia_id = ? AND access_type = 'entry' AND DATE(timestamp) = ?
                     )
                 )`,
                [estadiaId, targetDate, estadiaId, targetDate, estadiaId, targetDate]
            );

            // Get total entries for the day
            const totalEntries = await this.db.get(
                `SELECT COUNT(*) as count
                 FROM estadia_access_logs
                 WHERE estadia_id = ? AND access_type = 'entry' AND DATE(timestamp) = ?`,
                [estadiaId, targetDate]
            );

            // Get peak occupancy
            const peakOccupancy = await this.db.get(
                `SELECT MAX(occupancy) as peak
                 FROM (
                     SELECT COUNT(*) as occupancy
                     FROM estadia_access_logs
                     WHERE estadia_id = ? AND access_type = 'entry' AND DATE(timestamp) = ?
                     AND timestamp <= (
                         SELECT timestamp FROM estadia_access_logs
                         WHERE estadia_id = ? AND access_type = 'exit' AND DATE(timestamp) = ?
                         ORDER BY timestamp LIMIT 1 OFFSET ?
                     )
                     GROUP BY timestamp
                 )`,
                [estadiaId, targetDate, estadiaId, targetDate, 0]
            );

            const estadia = await this.getEstadiaById(estadiaId);
            
            return {
                estadiaId,
                estadiaName: estadia?.name,
                capacity: estadia?.capacity || 0,
                currentOccupancy: currentOccupancy?.count || 0,
                totalEntries: totalEntries?.count || 0,
                peakOccupancy: peakOccupancy?.peak || 0,
                date: targetDate
            };
        } catch (error) {
            console.error('Error getting estadia occupancy:', error);
            throw error;
        }
    }

    /**
     * Get estadia analytics for a festival
     * @param {string} festivalId - Festival ID
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @returns {Promise<Array>} Analytics data
     */
    async getEstadiaAnalytics(festivalId, startDate, endDate) {
        try {
            return await this.db.all(
                `SELECT 
                    e.id as estadia_id,
                    e.name as estadia_name,
                    e.type as estadia_type,
                    e.capacity,
                    COUNT(CASE WHEN eal.access_type = 'entry' THEN 1 END) as total_entries,
                    COUNT(CASE WHEN eal.access_type = 'exit' THEN 1 END) as total_exits,
                    COUNT(CASE WHEN eal.access_type = 'denied' THEN 1 END) as total_denied,
                    AVG(CASE WHEN eal.access_type = 'entry' THEN 1 ELSE 0 END) as avg_daily_entries
                 FROM estadias e
                 LEFT JOIN estadia_access_logs eal ON e.id = eal.estadia_id
                 WHERE e.festival_id = ? AND e.is_active = 1
                 AND (eal.timestamp IS NULL OR DATE(eal.timestamp) BETWEEN ? AND ?)
                 GROUP BY e.id, e.name, e.type, e.capacity
                 ORDER BY total_entries DESC`,
                [festivalId, startDate, endDate]
            );
        } catch (error) {
            console.error('Error getting estadia analytics:', error);
            throw error;
        }
    }

    /**
     * Update estadia information
     * @param {string} estadiaId - Estadia ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated estadia
     */
    async updateEstadia(estadiaId, updateData) {
        try {
            const allowedFields = ['name', 'description', 'type', 'location', 'latitude', 'longitude', 'capacity', 'access_level'];
            const updates = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }

            values.push(estadiaId);

            await this.db.run(
                `UPDATE estadias SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );

            return await this.getEstadiaById(estadiaId);
        } catch (error) {
            console.error('Error updating estadia:', error);
            throw error;
        }
    }

    /**
     * Deactivate an estadia
     * @param {string} estadiaId - Estadia ID
     * @returns {Promise<boolean>} Success status
     */
    async deactivateEstadia(estadiaId) {
        try {
            const result = await this.db.run(
                'UPDATE estadias SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [estadiaId]
            );

            return result.changes > 0;
        } catch (error) {
            console.error('Error deactivating estadia:', error);
            throw error;
        }
    }

    /**
     * Get estadias by type
     * @param {string} festivalId - Festival ID
     * @param {string} type - Estadia type
     * @returns {Promise<Array>} List of estadias
     */
    async getEstadiasByType(festivalId, type) {
        try {
            return await this.db.all(
                'SELECT * FROM estadias WHERE festival_id = ? AND type = ? AND is_active = 1 ORDER BY name',
                [festivalId, type]
            );
        } catch (error) {
            console.error('Error getting estadias by type:', error);
            throw error;
        }
    }

    /**
     * Get estadias near a location
     * @param {string} festivalId - Festival ID
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {number} radius - Radius in meters (default: 1000)
     * @returns {Promise<Array>} List of nearby estadias
     */
    async getEstadiasNearLocation(festivalId, latitude, longitude, radius = 1000) {
        try {
            // Simple distance calculation (for more accuracy, use proper geospatial queries)
            return await this.db.all(
                `SELECT *, 
                 (6371000 * acos(cos(radians(?)) * cos(radians(latitude)) * 
                  cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
                  sin(radians(latitude)))) AS distance
                 FROM estadias 
                 WHERE festival_id = ? AND is_active = 1
                 HAVING distance < ?
                 ORDER BY distance`,
                [latitude, longitude, latitude, festivalId, radius]
            );
        } catch (error) {
            console.error('Error getting estadias near location:', error);
            throw error;
        }
    }

    // Simple CRUD methods for testing (user stays/bookings)
    async createEstadia(estadiaData) {
        const { user_id, festival_id, room_id, access_code, start_time, end_time, metadata = {} } = estadiaData;
        const id = crypto.randomUUID();

        if (!user_id || !festival_id || !room_id || !access_code || !start_time || !end_time) {
            throw new Error('Missing required estadia data');
        }

        // Basic validation for dates
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);
        if (isNaN(startDate) || isNaN(endDate) || startDate >= endDate) {
            throw new Error('Invalid start or end time for estadia');
        }

        await this.db.run(
            `INSERT INTO estadias (id, user_id, festival_id, room_id, access_code, start_time, end_time, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, user_id, festival_id, room_id, access_code, start_time, end_time, JSON.stringify(metadata)]
        );
        return this.getEstadiaById(id);
    }

    async getEstadiaById(estadiaId) {
        const estadia = await this.db.get('SELECT * FROM estadias WHERE id = ?', [estadiaId]);
        if (estadia && estadia.metadata) {
            estadia.metadata = JSON.parse(estadia.metadata);
        }
        return estadia;
    }

    async getUserEstadias(userId) {
        const estadias = await this.db.all('SELECT * FROM estadias WHERE user_id = ? ORDER BY start_time DESC', [userId]);
        return estadias.map(estadia => {
            if (estadia.metadata) {
                estadia.metadata = JSON.parse(estadia.metadata);
            }
            return estadia;
        });
    }

    async updateEstadiaStatus(estadiaId, status) {
        const validStatuses = ['active', 'checked_in', 'checked_out', 'cancelled', 'expired'];
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid estadia status');
        }

        let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
        const params = [status];

        if (status === 'checked_in') {
            updateFields += ', check_in_time = CURRENT_TIMESTAMP';
        } else if (status === 'checked_out') {
            updateFields += ', check_out_time = CURRENT_TIMESTAMP';
        }

        await this.db.run(`UPDATE estadias SET ${updateFields} WHERE id = ?`, [...params, estadiaId]);
        return this.getEstadiaById(estadiaId);
    }

    async validateRoomAccess(accessCode, roomId, userId) {
        const estadia = await this.db.get(
            `SELECT * FROM estadias WHERE access_code = ? AND room_id = ? AND user_id = ? AND status = 'active'`,
            [accessCode, roomId, userId]
        );

        let accessGranted = false;
        let reason = '';

        if (!estadia) {
            reason = 'Invalid access code or no active estadia found.';
        } else {
            const now = new Date();
            const startTime = new Date(estadia.start_time);
            const endTime = new Date(estadia.end_time);

            if (now < startTime) {
                reason = 'Access not yet active.';
            } else if (now > endTime) {
                reason = 'Access expired.';
                await this.updateEstadiaStatus(estadia.id, 'expired');
            } else {
                accessGranted = true;
                reason = 'Access granted.';
                await this.updateEstadiaStatus(estadia.id, 'checked_in');
            }
        }

        // Log the access attempt
        const logId = crypto.randomUUID();
        await this.db.run(
            `INSERT INTO room_access_logs (id, estadia_id, user_id, room_id, access_granted, reason)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [logId, estadia ? estadia.id : 'unknown', userId, roomId, accessGranted, reason]
        );

        return { accessGranted, reason, estadia: accessGranted ? estadia : null };
    }
}

module.exports = new EstadiasService();
