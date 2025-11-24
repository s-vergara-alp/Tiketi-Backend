// Load configuration first (which loads environment variables)
const config = require('./config');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import enhanced security middleware
const {
    requestId,
    createRateLimiters,
    speedLimiter,
    corsOptions,
    helmetConfig,
    securityHeaders,
    requestTiming,
    sanitizeInput,
    apiVersioning,
    requestSizeLimit,
    enhancedLogging
} = require('./middleware/security');

// Import database
const database = require('./database/database');

// Import routes
const authRoutes = require('./routes/auth');
const festivalRoutes = require('./routes/festivals');
const ticketRoutes = require('./routes/tickets');
const chatRoutes = require('./routes/chat');
const widgetRoutes = require('./routes/widgets');
const userRoutes = require('./routes/users');
const vendorRoutes = require('./routes/vendors');
const poiRoutes = require('./routes/pois');
const scheduleRoutes = require('./routes/schedule');
const artistRoutes = require('./routes/artists');
const meshRoutes = require('./routes/mesh');
const bleRoutes = require('./routes/ble');
const biometricRoutes = require('./routes/biometric');
const ticketValidationRoutes = require('./routes/ticket-validation');
const adminRoutes = require('./routes/admin');
const roomRoutes = require('./routes/room');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Import socket handlers
const { setupSocketHandlers } = require('./socket/handlers');

const app = express();

// Create server and Socket.IO (will be started in index.js)
const server = createServer(app);

// Enhanced Socket.IO configuration with security
const io = new Server(server, {
    cors: {
        origin: [
            process.env.CLIENT_URL || "http://localhost:3000",
            "https://tiikii.com",
            "https://www.tiikii.com"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: false, // Disable older Engine.IO versions
    pingTimeout: 60000,
    pingInterval: 25000
});

// Create rate limiters
const { generalLimiter, authLimiter, apiKeyLimiter } = createRateLimiters();

// ===== ENHANCED SECURITY MIDDLEWARE STACK =====

// 1. Request timing (must be first)
app.use(requestTiming);

// 2. Request ID for tracking
app.use(requestId);

// 3. Enhanced logging
app.use(enhancedLogging);

// 4. Enhanced Helmet security headers
app.use(helmet(helmetConfig));

// 5. Additional security headers
app.use(securityHeaders);

// 6. API versioning
app.use(apiVersioning);

// 7. Request size limiting
app.use(requestSizeLimit);

// 8. Input sanitization
app.use(sanitizeInput);

// 9. Enhanced CORS
app.use(cors(corsOptions));

// 10. Compression
app.use(compression());

// 11. Morgan logging (development only)
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// 12. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 13. Rate limiting for unauthenticated routes (DISABLED)
// app.use('/api/auth', authLimiter);
// app.use('/api/festivals', generalLimiter);
// app.use('/api/widgets', generalLimiter);
// app.use('/api/vendors', generalLimiter);
// app.use('/api/pois', generalLimiter);
// app.use('/api/schedule', generalLimiter);
// app.use('/api/artists', generalLimiter);

// ===== ROUTES =====

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/festivals', festivalRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/pois', poiRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/artists', artistRoutes);

// BLE and biometric routes (public for validation)
app.use('/api/ble', bleRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/ticket-validation', ticketValidationRoutes);

// Protected routes with authentication and rate limiting (RATE LIMITING DISABLED)
app.use('/api/tickets', authenticateToken, ticketRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/mesh', authenticateToken, meshRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/room', roomRoutes);

// Serve static files (if any)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Error handling middleware
app.use(errorHandler);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Export both app and server for testing and production
module.exports = { app, server, io };
