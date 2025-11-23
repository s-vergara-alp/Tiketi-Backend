const { v4: uuidv4 } = require('uuid');
const database = require('../database/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');
const secureQRService = require('./SecureQRService');
const bleService = require('./BLEService');
const biometricService = require('./BiometricService');

class TicketService {
    /**
     * Purchase a ticket for a user
     * @param {string} userId - User ID
     * @param {string} festivalId - Festival ID
     * @param {string} templateId - Ticket template ID
     * @param {string} holderName - Name of ticket holder
     * @param {Object} options - Additional options
     * @param {Object} db - Optional database transaction instance
     * @returns {Promise<Object>} Created ticket
     */
    async purchaseTicket(userId, festivalId, templateId, holderName, options = {}, db = null) {
        const executePurchase = async (databaseInstance) => {
            // Validate festival exists and is active
            const festival = await databaseInstance.get(
                'SELECT id, name, start_date, end_date FROM festivals WHERE id = ? AND is_active = 1',
                [festivalId]
            );
            if (!festival) {
                throw new NotFoundError('Festival not found or inactive');
            }

            // Validate template exists and is available
            const template = await databaseInstance.get(
                'SELECT * FROM ticket_templates WHERE id = ? AND festival_id = ? AND is_available = 1',
                [templateId, festivalId]
            );
            if (!template) {
                throw new NotFoundError('Ticket template not found or unavailable');
            }

            // Check availability
            if (template.max_quantity && template.current_quantity >= template.max_quantity) {
                throw new BusinessLogicError('This ticket type is sold out');
            }

            // Check if user already has this type of ticket (optional business rule)
            if (options.preventDuplicate) {
                const existingTicket = await databaseInstance.get(
                    'SELECT id FROM tickets WHERE user_id = ? AND template_id = ? AND status = "active"',
                    [userId, templateId]
                );
                if (existingTicket) {
                    throw new BusinessLogicError('You already have an active ticket of this type');
                }
            }

            // Generate unique ticket ID
            const ticketId = uuidv4();
            
            // Create ticket data for secure QR
            const ticketData = {
                ticketId,
                userId,
                festivalId,
                templateId,
                holderName,
                tier: template.name,
                validFrom: festival.start_date,
                validTo: festival.end_date,
                price: template.price,
                purchaseDate: new Date().toISOString()
            };

            // Generate secure QR payload
            const secureQRData = await secureQRService.generateSecureQRPayload(ticketId, ticketData);
            const qrPayload = secureQRData.qrPayload;

            // Create ticket
            const result = await databaseInstance.run(`
                INSERT INTO tickets (
                    id, user_id, festival_id, template_id, qr_payload, 
                    holder_name, tier, valid_from, valid_to, price,
                    transaction_id, seat_info
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                ticketId, userId, festivalId, templateId, qrPayload,
                holderName, template.name, festival.start_date, festival.end_date, template.price,
                options.transactionId || null, options.seatInfo || null
            ]);

            if (result.changes === 0) {
                throw new Error('Failed to create ticket');
            }

            // Update template quantity
            await databaseInstance.run(
                'UPDATE ticket_templates SET current_quantity = current_quantity + 1 WHERE id = ?',
                [templateId]
            );

            // Return created ticket
            return await this.getTicketById(ticketId, userId);
        };

        // If a database transaction is provided, use it; otherwise create a new one
        if (db) {
            return await executePurchase(db);
        } else {
            return await database.transaction(executePurchase);
        }
    }

    /**
     * Get ticket by ID with validation
     * @param {string} ticketId - Ticket ID
     * @param {string} userId - User ID (for ownership validation)
     * @returns {Promise<Object>} Ticket details
     */
    async getTicketById(ticketId, userId) {
        const ticket = await database.get(`
            SELECT 
                t.*,
                f.name as festival_name,
                f.logo as festival_logo,
                f.venue as festival_venue,
                f.start_date as festival_start,
                f.end_date as festival_end,
                tt.name as template_name,
                tt.description as template_description,
                tt.benefits as template_benefits
            FROM tickets t
            JOIN festivals f ON t.festival_id = f.id
            JOIN ticket_templates tt ON t.template_id = tt.id
            WHERE t.id = ? AND t.user_id = ?
        `, [ticketId, userId]);

        if (!ticket) {
            throw new NotFoundError('Ticket not found');
        }

        return this.formatTicket(ticket);
    }

    /**
     * Get all tickets for a user
     * @param {string} userId - User ID
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Array of tickets
     */
    async getUserTickets(userId, filters = {}) {
        let query = `
            SELECT 
                t.*,
                f.name as festival_name,
                f.logo as festival_logo,
                tt.name as template_name,
                tt.description as template_description
            FROM tickets t
            JOIN festivals f ON t.festival_id = f.id
            JOIN ticket_templates tt ON t.template_id = tt.id
            WHERE t.user_id = ?
        `;
        const params = [userId];

        // Apply filters
        if (filters.status) {
            query += ' AND t.status = ?';
            params.push(filters.status);
        }

        if (filters.festivalId) {
            query += ' AND t.festival_id = ?';
            params.push(filters.festivalId);
        }

        query += ' ORDER BY t.purchase_date DESC';

        const tickets = await database.all(query, params);
        return tickets.map(ticket => this.formatTicket(ticket));
    }

    /**
     * Validate ticket for entry with BLE and biometric support
     * @param {string} qrPayload - QR code payload
     * @param {Object} validationOptions - Validation options
     * @param {string} validationOptions.sessionToken - BLE session token (optional)
     * @param {Object} validationOptions.biometricData - Biometric data for verification (optional)
     * @param {string} validationOptions.validatorId - ID of validator (optional)
     * @param {string} validationOptions.location - Location of validation (optional)
     * @returns {Promise<Object>} Validation result
     */
    async validateTicket(qrPayload, validationOptions = {}) {
        try {
            // Validate secure QR payload
            const qrValidation = await secureQRService.validateSecureQRPayload(qrPayload);
            
            if (!qrValidation.valid) {
                return qrValidation;
            }

            const { ticketData, ticketId } = qrValidation;
            const now = new Date();
            const festivalStart = new Date(ticketData.validFrom);
            const festivalEnd = new Date(ticketData.validTo);

            // Get full ticket data from database
            const ticket = await database.get(`
                SELECT 
                    t.*,
                    f.name as festival_name,
                    f.start_date as festival_start,
                    f.end_date as festival_end,
                    f.ble_enabled,
                    f.biometric_enabled
                FROM tickets t
                JOIN festivals f ON t.festival_id = f.id
                WHERE t.id = ?
            `, [ticketId]);

            if (!ticket) {
                return {
                    valid: false,
                    message: 'Ticket not found in database',
                    code: 'TICKET_NOT_FOUND'
                };
            }

            // Check ticket status
            if (ticket.status !== 'active') {
                return {
                    valid: false,
                    message: `Ticket is ${ticket.status}`,
                    code: 'TICKET_INVALID_STATUS',
                    ticket: this.formatTicketForValidation(ticket)
                };
            }

            // Check festival timing
            if (now < festivalStart) {
                return {
                    valid: false,
                    message: 'Festival has not started yet',
                    code: 'FESTIVAL_NOT_STARTED',
                    ticket: this.formatTicketForValidation(ticket),
                    festivalStart: ticket.festival_start
                };
            }

            if (now > festivalEnd) {
                return {
                    valid: false,
                    message: 'Festival has ended',
                    code: 'FESTIVAL_ENDED',
                    ticket: this.formatTicketForValidation(ticket),
                    festivalEnd: ticket.festival_end
                };
            }

            // Validate BLE session if required
            let bleValidation = { valid: true };
            if (ticket.ble_validation_required && ticket.ble_enabled) {
                if (!validationOptions.sessionToken) {
                    return {
                        valid: false,
                        message: 'BLE session token required for validation',
                        code: 'BLE_SESSION_REQUIRED'
                    };
                }

                bleValidation = await bleService.validateSession(validationOptions.sessionToken);
                if (!bleValidation.valid) {
                    return {
                        valid: false,
                        message: 'BLE session validation failed',
                        code: 'BLE_VALIDATION_FAILED',
                        bleError: bleValidation.message
                    };
                }
            }

            // Validate biometric if required
            let biometricValidation = { verified: true };
            if (ticket.biometric_required && ticket.biometric_enabled) {
                if (!validationOptions.biometricData) {
                    return {
                        valid: false,
                        message: 'Biometric verification required',
                        code: 'BIOMETRIC_REQUIRED'
                    };
                }

                biometricValidation = await biometricService.verifyBiometric(
                    ticket.user_id,
                    validationOptions.biometricData.type,
                    validationOptions.biometricData.template,
                    bleValidation.sessionId,
                    {
                        ipAddress: validationOptions.ipAddress,
                        userAgent: validationOptions.userAgent
                    }
                );

                if (!biometricValidation.verified) {
                    return {
                        valid: false,
                        message: 'Biometric verification failed',
                        code: 'BIOMETRIC_VERIFICATION_FAILED',
                        confidenceScore: biometricValidation.confidenceScore
                    };
                }
            }

            // Mark ticket as used
            await database.run(
                'UPDATE tickets SET status = "used", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [ticket.id]
            );

            // Mark QR as used
            await secureQRService.markQRAsUsed(
                qrPayload,
                validationOptions.validatorId,
                validationOptions.location
            );

            // Determine validation method
            let validationMethod = 'qr_only';
            if (ticket.ble_validation_required && bleValidation.valid) {
                validationMethod = 'qr_ble';
            }
            if (ticket.biometric_required && biometricValidation.verified) {
                validationMethod = validationMethod === 'qr_ble' ? 'qr_ble_biometric' : 'qr_biometric';
            }

            // Create validation record
            const validationId = uuidv4();
            await database.run(`
                INSERT INTO ticket_validations (
                    id, ticket_id, qr_payload, validated_at, status, validator_id,
                    beacon_id, location, biometric_verified, biometric_confidence,
                    validation_method, device_info
                ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'used', ?, ?, ?, ?, ?, ?, ?)
            `, [
                validationId, ticket.id, qrPayload, validationOptions.validatorId,
                bleValidation.beaconId, validationOptions.location,
                biometricValidation.verified ? 1 : 0, biometricValidation.confidenceScore || 0,
                validationMethod, JSON.stringify({
                    bleSessionId: bleValidation.sessionId,
                    biometricType: validationOptions.biometricData?.type,
                    deviceInfo: validationOptions.deviceInfo
                })
            ]);

            return {
                valid: true,
                message: 'Ticket is valid',
                code: 'TICKET_VALID',
                ticket: {
                    ...this.formatTicketForValidation(ticket),
                    status: 'used'
                },
                validation: {
                    method: validationMethod,
                    bleValidated: bleValidation.valid,
                    biometricVerified: biometricValidation.verified,
                    confidenceScore: biometricValidation.confidenceScore,
                    validationId
                }
            };
        } catch (error) {
            console.error('Error validating ticket:', error);
            return {
                valid: false,
                message: 'Ticket validation failed',
                code: 'VALIDATION_ERROR',
                error: error.message
            };
        }
    }

    /**
     * Transfer ticket to another holder
     * @param {string} ticketId - Ticket ID
     * @param {string} userId - Current user ID
     * @param {string} newHolderName - New holder name
     * @returns {Promise<Object>} Transfer result
     */
    async transferTicket(ticketId, userId, newHolderName) {
        return await database.transaction(async (db) => {
            // Check if ticket exists and belongs to user
            const ticket = await db.get(
                'SELECT * FROM tickets WHERE id = ? AND user_id = ? AND status = "active"',
                [ticketId, userId]
            );
            if (!ticket) {
                throw new NotFoundError('Ticket not found or not transferable');
            }

            // Update ticket holder
            const result = await db.run(
                'UPDATE tickets SET holder_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newHolderName, ticketId]
            );

            if (result.changes === 0) {
                throw new Error('Failed to transfer ticket');
            }

            return {
                message: 'Ticket transferred successfully',
                ticketId,
                newHolderName,
                transferredAt: new Date().toISOString()
            };
        });
    }

    /**
     * Cancel ticket
     * @param {string} ticketId - Ticket ID
     * @param {string} userId - User ID
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelTicket(ticketId, userId, reason = 'User requested cancellation') {
        return await database.transaction(async (db) => {
            // Check if ticket exists and belongs to user
            const ticket = await db.get(
                'SELECT * FROM tickets WHERE id = ? AND user_id = ? AND status = "active"',
                [ticketId, userId]
            );
            if (!ticket) {
                throw new NotFoundError('Ticket not found or not cancellable');
            }

            // Update ticket status
            const result = await db.run(
                'UPDATE tickets SET status = "cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [ticketId]
            );

            if (result.changes === 0) {
                throw new Error('Failed to cancel ticket');
            }

            // Decrease template quantity
            await db.run(
                'UPDATE ticket_templates SET current_quantity = current_quantity - 1 WHERE id = ?',
                [ticket.template_id]
            );

            return {
                message: 'Ticket cancelled successfully',
                ticketId,
                reason,
                cancelledAt: new Date().toISOString()
            };
        });
    }

    /**
     * Get ticket templates for a festival
     * @param {string} festivalId - Festival ID
     * @returns {Promise<Object>} Festival and templates
     */
    async getTicketTemplates(festivalId) {
        // Check if festival exists
        const festival = await database.get(
            'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
            [festivalId]
        );
        if (!festival) {
            throw new NotFoundError('Festival not found');
        }

        const templates = await database.all(`
            SELECT * FROM ticket_templates 
            WHERE festival_id = ? AND is_available = 1
            ORDER BY price ASC
        `, [festivalId]);

        return {
            festivalId,
            festivalName: festival.name,
            templates: templates.map(template => ({
                ...template,
                benefits: template.benefits ? JSON.parse(template.benefits) : [],
                available: template.max_quantity ? 
                    Math.max(0, template.max_quantity - template.current_quantity) : 
                    null
            }))
        };
    }

    /**
     * Generate QR payload for ticket (legacy method - now uses secure QR)
     * @param {string} festivalId - Festival ID
     * @param {string} templateName - Template name
     * @param {string} ticketId - Ticket ID
     * @returns {string} QR payload
     */
    generateQRPayload(festivalId, templateName, ticketId) {
        return `${festivalId.toUpperCase()}-${templateName.toUpperCase()}-${ticketId.substring(0, 8).toUpperCase()}`;
    }

    /**
     * Start BLE validation session for ticket
     * @param {string} ticketId - Ticket ID
     * @param {string} userId - User ID
     * @param {string} beaconId - BLE beacon ID
     * @param {Object} proximityData - Proximity data
     * @returns {Promise<Object>} BLE session
     */
    async startBLEValidation(ticketId, userId, beaconId, proximityData = {}) {
        try {
            // Verify ticket exists and belongs to user
            const ticket = await database.get(
                'SELECT * FROM tickets WHERE id = ? AND user_id = ? AND status = "active"',
                [ticketId, userId]
            );

            if (!ticket) {
                throw new NotFoundError('Ticket not found or not active');
            }

            // Start BLE validation session
            const session = await bleService.startValidationSession(
                beaconId,
                userId,
                `ticket-${ticketId}`,
                proximityData
            );

            return {
                success: true,
                sessionId: session.sessionId,
                sessionToken: session.sessionToken,
                expiresAt: session.expiresAt,
                beaconId: session.beaconId
            };
        } catch (error) {
            console.error('Error starting BLE validation:', error);
            throw error;
        }
    }

    /**
     * Enroll biometric data for ticket holder
     * @param {string} ticketId - Ticket ID
     * @param {string} userId - User ID
     * @param {string} biometricType - Type of biometric data
     * @param {string} templateData - Biometric template data
     * @param {number} qualityScore - Quality score
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Enrollment result
     */
    async enrollBiometricForTicket(ticketId, userId, biometricType, templateData, qualityScore, metadata = {}) {
        try {
            // Verify ticket exists and belongs to user
            const ticket = await database.get(
                'SELECT * FROM tickets WHERE id = ? AND user_id = ?',
                [ticketId, userId]
            );

            if (!ticket) {
                throw new NotFoundError('Ticket not found');
            }

            // Enroll biometric data
            const result = await biometricService.enrollBiometric(
                userId,
                biometricType,
                templateData,
                qualityScore,
                {
                    ...metadata,
                    ticketId,
                    festivalId: ticket.festival_id
                }
            );

            return result;
        } catch (error) {
            console.error('Error enrolling biometric for ticket:', error);
            throw error;
        }
    }

    /**
     * Get ticket validation requirements
     * @param {string} ticketId - Ticket ID
     * @returns {Promise<Object>} Validation requirements
     */
    async getTicketValidationRequirements(ticketId) {
        try {
            const ticket = await database.get(`
                SELECT 
                    t.*,
                    f.ble_enabled,
                    f.biometric_enabled,
                    f.name as festival_name
                FROM tickets t
                JOIN festivals f ON t.festival_id = f.id
                WHERE t.id = ?
            `, [ticketId]);

            if (!ticket) {
                throw new NotFoundError('Ticket not found');
            }

            return {
                ticketId: ticket.id,
                festivalId: ticket.festival_id,
                festivalName: ticket.festival_name,
                bleRequired: ticket.ble_validation_required && ticket.ble_enabled,
                biometricRequired: ticket.biometric_required && ticket.biometric_enabled,
                validFrom: ticket.valid_from,
                validTo: ticket.valid_to,
                status: ticket.status
            };
        } catch (error) {
            console.error('Error getting ticket validation requirements:', error);
            throw error;
        }
    }

    /**
     * Get ticket validation history
     * @param {string} ticketId - Ticket ID
     * @returns {Promise<Array>} Validation history
     */
    async getTicketValidationHistory(ticketId) {
        try {
            const validations = await database.all(`
                SELECT 
                    tv.*,
                    u.username as validator_name,
                    bb.name as beacon_name,
                    bb.location_name
                FROM ticket_validations tv
                LEFT JOIN users u ON tv.validator_id = u.id
                LEFT JOIN ble_beacons bb ON tv.beacon_id = bb.id
                WHERE tv.ticket_id = ?
                ORDER BY tv.validated_at DESC
            `, [ticketId]);

            return validations.map(validation => ({
                id: validation.id,
                validatedAt: validation.validated_at,
                status: validation.status,
                validatorName: validation.validator_name,
                beaconName: validation.beacon_name,
                location: validation.location,
                biometricVerified: validation.biometric_verified === 1,
                biometricConfidence: validation.biometric_confidence,
                validationMethod: validation.validation_method,
                deviceInfo: validation.device_info ? JSON.parse(validation.device_info) : null
            }));
        } catch (error) {
            console.error('Error getting ticket validation history:', error);
            throw error;
        }
    }

    /**
     * Format ticket for response
     * @param {Object} ticket - Raw ticket data
     * @returns {Object} Formatted ticket
     */
    formatTicket(ticket) {
        return {
            ...ticket,
            festivalName: ticket.festival_name,
            festivalLogo: ticket.festival_logo,
            festivalVenue: ticket.festival_venue,
            festivalStart: ticket.festival_start,
            festivalEnd: ticket.festival_end,
            templateName: ticket.template_name,
            templateDescription: ticket.template_description,
            templateBenefits: ticket.template_benefits ? JSON.parse(ticket.template_benefits) : []
        };
    }

    /**
     * Format ticket for validation response
     * @param {Object} ticket - Raw ticket data
     * @returns {Object} Formatted ticket for validation
     */
    formatTicketForValidation(ticket) {
        return {
            id: ticket.id,
            holderName: ticket.holder_name,
            tier: ticket.tier,
            status: ticket.status,
            festivalName: ticket.festival_name
        };
    }
}

module.exports = new TicketService();

