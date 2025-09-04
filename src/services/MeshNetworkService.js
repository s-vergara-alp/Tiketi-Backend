/**
 * MeshNetworkService.js
 * 
 * Service for handling Bluetooth mesh network operations based on BitChat protocol
 * Provides offline communication capabilities for festival environments
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const database = require('../database/database');

class MeshNetworkService extends EventEmitter {
    constructor() {
        super();
        this.db = database;
        this.activeSessions = new Map();
        this.messageQueue = new Map();
        this.peerCache = new Map();
        this.isOnline = true;
        
        // BitChat protocol constants
        this.PROTOCOL_VERSION = 1;
        this.MAX_TTL = 7;
        this.MESSAGE_TYPES = {
            TEXT: 'text',
            IMAGE: 'image',
            FILE: 'file',
            LOCATION: 'location',
            TICKET: 'ticket',
            ESTADIA: 'estadia',
            SYSTEM: 'system',
            HANDSHAKE_INIT: 'handshake_init',
            HANDSHAKE_RESPONSE: 'handshake_response',
            HANDSHAKE_COMPLETE: 'handshake_complete',
            DELIVERY_ACK: 'delivery_ack',
            READ_RECEIPT: 'read_receipt'
        };
        
        // Initialize cleanup intervals
        this.startCleanupIntervals();
    }

    /**
     * Register a new mesh identity for a user
     * @param {string} userId - User ID
     * @param {string} festivalId - Festival ID
     * @param {Object} identityData - Identity data from BitChat client
     * @returns {Promise<Object>} Created identity
     */
    async registerMeshIdentity(userId, festivalId, identityData) {
        const { fingerprint, staticPublicKey, signingPublicKey, nickname } = identityData;
        
        try {
            // Check if identity already exists
            const existing = await this.db.get(
                'SELECT * FROM mesh_identities WHERE fingerprint = ?',
                [fingerprint]
            );
            
            if (existing) {
                // Update last seen and user association
                await this.db.run(
                    `UPDATE mesh_identities 
                     SET user_id = ?, last_seen = CURRENT_TIMESTAMP, is_active = 1
                     WHERE fingerprint = ?`,
                    [userId, fingerprint]
                );
                return existing;
            }
            
            // Create new identity
            const identityId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO mesh_identities 
                 (id, user_id, festival_id, fingerprint, static_public_key, signing_public_key, nickname)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [identityId, userId, festivalId, fingerprint, staticPublicKey, signingPublicKey, nickname]
            );
            
            const newIdentity = await this.db.get(
                'SELECT * FROM mesh_identities WHERE id = ?',
                [identityId]
            );
            
            this.emit('identityRegistered', newIdentity);
            return newIdentity;
            
        } catch (error) {
            console.error('Error registering mesh identity:', error);
            throw error;
        }
    }

    /**
     * Process incoming mesh message
     * @param {Object} messageData - Message data from BitChat client
     * @returns {Promise<Object>} Processing result
     */
    async processMeshMessage(messageData) {
        const {
            senderFingerprint,
            recipientFingerprint,
            roomId,
            messageType,
            content,
            encryptedContent,
            isPrivate,
            ttl,
            timestamp
        } = messageData;
        
        try {
            // Get sender identity
            const senderIdentity = await this.getMeshIdentityByFingerprint(senderFingerprint);
            if (!senderIdentity) {
                throw new Error('Unknown sender identity');
            }
            
            // Get recipient identity (if not broadcast)
            let recipientIdentity = null;
            if (recipientFingerprint && recipientFingerprint !== 'FFFFFFFFFFFFFFFF') {
                recipientIdentity = await this.getMeshIdentityByFingerprint(recipientFingerprint);
            }
            
            // Create message record
            const messageId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO mesh_messages 
                 (id, sender_identity_id, recipient_identity_id, room_id, message_type, 
                  content, encrypted_content, is_private, ttl, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    messageId, senderIdentity.id, recipientIdentity?.id, roomId, messageType,
                    content, encryptedContent, isPrivate, ttl, timestamp
                ]
            );
            
            // Handle different message types
            await this.handleMessageType(messageId, messageType, content, senderIdentity, recipientIdentity);
            
            // If online, sync to main chat system
            if (this.isOnline && roomId) {
                await this.syncToMainChat(messageId, senderIdentity, roomId, content);
            }
            
            // Send delivery acknowledgment
            if (recipientIdentity) {
                await this.sendDeliveryAck(senderIdentity, recipientIdentity, messageId);
            }
            
            this.emit('messageProcessed', { messageId, senderIdentity, recipientIdentity });
            
            return { success: true, messageId };
            
        } catch (error) {
            console.error('Error processing mesh message:', error);
            throw error;
        }
    }

    /**
     * Handle different message types
     */
    async handleMessageType(messageId, messageType, content, senderIdentity, recipientIdentity) {
        switch (messageType) {
            case this.MESSAGE_TYPES.TICKET:
                await this.handleTicketMessage(messageId, content, senderIdentity);
                break;
            case this.MESSAGE_TYPES.ESTADIA:
                await this.handleEstadiaMessage(messageId, content, senderIdentity);
                break;
            case this.MESSAGE_TYPES.LOCATION:
                await this.handleLocationMessage(messageId, content, senderIdentity);
                break;
            case this.MESSAGE_TYPES.SYSTEM:
                await this.handleSystemMessage(messageId, content, senderIdentity);
                break;
        }
    }

    /**
     * Handle ticket-related messages
     */
    async handleTicketMessage(messageId, content, senderIdentity) {
        try {
            const ticketData = JSON.parse(content);
            const { action, ticketId, qrPayload } = ticketData;
            
            switch (action) {
                case 'scan':
                    await this.processTicketScan(senderIdentity, ticketId, qrPayload);
                    break;
                case 'transfer':
                    await this.processTicketTransfer(senderIdentity, ticketData);
                    break;
                case 'validate':
                    await this.processTicketValidation(senderIdentity, ticketId);
                    break;
            }
        } catch (error) {
            console.error('Error handling ticket message:', error);
        }
    }

    /**
     * Handle estadia (room access) messages
     */
    async handleEstadiaMessage(messageId, content, senderIdentity) {
        try {
            const estadiaData = JSON.parse(content);
            const { action, estadiaId, accessType } = estadiaData;
            
            switch (action) {
                case 'request_access':
                    await this.processEstadiaAccessRequest(senderIdentity, estadiaId, accessType);
                    break;
                case 'grant_access':
                    await this.processEstadiaAccessGrant(senderIdentity, estadiaData);
                    break;
                case 'log_entry':
                    await this.logEstadiaEntry(senderIdentity, estadiaId, 'entry');
                    break;
                case 'log_exit':
                    await this.logEstadiaExit(senderIdentity, estadiaId, 'exit');
                    break;
            }
        } catch (error) {
            console.error('Error handling estadia message:', error);
        }
    }

    /**
     * Process ticket scan via mesh network
     */
    async processTicketScan(senderIdentity, ticketId, qrPayload) {
        try {
            // Validate ticket
            const ticket = await this.db.get(
                'SELECT * FROM tickets WHERE id = ? AND status = "active"',
                [ticketId]
            );
            
            if (!ticket) {
                await this.sendSystemMessage(senderIdentity, 'Ticket not found or invalid');
                return;
            }
            
            // Check if ticket is valid for current time
            const now = new Date();
            if (now < new Date(ticket.valid_from) || now > new Date(ticket.valid_to)) {
                await this.sendSystemMessage(senderIdentity, 'Ticket is not valid at this time');
                return;
            }
            
            // Log the scan
            await this.db.run(
                `INSERT INTO estadia_access_logs 
                 (id, estadia_id, user_id, access_type, timestamp, mesh_identity_id, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    crypto.randomUUID(), null, ticket.user_id, 'ticket_scan',
                    new Date().toISOString(), senderIdentity.id, `Ticket scanned via mesh: ${ticketId}`
                ]
            );
            
            await this.sendSystemMessage(senderIdentity, `Ticket ${ticketId} validated successfully`);
            
        } catch (error) {
            console.error('Error processing ticket scan:', error);
        }
    }

    /**
     * Process estadia access request
     */
    async processEstadiaAccessRequest(senderIdentity, estadiaId, accessType) {
        try {
            // Check if user has access to this estadia
            const access = await this.db.get(
                `SELECT ea.*, e.name as estadia_name 
                 FROM estadia_access ea
                 JOIN estadias e ON ea.estadia_id = e.id
                 WHERE ea.user_id = ? AND ea.estadia_id = ? AND ea.is_active = 1
                 AND (ea.expires_at IS NULL OR ea.expires_at > CURRENT_TIMESTAMP)`,
                [senderIdentity.user_id, estadiaId]
            );
            
            if (!access) {
                await this.sendSystemMessage(senderIdentity, 'Access denied: No permission for this area');
                return;
            }
            
            // Log the access request
            await this.logEstadiaEntry(senderIdentity, estadiaId, 'entry');
            
            await this.sendSystemMessage(senderIdentity, `Access granted to ${access.estadia_name}`);
            
        } catch (error) {
            console.error('Error processing estadia access request:', error);
        }
    }

    /**
     * Log estadia entry/exit
     */
    async logEstadiaEntry(senderIdentity, estadiaId, accessType) {
        try {
            await this.db.run(
                `INSERT INTO estadia_access_logs 
                 (id, estadia_id, user_id, access_type, timestamp, mesh_identity_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    crypto.randomUUID(), estadiaId, senderIdentity.user_id,
                    accessType, new Date().toISOString(), senderIdentity.id
                ]
            );
        } catch (error) {
            console.error('Error logging estadia access:', error);
        }
    }

    /**
     * Sync mesh message to main chat system when online
     */
    async syncToMainChat(messageId, senderIdentity, roomId, content) {
        try {
            // Check if room exists in main chat system
            const room = await this.db.get(
                'SELECT * FROM chat_rooms WHERE id = ?',
                [roomId]
            );
            
            if (!room) {
                return; // Room doesn't exist in main system
            }
            
            // Create message in main chat system
            const mainMessageId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO chat_messages 
                 (id, room_id, sender_id, text, timestamp)
                 VALUES (?, ?, ?, ?, ?)`,
                [mainMessageId, roomId, senderIdentity.user_id, content, new Date().toISOString()]
            );
            
            // Queue for offline sync
            await this.queueForSync(senderIdentity.user_id, 'message', {
                meshMessageId: messageId,
                mainMessageId: mainMessageId,
                roomId: roomId,
                content: content
            });
            
        } catch (error) {
            console.error('Error syncing to main chat:', error);
        }
    }

    /**
     * Send system message to mesh identity
     */
    async sendSystemMessage(recipientIdentity, message) {
        try {
            const messageId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO mesh_messages 
                 (id, sender_identity_id, recipient_identity_id, message_type, content, is_private, ttl)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    messageId, null, recipientIdentity.id, this.MESSAGE_TYPES.SYSTEM,
                    message, true, this.MAX_TTL
                ]
            );
            
            this.emit('systemMessageSent', { messageId, recipientIdentity, message });
        } catch (error) {
            console.error('Error sending system message:', error);
        }
    }

    /**
     * Send delivery acknowledgment
     */
    async sendDeliveryAck(senderIdentity, recipientIdentity, originalMessageId) {
        try {
            const ackId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO mesh_messages 
                 (id, sender_identity_id, recipient_identity_id, message_type, content, is_private, ttl)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    ackId, recipientIdentity.id, senderIdentity.id, this.MESSAGE_TYPES.DELIVERY_ACK,
                    JSON.stringify({ originalMessageId }), true, this.MAX_TTL
                ]
            );
        } catch (error) {
            console.error('Error sending delivery ack:', error);
        }
    }

    /**
     * Queue data for offline synchronization
     */
    async queueForSync(userId, syncType, data, priority = 5) {
        try {
            const queueId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO offline_sync_queue 
                 (id, user_id, sync_type, data, priority)
                 VALUES (?, ?, ?, ?, ?)`,
                [queueId, userId, syncType, JSON.stringify(data), priority]
            );
        } catch (error) {
            console.error('Error queuing for sync:', error);
        }
    }

    /**
     * Get mesh identity by fingerprint
     */
    async getMeshIdentityByFingerprint(fingerprint) {
        if (this.peerCache.has(fingerprint)) {
            return this.peerCache.get(fingerprint);
        }
        
        const identity = await this.db.get(
            'SELECT * FROM mesh_identities WHERE fingerprint = ? AND is_active = 1',
            [fingerprint]
        );
        
        if (identity) {
            this.peerCache.set(fingerprint, identity);
        }
        
        return identity;
    }

    /**
     * Get mesh rooms for a festival
     */
    async getMeshRooms(festivalId) {
        return await this.db.all(
            'SELECT * FROM mesh_rooms WHERE festival_id = ? AND is_active = 1 ORDER BY name',
            [festivalId]
        );
    }

    /**
     * Get estadias for a festival
     */
    async getEstadias(festivalId) {
        return await this.db.all(
            'SELECT * FROM estadias WHERE festival_id = ? AND is_active = 1 ORDER BY name',
            [festivalId]
        );
    }

    /**
     * Get user's estadia access
     */
    async getUserEstadiaAccess(userId) {
        return await this.db.all(
            `SELECT ea.*, e.name as estadia_name, e.type as estadia_type, e.location
             FROM estadia_access ea
             JOIN estadias e ON ea.estadia_id = e.id
             WHERE ea.user_id = ? AND ea.is_active = 1
             AND (ea.expires_at IS NULL OR ea.expires_at > CURRENT_TIMESTAMP)
             ORDER BY e.name`,
            [userId]
        );
    }

    /**
     * Start cleanup intervals
     */
    startCleanupIntervals() {
        // Clean up expired sessions every 5 minutes
        setInterval(async () => {
            try {
                await this.db.run(
                    'UPDATE mesh_sessions SET is_active = 0 WHERE expires_at < CURRENT_TIMESTAMP'
                );
                
                // Clear peer cache periodically
                this.peerCache.clear();
                
            } catch (error) {
                console.error('Error in cleanup interval:', error);
            }
        }, 5 * 60 * 1000);
        
        // Process sync queue every minute
        setInterval(async () => {
            if (this.isOnline) {
                await this.processSyncQueue();
            }
        }, 60 * 1000);
    }

    /**
     * Process offline sync queue
     */
    async processSyncQueue() {
        try {
            const pendingItems = await this.db.all(
                `SELECT * FROM offline_sync_queue 
                 WHERE is_processed = 0 AND attempt_count < max_attempts
                 ORDER BY priority DESC, created_at ASC
                 LIMIT 100`
            );
            
            for (const item of pendingItems) {
                try {
                    await this.processSyncItem(item);
                    
                    await this.db.run(
                        'UPDATE offline_sync_queue SET is_processed = 1, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [item.id]
                    );
                    
                } catch (error) {
                    console.error(`Error processing sync item ${item.id}:`, error);
                    
                    await this.db.run(
                        `UPDATE offline_sync_queue 
                         SET attempt_count = attempt_count + 1, last_attempt = CURRENT_TIMESTAMP, error_message = ?
                         WHERE id = ?`,
                        [error.message, item.id]
                    );
                }
            }
        } catch (error) {
            console.error('Error processing sync queue:', error);
        }
    }

    /**
     * Process individual sync item
     */
    async processSyncItem(item) {
        const data = JSON.parse(item.data);
        
        switch (item.sync_type) {
            case 'message':
                // Message already synced, just mark as processed
                break;
            case 'presence':
                await this.syncUserPresence(data);
                break;
            case 'access_log':
                await this.syncAccessLog(data);
                break;
            case 'ticket_scan':
                await this.syncTicketScan(data);
                break;
            case 'estadia_access':
                await this.syncEstadiaAccess(data);
                break;
        }
    }

    /**
     * Set online/offline status
     */
    setOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        this.emit('onlineStatusChanged', isOnline);
        
        if (isOnline) {
            // Process sync queue when coming online
            this.processSyncQueue();
        }
    }

    /**
     * Get mesh network statistics
     */
    async getMeshNetworkStats(festivalId, date = new Date().toISOString().split('T')[0]) {
        const stats = await this.db.get(
            'SELECT * FROM mesh_network_stats WHERE festival_id = ? AND date = ?',
            [festivalId, date]
        );
        
        if (!stats) {
            // Create new stats record
            const statsId = crypto.randomUUID();
            await this.db.run(
                `INSERT INTO mesh_network_stats 
                 (id, festival_id, date, total_peers, active_sessions, messages_sent, messages_received)
                 VALUES (?, ?, ?, 0, 0, 0, 0)`,
                [statsId, festivalId, date]
            );
            
            return await this.db.get(
                'SELECT * FROM mesh_network_stats WHERE id = ?',
                [statsId]
            );
        }
        
        return stats;
    }

    // Simple CRUD methods for testing
    async upsertPeer(peerData) {
        const { id, noise_public_key, signing_public_key, nickname, is_connected = false, is_reachable = false, metadata = {} } = peerData;

        if (!id || !noise_public_key || !signing_public_key || !nickname) {
            throw new Error('Missing required peer data for upsert');
        }

        const existingPeer = await this.db.get('SELECT * FROM mesh_peers WHERE id = ?', [id]);

        if (existingPeer) {
            await this.db.run(
                `UPDATE mesh_peers SET
                    noise_public_key = ?,
                    signing_public_key = ?,
                    nickname = ?,
                    last_seen = CURRENT_TIMESTAMP,
                    is_connected = ?,
                    is_reachable = ?,
                    metadata = ?
                WHERE id = ?`,
                [noise_public_key, signing_public_key, nickname, is_connected, is_reachable, JSON.stringify(metadata), id]
            );
        } else {
            await this.db.run(
                `INSERT INTO mesh_peers (id, noise_public_key, signing_public_key, nickname, is_connected, is_reachable, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, noise_public_key, signing_public_key, nickname, is_connected, is_reachable, JSON.stringify(metadata)]
            );
        }
        return this.getPeerById(id);
    }

    async getPeerById(peerId) {
        const peer = await this.db.get('SELECT * FROM mesh_peers WHERE id = ?', [peerId]);
        if (peer) {
            // Convert SQLite integers to booleans
            peer.is_connected = Boolean(peer.is_connected);
            peer.is_reachable = Boolean(peer.is_reachable);
            peer.is_favorite = Boolean(peer.is_favorite);
            peer.is_blocked = Boolean(peer.is_blocked);
            peer.is_verified = Boolean(peer.is_verified);
            if (peer.metadata) {
                peer.metadata = JSON.parse(peer.metadata);
            }
        }
        return peer;
    }

    async getAllPeers() {
        const peers = await this.db.all('SELECT * FROM mesh_peers');
        return peers.map(peer => {
            // Convert SQLite integers to booleans
            peer.is_connected = Boolean(peer.is_connected);
            peer.is_reachable = Boolean(peer.is_reachable);
            peer.is_favorite = Boolean(peer.is_favorite);
            peer.is_blocked = Boolean(peer.is_blocked);
            peer.is_verified = Boolean(peer.is_verified);
            if (peer.metadata) {
                peer.metadata = JSON.parse(peer.metadata);
            }
            return peer;
        });
    }

    async storeMeshMessage(messageData) {
        const { sender_id, recipient_id = null, content, is_private = false, is_encrypted = false, delivery_status = 'pending', metadata = {} } = messageData;
        const id = require('uuid').v4();

        if (!sender_id || !content) {
            throw new Error('Missing required message data for storage');
        }

        await this.db.run(
            `INSERT INTO mesh_messages (id, sender_id, recipient_id, content, is_private, is_encrypted, delivery_status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, sender_id, recipient_id, content, is_private, is_encrypted, delivery_status, JSON.stringify(metadata)]
        );
        return this.getMeshMessageById(id);
    }

    async getMeshMessageById(messageId) {
        const message = await this.db.get('SELECT * FROM mesh_messages WHERE id = ?', [messageId]);
        if (message) {
            // Convert SQLite integers to booleans
            message.is_private = Boolean(message.is_private);
            message.is_encrypted = Boolean(message.is_encrypted);
            if (message.metadata) {
                message.metadata = JSON.parse(message.metadata);
            }
        }
        return message;
    }

    async getMessagesForPeer(peerId, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const messages = await this.db.all(
            `SELECT * FROM mesh_messages
            WHERE sender_id = ? OR recipient_id = ?
            ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            [peerId, peerId, limit, offset]
        );
        return messages.map(message => {
            // Convert SQLite integers to booleans
            message.is_private = Boolean(message.is_private);
            message.is_encrypted = Boolean(message.is_encrypted);
            if (message.metadata) {
                message.metadata = JSON.parse(message.metadata);
            }
            return message;
        });
    }

    async updateMessageDeliveryStatus(messageId, status) {
        await this.db.run('UPDATE mesh_messages SET delivery_status = ? WHERE id = ?', [status, messageId]);
    }

    async generateUserIdentity(userId) {
        const cryptoUtils = require('../utils/cryptoUtils');
        const noiseKeyPair = cryptoUtils.generateNoiseKeyPair();
        const signingKeyPair = cryptoUtils.generateSigningKeyPair();
        const fingerprint = cryptoUtils.deriveFingerprint(noiseKeyPair.publicKey);

        return {
            userId,
            noisePublicKey: noiseKeyPair.publicKey,
            signingPublicKey: signingKeyPair.publicKey,
            fingerprint: fingerprint
        };
    }
}

module.exports = new MeshNetworkService();
