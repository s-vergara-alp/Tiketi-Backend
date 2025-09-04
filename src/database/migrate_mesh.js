/**
 * migrate_mesh.js
 * 
 * Migration script to add BitChat mesh network support to existing database
 * Run this after the main database schema is created
 */

const fs = require('fs');
const path = require('path');
const database = require('./database');

async function migrateMeshTables() {
    try {
        console.log('Starting mesh network migration...');
        
        // Connect to database first (only if not already connected)
        if (!database.db) {
            await database.connect();
        }
        
        // Read the mesh schema
        const meshSchemaPath = path.join(__dirname, 'mesh_schema_simple.sql');
        const meshSchema = fs.readFileSync(meshSchemaPath, 'utf8');
        
        // Split the schema into individual statements
        // First, remove comments and normalize whitespace
        const cleanSchema = meshSchema
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('--'))
            .join(' ');
        
        // Split by semicolon and clean up
        const statements = cleanSchema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0)
            .sort((a, b) => {
                // Sort CREATE TABLE statements before CREATE INDEX statements
                const aIsTable = a.startsWith('CREATE TABLE');
                const bIsTable = b.startsWith('CREATE TABLE');
                if (aIsTable && !bIsTable) return -1;
                if (!aIsTable && bIsTable) return 1;
                return 0;
            });
        
        console.log(`Found ${statements.length} SQL statements to execute`);
        
        // Log the order of statements
        statements.forEach((stmt, i) => {
            console.log(`Statement ${i + 1}: ${stmt.substring(0, 50)}...`);
        });
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                await database.run(statement);
                console.log(`✓ Executed statement ${i + 1}/${statements.length}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⚠ Statement ${i + 1} skipped (table/index already exists)`);
                } else {
                    console.error(`✗ Error executing statement ${i + 1}:`, error.message);
                    console.error(`Statement was: ${statement}`);
                    throw error;
                }
            }
        }
        
        console.log('Mesh network migration completed successfully!');
        
        // Verify tables were created
        const tables = await database.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%mesh%' OR name LIKE '%estadia%' OR name LIKE '%offline%')"
        );
        
        console.log('Created tables:', tables.map(t => t.name));
        
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        // Only disconnect if we connected in this function
        if (require.main === module) {
            await database.disconnect();
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateMeshTables()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateMeshTables };
