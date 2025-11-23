const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const database = require('../database/database');

class SecureQRService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.tagLength = 16; // 128 bits
        this.hmacAlgorithm = 'sha256';
        this.qrExpirationHours = 24; // QR codes expire in 24 hours
    }

    /**
     * Generate or retrieve encryption key for QR codes
     * @param {string} keyType - Type of encryption key
     * @returns {Promise<Buffer>} Encryption key
     */
    async getEncryptionKey(keyType = 'qr_encryption') {
        try {
            // Try to get active key from database
            const keyRecord = await database.get(
                'SELECT * FROM encryption_keys WHERE key_type = ? AND is_active = 1 ORDER BY key_version DESC LIMIT 1',
                [keyType]
            );

            if (keyRecord) {
                // Decrypt the key using master key from environment
                const masterKey = process.env.MASTER_ENCRYPTION_KEY || this.generateMasterKey();
                const decipher = crypto.createDecipher('aes-256-cbc', masterKey);
                let decryptedKey = decipher.update(keyRecord.key_data, 'hex', 'utf8');
                decryptedKey += decipher.final('utf8');
                return Buffer.from(decryptedKey, 'hex');
            }

            // Generate new key if none exists
            return await this.generateNewEncryptionKey(keyType);
        } catch (error) {
            console.error('Error getting encryption key:', error);
            throw new Error('Failed to get encryption key');
        }
    }

    /**
     * Generate a new encryption key and store it
     * @param {string} keyType - Type of encryption key
     * @returns {Promise<Buffer>} New encryption key
     */
    async generateNewEncryptionKey(keyType) {
        try {
            const keyId = uuidv4();
            const keyVersion = await this.getNextKeyVersion(keyType);
            const key = crypto.randomBytes(this.keyLength);

            // Encrypt the key with master key
            const masterKey = process.env.MASTER_ENCRYPTION_KEY || this.generateMasterKey();
            const cipher = crypto.createCipher('aes-256-cbc', masterKey);
            let encryptedKey = cipher.update(key.toString('hex'), 'utf8', 'hex');
            encryptedKey += cipher.final('hex');

            // Store encrypted key in database
            await database.run(
                'INSERT INTO encryption_keys (id, key_type, key_data, key_version) VALUES (?, ?, ?, ?)',
                [keyId, keyType, encryptedKey, keyVersion]
            );

            console.log(`Generated new encryption key for ${keyType}, version ${keyVersion}`);
            return key;
        } catch (error) {
            console.error('Error generating new encryption key:', error);
            throw new Error('Failed to generate encryption key');
        }
    }

    /**
     * Get next key version number
     * @param {string} keyType - Type of encryption key
     * @returns {Promise<number>} Next version number
     */
    async getNextKeyVersion(keyType) {
        const result = await database.get(
            'SELECT MAX(key_version) as max_version FROM encryption_keys WHERE key_type = ?',
            [keyType]
        );
        return (result?.max_version || 0) + 1;
    }

    /**
     * Generate master encryption key if not set
     * @returns {string} Master encryption key
     */
    generateMasterKey() {
        if (!process.env.MASTER_ENCRYPTION_KEY) {
            console.warn('MASTER_ENCRYPTION_KEY not set, generating temporary key');
            return crypto.randomBytes(32).toString('hex');
        }
        return process.env.MASTER_ENCRYPTION_KEY;
    }

    /**
     * Generate secure QR payload for ticket
     * @param {string} ticketId - Ticket ID
     * @param {Object} ticketData - Ticket data to encrypt
     * @returns {Promise<Object>} Secure QR data
     */
    async generateSecureQRPayload(ticketId, ticketData) {
        try {
            const qrId = uuidv4();
            const encryptionKey = await this.getEncryptionKey('qr_encryption');
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipher(this.algorithm, encryptionKey);
            cipher.setAAD(Buffer.from(ticketId, 'utf8'));

            // Encrypt ticket data
            let encryptedData = cipher.update(JSON.stringify(ticketData), 'utf8', 'hex');
            encryptedData += cipher.final('hex');
            const tag = cipher.getAuthTag();

            // Generate HMAC signature
            const hmac = crypto.createHmac(this.hmacAlgorithm, encryptionKey);
            hmac.update(encryptedData);
            hmac.update(iv);
            hmac.update(tag);
            const signature = hmac.digest('hex');

            // Generate QR payload
            const qrPayload = `${ticketId.substring(0, 8).toUpperCase()}-${qrId.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

            // Calculate expiration time
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + this.qrExpirationHours);

            // Store secure QR data
            await database.run(`
                INSERT INTO secure_qr_codes (
                    id, ticket_id, qr_payload, encrypted_data, signature, nonce, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                qrId, ticketId, qrPayload, encryptedData, signature, iv.toString('hex'), expiresAt.toISOString()
            ]);

            return {
                qrId,
                qrPayload,
                expiresAt: expiresAt.toISOString(),
                encryptedData,
                signature,
                nonce: iv.toString('hex')
            };
        } catch (error) {
            console.error('Error generating secure QR payload:', error);
            throw new Error('Failed to generate secure QR payload');
        }
    }

    /**
     * Validate secure QR payload
     * @param {string} qrPayload - QR payload to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateSecureQRPayload(qrPayload) {
        try {
            // Get secure QR data
            const qrData = await database.get(
                'SELECT * FROM secure_qr_codes WHERE qr_payload = ?',
                [qrPayload]
            );

            if (!qrData) {
                return {
                    valid: false,
                    message: 'QR code not found',
                    code: 'QR_NOT_FOUND'
                };
            }

            // Check if already used
            if (qrData.is_used) {
                return {
                    valid: false,
                    message: 'QR code already used',
                    code: 'QR_ALREADY_USED',
                    usedAt: qrData.used_at
                };
            }

            // Check expiration
            const now = new Date();
            const expiresAt = new Date(qrData.expires_at);
            if (now > expiresAt) {
                return {
                    valid: false,
                    message: 'QR code expired',
                    code: 'QR_EXPIRED',
                    expiredAt: qrData.expires_at
                };
            }

            // Get encryption key
            const encryptionKey = await this.getEncryptionKey('qr_encryption');
            const iv = Buffer.from(qrData.nonce, 'hex');

            // Verify HMAC signature
            const hmac = crypto.createHmac(this.hmacAlgorithm, encryptionKey);
            hmac.update(qrData.encrypted_data);
            hmac.update(iv);
            hmac.update(Buffer.from(qrData.signature, 'hex'));
            const expectedSignature = hmac.digest('hex');

            if (expectedSignature !== qrData.signature) {
                return {
                    valid: false,
                    message: 'QR code signature invalid',
                    code: 'QR_INVALID_SIGNATURE'
                };
            }

            // Decrypt ticket data
            const decipher = crypto.createDecipher(this.algorithm, encryptionKey);
            decipher.setAAD(Buffer.from(qrData.ticket_id, 'utf8'));
            decipher.setAuthTag(Buffer.from(qrData.signature, 'hex'));

            let decryptedData = decipher.update(qrData.encrypted_data, 'hex', 'utf8');
            decryptedData += decipher.final('utf8');

            const ticketData = JSON.parse(decryptedData);

            return {
                valid: true,
                message: 'QR code is valid',
                code: 'QR_VALID',
                ticketData,
                qrId: qrData.id,
                ticketId: qrData.ticket_id
            };
        } catch (error) {
            console.error('Error validating secure QR payload:', error);
            return {
                valid: false,
                message: 'QR code validation failed',
                code: 'QR_VALIDATION_ERROR'
            };
        }
    }

    /**
     * Mark QR code as used
     * @param {string} qrPayload - QR payload to mark as used
     * @param {string} validatorId - ID of validator
     * @param {string} location - Location of validation
     * @returns {Promise<Object>} Result
     */
    async markQRAsUsed(qrPayload, validatorId = null, location = null) {
        try {
            const result = await database.run(`
                UPDATE secure_qr_codes 
                SET is_used = 1, used_at = CURRENT_TIMESTAMP 
                WHERE qr_payload = ? AND is_used = 0
            `, [qrPayload]);

            if (result.changes === 0) {
                return {
                    success: false,
                    message: 'QR code not found or already used'
                };
            }

            // Get ticket ID for validation record
            const qrData = await database.get(
                'SELECT ticket_id FROM secure_qr_codes WHERE qr_payload = ?',
                [qrPayload]
            );

            // Create validation record
            const validationId = uuidv4();
            await database.run(`
                INSERT INTO ticket_validations (
                    id, ticket_id, qr_payload, validated_at, validator_id, location, validation_method
                ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'qr_only')
            `, [validationId, qrData.ticket_id, qrPayload, validatorId, location]);

            return {
                success: true,
                message: 'QR code marked as used',
                validationId
            };
        } catch (error) {
            console.error('Error marking QR as used:', error);
            throw new Error('Failed to mark QR as used');
        }
    }

    /**
     * Generate dynamic QR code with time-based rotation
     * @param {string} ticketId - Ticket ID
     * @param {Object} ticketData - Ticket data
     * @param {number} rotationInterval - Rotation interval in seconds
     * @returns {Promise<Object>} Dynamic QR data
     */
    async generateDynamicQR(ticketId, ticketData, rotationInterval = 30) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const timeSlot = Math.floor(now / rotationInterval);
            
            // Add time-based data to ticket data
            const dynamicTicketData = {
                ...ticketData,
                timeSlot,
                rotationInterval,
                generatedAt: now
            };

            return await this.generateSecureQRPayload(ticketId, dynamicTicketData);
        } catch (error) {
            console.error('Error generating dynamic QR:', error);
            throw new Error('Failed to generate dynamic QR');
        }
    }

    /**
     * Clean up expired QR codes
     * @returns {Promise<number>} Number of cleaned up codes
     */
    async cleanupExpiredQRCodes() {
        try {
            const result = await database.run(`
                DELETE FROM secure_qr_codes 
                WHERE expires_at < CURRENT_TIMESTAMP AND is_used = 0
            `);

            console.log(`Cleaned up ${result.changes} expired QR codes`);
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired QR codes:', error);
            throw new Error('Failed to cleanup expired QR codes');
        }
    }

    /**
     * Get QR code statistics
     * @returns {Promise<Object>} QR code statistics
     */
    async getQRStatistics() {
        try {
            const stats = await database.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used,
                    SUM(CASE WHEN is_used = 0 AND expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN is_used = 0 AND expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as expired
                FROM secure_qr_codes
            `);

            return {
                total: stats.total || 0,
                used: stats.used || 0,
                active: stats.active || 0,
                expired: stats.expired || 0
            };
        } catch (error) {
            console.error('Error getting QR statistics:', error);
            throw new Error('Failed to get QR statistics');
        }
    }
}

module.exports = new SecureQRService();




