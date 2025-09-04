const request = require('supertest');
const database = require('../src/database/database');
const ticketService = require('../src/services/TicketService');
const paymentService = require('../src/services/PaymentService');

// Import the app from app.js (without server startup)
const { app } = require('../src/app');

// Test data
const testFestival = {
    id: 'test-festival-1',
    name: 'Test Festival 2025',
    description: 'A test festival',
    venue: 'Test Venue',
    start_date: '2025-08-01 10:00:00',
    end_date: '2025-10-31 22:00:00',
    latitude: 40.7128,
    longitude: -74.0060,
    latitude_delta: 0.01,
    longitude_delta: 0.01,
    primary_color: '#FF0000',
    secondary_color: '#00FF00',
    accent_color: '#0000FF',
    background_color: '#FFFFFF',
    is_active: 1
};

const testTemplate = {
    id: 'test-template-1',
    festival_id: 'test-festival-1',
    name: 'General Admission',
    description: 'General admission ticket',
    price: 99.99,
    currency: 'USD',
    benefits: JSON.stringify(['Access to all stages', 'Free water']),
    max_quantity: 1000,
    current_quantity: 0,
    is_available: 1
};

const testUser = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'hashedpassword',
    first_name: 'Test',
    last_name: 'User',
    is_active: 1,
    is_verified: 1
};

describe('Ticket Service Tests', () => {
    beforeAll(async () => {
        // Connect to test database
        await database.connect();
        
        // Setup test data
        await setupTestData();
    });

    afterAll(async () => {
        // Cleanup test data
        await cleanupTestData();
        await database.disconnect();
    });

    beforeEach(async () => {
        // Reset test data before each test
        await resetTestData();
    });

    describe('TicketService', () => {
        describe('purchaseTicket', () => {
            it('should purchase a ticket successfully', async () => {
                const result = await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );

                expect(result).toBeDefined();
                expect(result.id).toBeDefined();
                expect(result.holder_name).toBe('John Doe');
                expect(result.festival_id).toBe(testFestival.id);
                expect(result.template_id).toBe(testTemplate.id);
                expect(result.status).toBe('active');
                expect(result.qr_payload).toBeDefined();
            });

            it('should throw error for non-existent festival', async () => {
                await expect(
                    ticketService.purchaseTicket(
                        testUser.id,
                        'non-existent-festival',
                        testTemplate.id,
                        'John Doe'
                    )
                ).rejects.toThrow('Festival not found');
            });

            it('should throw error for non-existent template', async () => {
                await expect(
                    ticketService.purchaseTicket(
                        testUser.id,
                        testFestival.id,
                        'non-existent-template',
                        'John Doe'
                    )
                ).rejects.toThrow('Ticket template not found or unavailable');
            });

            it('should throw error when template is sold out', async () => {
                // First, update template to be sold out
                await database.run(
                    'UPDATE ticket_templates SET current_quantity = max_quantity WHERE id = ?',
                    [testTemplate.id]
                );

                await expect(
                    ticketService.purchaseTicket(
                        testUser.id,
                        testFestival.id,
                        testTemplate.id,
                        'John Doe'
                    )
                ).rejects.toThrow('This ticket type is sold out');
            });
        });

        describe('getTicketById', () => {
            it('should return ticket by ID', async () => {
                // Create a ticket first
                const ticket = await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );

                const result = await ticketService.getTicketById(ticket.id, testUser.id);
                expect(result.id).toBe(ticket.id);
                expect(result.holder_name).toBe('John Doe');
            });

            it('should throw error for non-existent ticket', async () => {
                await expect(
                    ticketService.getTicketById('non-existent-ticket', testUser.id)
                ).rejects.toThrow('Ticket not found');
            });

            it('should throw error for ticket not owned by user', async () => {
                // Create a ticket with different user
                const ticket = await ticketService.purchaseTicket(
                    'different-user-id',
                    testFestival.id,
                    testTemplate.id,
                    'Jane Doe'
                );

                await expect(
                    ticketService.getTicketById(ticket.id, testUser.id)
                ).rejects.toThrow('Ticket not found');
            });
        });

        describe('getUserTickets', () => {
            it('should return user tickets', async () => {
                // Create multiple tickets
                await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );
                await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'Jane Doe'
                );

                const tickets = await ticketService.getUserTickets(testUser.id);
                expect(tickets).toHaveLength(2);
                expect(tickets[0].user_id).toBe(testUser.id);
            });

            it('should filter tickets by status', async () => {
                // Create tickets
                await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );

                const tickets = await ticketService.getUserTickets(testUser.id, { status: 'active' });
                expect(tickets.every(t => t.status === 'active')).toBe(true);
            });
        });

        describe('validateTicket', () => {
            it('should validate active ticket successfully', async () => {
                const ticket = await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );

                const result = await ticketService.validateTicket(ticket.qr_payload);
                expect(result.valid).toBe(true);
                expect(result.code).toBe('TICKET_VALID');
            });

            it('should reject non-existent ticket', async () => {
                const result = await ticketService.validateTicket('non-existent-qr');
                expect(result.valid).toBe(false);
                expect(result.code).toBe('TICKET_NOT_FOUND');
            });

            it('should reject used ticket', async () => {
                const ticket = await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );

                // Use the ticket first
                await ticketService.validateTicket(ticket.qr_payload);

                // Try to use it again
                const result = await ticketService.validateTicket(ticket.qr_payload);
                expect(result.valid).toBe(false);
                expect(result.code).toBe('TICKET_INVALID_STATUS');
            });
        });

        describe('transferTicket', () => {
            it('should transfer ticket successfully', async () => {
                const ticket = await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );

                const result = await ticketService.transferTicket(
                    ticket.id,
                    testUser.id,
                    'Jane Doe'
                );

                expect(result.message).toBe('Ticket transferred successfully');
                expect(result.newHolderName).toBe('Jane Doe');

                // Verify ticket was updated
                const updatedTicket = await ticketService.getTicketById(ticket.id, testUser.id);
                expect(updatedTicket.holder_name).toBe('Jane Doe');
            });

            it('should throw error for non-existent ticket', async () => {
                await expect(
                    ticketService.transferTicket(
                        'non-existent-ticket',
                        testUser.id,
                        'Jane Doe'
                    )
                ).rejects.toThrow('Ticket not found or not transferable');
            });
        });

        describe('cancelTicket', () => {
            it('should cancel ticket successfully', async () => {
                const ticket = await ticketService.purchaseTicket(
                    testUser.id,
                    testFestival.id,
                    testTemplate.id,
                    'John Doe'
                );

                const result = await ticketService.cancelTicket(
                    ticket.id,
                    testUser.id,
                    'Changed plans'
                );

                expect(result.message).toBe('Ticket cancelled successfully');
                expect(result.reason).toBe('Changed plans');

                // Verify ticket was cancelled
                const updatedTicket = await ticketService.getTicketById(ticket.id, testUser.id);
                expect(updatedTicket.status).toBe('cancelled');
            });
        });
    });

    describe('PaymentService', () => {
        describe('processTicketPayment', () => {
            it('should process payment successfully', async () => {
                const paymentData = {
                    userId: testUser.id,
                    festivalId: testFestival.id,
                    templateId: testTemplate.id,
                    holderName: 'John Doe',
                    paymentMethod: {
                        type: 'credit_card',
                        token: 'valid_card_token'
                    },
                    amount: 99.99,
                    currency: 'USD'
                };

                const result = await paymentService.processTicketPayment(paymentData);

                expect(result.success).toBe(true);
                expect(result.paymentId).toBeDefined();
                expect(result.ticket).toBeDefined();
                expect(result.amount).toBe(99.99);
            });

            it('should handle payment failure', async () => {
                const paymentData = {
                    userId: testUser.id,
                    festivalId: testFestival.id,
                    templateId: testTemplate.id,
                    holderName: 'John Doe',
                    paymentMethod: {
                        type: 'credit_card',
                        token: 'insufficient_funds_token'
                    },
                    amount: 99.99,
                    currency: 'USD'
                };

                await expect(
                    paymentService.processTicketPayment(paymentData)
                ).rejects.toThrow('Payment failed: Insufficient funds');
            });
        });

        describe('getPaymentHistory', () => {
            it('should return payment history', async () => {
                // Create a payment first
                const paymentData = {
                    userId: testUser.id,
                    festivalId: testFestival.id,
                    templateId: testTemplate.id,
                    holderName: 'John Doe',
                    paymentMethod: {
                        type: 'credit_card',
                        token: 'valid_card_token'
                    },
                    amount: 99.99,
                    currency: 'USD'
                };

                await paymentService.processTicketPayment(paymentData);

                const payments = await paymentService.getPaymentHistory(testUser.id);
                expect(payments.length).toBeGreaterThan(0);
                expect(payments[0].user_id).toBe(testUser.id);
            });
        });
    });


});

// Helper functions
async function setupTestData() {
    // Insert test user
    await database.run(`
        INSERT OR REPLACE INTO users (
            id, username, email, password_hash, first_name, last_name, is_active, is_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        testUser.id, testUser.username, testUser.email, testUser.password_hash,
        testUser.first_name, testUser.last_name, testUser.is_active, testUser.is_verified
    ]);

    // Insert test festival
    await database.run(`
        INSERT OR REPLACE INTO festivals (
            id, name, description, venue, start_date, end_date, latitude, longitude,
            latitude_delta, longitude_delta, primary_color, secondary_color, accent_color,
            background_color, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        testFestival.id, testFestival.name, testFestival.description, testFestival.venue,
        testFestival.start_date, testFestival.end_date, testFestival.latitude, testFestival.longitude,
        testFestival.latitude_delta, testFestival.longitude_delta, testFestival.primary_color,
        testFestival.secondary_color, testFestival.accent_color, testFestival.background_color,
        testFestival.is_active
    ]);

    // Insert test template
    await database.run(`
        INSERT OR REPLACE INTO ticket_templates (
            id, festival_id, name, description, price, currency, benefits,
            max_quantity, current_quantity, is_available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        testTemplate.id, testTemplate.festival_id, testTemplate.name, testTemplate.description,
        testTemplate.price, testTemplate.currency, testTemplate.benefits,
        testTemplate.max_quantity, testTemplate.current_quantity, testTemplate.is_available
    ]);
}

async function resetTestData() {
    // Reset ticket template quantity
    await database.run(`
        UPDATE ticket_templates 
        SET current_quantity = 0 
        WHERE id = ?
    `, [testTemplate.id]);

    // Delete test tickets
    await database.run('DELETE FROM tickets WHERE user_id = ?', [testUser.id]);

    // Delete test payments
    await database.run('DELETE FROM payments WHERE user_id = ?', [testUser.id]);

    // Delete test refunds
    await database.run(`
        DELETE FROM refunds 
        WHERE payment_id IN (SELECT id FROM payments WHERE user_id = ?)
    `, [testUser.id]);
}

async function cleanupTestData() {
    // Clean up all test data
    await database.run('DELETE FROM tickets WHERE user_id = ?', [testUser.id]);
    await database.run('DELETE FROM payments WHERE user_id = ?', [testUser.id]);
    await database.run('DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE user_id = ?)', [testUser.id]);
    await database.run('DELETE FROM ticket_templates WHERE id = ?', [testTemplate.id]);
    await database.run('DELETE FROM festivals WHERE id = ?', [testFestival.id]);
    await database.run('DELETE FROM users WHERE id = ?', [testUser.id]);
}

