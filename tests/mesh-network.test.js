const request = require('supertest');
const { app } = require('../src/app');
const database = require('../src/database/database');
const meshNetworkService = require('../src/services/MeshNetworkService');
const cryptoUtils = require('../src/utils/cryptoUtils');

describe('Mesh Network Service', () => {
    let authToken;
    let testUserId;

    beforeAll(async () => {
        // Use test utilities to generate token instead of registering/login
        testUserId = 'test-user-base'; // Use the seeded test user
        authToken = global.testUtils.generateTestToken(testUserId);
    });

    afterAll(async () => {
        // Clean up test data (but not the seeded test user)
        await database.run('DELETE FROM mesh_peers WHERE nickname LIKE ?', ['%test%']);
        await database.run('DELETE FROM mesh_messages WHERE content LIKE ?', ['%test%']);
    });

    describe('Peer Management', () => {
        test('should register a new mesh peer', async () => {
            const peerData = {
                id: 'test-peer-001',
                noise_public_key: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                signing_public_key: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
                nickname: 'TestPeer001',
                is_connected: true,
                is_reachable: true,
                metadata: { device_type: 'mobile', app_version: '1.0.0' }
            };

            const response = await request(app)
                .post('/api/mesh/peers')
                .set('Authorization', `Bearer ${authToken}`)
                .send(peerData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(peerData.id);
            expect(response.body.data.nickname).toBe(peerData.nickname);
            expect(response.body.data.is_connected).toBe(true);
        });

        test('should update an existing mesh peer', async () => {
            const updateData = {
                id: 'test-peer-001',
                noise_public_key: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                signing_public_key: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
                nickname: 'TestPeer001Updated',
                is_connected: false,
                is_reachable: true,
                metadata: { device_type: 'mobile', app_version: '1.1.0' }
            };

            const response = await request(app)
                .post('/api/mesh/peers')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.data.nickname).toBe('TestPeer001Updated');
            expect(response.body.data.is_connected).toBe(false);
        });

        test('should get all mesh peers', async () => {
            const response = await request(app)
                .get('/api/mesh/peers')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        test('should get a specific mesh peer by ID', async () => {
            const response = await request(app)
                .get('/api/mesh/peers/test-peer-001')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('test-peer-001');
        });

        test('should return 404 for non-existent peer', async () => {
            const response = await request(app)
                .get('/api/mesh/peers/non-existent-peer')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error.message).toBe('Mesh peer not found');
        });

        test('should validate required fields for peer registration', async () => {
            const invalidPeerData = {
                id: 'test-peer-002',
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/mesh/peers')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidPeerData);

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('Invalid value');
        });
    });

    describe('Message Management', () => {
        test('should store a mesh message', async () => {
            const messageData = {
                sender_id: 'test-peer-001',
                recipient_id: 'test-peer-002',
                content: 'Test message from mesh network',
                is_private: true,
                is_encrypted: true,
                delivery_status: 'sent',
                metadata: { message_type: 'text', timestamp: Date.now() }
            };

            const response = await request(app)
                .post('/api/mesh/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .send(messageData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe(messageData.content);
            expect(response.body.data.is_private).toBe(true);
        });

        test('should get messages for a specific peer', async () => {
            const response = await request(app)
                .get('/api/mesh/messages/test-peer-001')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('should update message delivery status', async () => {
            // First, get a message ID
            const messagesResponse = await request(app)
                .get('/api/mesh/messages/test-peer-001')
                .set('Authorization', `Bearer ${authToken}`);

            if (messagesResponse.body.data.length > 0) {
                const messageId = messagesResponse.body.data[0].id;
                
                const response = await request(app)
                    .put(`/api/mesh/messages/${messageId}/status`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ status: 'delivered' });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            }
        });

        test('should validate message data', async () => {
            const invalidMessageData = {
                // Missing required fields
                content: 'Test message'
            };

            const response = await request(app)
                .post('/api/mesh/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidMessageData);

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('Invalid value');
        });
    });

    describe('Identity Generation', () => {
        test('should generate user identity', async () => {
            const identity = await meshNetworkService.generateUserIdentity(testUserId);
            
            expect(identity).toHaveProperty('userId');
            expect(identity).toHaveProperty('noisePublicKey');
            expect(identity).toHaveProperty('signingPublicKey');
            expect(identity).toHaveProperty('fingerprint');
            expect(identity.userId).toBe(testUserId);
        });
    });

    describe('Service Layer Tests', () => {
        test('should upsert peer directly through service', async () => {
            const randomSuffix = Math.random().toString(36).substring(7);
            const peerData = {
                id: `service-test-peer-${randomSuffix}`,
                noise_public_key: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc${randomSuffix.padEnd(3, '0').substring(0, 3)}`,
                signing_public_key: `fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543${randomSuffix.padEnd(3, '0').substring(0, 3)}`,
                nickname: `ServiceTestPeer${randomSuffix}`,
                is_connected: true,
                is_reachable: false
            };

            const peer = await meshNetworkService.upsertPeer(peerData);
            expect(peer.id).toBe(peerData.id);
            expect(peer.nickname).toBe(peerData.nickname);
        });

        test('should store message directly through service', async () => {
            const messageData = {
                sender_id: 'service-test-peer',
                content: 'Service test message',
                is_private: false,
                is_encrypted: false
            };

            const message = await meshNetworkService.storeMeshMessage(messageData);
            expect(message.content).toBe(messageData.content);
            expect(message.sender_id).toBe(messageData.sender_id);
        });

        test('should handle missing peer data gracefully', async () => {
            await expect(meshNetworkService.upsertPeer({})).rejects.toThrow();
        });

        test('should handle missing message data gracefully', async () => {
            await expect(meshNetworkService.storeMeshMessage({})).rejects.toThrow();
        });
    });
});
