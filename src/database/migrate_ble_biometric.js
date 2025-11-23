const database = require('./database');

async function migrateBLEBiometric() {
    try {
        console.log('Starting BLE and biometric migration...');

        // Connect to database
        await database.connect();

        // Add new columns to users table (check if they exist first)
        try {
            await database.run(`
                ALTER TABLE users ADD COLUMN biometric_enrolled BOOLEAN DEFAULT 0
            `);
            console.log('Added biometric_enrolled column to users table');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('biometric_enrolled column already exists, skipping');
            } else {
                throw error;
            }
        }

        try {
            await database.run(`
                ALTER TABLE users ADD COLUMN biometric_consent_at DATETIME
            `);
            console.log('Added biometric_consent_at column to users table');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('biometric_consent_at column already exists, skipping');
            } else {
                throw error;
            }
        }

        try {
            await database.run(`
                ALTER TABLE users ADD COLUMN biometric_consent_version TEXT
            `);
            console.log('Added biometric_consent_version column to users table');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('biometric_consent_version column already exists, skipping');
            } else {
                throw error;
            }
        }

        // Add new columns to festivals table (check if they exist first)
        try {
            await database.run(`
                ALTER TABLE festivals ADD COLUMN ble_enabled BOOLEAN DEFAULT 1
            `);
            console.log('Added ble_enabled column to festivals table');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('ble_enabled column already exists, skipping');
            } else {
                throw error;
            }
        }

        try {
            await database.run(`
                ALTER TABLE festivals ADD COLUMN biometric_enabled BOOLEAN DEFAULT 1
            `);
            console.log('Added biometric_enabled column to festivals table');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('biometric_enabled column already exists, skipping');
            } else {
                throw error;
            }
        }

        // Add new columns to tickets table (check if they exist first)
        try {
            await database.run(`
                ALTER TABLE tickets ADD COLUMN biometric_required BOOLEAN DEFAULT 0
            `);
            console.log('Added biometric_required column to tickets table');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('biometric_required column already exists, skipping');
            } else {
                throw error;
            }
        }

        try {
            await database.run(`
                ALTER TABLE tickets ADD COLUMN ble_validation_required BOOLEAN DEFAULT 1
            `);
            console.log('Added ble_validation_required column to tickets table');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('ble_validation_required column already exists, skipping');
            } else {
                throw error;
            }
        }

        // Create biometric_data table
        await database.run(`
            CREATE TABLE IF NOT EXISTS biometric_data (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                biometric_type TEXT NOT NULL CHECK (biometric_type IN ('face', 'fingerprint', 'voice', 'iris')),
                template_data TEXT NOT NULL,
                template_hash TEXT NOT NULL,
                encryption_key_id TEXT NOT NULL,
                quality_score REAL,
                enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used_at DATETIME,
                is_active BOOLEAN DEFAULT 1,
                metadata TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Created biometric_data table');

        // Create ble_beacons table
        await database.run(`
            CREATE TABLE IF NOT EXISTS ble_beacons (
                id TEXT PRIMARY KEY,
                festival_id TEXT NOT NULL,
                name TEXT NOT NULL,
                location_name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                mac_address TEXT UNIQUE NOT NULL,
                uuid TEXT NOT NULL,
                major INTEGER NOT NULL,
                minor INTEGER NOT NULL,
                tx_power INTEGER DEFAULT -59,
                rssi_threshold INTEGER DEFAULT -70,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
            )
        `);
        console.log('Created ble_beacons table');

        // Create ble_validation_sessions table
        await database.run(`
            CREATE TABLE IF NOT EXISTS ble_validation_sessions (
                id TEXT PRIMARY KEY,
                beacon_id TEXT NOT NULL,
                user_id TEXT,
                device_id TEXT,
                session_token TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'active' CHECK (status IN ('active', 'validated', 'expired', 'cancelled')),
                proximity_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                validated_at DATETIME,
                FOREIGN KEY (beacon_id) REFERENCES ble_beacons(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('Created ble_validation_sessions table');

        // Create secure_qr_codes table
        await database.run(`
            CREATE TABLE IF NOT EXISTS secure_qr_codes (
                id TEXT PRIMARY KEY,
                ticket_id TEXT NOT NULL,
                qr_payload TEXT UNIQUE NOT NULL,
                encrypted_data TEXT NOT NULL,
                signature TEXT NOT NULL,
                nonce TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                is_used BOOLEAN DEFAULT 0,
                used_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            )
        `);
        console.log('Created secure_qr_codes table');

        // Create ticket_validations table
        await database.run(`
            CREATE TABLE IF NOT EXISTS ticket_validations (
                id TEXT PRIMARY KEY,
                ticket_id TEXT NOT NULL,
                qr_payload TEXT UNIQUE NOT NULL,
                validated_at DATETIME NOT NULL,
                status TEXT DEFAULT 'used' CHECK (status IN ('used', 'invalid', 'expired', 'duplicate')),
                validator_id TEXT,
                beacon_id TEXT,
                location TEXT,
                biometric_verified BOOLEAN DEFAULT 0,
                biometric_confidence REAL,
                validation_method TEXT CHECK (validation_method IN ('qr_only', 'qr_ble', 'qr_biometric', 'qr_ble_biometric')),
                device_info TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
                FOREIGN KEY (validator_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (beacon_id) REFERENCES ble_beacons(id) ON DELETE SET NULL
            )
        `);
        console.log('Created ticket_validations table');

        // Create encryption_keys table
        await database.run(`
            CREATE TABLE IF NOT EXISTS encryption_keys (
                id TEXT PRIMARY KEY,
                key_type TEXT NOT NULL CHECK (key_type IN ('qr_encryption', 'biometric_encryption', 'session_encryption')),
                key_data TEXT NOT NULL,
                key_version INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                rotated_at DATETIME
            )
        `);
        console.log('Created encryption_keys table');

        // Create biometric_verification_attempts table
        await database.run(`
            CREATE TABLE IF NOT EXISTS biometric_verification_attempts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT,
                biometric_type TEXT NOT NULL,
                verification_result TEXT NOT NULL CHECK (verification_result IN ('success', 'failure', 'error')),
                confidence_score REAL,
                attempt_data TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES ble_validation_sessions(id) ON DELETE SET NULL
            )
        `);
        console.log('Created biometric_verification_attempts table');

        // Create indexes
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_biometric_data_user_id ON biometric_data(user_id)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_biometric_data_type ON biometric_data(biometric_type)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ble_beacons_festival_id ON ble_beacons(festival_id)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ble_beacons_mac_address ON ble_beacons(mac_address)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ble_validation_sessions_beacon_id ON ble_validation_sessions(beacon_id)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ble_validation_sessions_user_id ON ble_validation_sessions(user_id)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ble_validation_sessions_status ON ble_validation_sessions(status)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_secure_qr_codes_ticket_id ON secure_qr_codes(ticket_id)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_secure_qr_codes_qr_payload ON secure_qr_codes(qr_payload)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ticket_validations_ticket_id ON ticket_validations(ticket_id)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ticket_validations_qr_payload ON ticket_validations(qr_payload)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_ticket_validations_validated_at ON ticket_validations(validated_at)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_biometric_verification_attempts_user_id ON biometric_verification_attempts(user_id)
        `);
        await database.run(`
            CREATE INDEX IF NOT EXISTS idx_biometric_verification_attempts_session_id ON biometric_verification_attempts(session_id)
        `);
        console.log('Created all indexes');

        console.log('BLE and biometric migration completed successfully');
    } catch (error) {
        console.error('Error during BLE and biometric migration:', error);
        throw error;
    } finally {
        // Disconnect from database
        await database.disconnect();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateBLEBiometric()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateBLEBiometric };
