const request = require('supertest');
const { app } = require('../src/app');
const database = require('../src/database/database');
const { migrateBLEBiometric } = require('../src/database/migrate_ble_biometric');

describe('BLE and Biometric System Integration Tests', () => {
    let authToken;
    let userId;
    let festivalId;
    let ticketId;
    let beaconId;
    let sessionToken;

    beforeAll(async () => {
        // Connect to database
        await database.connect();
        
        // Run migration
        await migrateBLEBiometric();
    });

    afterAll(async () => {
        // Clean up test data
        await database.run('DELETE FROM biometric_verification_attempts');
        await database.run('DELETE FROM ticket_validations');
        await database.run('DELETE FROM secure_qr_codes');
        await database.run('DELETE FROM ble_validation_sessions');
        await database.run('DELETE FROM ble_beacons');
        await database.run('DELETE FROM biometric_data');
        await database.run('DELETE FROM tickets');
        await database.run('DELETE FROM festivals');
        await database.run('DELETE FROM users');
        
        // Disconnect from database
        await database.disconnect();
    });

    beforeEach(async () => {
        // Clean up test data
        await database.run('DELETE FROM biometric_verification_attempts');
        await database.run('DELETE FROM ticket_validations');
        await database.run('DELETE FROM secure_qr_codes');
        await database.run('DELETE FROM ble_validation_sessions');
        await database.run('DELETE FROM ble_beacons');
        await database.run('DELETE FROM tickets');
        await database.run('DELETE FROM festivals');
        await database.run('DELETE FROM users');
    });

    describe('User Registration and Authentication', () => {
        test('Should register a new user', async () => {
            const userData = {
                username: 'testuser' + Date.now(),
                email: 'test' + Date.now() + '@example.com',
                password: 'TestPassword123!',
                firstName: 'Test',
                lastName: 'User'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData);

            expect(response.status).toBe(201);
            expect(response.body.message).toContain('User registered successfully');
            expect(response.body.user).toBeDefined();
            
            userId = response.body.user.id;
        });

        test('Should login user and get auth token', async () => {
            const loginData = {
                email: 'test' + Date.now() + '@example.com',
                password: 'TestPassword123!'
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body.token).toBeDefined();
            
            authToken = response.body.token;
        });
    });

    describe('Festival Management', () => {
        test('Should create a festival with BLE and biometric enabled', async () => {
            const festivalData = {
                name: 'Test Festival 2024',
                description: 'A test festival for BLE and biometric testing',
                venue: 'Test Venue',
                startDate: '2024-12-01T10:00:00Z',
                endDate: '2024-12-03T22:00:00Z',
                latitude: 40.7128,
                longitude: -74.0060,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
                primaryColor: '#FF6B6B',
                secondaryColor: '#4ECDC4',
                accentColor: '#45B7D1',
                backgroundColor: '#96CEB4',
                decorationIcons: '["🎵", "🎪", "🎨"]',
                bleEnabled: true,
                biometricEnabled: true
            };

            const response = await request(app)
                .post('/api/festivals')
                .set('Authorization', `Bearer ${authToken}`)
                .send(festivalData);

            expect(response.status).toBe(201);
            expect(response.body.festival).toBeDefined();
            expect(response.body.festival.bleEnabled).toBe(true);
            expect(response.body.festival.biometricEnabled).toBe(true);
            
            festivalId = response.body.festival.id;
        });
    });

    describe('BLE Beacon Management', () => {
        test('Should register a BLE beacon', async () => {
            const beaconData = {
                festivalId: festivalId,
                name: 'Main Entrance Beacon',
                locationName: 'Main Entrance',
                latitude: 40.7128,
                longitude: -74.0060,
                macAddress: 'AA:BB:CC:DD:EE:FF',
                uuid: '12345678-1234-1234-1234-123456789ABC',
                major: 1,
                minor: 1,
                txPower: -59,
                rssiThreshold: -70
            };

            const response = await request(app)
                .post('/api/ble/beacons')
                .set('Authorization', `Bearer ${authToken}`)
                .send(beaconData);

            expect(response.status).toBe(201);
            expect(response.body.beacon).toBeDefined();
            expect(response.body.beacon.name).toBe('Main Entrance Beacon');
            
            beaconId = response.body.beacon.id;
        });

        test('Should get beacons for festival', async () => {
            const response = await request(app)
                .get(`/api/ble/beacons/${festivalId}`);

            expect(response.status).toBe(200);
            expect(response.body.beacons).toBeDefined();
            expect(response.body.beacons.length).toBeGreaterThan(0);
        });
    });

    describe('Ticket Purchase with Secure QR', () => {
        test('Should create a ticket template', async () => {
            const templateData = {
                festivalId: festivalId,
                name: 'VIP Pass',
                description: 'VIP access to all areas',
                price: 299.99,
                currency: 'USD',
                benefits: '["VIP lounge access", "Priority entry", "Free drinks"]',
                maxQuantity: 100,
                isAvailable: true
            };

            const response = await request(app)
                .post('/api/festivals/templates')
                .set('Authorization', `Bearer ${authToken}`)
                .send(templateData);

            expect(response.status).toBe(201);
            expect(response.body.template).toBeDefined();
        });

        test('Should purchase a ticket with secure QR', async () => {
            const ticketData = {
                festivalId: festivalId,
                templateId: 'template-id', // This would be the actual template ID
                holderName: 'Test User',
                options: {
                    preventDuplicate: false
                }
            };

            const response = await request(app)
                .post('/api/tickets/purchase')
                .set('Authorization', `Bearer ${authToken}`)
                .send(ticketData);

            expect(response.status).toBe(201);
            expect(response.body.ticket).toBeDefined();
            expect(response.body.ticket.qrPayload).toBeDefined();
            
            ticketId = response.body.ticket.id;
        });
    });

    describe('BLE Validation Sessions', () => {
        test('Should start BLE validation session', async () => {
            const sessionData = {
                beaconId: beaconId,
                userId: userId,
                deviceId: 'test-device-123',
                proximityData: {
                    rssi: -65,
                    distance: 2.5,
                    accuracy: 0.8
                }
            };

            const response = await request(app)
                .post('/api/ble/sessions')
                .send(sessionData);

            expect(response.status).toBe(201);
            expect(response.body.session).toBeDefined();
            expect(response.body.session.sessionToken).toBeDefined();
            
            sessionToken = response.body.session.sessionToken;
        });

        test('Should validate BLE session', async () => {
            const validationData = {
                sessionToken: sessionToken,
                validationData: {
                    proximity: 'near',
                    signalStrength: -65
                }
            };

            const response = await request(app)
                .post('/api/ble/sessions/validate')
                .send(validationData);

            expect(response.status).toBe(200);
            expect(response.body.validation).toBeDefined();
            expect(response.body.validation.valid).toBe(true);
        });
    });

    describe('Biometric Enrollment and Verification', () => {
        test('Should enroll biometric data', async () => {
            const biometricData = {
                biometricType: 'face',
                templateData: 'mock-face-template-data',
                qualityScore: 0.85,
                metadata: {
                    device: 'iPhone 15 Pro',
                    algorithm: 'FaceID v2.0'
                }
            };

            const response = await request(app)
                .post('/api/biometric/enroll')
                .set('Authorization', `Bearer ${authToken}`)
                .send(biometricData);

            expect(response.status).toBe(201);
            expect(response.body.result).toBeDefined();
            expect(response.body.result.success).toBe(true);
        });

        test('Should get biometric status', async () => {
            const response = await request(app)
                .get(`/api/biometric/status/${userId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBeDefined();
            expect(response.body.status.enrolled).toBe(true);
        });

        test('Should verify biometric data', async () => {
            const verificationData = {
                userId: userId,
                biometricType: 'face',
                templateData: 'mock-face-template-data-verification',
                sessionId: 'test-session-123'
            };

            const response = await request(app)
                .post('/api/biometric/verify')
                .send(verificationData);

            expect(response.status).toBe(200);
            expect(response.body.result).toBeDefined();
            expect(response.body.result.verified).toBeDefined();
        });
    });

    describe('Enhanced Ticket Validation', () => {
        test('Should validate ticket with BLE and biometric', async () => {
            const validationData = {
                qrPayload: 'test-qr-payload',
                sessionToken: sessionToken,
                biometricData: {
                    type: 'face',
                    template: 'mock-face-template-data-verification'
                },
                validatorId: userId,
                location: 'Main Entrance',
                deviceInfo: {
                    device: 'Validation Terminal 1',
                    version: '1.0.0'
                }
            };

            const response = await request(app)
                .post('/api/ticket-validation/validate')
                .send(validationData);

            expect(response.status).toBe(200);
            expect(response.body.result).toBeDefined();
        });

        test('Should get ticket validation requirements', async () => {
            const response = await request(app)
                .get(`/api/ticket-validation/requirements/${ticketId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.requirements).toBeDefined();
            expect(response.body.requirements.bleRequired).toBeDefined();
            expect(response.body.requirements.biometricRequired).toBeDefined();
        });

        test('Should get ticket validation history', async () => {
            const response = await request(app)
                .get(`/api/ticket-validation/history/${ticketId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.history).toBeDefined();
            expect(Array.isArray(response.body.history)).toBe(true);
        });
    });

    describe('Security and Error Handling', () => {
        test('Should reject invalid biometric data', async () => {
            const invalidBiometricData = {
                biometricType: 'invalid-type',
                templateData: 'test-data',
                qualityScore: 0.5
            };

            const response = await request(app)
                .post('/api/biometric/enroll')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidBiometricData);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Unsupported biometric type');
        });

        test('Should reject low quality biometric data', async () => {
            const lowQualityData = {
                biometricType: 'face',
                templateData: 'test-data',
                qualityScore: 0.3 // Below minimum threshold
            };

            const response = await request(app)
                .post('/api/biometric/enroll')
                .set('Authorization', `Bearer ${authToken}`)
                .send(lowQualityData);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Biometric quality too low');
        });

        test('Should handle missing BLE session token', async () => {
            const validationData = {
                qrPayload: 'test-qr-payload',
                // Missing sessionToken
                biometricData: {
                    type: 'face',
                    template: 'test-template'
                }
            };

            const response = await request(app)
                .post('/api/ticket-validation/validate')
                .send(validationData);

            expect(response.status).toBe(200);
            expect(response.body.result.valid).toBe(false);
            expect(response.body.result.code).toBe('BLE_SESSION_REQUIRED');
        });
    });

    describe('API Endpoints and Documentation', () => {
        test('Should get supported biometric types', async () => {
            const response = await request(app)
                .get('/api/biometric/supported-types');

            expect(response.status).toBe(200);
            expect(response.body.supportedTypes).toBeDefined();
            expect(Array.isArray(response.body.supportedTypes)).toBe(true);
        });

        test('Should get biometric consent information', async () => {
            const response = await request(app)
                .get('/api/biometric/consent-info');

            expect(response.status).toBe(200);
            expect(response.body.consentInfo).toBeDefined();
            expect(response.body.consentInfo.version).toBeDefined();
        });

        test('Should get BLE statistics', async () => {
            const response = await request(app)
                .get(`/api/ble/statistics/${festivalId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.statistics).toBeDefined();
            expect(response.body.statistics.beacons).toBeDefined();
            expect(response.body.statistics.sessions).toBeDefined();
        });
    });
});




