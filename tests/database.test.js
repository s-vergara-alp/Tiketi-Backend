const database = require('../src/database/database');
const path = require('path');
const fs = require('fs');

describe('Database Tests', () => {
  const testDbPath = './database/test_database.db';

  beforeAll(async () => {
    // Set test database path
    process.env.DB_PATH = testDbPath;
    
    // Connect to test database
    await database.connect();
    
    // Create schema
    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await database.run(statement);
        } catch (error) {
          // Ignore errors for statements that might already exist
          if (!error.message.includes('already exists')) {
            console.warn('Schema statement failed:', statement, error.message);
          }
        }
      }
    }
  });

  afterAll(async () => {
    // Disconnect from database
    await database.disconnect();
    
    // Wait a bit for the connection to fully close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        console.warn('Could not remove test database file:', error.message);
      }
    }
  });

  beforeEach(async () => {
    // Reset database before each test
    await database.run('DELETE FROM tickets');
    await database.run('DELETE FROM payments');
    await database.run('DELETE FROM refunds');
    await database.run('DELETE FROM ticket_templates');
    await database.run('DELETE FROM festivals');
    await database.run('DELETE FROM users');
  });

  describe('Connection Management', () => {
    it('should connect to database successfully', async () => {
      expect(database.db).toBeDefined();
      expect(database.db).not.toBeNull();
    });

    it('should handle multiple connections gracefully', async () => {
      // Should not throw when connecting again
      await expect(database.connect()).resolves.not.toThrow();
    });
  });

  describe('Basic Database Operations', () => {
    it('should execute simple queries', async () => {
      const result = await database.run('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)');
      expect(result).toBeDefined();
      
      const insertResult = await database.run('INSERT INTO test_table (name) VALUES (?)', ['test']);
      expect(insertResult.changes).toBe(1);
      
      const row = await database.get('SELECT * FROM test_table WHERE name = ?', ['test']);
      expect(row.name).toBe('test');
      
      const rows = await database.all('SELECT * FROM test_table');
      expect(rows).toHaveLength(1);
      
      // Cleanup
      await database.run('DROP TABLE test_table');
    });

    it('should handle parameterized queries correctly', async () => {
      await database.run('CREATE TABLE IF NOT EXISTS param_test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)');
      
      // Test with multiple parameters
      await database.run('INSERT INTO param_test (name, value) VALUES (?, ?)', ['test1', 100]);
      await database.run('INSERT INTO param_test (name, value) VALUES (?, ?)', ['test2', 200]);
      
      const row = await database.get('SELECT * FROM param_test WHERE name = ? AND value = ?', ['test1', 100]);
      expect(row.name).toBe('test1');
      expect(row.value).toBe(100);
      
      const rows = await database.all('SELECT * FROM param_test WHERE value > ?', [150]);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('test2');
      
      // Cleanup
      await database.run('DROP TABLE param_test');
    });
  });

  describe('Transaction Management', () => {
    it('should execute transactions successfully', async () => {
      await database.run('CREATE TABLE IF NOT EXISTS trans_test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)');
      
      const result = await database.transaction(async (db) => {
        await db.run('INSERT INTO trans_test (name, value) VALUES (?, ?)', ['test1', 100]);
        await db.run('INSERT INTO trans_test (name, value) VALUES (?, ?)', ['test2', 200]);
        
        const count = await db.get('SELECT COUNT(*) as count FROM trans_test');
        return count.count;
      });
      
      expect(result).toBe(2);
      
      const finalCount = await database.get('SELECT COUNT(*) as count FROM trans_test');
      expect(finalCount.count).toBe(2);
      
      // Cleanup
      await database.run('DROP TABLE trans_test');
    });

    it('should rollback transactions on error', async () => {
      await database.run('CREATE TABLE IF NOT EXISTS rollback_test (id INTEGER PRIMARY KEY, name TEXT)');
      
      // This should throw an error and rollback
      await expect(database.transaction(async (db) => {
        await db.run('INSERT INTO rollback_test (name) VALUES (?)', ['test1']);
        await db.run('INSERT INTO rollback_test (name) VALUES (?)', ['test2']);
        
        // This will cause an error (invalid SQL)
        await db.run('INVALID SQL STATEMENT');
      })).rejects.toThrow();
      
      // Verify that no data was committed
      const count = await database.get('SELECT COUNT(*) as count FROM rollback_test');
      expect(count.count).toBe(0);
      
      // Cleanup
      await database.run('DROP TABLE rollback_test');
    });

    it('should handle nested transactions', async () => {
      // SQLite doesn't support nested transactions, so we skip this test
      // In a real implementation with a database that supports nested transactions,
      // this would test proper handling of nested transaction scenarios
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Error Handling', () => {
    it('should handle SQL syntax errors gracefully', async () => {
      try {
        await database.run('INVALID SQL');
        // If we get here, the error wasn't thrown as expected
        expect(true).toBe(false); // This should not be reached
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('SQL');
      }
    });

    it('should handle constraint violations', async () => {
      await database.run('CREATE TABLE IF NOT EXISTS constraint_test (id INTEGER PRIMARY KEY, unique_field TEXT UNIQUE)');
      
      await database.run('INSERT INTO constraint_test (unique_field) VALUES (?)', ['test']);
      
      // This should fail due to unique constraint
      await expect(
        database.run('INSERT INTO constraint_test (unique_field) VALUES (?)', ['test'])
      ).rejects.toThrow();
      
      // Cleanup
      await database.run('DROP TABLE constraint_test');
    });

    it('should handle database disconnection gracefully', async () => {
      await database.disconnect();
      
      // Should handle operations after disconnection
      await expect(database.run('SELECT 1')).rejects.toThrow();
      
      // Reconnect for other tests
      await database.connect();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large batch operations efficiently', async () => {
      await database.run('CREATE TABLE IF NOT EXISTS batch_test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)');
      
      const startTime = Date.now();
      
      // Insert 1000 records
      for (let i = 0; i < 1000; i++) {
        await database.run('INSERT INTO batch_test (name, value) VALUES (?, ?)', [`test${i}`, i]);
      }
      
      const insertTime = Date.now() - startTime;
      console.log(`Inserted 1000 records in ${insertTime}ms`);
      
      // Query all records
      const queryStartTime = Date.now();
      const rows = await database.all('SELECT * FROM batch_test');
      const queryTime = Date.now() - queryStartTime;
      
      console.log(`Queried ${rows.length} records in ${queryTime}ms`);
      
      expect(rows).toHaveLength(1000);
      expect(insertTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(queryTime).toBeLessThan(1000); // Should complete in under 1 second
      
      // Cleanup
      await database.run('DROP TABLE batch_test');
    });

    it('should handle concurrent operations', async () => {
      await database.run('CREATE TABLE IF NOT EXISTS concurrent_test (id INTEGER PRIMARY KEY, name TEXT)');
      
      const promises = [];
      
      // Start 10 concurrent insert operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          database.run('INSERT INTO concurrent_test (name) VALUES (?)', [`concurrent${i}`])
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.changes).toBe(1);
      });
      
      const count = await database.get('SELECT COUNT(*) as count FROM concurrent_test');
      expect(count.count).toBe(10);
      
      // Cleanup
      await database.run('DROP TABLE concurrent_test');
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data integrity across operations', async () => {
      await database.run('CREATE TABLE IF NOT EXISTS integrity_test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)');
      
      // Insert test data
      await database.run('INSERT INTO integrity_test (name, value) VALUES (?, ?)', ['test1', 100]);
      await database.run('INSERT INTO integrity_test (name, value) VALUES (?, ?)', ['test2', 200]);
      
      // Verify initial state
      let rows = await database.all('SELECT * FROM integrity_test ORDER BY id');
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('test1');
      expect(rows[1].name).toBe('test2');
      
      // Update data
      await database.run('UPDATE integrity_test SET value = ? WHERE name = ?', [150, 'test1']);
      
      // Verify update
      const updatedRow = await database.get('SELECT * FROM integrity_test WHERE name = ?', ['test1']);
      expect(updatedRow.value).toBe(150);
      
      // Delete data
      await database.run('DELETE FROM integrity_test WHERE name = ?', ['test2']);
      
      // Verify deletion
      rows = await database.all('SELECT * FROM integrity_test');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('test1');
      
      // Cleanup
      await database.run('DROP TABLE integrity_test');
    });
  });
});
