const jwt = require('jsonwebtoken');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-tokens';

console.log('JWT_SECRET:', process.env.JWT_SECRET);

// Generate a test token
const token = jwt.sign({ 
    id: 'test-user-123', 
    username: 'testuser',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
}, process.env.JWT_SECRET);

console.log('Generated token:', token);

// Verify the token
try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified successfully:', decoded);
} catch (error) {
    console.error('Token verification failed:', error.message);
}

// Test with the same secret that the auth middleware uses
const authMiddleware = require('./src/middleware/auth');
console.log('Auth middleware JWT_SECRET:', process.env.JWT_SECRET);
