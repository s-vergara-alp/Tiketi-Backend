const database = require('./database');

async function migrateEmailVerification() {
    try {
        console.log('Starting email verification migration...');
        
        // Connect to database
        await database.connect();

        // Create email_verification_tokens table
        await database.run(`
            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create indexes for better performance
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id 
            ON email_verification_tokens(user_id)
        `);

        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token 
            ON email_verification_tokens(token)
        `);

        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email 
            ON email_verification_tokens(email)
        `);

        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at 
            ON email_verification_tokens(expires_at)
        `);

        console.log('Email verification migration completed successfully');
    } catch (error) {
        console.error('Error during email verification migration:', error);
        throw error;
    } finally {
        // Disconnect from database
        await database.disconnect();
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateEmailVerification()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = migrateEmailVerification;
