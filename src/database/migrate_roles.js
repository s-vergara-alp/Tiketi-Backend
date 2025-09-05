const database = require('./database');

/**
 * Migration to add role-based access control columns to users table
 */
async function migrateRoles() {
    try {
        console.log('Starting role migration...');
        
        // Connect to database
        await database.connect();
        
        // Check if columns already exist
        const tableInfo = await database.all("PRAGMA table_info(users)");
        const existingColumns = tableInfo.map(col => col.name);
        
        const newColumns = [
            { name: 'is_admin', type: 'BOOLEAN DEFAULT 0' },
            { name: 'is_staff', type: 'BOOLEAN DEFAULT 0' },
            { name: 'is_security', type: 'BOOLEAN DEFAULT 0' },
            { name: 'role', type: 'TEXT DEFAULT "user"' }
        ];
        
        for (const column of newColumns) {
            if (!existingColumns.includes(column.name)) {
                console.log(`Adding column: ${column.name}`);
                await database.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
            } else {
                console.log(`Column ${column.name} already exists, skipping...`);
            }
        }
        
        // Create some default admin users for testing
        const adminUsers = await database.all('SELECT id FROM users WHERE is_admin = 1 OR role = "admin"');
        if (adminUsers.length === 0) {
            console.log('No admin users found, creating default admin...');
            // Get the first user and make them admin
            const firstUser = await database.get('SELECT id FROM users ORDER BY created_at LIMIT 1');
            if (firstUser) {
                await database.run(
                    'UPDATE users SET is_admin = 1, is_staff = 1, is_security = 1, role = "admin" WHERE id = ?',
                    [firstUser.id]
                );
                console.log(`Made user ${firstUser.id} an admin`);
            }
        }
        
        console.log('Role migration completed successfully!');
        
    } catch (error) {
        console.error('Error during role migration:', error);
        throw error;
    } finally {
        // Disconnect from database
        await database.disconnect();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateRoles()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateRoles };
