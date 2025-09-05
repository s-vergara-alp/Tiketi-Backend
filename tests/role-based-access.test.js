const request = require('supertest');
const app = require('../src/app').app;
const database = require('../src/database/database');
const { generateToken } = require('../src/middleware/auth');
const { setupTestDatabase, teardownTestDatabase } = require('./setup');

describe('Role-Based Access Control Tests', () => {
    let testUsers = {};
    let testTokens = {};

    beforeAll(async () => {
        await setupTestDatabase();
        
        // Create test users with different roles
        const userRoles = [
            { id: 'user-regular', role: 'user', is_admin: 0, is_staff: 0, is_security: 0 },
            { id: 'user-security', role: 'security', is_admin: 0, is_staff: 0, is_security: 1 },
            { id: 'user-staff', role: 'staff', is_admin: 0, is_staff: 1, is_security: 0 },
            { id: 'user-admin', role: 'admin', is_admin: 1, is_staff: 1, is_security: 1 }
        ];

        for (const userData of userRoles) {
            const userId = userData.id;
            
            // Create user in database
            await database.run(`
                INSERT INTO users (id, username, email, password_hash, first_name, last_name, is_active, is_verified, is_admin, is_staff, is_security, role)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId,
                `test-${userId}`,
                `test-${userId}@example.com`,
                'hashed_password',
                'Test',
                'User',
                1, 1,
                userData.is_admin,
                userData.is_staff,
                userData.is_security,
                userData.role
            ]);

            // Store user data and generate token
            testUsers[userId] = { ...userData, username: `test-${userId}`, email: `test-${userId}@example.com` };
            testTokens[userId] = generateToken({ id: userId, email: `test-${userId}@example.com` });
        }

        // Create test festival and ticket template for testing
        await database.run(`
            INSERT INTO festivals (id, name, description, start_date, end_date, location, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['test-festival', 'Test Festival', 'Test Description', '2024-01-01', '2024-01-07', 'Test Location', 1]);

        await database.run(`
            INSERT INTO ticket_templates (id, festival_id, name, description, price, max_quantity, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['test-template', 'test-festival', 'Test Template', 'Test Description', 50.00, 100, 1]);
    });

    afterAll(async () => {
        await teardownTestDatabase();
    });

    describe('Ticket Template Access', () => {
        test('Regular user should not access ticket templates', async () => {
            const response = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', `Bearer ${testTokens['user-regular']}`)
                .expect(403);

            expect(response.body.error).toContain('Staff access required');
        });

        test('Security user should not access ticket templates', async () => {
            const response = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', `Bearer ${testTokens['user-security']}`)
                .expect(403);

            expect(response.body.error).toContain('Staff access required');
        });

        test('Staff user should access ticket templates', async () => {
            const response = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', `Bearer ${testTokens['user-staff']}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        test('Admin user should access ticket templates', async () => {
            const response = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', `Bearer ${testTokens['user-admin']}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('QR Code Validation Access', () => {
        test('Regular user should not validate QR codes', async () => {
            const response = await request(app)
                .post('/api/tickets/validate/test-qr-payload')
                .set('Authorization', `Bearer ${testTokens['user-regular']}`)
                .expect(403);

            expect(response.body.error).toContain('Security access required');
        });

        test('Staff user should not validate QR codes', async () => {
            const response = await request(app)
                .post('/api/tickets/validate/test-qr-payload')
                .set('Authorization', `Bearer ${testTokens['user-staff']}`)
                .expect(403);

            expect(response.body.error).toContain('Security access required');
        });

        test('Security user should validate QR codes', async () => {
            const response = await request(app)
                .post('/api/tickets/validate/test-qr-payload')
                .set('Authorization', `Bearer ${testTokens['user-security']}`)
                .expect(400); // 400 because QR payload doesn't exist, but 403 would be access denied

            // Should not be access denied error
            expect(response.body.error).not.toContain('Security access required');
        });

        test('Admin user should validate QR codes', async () => {
            const response = await request(app)
                .post('/api/tickets/validate/test-qr-payload')
                .set('Authorization', `Bearer ${testTokens['user-admin']}`)
                .expect(400); // 400 because QR payload doesn't exist, but 403 would be access denied

            // Should not be access denied error
            expect(response.body.error).not.toContain('Security access required');
        });
    });

    describe('Estadias Management Access', () => {
        test('Regular user should not create estadias', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${testTokens['user-regular']}`)
                .send({
                    user_id: 'user-regular',
                    festival_id: 'test-festival',
                    room_number: '101',
                    check_in_date: '2024-01-01',
                    check_out_date: '2024-01-03'
                })
                .expect(403);

            expect(response.body.error).toContain('Staff access required');
        });

        test('Security user should not create estadias', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${testTokens['user-security']}`)
                .send({
                    user_id: 'user-security',
                    festival_id: 'test-festival',
                    room_number: '102',
                    check_in_date: '2024-01-01',
                    check_out_date: '2024-01-03'
                })
                .expect(403);

            expect(response.body.error).toContain('Staff access required');
        });

        test('Staff user should create estadias', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${testTokens['user-staff']}`)
                .send({
                    user_id: 'user-staff',
                    festival_id: 'test-festival',
                    room_number: '103',
                    check_in_date: '2024-01-01',
                    check_out_date: '2024-01-03'
                })
                .expect(201);

            expect(response.body).toHaveProperty('id');
        });

        test('Admin user should create estadias', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias')
                .set('Authorization', `Bearer ${testTokens['user-admin']}`)
                .send({
                    user_id: 'user-admin',
                    festival_id: 'test-festival',
                    room_number: '104',
                    check_in_date: '2024-01-01',
                    check_out_date: '2024-01-03'
                })
                .expect(201);

            expect(response.body).toHaveProperty('id');
        });
    });

    describe('Estadia Access Validation', () => {
        let estadiaId;

        beforeAll(async () => {
            // Create an estadia for testing access validation
            const result = await database.run(`
                INSERT INTO estadias (id, user_id, festival_id, room_number, check_in_date, check_out_date, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, ['test-estadia', 'user-regular', 'test-festival', '105', '2024-01-01', '2024-01-03', 'active']);
            
            estadiaId = 'test-estadia';
        });

        test('Regular user should not validate access codes', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${testTokens['user-regular']}`)
                .send({
                    access_code: 'test-code',
                    room_number: '105'
                })
                .expect(403);

            expect(response.body.error).toContain('Security access required');
        });

        test('Staff user should not validate access codes', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${testTokens['user-staff']}`)
                .send({
                    access_code: 'test-code',
                    room_number: '105'
                })
                .expect(403);

            expect(response.body.error).toContain('Security access required');
        });

        test('Security user should validate access codes', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${testTokens['user-security']}`)
                .send({
                    access_code: 'test-code',
                    room_number: '105'
                })
                .expect(400); // 400 because access code doesn't exist, but 403 would be access denied

            // Should not be access denied error
            expect(response.body.error).not.toContain('Security access required');
        });

        test('Admin user should validate access codes', async () => {
            const response = await request(app)
                .post('/api/mesh/estadias/access/validate')
                .set('Authorization', `Bearer ${testTokens['user-admin']}`)
                .send({
                    access_code: 'test-code',
                    room_number: '105'
                })
                .expect(400); // 400 because access code doesn't exist, but 403 would be access denied

            // Should not be access denied error
            expect(response.body.error).not.toContain('Security access required');
        });
    });

    describe('Role Hierarchy Verification', () => {
        test('Admin should have all permissions', async () => {
            // Test staff permission (ticket templates)
            const staffResponse = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', `Bearer ${testTokens['user-admin']}`)
                .expect(200);

            // Test security permission (QR validation)
            const securityResponse = await request(app)
                .post('/api/tickets/validate/test-qr')
                .set('Authorization', `Bearer ${testTokens['user-admin']}`)
                .expect(400); // Not 403, so access is granted

            expect(staffResponse.status).toBe(200);
            expect(securityResponse.status).toBe(400); // Access granted, but invalid QR
        });

        test('Staff should have staff permissions but not security', async () => {
            // Test staff permission (ticket templates)
            const staffResponse = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', `Bearer ${testTokens['user-staff']}`)
                .expect(200);

            // Test security permission (QR validation) - should be denied
            const securityResponse = await request(app)
                .post('/api/tickets/validate/test-qr')
                .set('Authorization', `Bearer ${testTokens['user-staff']}`)
                .expect(403);

            expect(staffResponse.status).toBe(200);
            expect(securityResponse.body.error).toContain('Security access required');
        });

        test('Security should have security permissions but not staff', async () => {
            // Test staff permission (ticket templates) - should be denied
            const staffResponse = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', `Bearer ${testTokens['user-security']}`)
                .expect(403);

            // Test security permission (QR validation)
            const securityResponse = await request(app)
                .post('/api/tickets/validate/test-qr')
                .set('Authorization', `Bearer ${testTokens['user-security']}`)
                .expect(400); // Not 403, so access is granted

            expect(staffResponse.body.error).toContain('Staff access required');
            expect(securityResponse.status).toBe(400); // Access granted, but invalid QR
        });
    });

    describe('Unauthenticated Access', () => {
        test('Should deny access to protected endpoints without token', async () => {
            const response = await request(app)
                .get('/api/tickets/templates/test-festival')
                .expect(401);

            expect(response.body.error).toContain('Access token required');
        });

        test('Should deny access with invalid token', async () => {
            const response = await request(app)
                .get('/api/tickets/templates/test-festival')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.error).toContain('Invalid token');
        });
    });
});
