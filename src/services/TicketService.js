const { v4: uuidv4 } = require('uuid');
const database = require('../database/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');

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

            // Generate unique ticket ID and QR payload
            const ticketId = uuidv4();
            const qrPayload = this.generateQRPayload(festivalId, template.name, ticketId);

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
     * Validate ticket for entry
     * @param {string} qrPayload - QR code payload
     * @returns {Promise<Object>} Validation result
     */
    async validateTicket(qrPayload) {
        const ticket = await database.get(`
            SELECT 
                t.*,
                f.name as festival_name,
                f.start_date as festival_start,
                f.end_date as festival_end
            FROM tickets t
            JOIN festivals f ON t.festival_id = f.id
            WHERE t.qr_payload = ?
        `, [qrPayload]);

        if (!ticket) {
            return {
                valid: false,
                message: 'Ticket not found',
                code: 'TICKET_NOT_FOUND'
            };
        }

        const now = new Date();
        const festivalStart = new Date(ticket.festival_start);
        const festivalEnd = new Date(ticket.festival_end);

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

        // Mark ticket as used
        await database.run(
            'UPDATE tickets SET status = "used", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [ticket.id]
        );

        return {
            valid: true,
            message: 'Ticket is valid',
            code: 'TICKET_VALID',
            ticket: {
                ...this.formatTicketForValidation(ticket),
                status: 'used'
            }
        };
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
     * Generate QR payload for ticket
     * @param {string} festivalId - Festival ID
     * @param {string} templateName - Template name
     * @param {string} ticketId - Ticket ID
     * @returns {string} QR payload
     */
    generateQRPayload(festivalId, templateName, ticketId) {
        return `${festivalId.toUpperCase()}-${templateName.toUpperCase()}-${ticketId.substring(0, 8).toUpperCase()}`;
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

