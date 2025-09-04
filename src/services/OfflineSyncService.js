/**
 * OfflineSyncService.js
 * 
 * Service for handling offline-to-online synchronization
 * Manages data synchronization when internet connectivity is restored
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const database = require('../database/database');

class OfflineSyncService extends EventEmitter {
    constructor() {
        super();
        this.db = database;
        this.syncInProgress = false;
        this.syncQueue = [];
        this.conflictResolution = {
            strategy: 'server_wins', // 'server_wins', 'client_wins', 'merge', 'manual'
            mergeFields: ['content', 'metadata'],
            excludeFields: ['id', 'created_at', 'updated_at']
        };
        
        // Start sync processing
        this.startSyncProcessor();
    }

    /**
     * Queue data for synchronization
     * @param {string} userId - User ID
     * @param {string} syncType - Type of data to sync
     * @param {Object} data - Data to sync
     * @param {number} priority - Priority (1-10, higher = more important)
     * @param {string} identityId - Mesh identity ID (optional)
     * @returns {Promise<string>} Queue item ID
     */
    async queueForSync(userId, syncType, data, priority = 5, identityId = null) {
        try {
            const queueId = crypto.randomUUID();
            
            await this.db.run(
                `INSERT INTO offline_sync_queue 
                 (id, user_id, identity_id, sync_type, data, priority)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [queueId, userId, identityId, syncType, JSON.stringify(data), priority]
            );
            
            this.emit('itemQueued', { queueId, userId, syncType, priority });
            
            // Trigger sync if not already in progress
            if (!this.syncInProgress) {
                setImmediate(() => this.processSyncQueue());
            }
            
            return queueId;
        } catch (error) {
            console.error('Error queuing for sync:', error);
            throw error;
        }
    }

    /**
     * Process the sync queue
     */
    async processSyncQueue() {
        if (this.syncInProgress) {
            return;
        }
        
        this.syncInProgress = true;
        
        try {
            const pendingItems = await this.getPendingSyncItems();
            
            if (pendingItems.length === 0) {
                this.emit('syncComplete', { processed: 0 });
                return;
            }
            
            let processed = 0;
            let failed = 0;
            
            for (const item of pendingItems) {
                try {
                    await this.processSyncItem(item);
                    await this.markItemProcessed(item.id);
                    processed++;
                    
                    this.emit('itemProcessed', { item, success: true });
                } catch (error) {
                    console.error(`Error processing sync item ${item.id}:`, error);
                    await this.markItemFailed(item.id, error.message);
                    failed++;
                    
                    this.emit('itemProcessed', { item, success: false, error: error.message });
                }
            }
            
            this.emit('syncComplete', { processed, failed, total: pendingItems.length });
            
        } catch (error) {
            console.error('Error processing sync queue:', error);
            this.emit('syncError', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Get pending sync items
     * @returns {Promise<Array>} Pending sync items
     */
    async getPendingSyncItems() {
        return await this.db.all(
            `SELECT * FROM offline_sync_queue 
             WHERE is_processed = 0 AND attempt_count < max_attempts
             ORDER BY priority DESC, created_at ASC
             LIMIT 100`
        );
    }

    /**
     * Process individual sync item
     * @param {Object} item - Sync item
     */
    async processSyncItem(item) {
        const data = JSON.parse(item.data);
        
        switch (item.sync_type) {
            case 'message':
                await this.syncMessage(item, data);
                break;
            case 'presence':
                await this.syncUserPresence(item, data);
                break;
            case 'access_log':
                await this.syncAccessLog(item, data);
                break;
            case 'ticket_scan':
                await this.syncTicketScan(item, data);
                break;
            case 'estadia_access':
                await this.syncEstadiaAccess(item, data);
                break;
            case 'favorite':
                await this.syncFavorite(item, data);
                break;
            case 'location':
                await this.syncLocation(item, data);
                break;
            case 'notification':
                await this.syncNotification(item, data);
                break;
            default:
                console.warn(`Unknown sync type: ${item.sync_type}`);
        }
    }

    /**
     * Sync message data
     */
    async syncMessage(item, data) {
        const { meshMessageId, mainMessageId, roomId, content, timestamp } = data;
        
        // Check if message already exists in main chat
        const existingMessage = await this.db.get(
            'SELECT * FROM chat_messages WHERE id = ?',
            [mainMessageId]
        );
        
        if (existingMessage) {
            // Message already synced, just update timestamp if needed
            if (existingMessage.timestamp !== timestamp) {
                await this.db.run(
                    'UPDATE chat_messages SET timestamp = ? WHERE id = ?',
                    [timestamp, mainMessageId]
                );
            }
            return;
        }
        
        // Create message in main chat system
        await this.db.run(
            `INSERT INTO chat_messages 
             (id, room_id, sender_id, text, timestamp)
             VALUES (?, ?, ?, ?, ?)`,
            [mainMessageId, roomId, item.user_id, content, timestamp]
        );
    }

    /**
     * Sync user presence data
     */
    async syncUserPresence(item, data) {
        const { festivalId, latitude, longitude, status, timestamp } = data;
        
        // Check if presence record exists
        const existingPresence = await this.db.get(
            'SELECT * FROM user_presence WHERE user_id = ? AND festival_id = ?',
            [item.user_id, festivalId]
        );
        
        if (existingPresence) {
            // Update existing presence
            await this.db.run(
                `UPDATE user_presence 
                 SET latitude = ?, longitude = ?, status = ?, last_seen = ?
                 WHERE user_id = ? AND festival_id = ?`,
                [latitude, longitude, status, timestamp, item.user_id, festivalId]
            );
        } else {
            // Create new presence record
            const presenceId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO user_presence 
                 (id, user_id, festival_id, latitude, longitude, status, last_seen)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [presenceId, item.user_id, festivalId, latitude, longitude, status, timestamp]
            );
        }
    }

    /**
     * Sync access log data
     */
    async syncAccessLog(item, data) {
        const { estadiaId, accessType, timestamp, latitude, longitude, notes } = data;
        
        // Check if log entry already exists
        const existingLog = await this.db.get(
            `SELECT * FROM estadia_access_logs 
             WHERE user_id = ? AND estadia_id = ? AND access_type = ? AND timestamp = ?`,
            [item.user_id, estadiaId, accessType, timestamp]
        );
        
        if (existingLog) {
            // Log already exists, skip
            return;
        }
        
        // Create new log entry
        const logId = crypto.randomUUID();
        await this.db.run(
            `INSERT INTO estadia_access_logs 
             (id, estadia_id, user_id, access_type, timestamp, location_latitude, location_longitude, mesh_identity_id, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [logId, estadiaId, item.user_id, accessType, timestamp, latitude, longitude, item.identity_id, notes]
        );
    }

    /**
     * Sync ticket scan data
     */
    async syncTicketScan(item, data) {
        const { ticketId, qrPayload, timestamp, location } = data;
        
        // Validate ticket
        const ticket = await this.db.get(
            'SELECT * FROM tickets WHERE id = ? AND status = "active"',
            [ticketId]
        );
        
        if (!ticket) {
            throw new Error('Ticket not found or invalid');
        }
        
        // Check if scan already logged
        const existingScan = await this.db.get(
            `SELECT * FROM estadia_access_logs 
             WHERE user_id = ? AND access_type = 'ticket_scan' AND notes LIKE ?`,
            [item.user_id, `%${ticketId}%`]
        );
        
        if (existingScan) {
            return; // Already logged
        }
        
        // Log the ticket scan
        const logId = crypto.randomUUID();
        await this.db.run(
            `INSERT INTO estadia_access_logs 
             (id, estadia_id, user_id, access_type, timestamp, location_latitude, location_longitude, mesh_identity_id, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                logId, null, item.user_id, 'ticket_scan', timestamp,
                location?.latitude, location?.longitude, item.identity_id,
                `Ticket scanned via mesh: ${ticketId}`
            ]
        );
    }

    /**
     * Sync estadia access data
     */
    async syncEstadiaAccess(item, data) {
        const { estadiaId, accessType, timestamp, grantedBy, expiresAt, notes } = data;
        
        // Check if access already exists
        const existingAccess = await this.db.get(
            `SELECT * FROM estadia_access 
             WHERE user_id = ? AND estadia_id = ? AND is_active = 1`,
            [item.user_id, estadiaId]
        );
        
        if (existingAccess) {
            // Update existing access
            await this.db.run(
                `UPDATE estadia_access 
                 SET access_type = ?, expires_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [accessType, expiresAt, notes, existingAccess.id]
            );
        } else {
            // Create new access
            const accessId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO estadia_access 
                 (id, estadia_id, user_id, access_type, granted_by, expires_at, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [accessId, estadiaId, item.user_id, accessType, grantedBy, expiresAt, notes]
            );
        }
    }

    /**
     * Sync favorite data
     */
    async syncFavorite(item, data) {
        const { artistId, action } = data; // action: 'add' or 'remove'
        
        if (action === 'add') {
            // Add favorite
            await this.db.run(
                `INSERT OR IGNORE INTO user_favorites (user_id, artist_id) VALUES (?, ?)`,
                [item.user_id, artistId]
            );
        } else if (action === 'remove') {
            // Remove favorite
            await this.db.run(
                'DELETE FROM user_favorites WHERE user_id = ? AND artist_id = ?',
                [item.user_id, artistId]
            );
        }
    }

    /**
     * Sync location data
     */
    async syncLocation(item, data) {
        const { festivalId, latitude, longitude, timestamp, accuracy } = data;
        
        // Update user presence with location
        await this.syncUserPresence(item, {
            festivalId,
            latitude,
            longitude,
            status: 'online',
            timestamp
        });
        
        // Could also store in a separate location history table
        // for more detailed location tracking
    }

    /**
     * Sync notification data
     */
    async syncNotification(item, data) {
        const { title, body, type, data: notificationData, scheduledAt } = data;
        
        // Create notification in main system
        const notificationId = crypto.randomUUID();
        await this.db.run(
            `INSERT INTO notifications 
             (id, user_id, title, body, type, data, scheduled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [notificationId, item.user_id, title, body, type, JSON.stringify(notificationData), scheduledAt]
        );
    }

    /**
     * Mark sync item as processed
     * @param {string} itemId - Item ID
     */
    async markItemProcessed(itemId) {
        await this.db.run(
            'UPDATE offline_sync_queue SET is_processed = 1, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [itemId]
        );
    }

    /**
     * Mark sync item as failed
     * @param {string} itemId - Item ID
     * @param {string} errorMessage - Error message
     */
    async markItemFailed(itemId, errorMessage) {
        await this.db.run(
            `UPDATE offline_sync_queue 
             SET attempt_count = attempt_count + 1, last_attempt = CURRENT_TIMESTAMP, error_message = ?
             WHERE id = ?`,
            [errorMessage, itemId]
        );
    }

    /**
     * Get sync statistics
     * @param {string} userId - User ID (optional)
     * @returns {Promise<Object>} Sync statistics
     */
    async getSyncStats(userId = null) {
        try {
            let whereClause = '';
            let params = [];
            
            if (userId) {
                whereClause = 'WHERE user_id = ?';
                params = [userId];
            }
            
            const stats = await this.db.get(
                `SELECT 
                    COUNT(*) as total_items,
                    SUM(CASE WHEN is_processed = 1 THEN 1 ELSE 0 END) as processed_items,
                    SUM(CASE WHEN is_processed = 0 AND attempt_count < max_attempts THEN 1 ELSE 0 END) as pending_items,
                    SUM(CASE WHEN attempt_count >= max_attempts THEN 1 ELSE 0 END) as failed_items
                 FROM offline_sync_queue ${whereClause}`,
                params
            );
            
            return stats;
        } catch (error) {
            console.error('Error getting sync stats:', error);
            throw error;
        }
    }

    /**
     * Get sync queue for user
     * @param {string} userId - User ID
     * @param {number} limit - Number of items to return
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Array>} Sync queue items
     */
    async getSyncQueue(userId, limit = 100, offset = 0) {
        try {
            return await this.db.all(
                `SELECT * FROM offline_sync_queue 
                 WHERE user_id = ?
                 ORDER BY priority DESC, created_at ASC
                 LIMIT ? OFFSET ?`,
                [userId, limit, offset]
            );
        } catch (error) {
            console.error('Error getting sync queue:', error);
            throw error;
        }
    }

    /**
     * Clear processed sync items
     * @param {string} userId - User ID (optional)
     * @param {number} olderThanDays - Clear items older than N days
     * @returns {Promise<number>} Number of items cleared
     */
    async clearProcessedItems(userId = null, olderThanDays = 7) {
        try {
            let whereClause = 'WHERE is_processed = 1 AND processed_at < datetime("now", "-" || ? || " days")';
            let params = [olderThanDays];
            
            if (userId) {
                whereClause += ' AND user_id = ?';
                params.push(userId);
            }
            
            const result = await this.db.run(
                `DELETE FROM offline_sync_queue ${whereClause}`,
                params
            );
            
            return result.changes;
        } catch (error) {
            console.error('Error clearing processed items:', error);
            throw error;
        }
    }

    /**
     * Retry failed sync items
     * @param {string} userId - User ID (optional)
     * @returns {Promise<number>} Number of items retried
     */
    async retryFailedItems(userId = null) {
        try {
            let whereClause = 'WHERE attempt_count >= max_attempts';
            let params = [];
            
            if (userId) {
                whereClause += ' AND user_id = ?';
                params = [userId];
            }
            
            const result = await this.db.run(
                `UPDATE offline_sync_queue 
                 SET attempt_count = 0, error_message = NULL, last_attempt = NULL
                 ${whereClause}`,
                params
            );
            
            // Trigger sync processing
            if (result.changes > 0) {
                setImmediate(() => this.processSyncQueue());
            }
            
            return result.changes;
        } catch (error) {
            console.error('Error retrying failed items:', error);
            throw error;
        }
    }

    /**
     * Start sync processor
     */
    startSyncProcessor() {
        // Process sync queue every 30 seconds
        setInterval(() => {
            if (!this.syncInProgress) {
                this.processSyncQueue();
            }
        }, 30000);
        
        // Clean up old processed items every hour
        setInterval(() => {
            this.clearProcessedItems(null, 7);
        }, 60 * 60 * 1000);
    }

    /**
     * Handle conflict resolution
     * @param {Object} localData - Local data
     * @param {Object} serverData - Server data
     * @param {string} field - Field name
     * @returns {any} Resolved value
     */
    resolveConflict(localData, serverData, field) {
        switch (this.conflictResolution.strategy) {
            case 'server_wins':
                return serverData[field];
            case 'client_wins':
                return localData[field];
            case 'merge':
                if (this.conflictResolution.mergeFields.includes(field)) {
                    return this.mergeFieldValues(localData[field], serverData[field]);
                }
                return serverData[field]; // Default to server for non-merge fields
            case 'manual':
                // Return both values for manual resolution
                return {
                    local: localData[field],
                    server: serverData[field],
                    requiresManualResolution: true
                };
            default:
                return serverData[field];
        }
    }

    /**
     * Merge field values
     * @param {any} localValue - Local value
     * @param {any} serverValue - Server value
     * @returns {any} Merged value
     */
    mergeFieldValues(localValue, serverValue) {
        if (typeof localValue === 'object' && typeof serverValue === 'object') {
            return { ...serverValue, ...localValue };
        }
        
        if (Array.isArray(localValue) && Array.isArray(serverValue)) {
            return [...new Set([...serverValue, ...localValue])];
        }
        
        // For primitive values, prefer server value
        return serverValue;
    }

    /**
     * Set conflict resolution strategy
     * @param {string} strategy - Strategy name
     * @param {Object} options - Strategy options
     */
    setConflictResolutionStrategy(strategy, options = {}) {
        this.conflictResolution = {
            strategy,
            mergeFields: options.mergeFields || this.conflictResolution.mergeFields,
            excludeFields: options.excludeFields || this.conflictResolution.excludeFields
        };
    }

    // Simple CRUD methods for testing
    async enqueueOfflineItem(userId, type, data) {
        const id = crypto.randomUUID();
        if (!userId || !type || !data) {
            throw new Error('Missing required data for offline queue');
        }

        await this.db.run(
            `INSERT INTO offline_queue (id, user_id, type, data)
            VALUES (?, ?, ?, ?)`,
            [id, userId, type, JSON.stringify(data)]
        );
        return this.getOfflineItemById(id);
    }

    async getOfflineItemById(itemId) {
        const item = await this.db.get('SELECT * FROM offline_queue WHERE id = ?', [itemId]);
        if (item && item.data) {
            item.data = JSON.parse(item.data);
            item.is_processed = Boolean(item.is_processed);
        }
        return item;
    }

    async getPendingOfflineItems(userId) {
        const items = await this.db.all(
            `SELECT * FROM offline_queue WHERE user_id = ? AND is_processed = 0 ORDER BY timestamp ASC`,
            [userId]
        );
        return items.map(item => {
            item.is_processed = Boolean(item.is_processed);
            if (item.data) {
                item.data = JSON.parse(item.data);
            }
            return item;
        });
    }

    async markItemAsProcessed(itemId) {
        await this.db.run('UPDATE offline_queue SET is_processed = 1, processed_at = CURRENT_TIMESTAMP WHERE id = ?', [itemId]);
    }

    async processOfflineQueue(userId) {
        const pendingItems = await this.getPendingOfflineItems(userId);
        const processedResults = [];

        for (const item of pendingItems) {
            try {
                // Implement logic to apply the offline data to the main system
                // This would involve calling other services (e.g., MeshNetworkService, EstadiasService)
                // based on the item.type and item.data
                console.log(`Processing offline item [${item.type}] for user ${userId}:`, item.data);

                // Example: If type is 'message', store it in mesh_messages
                if (item.type === 'message') {
                    // Assuming item.data contains { sender_id, recipient_id, content, ... }
                    // await meshNetworkService.storeMeshMessage(item.data);
                } else if (item.type === 'estadia_update') {
                    // Assuming item.data contains { estadia_id, status, ... }
                    // await estadiasService.updateEstadiaStatus(item.data.estadia_id, item.data.status);
                }
                // ... handle other types ...

                await this.markItemAsProcessed(item.id);
                processedResults.push({ itemId: item.id, success: true });
            } catch (error) {
                console.error(`Failed to process offline item ${item.id}:`, error);
                // Optionally update retry count or mark as failed
                processedResults.push({ itemId: item.id, success: false, error: error.message });
            }
        }
        return processedResults;
    }
}

module.exports = new OfflineSyncService();
