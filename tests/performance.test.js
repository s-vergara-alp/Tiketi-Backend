const request = require('supertest');
const database = require('../src/database/database');
const ticketService = require('../src/services/TicketService');
const paymentService = require('../src/services/PaymentService');

// Import the app from app.js (without server startup)
const { app } = require('../src/app');

// Test data
const testFestival = {
    id: 'perf-festival',
    name: 'Performance Test Festival',
    description: 'A festival for performance testing',
    venue: 'Performance Venue',
    start_date: '2024-09-01 10:00:00',
    end_date: '2024-09-03 22:00:00',
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
    id: 'perf-template',
    festival_id: 'perf-festival',
    name: 'Performance Pass',
    description: 'Performance test ticket',
    price: 99.99,
    currency: 'USD',
    benefits: JSON.stringify(['Access to all areas']),
    max_quantity: 10000,
    current_quantity: 0,
    is_available: 1
};

const testUsers = Array.from({ length: 100 }, (_, i) => ({
    id: `perf-user-${i}`,
    username: `perfuser${i}`,
    email: `perf${i}@test.com`,
    password_hash: 'hashedpassword',
    first_name: `Perf${i}`,
    last_name: 'User',
    is_active: 1,
    is_verified: 1
}));

describe('Performance Tests', () => {
    beforeAll(async () => {
        // Connect to database
        await database.connect();
        
        // Setup test data
        await setupPerformanceTestData();
    });

    afterAll(async () => {
        // Cleanup test data
        await cleanupPerformanceTestData();
        await database.disconnect();
    });

    beforeEach(async () => {
        // Reset test data before each test
        await resetPerformanceTestData();
    });

    describe('Concurrent Ticket Purchases', () => {
        it('should handle 50 concurrent ticket purchases', async () => {
            const startTime = Date.now();
            const concurrentPurchases = 50;
            const promises = [];

            for (let i = 0; i < concurrentPurchases; i++) {
                const user = testUsers[i];
                const purchaseData = {
                    festivalId: testFestival.id,
                    templateId: testTemplate.id,
                    holderName: `User ${i}`,
                    paymentMethod: {
                        type: 'credit_card',
                        token: 'valid_card_token'
                    },
                    amount: 99.99,
                    currency: 'USD'
                };

                promises.push(
                    request(app)
                        .post('/api/tickets/purchase')
                        .send(purchaseData)
                        .set('Authorization', `Bearer ${generateTestToken(user.id)}`)
                        .then(response => {
                            expect(response.status).toBe(201);
                            expect(response.body.success).toBe(true);
                            return response.body;
                        })
                        .catch(error => {
                            console.error(`Purchase ${i} failed:`, error.message);
                            throw error;
                        })
                );
            }

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            console.log(`Completed ${concurrentPurchases} concurrent purchases in ${duration}ms`);
            console.log(`Average time per purchase: ${duration / concurrentPurchases}ms`);

            expect(results).toHaveLength(concurrentPurchases);
            expect(results.every(r => r.success)).toBe(true);

            // Verify all tickets were created
            const tickets = await database.all(
                'SELECT COUNT(*) as count FROM tickets WHERE festival_id = ?',
                [testFestival.id]
            );
            expect(tickets[0].count).toBe(concurrentPurchases);

            // Verify template quantity was updated correctly
            const template = await database.get(
                'SELECT current_quantity FROM ticket_templates WHERE id = ?',
                [testTemplate.id]
            );
            expect(template.current_quantity).toBe(concurrentPurchases);
        }, 30000); // 30 second timeout

        it('should handle race conditions correctly', async () => {
            // Test with limited quantity template
            const limitedTemplate = {
                id: 'limited-template',
                festival_id: 'perf-festival',
                name: 'Limited Pass',
                description: 'Limited quantity ticket',
                price: 99.99,
                currency: 'USD',
                benefits: JSON.stringify(['Limited access']),
                max_quantity: 10,
                current_quantity: 0,
                is_available: 1
            };

            await database.run(`
                INSERT OR REPLACE INTO ticket_templates (
                    id, festival_id, name, description, price, currency, benefits,
                    max_quantity, current_quantity, is_available
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                limitedTemplate.id, limitedTemplate.festival_id, limitedTemplate.name,
                limitedTemplate.description, limitedTemplate.price, limitedTemplate.currency,
                limitedTemplate.benefits, limitedTemplate.max_quantity,
                limitedTemplate.current_quantity, limitedTemplate.is_available
            ]);

            const concurrentPurchases = 20; // More than available quantity
            const promises = [];
            const results = [];

            for (let i = 0; i < concurrentPurchases; i++) {
                const user = testUsers[i];
                const purchaseData = {
                    festivalId: testFestival.id,
                    templateId: limitedTemplate.id,
                    holderName: `User ${i}`,
                    paymentMethod: {
                        type: 'credit_card',
                        token: 'valid_card_token'
                    },
                    amount: 99.99,
                    currency: 'USD'
                };

                promises.push(
                    request(app)
                        .post('/api/tickets/purchase')
                        .send(purchaseData)
                        .set('Authorization', `Bearer ${generateTestToken(user.id)}`)
                        .then(response => {
                            results.push({ success: true, status: response.status });
                            return response.body;
                        })
                        .catch(error => {
                            results.push({ success: false, status: error.response?.status });
                            return null;
                        })
                );
            }

            await Promise.all(promises);

            // Count successful purchases
            const successfulPurchases = results.filter(r => r.success).length;
            const failedPurchases = results.filter(r => !r.success).length;

            console.log(`Successful purchases: ${successfulPurchases}`);
            console.log(`Failed purchases: ${failedPurchases}`);

            // Should have exactly 10 successful purchases (max quantity)
            expect(successfulPurchases).toBe(10);
            expect(failedPurchases).toBe(10);

            // Verify template quantity
            const template = await database.get(
                'SELECT current_quantity FROM ticket_templates WHERE id = ?',
                [limitedTemplate.id]
            );
            expect(template.current_quantity).toBe(10);

            // Cleanup
            await database.run('DELETE FROM ticket_templates WHERE id = ?', [limitedTemplate.id]);
        }, 30000);
    });

    describe('Database Query Performance', () => {
        it('should handle large result sets efficiently', async () => {
            // Create many tickets first
            const ticketCount = 1000;
            const tickets = [];

            for (let i = 0; i < ticketCount; i++) {
                const user = testUsers[i % testUsers.length];
                const ticket = await ticketService.purchaseTicket(
                    user.id,
                    testFestival.id,
                    testTemplate.id,
                    `User ${i}`
                );
                tickets.push(ticket);
            }

            // Test query performance
            const startTime = Date.now();
            const allTickets = await database.all(`
                SELECT t.*, f.name as festival_name, tt.name as template_name
                FROM tickets t
                JOIN festivals f ON t.festival_id = f.id
                JOIN ticket_templates tt ON t.template_id = tt.id
                WHERE t.festival_id = ?
                ORDER BY t.purchase_date DESC
            `, [testFestival.id]);
            const endTime = Date.now();

            console.log(`Query returned ${allTickets.length} tickets in ${endTime - startTime}ms`);

            expect(allTickets).toHaveLength(ticketCount);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
        }, 30000);

        it('should handle pagination efficiently', async () => {
            // Create many tickets first
            const ticketCount = 500;
            for (let i = 0; i < ticketCount; i++) {
                const user = testUsers[i % testUsers.length];
                await ticketService.purchaseTicket(
                    user.id,
                    testFestival.id,
                    testTemplate.id,
                    `User ${i}`
                );
            }

            const pageSize = 50;
            const pages = Math.ceil(ticketCount / pageSize);
            const startTime = Date.now();

            for (let page = 0; page < pages; page++) {
                const offset = page * pageSize;
                const tickets = await database.all(`
                    SELECT t.*, f.name as festival_name, tt.name as template_name
                    FROM tickets t
                    JOIN festivals f ON t.festival_id = f.id
                    JOIN ticket_templates tt ON t.template_id = tt.id
                    WHERE t.festival_id = ?
                    ORDER BY t.purchase_date DESC
                    LIMIT ? OFFSET ?
                `, [testFestival.id, pageSize, offset]);

                expect(tickets.length).toBeLessThanOrEqual(pageSize);
            }

            const endTime = Date.now();
            console.log(`Pagination test completed in ${endTime - startTime}ms`);

            expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
        }, 30000);
    });

    describe('API Response Time', () => {
        it('should respond to ticket queries within acceptable time', async () => {
            // Create some test tickets
            for (let i = 0; i < 10; i++) {
                const user = testUsers[i];
                await ticketService.purchaseTicket(
                    user.id,
                    testFestival.id,
                    testTemplate.id,
                    `User ${i}`
                );
            }

            const responseTimes = [];
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                const user = testUsers[i % testUsers.length];
                const startTime = Date.now();

                await request(app)
                    .get('/api/tickets')
                    .set('Authorization', `Bearer ${generateTestToken(user.id)}`)
                    .expect(200);

                const endTime = Date.now();
                responseTimes.push(endTime - startTime);
            }

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);
            const minResponseTime = Math.min(...responseTimes);

            console.log(`Average response time: ${avgResponseTime}ms`);
            console.log(`Max response time: ${maxResponseTime}ms`);
            console.log(`Min response time: ${minResponseTime}ms`);

            expect(avgResponseTime).toBeLessThan(100); // Average under 100ms
            expect(maxResponseTime).toBeLessThan(500); // Max under 500ms
        }, 30000);

        it('should handle ticket validation efficiently', async () => {
            // Create a ticket for validation
            const user = testUsers[0];
            const ticket = await ticketService.purchaseTicket(
                user.id,
                testFestival.id,
                testTemplate.id,
                'Validation Test'
            );

            const responseTimes = [];
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();

                await request(app)
                    .post(`/api/tickets/validate/${ticket.qr_payload}`)
                    .expect(200);

                const endTime = Date.now();
                responseTimes.push(endTime - startTime);
            }

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);

            console.log(`Average validation time: ${avgResponseTime}ms`);
            console.log(`Max validation time: ${maxResponseTime}ms`);

            expect(avgResponseTime).toBeLessThan(50); // Average under 50ms
            expect(maxResponseTime).toBeLessThan(200); // Max under 200ms
        }, 30000);
    });

    describe('Memory Usage', () => {
        it('should not have memory leaks during repeated operations', async () => {
            const initialMemory = process.memoryUsage();
            console.log('Initial memory usage:', initialMemory);

            // Perform many operations
            for (let i = 0; i < 100; i++) {
                const user = testUsers[i % testUsers.length];
                
                // Purchase ticket
                const ticket = await ticketService.purchaseTicket(
                    user.id,
                    testFestival.id,
                    testTemplate.id,
                    `User ${i}`
                );

                // Get user tickets
                await ticketService.getUserTickets(user.id);

                // Validate ticket
                await ticketService.validateTicket(ticket.qr_payload);

                // Get payment history
                await paymentService.getPaymentHistory(user.id);
            }

            const finalMemory = process.memoryUsage();
            console.log('Final memory usage:', finalMemory);

            const memoryIncrease = {
                heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
                heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
                external: finalMemory.external - initialMemory.external
            };

            console.log('Memory increase:', memoryIncrease);

            // Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024);
        }, 30000);
    });
});

// Helper functions
function generateTestToken(userId) {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ 
        id: userId, 
        username: 'testuser',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
    }, process.env.JWT_SECRET);
}

async function setupPerformanceTestData() {
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

    // Insert test users
    for (const user of testUsers) {
        await database.run(`
            INSERT OR REPLACE INTO users (
                id, username, email, password_hash, first_name, last_name, is_active, is_verified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            user.id, user.username, user.email, user.password_hash,
            user.first_name, user.last_name, user.is_active, user.is_verified
        ]);
    }
}

async function resetPerformanceTestData() {
    // Reset template quantity
    await database.run(`
        UPDATE ticket_templates 
        SET current_quantity = 0 
        WHERE id = ?
    `, [testTemplate.id]);

    // Delete test tickets
    await database.run('DELETE FROM tickets WHERE festival_id = ?', [testFestival.id]);

    // Delete test payments
    await database.run('DELETE FROM payments WHERE festival_id = ?', [testFestival.id]);

    // Delete test refunds
    await database.run(`
        DELETE FROM refunds 
        WHERE payment_id IN (SELECT id FROM payments WHERE festival_id = ?)
    `, [testFestival.id]);
}

async function cleanupPerformanceTestData() {
    // Clean up all test data
    await database.run('DELETE FROM tickets WHERE festival_id = ?', [testFestival.id]);
    await database.run('DELETE FROM payments WHERE festival_id = ?', [testFestival.id]);
    await database.run('DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE festival_id = ?)', [testFestival.id]);
    await database.run('DELETE FROM ticket_templates WHERE id = ?', [testTemplate.id]);
    await database.run('DELETE FROM festivals WHERE id = ?', [testFestival.id]);
    
    for (const user of testUsers) {
        await database.run('DELETE FROM users WHERE id = ?', [user.id]);
    }
}

