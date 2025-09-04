const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
    }

    getDbPath() {
        // Use environment variable for test database, fallback to production database
        if (process.env.DB_PATH) {
            // If DB_PATH is set, use it directly (could be relative or absolute)
            return path.isAbsolute(process.env.DB_PATH) 
                ? process.env.DB_PATH 
                : path.join(process.cwd(), process.env.DB_PATH);
        } else {
            // Default to production database
            return path.join(__dirname, '../../database/tiikii_festival.db');
        }
    }

    connect() {
        return new Promise((resolve, reject) => {
            const dbPath = this.getDbPath();
            console.log('Connecting to database at:', dbPath);
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database at:', dbPath);
                    resolve();
                }
            });
        });
    }

    disconnect() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        this.db = null;
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Helper method to run queries that don't return results
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    // Helper method to get a single row
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Helper method to get multiple rows
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Database all error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Helper method to execute multiple statements
    exec(sql) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.exec(sql, (err) => {
                if (err) {
                    console.error('Database exec error:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Transaction helper
    async transaction(callback) {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION', (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    try {
                        callback(this)
                            .then(result => {
                                this.db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        reject(commitErr);
                                    } else {
                                        resolve(result);
                                    }
                                });
                            })
                            .catch(error => {
                                this.db.run('ROLLBACK', () => {
                                    reject(error);
                                });
                            });
                    } catch (error) {
                        this.db.run('ROLLBACK', () => {
                            reject(error);
                        });
                    }
                });
            });
        });
    }

    // Utility method to check if database exists and has tables
    async checkDatabase() {
        try {
            const tables = await this.all("SELECT name FROM sqlite_master WHERE type='table'");
            return tables.length > 0;
        } catch (error) {
            console.error('Error checking database:', error);
            return false;
        }
    }

    // Utility method to get table info
    async getTableInfo(tableName) {
        try {
            return await this.all(`PRAGMA table_info(${tableName})`);
        } catch (error) {
            console.error(`Error getting table info for ${tableName}:`, error);
            throw error;
        }
    }

    // Utility method to get row count
    async getRowCount(tableName) {
        try {
            const result = await this.get(`SELECT COUNT(*) as count FROM ${tableName}`);
            return result ? result.count : 0;
        } catch (error) {
            console.error(`Error getting row count for ${tableName}:`, error);
            throw error;
        }
    }
}

// Create singleton instance
const database = new Database();

module.exports = database;
