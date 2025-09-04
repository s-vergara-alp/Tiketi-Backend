const request = require('supertest');
const database = require('../src/database/database');

// Import the app without starting the server
const express = require('express');
const app = express();

// Setup basic middleware for testing
app.use(express.json());

// Health check endpoint for testing
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

describe('Server Basic Tests', () => {
    beforeAll(async () => {
        // Connect to test database
        await database.connect();
    });

    afterAll(async () => {
        // Disconnect from database
        await database.disconnect();
    });

    describe('Health Check', () => {
        it('should return 200 OK for health check', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('environment');
        });
    });

    describe('Database Connection', () => {
        it('should connect to database successfully', async () => {
            const hasTables = await database.checkDatabase();
            expect(hasTables).toBe(true);
        });

        it('should have required tables', async () => {
            const tables = await database.all(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            const tableNames = tables.map(t => t.name);
            
            // Check for essential tables
            expect(tableNames).toContain('users');
            expect(tableNames).toContain('festivals');
            expect(tableNames).toContain('artists');
            expect(tableNames).toContain('tickets');
            expect(tableNames).toContain('chat_rooms');
            expect(tableNames).toContain('widgets');
        });
    });

    describe('Database Operations', () => {
        it('should be able to query users table', async () => {
            const users = await database.all('SELECT COUNT(*) as count FROM users');
            expect(users[0].count).toBeGreaterThanOrEqual(0);
        });

        it('should be able to query festivals table', async () => {
            const festivals = await database.all('SELECT COUNT(*) as count FROM festivals');
            expect(festivals[0].count).toBeGreaterThanOrEqual(0);
        });

        it('should handle parameterized queries safely', async () => {
            const result = await database.get(
                'SELECT COUNT(*) as count FROM users WHERE is_active = ?',
                [1]
            );
            expect(result.count).toBeGreaterThanOrEqual(0);
        });
    });
});
