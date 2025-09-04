// Test setup file for Jest

// Load environment variables FIRST, before any other imports
require('dotenv').config();

// Set environment variables for tests
process.env.NODE_ENV = 'test';

// Generate unique database path for each test run
const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9);
process.env.DB_PATH = `./database/test_festival_${uniqueId}.db`;
process.env.JWT_SECRET = 'test-secret-key-for-jwt-tokens';

jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Generate test tokens using proper JWT structure that matches auth middleware
  generateTestToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ 
      userId: userId, // Use 'userId' to match what auth middleware expects
      username: 'testuser',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }, process.env.JWT_SECRET);
  },

  // Generate test data
  generateTestUser: (id = 'test-user') => ({
    id,
    username: `testuser-${id}`,
    email: `test-${id}@example.com`,
    password_hash: 'hashedpassword',
    first_name: 'Test',
    last_name: 'User',
    is_active: 1,
    is_verified: 1
  }),

  generateTestFestival: (id = 'test-festival') => ({
    id,
    name: `Test Festival ${id}`,
    description: 'A test festival',
    venue: 'Test Venue',
    start_date: '2024-07-01 10:00:00',
    end_date: '2024-07-03 22:00:00',
    latitude: 40.7128,
    longitude: -74.0060,
    latitude_delta: 0.01,
    longitude_delta: 0.01,
    primary_color: '#FF0000',
    secondary_color: '#00FF00',
    accent_color: '#0000FF',
    background_color: '#FFFFFF',
    is_active: 1
  }),

  generateTestTemplate: (festivalId, id = 'test-template') => ({
    id,
    festival_id: festivalId,
    name: 'Test Template',
    description: 'A test ticket template',
    price: 99.99,
    currency: 'USD',
    benefits: JSON.stringify(['Test benefit 1', 'Test benefit 2']),
    max_quantity: 1000,
    current_quantity: 0,
    is_available: 1
  })
};

// Initialize test database
const fs = require('fs');
const path = require('path');
const database = require('../src/database/database');

// Import app components for proper cleanup
const { app } = require('../src/app');

beforeAll(async () => {
  // Initialize database with schema
  await database.connect();
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, '../src/database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split schema into individual statements and execute
  const statements = schema.split(';').filter(stmt => stmt.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await database.run(statement);
      } catch (error) {
        // Ignore errors for statements that might already exist
        if (!error.message.includes('already exists')) {
          console.warn('Schema statement failed:', statement, error.message);
        }
      }
    }
  }
  
  // Seed basic test data
  try {
    // Create a basic test user
    await database.run(`
      INSERT INTO users (id, username, email, password_hash, first_name, last_name, is_active, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ['test-user-base', 'testuser', 'test@example.com', 'hashed_password', 'Test', 'User', 1, 1]);
    
    // Create a basic test festival
    await database.run(`
      INSERT INTO festivals (id, name, description, venue, start_date, end_date, latitude, longitude, latitude_delta, longitude_delta, primary_color, secondary_color, accent_color, background_color, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['test-festival-base', 'Test Festival', 'A test festival', 'Test Venue', '2024-07-01 10:00:00', '2024-07-03 22:00:00', 40.7128, -74.0060, 0.01, 0.01, '#FF0000', '#00FF00', '#0000FF', '#FFFFFF', 1]);
    
    // Create a basic test template
    await database.run(`
      INSERT INTO ticket_templates (id, festival_id, name, description, price, currency, benefits, max_quantity, current_quantity, is_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['test-template-base', 'test-festival-base', 'Test Template', 'A test ticket template', 99.99, 'USD', '[]', 1000, 0, 1]);
    
    // Run mesh migration for new tables
    const { migrateMeshTables } = require('../src/database/migrate_mesh');
    await migrateMeshTables();
    
    console.log('Basic test data seeded successfully');
  } catch (error) {
    console.warn('Failed to seed basic test data:', error.message);
  }
});

afterAll(async () => {
  // Clean up database
  await database.disconnect();
  
  // Wait a bit for the connection to fully close
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Remove test database file
  const testDbPath = process.env.DB_PATH;
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      console.warn('Could not remove test database file:', error.message);
    }
  }
});

// Mock console methods to reduce noise in tests (but allow some logging for debugging)
const originalConsole = { ...console };
beforeAll(() => {
  // Allow console.error for debugging
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
