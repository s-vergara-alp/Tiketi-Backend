const database = require('./database');

async function migrate() {
    await database.connect();
    
    console.log('Creating door_locks table...');
    await database.run(`
        CREATE TABLE IF NOT EXISTS door_locks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            location TEXT,
            ble_address TEXT NOT NULL,
            ble_name TEXT,
            status TEXT DEFAULT 'unknown' CHECK (status IN ('locked', 'unlocked', 'unknown')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('Creating room_permissions table...');
    await database.run(`
        CREATE TABLE IF NOT EXISTS room_permissions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            room_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES door_locks(id) ON DELETE CASCADE,
            UNIQUE(user_id, room_id)
        )
    `);

    console.log('Creating unlock_logs table...');
    await database.run(`
        CREATE TABLE IF NOT EXISTS unlock_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            room_id TEXT NOT NULL,
            success BOOLEAN NOT NULL,
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES door_locks(id) ON DELETE CASCADE
        )
    `);

    console.log('Creating indexes...');
    await database.run(`CREATE INDEX IF NOT EXISTS idx_door_locks_ble_address ON door_locks(ble_address)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_room_permissions_user_id ON room_permissions(user_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_room_permissions_room_id ON room_permissions(room_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_unlock_logs_user_id ON unlock_logs(user_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_unlock_logs_room_id ON unlock_logs(room_id)`);
    await database.run(`CREATE INDEX IF NOT EXISTS idx_unlock_logs_created_at ON unlock_logs(created_at)`);

    await database.disconnect();
    console.log('Room migration completed successfully!');
}

if (require.main === module) {
    migrate()
        .then(() => {
            console.log('Migration finished');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = migrate;
