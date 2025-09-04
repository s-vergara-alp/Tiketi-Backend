// Configuration file - must be loaded first before any other imports
require('dotenv').config();

// Export configuration object
module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    DB_PATH: process.env.DB_PATH || './database/tiikii_festival.db',
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000'
};


