const request = require('supertest');
const { app } = require('../src/app');
const database = require('../src/database/database');
const offlineSyncService = require('../src/services/OfflineSyncService');

describe('Offline Sync Service', () => {
    let authToken;
    let testUserId;

    beforeAll(async () => {
        // Use test utilities to generate token instead of registering/login
        testUserId = 'test-user-base'; // Use the seeded test user
        authToken = global.testUtils.generateTestToken(testUserId);
    });

    afterAll(async () => {
        // Clean up test data (but not the seeded test user)
        await database.run('DELETE FROM offline_queue WHERE user_id = ?', [testUserId]);
    });

    describe('Offline Queue Management', () => {
        test('should enqueue offline item', async () => {
            const offlineData = {
                type: 'message',
                data: {
                    sender_id: 'test-peer-001',
                    recipient_id: 'test-peer-002',
                    content: 'Offline test message',
                    timestamp: Date.now()
                }
            };

            const item = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                offlineData.type,
                offlineData.data
            );

            expect(item.user_id).toBe(testUserId);
            expect(item.type).toBe(offlineData.type);
            expect(item.data.content).toBe(offlineData.data.content);
            expect(item.is_processed).toBe(false);
        });

        test('should get offline item by ID', async () => {
            // First enqueue an item
            const offlineData = {
                type: 'favorite',
                data: {
                    peer_id: 'test-peer-003',
                    action: 'add'
                }
            };

            const enqueuedItem = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                offlineData.type,
                offlineData.data
            );

            // Get the item by ID
            const item = await offlineSyncService.getOfflineItemById(enqueuedItem.id);

            expect(item.id).toBe(enqueuedItem.id);
            expect(item.type).toBe(offlineData.type);
            expect(item.data.action).toBe(offlineData.data.action);
        });

        test('should get pending offline items for user', async () => {
            // Enqueue multiple items
            await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'location',
                { latitude: 40.7128, longitude: -74.0060, timestamp: Date.now() }
            );

            await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'notification',
                { message: 'Test notification', read: false }
            );

            const pendingItems = await offlineSyncService.getPendingOfflineItems(testUserId);

            expect(Array.isArray(pendingItems)).toBe(true);
            expect(pendingItems.length).toBeGreaterThan(0);
            expect(pendingItems.every(item => item.is_processed === false)).toBe(true);
        });

        test('should mark item as processed', async () => {
            // Enqueue an item
            const enqueuedItem = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'message',
                { estadia_id: 'test-estadia-001', status: 'checked_in' }
            );

            // Mark as processed
            await offlineSyncService.markItemAsProcessed(enqueuedItem.id);

            // Verify it's marked as processed
            const item = await offlineSyncService.getOfflineItemById(enqueuedItem.id);
            expect(item.is_processed).toBe(true);
            expect(item.processed_at).toBeDefined();
        });

        test('should process offline queue', async () => {
            // Enqueue some test items
            await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'message',
                { sender_id: 'test-peer-004', content: 'Queue test message' }
            );

            await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'favorite',
                { peer_id: 'test-peer-005', action: 'remove' }
            );

            // Process the queue
            const results = await offlineSyncService.processOfflineQueue(testUserId);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results.every(result => result.hasOwnProperty('itemId'))).toBe(true);
        });

        test('should handle missing data gracefully', async () => {
            await expect(offlineSyncService.enqueueOfflineItem()).rejects.toThrow();
            await expect(offlineSyncService.enqueueOfflineItem(testUserId)).rejects.toThrow();
            await expect(offlineSyncService.enqueueOfflineItem(testUserId, 'test')).rejects.toThrow();
        });

        test('should return empty array for user with no pending items', async () => {
            // Create a different user ID that has no items
            const emptyUserId = 'non-existent-user-id';
            const pendingItems = await offlineSyncService.getPendingOfflineItems(emptyUserId);
            
            expect(Array.isArray(pendingItems)).toBe(true);
            expect(pendingItems.length).toBe(0);
        });
    });

    describe('Different Offline Item Types', () => {
        test('should handle message type items', async () => {
            const messageData = {
                sender_id: 'test-peer-006',
                recipient_id: 'test-peer-007',
                content: 'Test offline message',
                is_encrypted: true,
                metadata: { message_type: 'text' }
            };

            const item = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'message',
                messageData
            );

            expect(item.type).toBe('message');
            expect(item.data.sender_id).toBe(messageData.sender_id);
            expect(item.data.is_encrypted).toBe(true);
        });

        test('should handle favorite type items', async () => {
            const favoriteData = {
                peer_id: 'test-peer-008',
                action: 'add',
                timestamp: Date.now()
            };

            const item = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'favorite',
                favoriteData
            );

            expect(item.type).toBe('favorite');
            expect(item.data.peer_id).toBe(favoriteData.peer_id);
            expect(item.data.action).toBe('add');
        });

        test('should handle location type items', async () => {
            const locationData = {
                latitude: 40.7589,
                longitude: -73.9851,
                accuracy: 10,
                timestamp: Date.now(),
                metadata: { venue: 'Times Square' }
            };

            const item = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'location',
                locationData
            );

            expect(item.type).toBe('location');
            expect(item.data.latitude).toBe(locationData.latitude);
            expect(item.data.metadata.venue).toBe('Times Square');
        });

        test('should handle notification type items', async () => {
            const notificationData = {
                title: 'Test Notification',
                message: 'This is a test notification from offline mode',
                type: 'info',
                read: false,
                timestamp: Date.now()
            };

            const item = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'notification',
                notificationData
            );

            expect(item.type).toBe('notification');
            expect(item.data.title).toBe(notificationData.title);
            expect(item.data.read).toBe(false);
        });

        test('should handle notification type items with estadia data', async () => {
            const estadiaUpdateData = {
                estadia_id: 'test-estadia-002',
                status: 'checked_out',
                check_out_time: new Date().toISOString(),
                metadata: { reason: 'Early departure' }
            };

            const item = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'notification',
                estadiaUpdateData
            );

            expect(item.type).toBe('notification');
            expect(item.data.estadia_id).toBe(estadiaUpdateData.estadia_id);
            expect(item.data.status).toBe('checked_out');
        });
    });

    describe('Queue Processing Logic', () => {
        test('should process items in correct order (FIFO)', async () => {
            // Clear existing items first
            await database.run('DELETE FROM offline_queue WHERE user_id = ?', [testUserId]);

            // Enqueue items with timestamps
            const item1 = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'message',
                { content: 'First message', order: 1 }
            );

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            const item2 = await offlineSyncService.enqueueOfflineItem(
                testUserId,
                'message',
                { content: 'Second message', order: 2 }
            );

            // Get pending items (should be in order)
            const pendingItems = await offlineSyncService.getPendingOfflineItems(testUserId);

            expect(pendingItems.length).toBe(2);
            expect(pendingItems[0].id).toBe(item1.id);
            expect(pendingItems[1].id).toBe(item2.id);
        });

        test('should handle processing errors gracefully', async () => {
            // This test would require mocking the actual processing logic
            // For now, we'll test that the service doesn't crash on processing
            const results = await offlineSyncService.processOfflineQueue(testUserId);
            
            expect(Array.isArray(results)).toBe(true);
            // Results should contain success/failure information
            results.forEach(result => {
                expect(result).toHaveProperty('itemId');
                expect(result).toHaveProperty('success');
            });
        });
    });
});
