const request = require('supertest');
const { app } = require('../src/app');
const database = require('../src/database/database');
const estadiasService = require('../src/services/EstadiasService');

describe('Estadias Service', () => {
    let authToken;
    let testUserId;
    let testFestivalId;
    let testRoomId;

    beforeAll(async () => {
        // Use test utilities to generate token instead of registering/login
        testUserId = 'test-user-base'; // Use the seeded test user
        authToken = global.testUtils.generateTestToken(testUserId);

        // Get test festival ID from seeded data
        const festival = await database.get('SELECT id FROM festivals LIMIT 1');
        
        testFestivalId = festival?.id || 'test-festival-base';
        testRoomId = 'test-room-id'; // Use a hardcoded room ID since there's no rooms table
    });

    afterAll(async () => {
        // Clean up test data (but not the seeded test user)
        await database.run('DELETE FROM estadias WHERE user_id = ?', [testUserId]);
        await database.run('DELETE FROM room_access_logs WHERE user_id = ?', [testUserId]);
    });

    describe('Estadia Creation and Management', () => {
        test('should create a new estadia', async () => {
            const estadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'TEST-ACCESS-001',
                start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
                metadata: { 
                    guest_count: 2, 
                    special_requests: 'Late checkout requested',
                    amenities: ['wifi', 'breakfast']
                }
            };

            const response = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(estadiaData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user_id).toBe(testUserId);
            expect(response.body.data.access_code).toBe(estadiaData.access_code);
            expect(response.body.data.status).toBe('active');
        });

        test('should get estadia by ID', async () => {
            // First create an estadia
            const estadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'TEST-ACCESS-002',
                start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            };

            const createResponse = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(estadiaData);

            const estadiaId = createResponse.body.data.id;

            const response = await request(app)
                .get(`/api/mesh/estadias/${estadiaId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(estadiaId);
            expect(response.body.data.access_code).toBe(estadiaData.access_code);
        });

        test('should get all estadias for a user', async () => {
            const response = await request(app)
                .get(`/api/mesh/estadias/user/${testUserId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        test('should update estadia status', async () => {
            // Create an estadia first
            const estadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'TEST-ACCESS-003',
                start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            };

            const createResponse = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(estadiaData);

            const estadiaId = createResponse.body.data.id;

            // Update status to checked_in
            const response = await request(app)
                .put(`/api/mesh/estadias/${estadiaId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'checked_in' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('checked_in');
            expect(response.body.data.check_in_time).toBeDefined();
        });

        test('should return 404 for non-existent estadia', async () => {
            const response = await request(app)
                .get('/api/mesh/estadias/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error.message).toBe('Estadia not found');
        });

        test('should validate required fields for estadia creation', async () => {
            const invalidEstadiaData = {
                user_id: testUserId,
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidEstadiaData);

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('Invalid value');
        });

        test('should validate date format for estadia creation', async () => {
            const invalidEstadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'TEST-ACCESS-004',
                start_time: 'invalid-date',
                end_time: 'invalid-date'
            };

            const response = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidEstadiaData);

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('Start Time must be a valid ISO 8601 date');
        });
    });

    describe('Room Access Validation', () => {
        test('should validate room access with correct code', async () => {
            // Create an estadia with future dates
            const estadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'VALID-ACCESS-001',
                start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
                end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
            };

            await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(estadiaData);

            // Validate access
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    access_code: 'VALID-ACCESS-001',
                    room_id: testRoomId,
                    user_id: testUserId
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessGranted).toBe(true);
            expect(response.body.data.reason).toBe('Access granted.');
        });

        test('should deny access with incorrect code', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    access_code: 'INVALID-ACCESS-001',
                    room_id: testRoomId,
                    user_id: testUserId
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessGranted).toBe(false);
            expect(response.body.data.reason).toContain('Invalid access code');
        });

        test('should deny access for expired estadia', async () => {
            // Create an expired estadia
            const estadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'EXPIRED-ACCESS-001',
                start_time: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
                end_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
            };

            await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(estadiaData);

            // Try to validate access
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    access_code: 'EXPIRED-ACCESS-001',
                    room_id: testRoomId,
                    user_id: testUserId
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessGranted).toBe(false);
            expect(response.body.data.reason).toBe('Access expired.');
        });

        test('should deny access for future estadia', async () => {
            // Create a future estadia
            const estadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'FUTURE-ACCESS-001',
                start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // Day after tomorrow
            };

            await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${authToken}`)
                .send(estadiaData);

            // Try to validate access
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    access_code: 'FUTURE-ACCESS-001',
                    room_id: testRoomId,
                    user_id: testUserId
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessGranted).toBe(false);
            expect(response.body.data.reason).toBe('Access not yet active.');
        });
    });

    describe('Service Layer Tests', () => {
        test('should create estadia directly through service', async () => {
            const estadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'SERVICE-TEST-001',
                start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            };

            const estadia = await estadiasService.createEstadia(estadiaData);
            expect(estadia.access_code).toBe(estadiaData.access_code);
            expect(estadia.status).toBe('active');
        });

        test('should validate room access directly through service', async () => {
            const result = await estadiasService.validateRoomAccess(
                'SERVICE-TEST-001',
                testRoomId,
                testUserId
            );

            expect(result).toHaveProperty('accessGranted');
            expect(result).toHaveProperty('reason');
        });

        test('should handle invalid estadia data gracefully', async () => {
            await expect(estadiasService.createEstadia({})).rejects.toThrow();
        });

        test('should handle invalid date ranges gracefully', async () => {
            const invalidEstadiaData = {
                user_id: testUserId,
                festival_id: testFestivalId,
                room_id: testRoomId,
                access_code: 'INVALID-DATES-001',
                start_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Future
                end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Past relative to start
            };

            await expect(estadiasService.createEstadia(invalidEstadiaData)).rejects.toThrow();
        });
    });
});
