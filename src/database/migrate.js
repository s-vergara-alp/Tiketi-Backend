const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../database/tiikii_festival.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(dbPath);

// Read schema file
const schema = fs.readFileSync(schemaPath, 'utf8');

console.log('Starting database migration...');

// Execute schema
db.exec(schema, (err) => {
    if (err) {
        console.error('Error creating database schema:', err);
        process.exit(1);
    }
    
    console.log('Database schema created successfully!');
    
    // Verify tables were created
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error checking tables:', err);
        } else {
            console.log('Created tables:');
            tables.forEach(table => {
                console.log(`  - ${table.name}`);
            });
        }
        
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database migration completed successfully!');
            }
        });
    });
});
