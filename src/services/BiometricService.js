const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const database = require('../database/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');

class BiometricService {
    constructor() {
        this.supportedTypes = ['face', 'fingerprint', 'voice', 'iris'];
        this.minQualityScore = 0.7; // Minimum quality score for enrollment
        this.verificationThreshold = 0.8; // Threshold for verification
        this.maxEnrollmentAttempts = 3; // Maximum enrollment attempts per type
        this.consentVersion = '1.0'; // Current consent version
    }

    /**
     * Enroll biometric data for a user
     * @param {string} userId - User ID
     * @param {string} biometricType - Type of biometric data
     * @param {string} templateData - Biometric template data
     * @param {number} qualityScore - Quality score of the template
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Enrollment result
     */
    async enrollBiometric(userId, biometricType, templateData, qualityScore, metadata = {}) {
        try {
            // Validate biometric type
            if (!this.supportedTypes.includes(biometricType)) {
                throw new ValidationError(`Unsupported biometric type: ${biometricType}`);
            }

            // Validate quality score
            if (qualityScore < this.minQualityScore) {
                throw new ValidationError(`Biometric quality too low. Minimum required: ${this.minQualityScore}`);
            }

            // Check if user exists and is verified
            const user = await database.get(
                'SELECT id, is_verified, biometric_enrolled FROM users WHERE id = ?',
                [userId]
            );

            if (!user) {
                throw new NotFoundError('User not found');
            }

            if (!user.is_verified) {
                throw new BusinessLogicError('User must be verified before biometric enrollment');
            }

            // Check if user already has this biometric type enrolled
            const existingBiometric = await database.get(
                'SELECT id FROM biometric_data WHERE user_id = ? AND biometric_type = ? AND is_active = 1',
                [userId, biometricType]
            );

            if (existingBiometric) {
                throw new BusinessLogicError(`User already has ${biometricType} biometric enrolled`);
            }

            // Check enrollment attempts
            const attemptCount = await database.get(
                'SELECT COUNT(*) as count FROM biometric_data WHERE user_id = ? AND biometric_type = ?',
                [userId, biometricType]
            );

            if (attemptCount.count >= this.maxEnrollmentAttempts) {
                throw new BusinessLogicError('Maximum enrollment attempts reached for this biometric type');
            }

            // Encrypt biometric template
            const encryptedData = await this.encryptBiometricTemplate(templateData);
            const templateHash = this.generateTemplateHash(templateData);
            const keyId = await this.getEncryptionKeyId('biometric_encryption');

            // Store biometric data
            const biometricId = uuidv4();
            await database.run(`
                INSERT INTO biometric_data (
                    id, user_id, biometric_type, template_data, template_hash,
                    encryption_key_id, quality_score, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                biometricId, userId, biometricType, encryptedData, templateHash,
                keyId, qualityScore, JSON.stringify(metadata)
            ]);

            // Update user biometric enrollment status
            await database.run(
                'UPDATE users SET biometric_enrolled = 1, biometric_consent_at = CURRENT_TIMESTAMP, biometric_consent_version = ? WHERE id = ?',
                [this.consentVersion, userId]
            );

            return {
                success: true,
                message: 'Biometric enrolled successfully',
                biometricId,
                biometricType,
                qualityScore,
                enrolledAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error enrolling biometric:', error);
            throw error;
        }
    }

    /**
     * Verify biometric data
     * @param {string} userId - User ID
     * @param {string} biometricType - Type of biometric data
     * @param {string} templateData - Biometric template data to verify
     * @param {string} sessionId - BLE session ID (optional)
     * @param {Object} requestInfo - Request information (IP, user agent, etc.)
     * @returns {Promise<Object>} Verification result
     */
    async verifyBiometric(userId, biometricType, templateData, sessionId = null, requestInfo = {}) {
        try {
            // Get user's enrolled biometric data
            const biometricData = await database.get(
                'SELECT * FROM biometric_data WHERE user_id = ? AND biometric_type = ? AND is_active = 1',
                [userId, biometricType]
            );

            if (!biometricData) {
                throw new NotFoundError(`No ${biometricType} biometric data found for user`);
            }

            // Decrypt stored template
            const storedTemplate = await this.decryptBiometricTemplate(
                biometricData.template_data,
                biometricData.encryption_key_id
            );

            // Perform biometric matching (simplified - in production, use proper biometric matching algorithms)
            const confidenceScore = await this.performBiometricMatching(templateData, storedTemplate);

            // Determine verification result
            const isVerified = confidenceScore >= this.verificationThreshold;
            const verificationResult = isVerified ? 'success' : 'failure';

            // Log verification attempt
            await this.logVerificationAttempt(
                userId,
                sessionId,
                biometricType,
                verificationResult,
                confidenceScore,
                requestInfo
            );

            // Update last used timestamp
            if (isVerified) {
                await database.run(
                    'UPDATE biometric_data SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [biometricData.id]
                );
            }

            return {
                verified: isVerified,
                confidenceScore,
                biometricType,
                message: isVerified ? 'Biometric verification successful' : 'Biometric verification failed',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error verifying biometric:', error);
            
            // Log failed verification attempt
            await this.logVerificationAttempt(
                userId,
                sessionId,
                biometricType,
                'error',
                0,
                requestInfo
            );

            throw error;
        }
    }

    /**
     * Get user's biometric enrollment status
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Enrollment status
     */
    async getBiometricStatus(userId) {
        try {
            const user = await database.get(
                'SELECT biometric_enrolled, biometric_consent_at, biometric_consent_version FROM users WHERE id = ?',
                [userId]
            );

            if (!user) {
                throw new NotFoundError('User not found');
            }

            const biometricData = await database.all(
                'SELECT biometric_type, quality_score, enrolled_at, last_used_at FROM biometric_data WHERE user_id = ? AND is_active = 1',
                [userId]
            );

            return {
                enrolled: user.biometric_enrolled === 1,
                consentAt: user.biometric_consent_at,
                consentVersion: user.biometric_consent_version,
                enrolledTypes: biometricData.map(data => ({
                    type: data.biometric_type,
                    qualityScore: data.quality_score,
                    enrolledAt: data.enrolled_at,
                    lastUsedAt: data.last_used_at
                }))
            };
        } catch (error) {
            console.error('Error getting biometric status:', error);
            throw error;
        }
    }

    /**
     * Delete biometric data
     * @param {string} userId - User ID
     * @param {string} biometricType - Type of biometric data to delete
     * @returns {Promise<Object>} Deletion result
     */
    async deleteBiometric(userId, biometricType) {
        try {
            const result = await database.run(
                'UPDATE biometric_data SET is_active = 0 WHERE user_id = ? AND biometric_type = ?',
                [userId, biometricType]
            );

            if (result.changes === 0) {
                throw new NotFoundError('Biometric data not found');
            }

            // Check if user has any remaining active biometric data
            const remainingData = await database.get(
                'SELECT COUNT(*) as count FROM biometric_data WHERE user_id = ? AND is_active = 1',
                [userId]
            );

            // Update user enrollment status if no active biometric data
            if (remainingData.count === 0) {
                await database.run(
                    'UPDATE users SET biometric_enrolled = 0 WHERE id = ?',
                    [userId]
                );
            }

            return {
                success: true,
                message: 'Biometric data deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting biometric:', error);
            throw error;
        }
    }

    /**
     * Get biometric verification statistics
     * @param {string} userId - User ID (optional)
     * @param {string} biometricType - Biometric type (optional)
     * @returns {Promise<Object>} Verification statistics
     */
    async getVerificationStatistics(userId = null, biometricType = null) {
        try {
            let query = `
                SELECT 
                    biometric_type,
                    verification_result,
                    COUNT(*) as count,
                    AVG(confidence_score) as avg_confidence
                FROM biometric_verification_attempts
                WHERE 1=1
            `;
            const params = [];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            if (biometricType) {
                query += ' AND biometric_type = ?';
                params.push(biometricType);
            }

            query += ' GROUP BY biometric_type, verification_result';

            const stats = await database.all(query, params);

            return {
                statistics: stats,
                totalAttempts: stats.reduce((sum, stat) => sum + stat.count, 0),
                successRate: this.calculateSuccessRate(stats)
            };
        } catch (error) {
            console.error('Error getting verification statistics:', error);
            throw new Error('Failed to get verification statistics');
        }
    }

    /**
     * Encrypt biometric template
     * @param {string} templateData - Template data to encrypt
     * @returns {Promise<string>} Encrypted template data
     */
    async encryptBiometricTemplate(templateData) {
        try {
            const key = await this.getEncryptionKey('biometric_encryption');
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-gcm', key);
            cipher.setAAD(Buffer.from('biometric-template', 'utf8'));

            let encrypted = cipher.update(templateData, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const tag = cipher.getAuthTag();

            return JSON.stringify({
                data: encrypted,
                iv: iv.toString('hex'),
                tag: tag.toString('hex')
            });
        } catch (error) {
            console.error('Error encrypting biometric template:', error);
            throw new Error('Failed to encrypt biometric template');
        }
    }

    /**
     * Decrypt biometric template
     * @param {string} encryptedData - Encrypted template data
     * @param {string} keyId - Encryption key ID
     * @returns {Promise<string>} Decrypted template data
     */
    async decryptBiometricTemplate(encryptedData, keyId) {
        try {
            const key = await this.getEncryptionKeyById(keyId);
            const { data, iv, tag } = JSON.parse(encryptedData);
            const decipher = crypto.createDecipher('aes-256-gcm', key);
            decipher.setAAD(Buffer.from('biometric-template', 'utf8'));
            decipher.setAuthTag(Buffer.from(tag, 'hex'));

            let decrypted = decipher.update(data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('Error decrypting biometric template:', error);
            throw new Error('Failed to decrypt biometric template');
        }
    }

    /**
     * Generate template hash for integrity verification
     * @param {string} templateData - Template data
     * @returns {string} Template hash
     */
    generateTemplateHash(templateData) {
        return crypto.createHash('sha256').update(templateData).digest('hex');
    }

    /**
     * Perform biometric matching (simplified implementation)
     * @param {string} inputTemplate - Input template
     * @param {string} storedTemplate - Stored template
     * @returns {Promise<number>} Confidence score (0-1)
     */
    async performBiometricMatching(inputTemplate, storedTemplate) {
        // This is a simplified implementation
        // In production, use proper biometric matching algorithms
        // For now, we'll simulate matching based on template similarity
        
        const inputHash = crypto.createHash('sha256').update(inputTemplate).digest('hex');
        const storedHash = crypto.createHash('sha256').update(storedTemplate).digest('hex');
        
        // Calculate similarity (simplified)
        let matches = 0;
        for (let i = 0; i < Math.min(inputHash.length, storedHash.length); i++) {
            if (inputHash[i] === storedHash[i]) {
                matches++;
            }
        }
        
        const similarity = matches / Math.max(inputHash.length, storedHash.length);
        
        // Add some randomness to simulate real biometric matching
        const randomFactor = 0.1 + Math.random() * 0.2; // 0.1 to 0.3
        return Math.min(0.95, similarity + randomFactor);
    }

    /**
     * Log verification attempt
     * @param {string} userId - User ID
     * @param {string} sessionId - Session ID
     * @param {string} biometricType - Biometric type
     * @param {string} result - Verification result
     * @param {number} confidenceScore - Confidence score
     * @param {Object} requestInfo - Request information
     * @returns {Promise<void>}
     */
    async logVerificationAttempt(userId, sessionId, biometricType, result, confidenceScore, requestInfo) {
        try {
            const attemptId = uuidv4();
            await database.run(`
                INSERT INTO biometric_verification_attempts (
                    id, user_id, session_id, biometric_type, verification_result,
                    confidence_score, attempt_data, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                attemptId, userId, sessionId, biometricType, result,
                confidenceScore, JSON.stringify(requestInfo), requestInfo.ipAddress, requestInfo.userAgent
            ]);
        } catch (error) {
            console.error('Error logging verification attempt:', error);
        }
    }

    /**
     * Get encryption key for biometric data
     * @param {string} keyType - Key type
     * @returns {Promise<Buffer>} Encryption key
     */
    async getEncryptionKey(keyType) {
        const keyRecord = await database.get(
            'SELECT * FROM encryption_keys WHERE key_type = ? AND is_active = 1 ORDER BY key_version DESC LIMIT 1',
            [keyType]
        );

        if (!keyRecord) {
            throw new Error('Encryption key not found');
        }

        // Decrypt the key using master key
        const masterKey = process.env.MASTER_ENCRYPTION_KEY || this.generateMasterKey();
        const decipher = crypto.createDecipher('aes-256-cbc', masterKey);
        let decryptedKey = decipher.update(keyRecord.key_data, 'hex', 'utf8');
        decryptedKey += decipher.final('utf8');
        return Buffer.from(decryptedKey, 'hex');
    }

    /**
     * Get encryption key by ID
     * @param {string} keyId - Key ID
     * @returns {Promise<Buffer>} Encryption key
     */
    async getEncryptionKeyById(keyId) {
        const keyRecord = await database.get(
            'SELECT * FROM encryption_keys WHERE id = ?',
            [keyId]
        );

        if (!keyRecord) {
            throw new Error('Encryption key not found');
        }

        const masterKey = process.env.MASTER_ENCRYPTION_KEY || this.generateMasterKey();
        const decipher = crypto.createDecipher('aes-256-cbc', masterKey);
        let decryptedKey = decipher.update(keyRecord.key_data, 'hex', 'utf8');
        decryptedKey += decipher.final('utf8');
        return Buffer.from(decryptedKey, 'hex');
    }

    /**
     * Get encryption key ID
     * @param {string} keyType - Key type
     * @returns {Promise<string>} Key ID
     */
    async getEncryptionKeyId(keyType) {
        const keyRecord = await database.get(
            'SELECT id FROM encryption_keys WHERE key_type = ? AND is_active = 1 ORDER BY key_version DESC LIMIT 1',
            [keyType]
        );

        if (!keyRecord) {
            throw new Error('Encryption key not found');
        }

        return keyRecord.id;
    }

    /**
     * Generate master encryption key
     * @returns {string} Master key
     */
    generateMasterKey() {
        if (!process.env.MASTER_ENCRYPTION_KEY) {
            console.warn('MASTER_ENCRYPTION_KEY not set, generating temporary key');
            return crypto.randomBytes(32).toString('hex');
        }
        return process.env.MASTER_ENCRYPTION_KEY;
    }

    /**
     * Calculate success rate from statistics
     * @param {Array} stats - Statistics array
     * @returns {number} Success rate (0-1)
     */
    calculateSuccessRate(stats) {
        const total = stats.reduce((sum, stat) => sum + stat.count, 0);
        const successful = stats
            .filter(stat => stat.verification_result === 'success')
            .reduce((sum, stat) => sum + stat.count, 0);
        
        return total > 0 ? successful / total : 0;
    }
}

module.exports = new BiometricService();




