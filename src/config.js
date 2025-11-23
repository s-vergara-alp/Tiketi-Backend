// Configuration file - must be loaded first before any other imports
require('dotenv').config();

// Export configuration object
module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    DB_PATH: process.env.DB_PATH || './database/tiikii_festival.db',
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
    
    // Email configuration
    EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
    EMAIL_PORT: process.env.EMAIL_PORT || 587,
    EMAIL_SECURE: process.env.EMAIL_SECURE === 'true' || false,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    
    // Email verification settings
    EMAIL_VERIFICATION_EXPIRY_HOURS: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS) || 24,
    EMAIL_VERIFICATION_URL: process.env.EMAIL_VERIFICATION_URL || `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email`
};


