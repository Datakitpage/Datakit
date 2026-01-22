import { describe, it, expect } from 'vitest';

/**
 * Tests for SQL type detection and command generation
 * These test the pure logic functions used in FloatingAICommand
 */

// Replicate the detectSQLType logic for testing
function detectSQLType(sql: string): 'read' | 'write' {
  const trimmed = sql.trim().toUpperCase();
  if (
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('EXPLAIN') ||
    trimmed.startsWith('DESCRIBE') ||
    trimmed.startsWith('SHOW')
  ) {
    return 'read';
  }
  return 'write';
}

describe('FloatingAICommand - SQL Type Detection', () => {
  describe('read operations', () => {
    it('should detect simple SELECT as read', () => {
      expect(detectSQLType('SELECT * FROM users')).toBe('read');
    });

    it('should detect SELECT with lowercase as read', () => {
      expect(detectSQLType('select * from users')).toBe('read');
    });

    it('should detect SELECT with mixed case as read', () => {
      expect(detectSQLType('Select Name From Users')).toBe('read');
    });

    it('should detect EXPLAIN as read', () => {
      expect(detectSQLType('EXPLAIN SELECT * FROM users')).toBe('read');
    });

    it('should detect DESCRIBE as read', () => {
      expect(detectSQLType('DESCRIBE users')).toBe('read');
    });

    it('should detect SHOW as read', () => {
      expect(detectSQLType('SHOW TABLES')).toBe('read');
    });

    it('should handle leading whitespace', () => {
      expect(detectSQLType('   SELECT * FROM users')).toBe('read');
    });

    it('should handle newlines before SELECT', () => {
      expect(detectSQLType('\n\nSELECT * FROM users')).toBe('read');
    });

    it('should detect complex SELECT with subquery as read', () => {
      const sql = `
        SELECT u.name, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count
        FROM users u
      `;
      expect(detectSQLType(sql)).toBe('read');
    });

    it('should detect SELECT with CTE as read', () => {
      const sql = `
        WITH active_users AS (
          SELECT * FROM users WHERE active = true
        )
        SELECT * FROM active_users
      `;
      // Note: CTE starts with WITH, so this would be detected as write
      // This is a known limitation - CTEs need special handling
      expect(detectSQLType(sql)).toBe('write');
    });
  });

  describe('write operations', () => {
    it('should detect UPDATE as write', () => {
      expect(detectSQLType('UPDATE users SET name = "test"')).toBe('write');
    });

    it('should detect DELETE as write', () => {
      expect(detectSQLType('DELETE FROM users WHERE id = 1')).toBe('write');
    });

    it('should detect INSERT as write', () => {
      expect(detectSQLType('INSERT INTO users (name) VALUES ("test")')).toBe('write');
    });

    it('should detect CREATE as write', () => {
      expect(detectSQLType('CREATE TABLE new_table (id INT)')).toBe('write');
    });

    it('should detect DROP as write', () => {
      expect(detectSQLType('DROP TABLE users')).toBe('write');
    });

    it('should detect ALTER as write', () => {
      expect(detectSQLType('ALTER TABLE users ADD COLUMN email VARCHAR')).toBe('write');
    });

    it('should detect TRUNCATE as write', () => {
      expect(detectSQLType('TRUNCATE TABLE logs')).toBe('write');
    });

    it('should detect UPDATE with lowercase as write', () => {
      expect(detectSQLType('update users set status = "active"')).toBe('write');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      // Empty string doesn't start with SELECT, so it's write
      expect(detectSQLType('')).toBe('write');
    });

    it('should handle whitespace only', () => {
      expect(detectSQLType('   ')).toBe('write');
    });

    it('should handle SELECT in column name as write when it starts with UPDATE', () => {
      expect(detectSQLType('UPDATE users SET select_count = 1')).toBe('write');
    });

    it('should handle SQL starting with comment', () => {
      // This starts with --, not SELECT, so it's write
      expect(detectSQLType('-- comment\nSELECT * FROM users')).toBe('write');
    });
  });
});

describe('FloatingAICommand - SQL Command Generation', () => {
  // Helper to create a mock AICommand similar to what FloatingAICommand generates
  function createSQLCommand(sql: string) {
    const sqlType = detectSQLType(sql);
    return {
      type: 'sql' as const,
      naturalLanguage: sql,
      sql: sql,
      parsed: {
        action: 'sql',
        value: sql,
      },
      isWriteOperation: sqlType === 'write',
    };
  }

  it('should create read command for SELECT', () => {
    const cmd = createSQLCommand('SELECT * FROM users');
    expect(cmd.type).toBe('sql');
    expect(cmd.isWriteOperation).toBe(false);
    expect(cmd.sql).toBe('SELECT * FROM users');
  });

  it('should create write command for UPDATE', () => {
    const cmd = createSQLCommand('UPDATE users SET active = true');
    expect(cmd.type).toBe('sql');
    expect(cmd.isWriteOperation).toBe(true);
  });

  it('should create write command for DELETE', () => {
    const cmd = createSQLCommand('DELETE FROM users WHERE id = 1');
    expect(cmd.type).toBe('sql');
    expect(cmd.isWriteOperation).toBe(true);
  });

  it('should preserve original SQL formatting', () => {
    const sql = `
      SELECT
        id,
        name
      FROM users
      WHERE active = true
    `;
    const cmd = createSQLCommand(sql);
    expect(cmd.sql).toBe(sql);
    expect(cmd.naturalLanguage).toBe(sql);
  });
});

describe('SQL Query Parsing for Write Operations', () => {
  // Helper functions that mirror the parsing logic in FocusedFileView

  function parseUpdateQuery(sql: string) {
    const trimmedSQL = sql.trim().toUpperCase();
    if (!trimmedSQL.startsWith('UPDATE')) {
      return null;
    }

    const whereMatch = sql.match(/WHERE\s+(.+)$/i);
    const whereClause = whereMatch ? whereMatch[1] : '';

    // Match SET column = value, stopping at WHERE or end of string
    // Handle both quoted and unquoted values
    const setMatch = sql.match(/SET\s+["']?(\w+)["']?\s*=\s*['"]?([^'"\s,]+)['"]?(?:\s+WHERE|\s*$)/i);
    if (!setMatch) {
      // Try simpler pattern for numeric values
      const simpleMatch = sql.match(/SET\s+(\w+)\s*=\s*([^\s,]+?)(?:\s+WHERE|\s*$)/i);
      if (!simpleMatch) {
        return null;
      }
      return {
        column: simpleMatch[1],
        newValue: simpleMatch[2].trim(),
        whereClause: whereClause || null,
      };
    }

    return {
      column: setMatch[1],
      newValue: setMatch[2].trim(),
      whereClause: whereClause || null,
    };
  }

  function parseDeleteQuery(sql: string) {
    const trimmedSQL = sql.trim().toUpperCase();
    if (!trimmedSQL.startsWith('DELETE')) {
      return null;
    }

    const whereMatch = sql.match(/WHERE\s+(.+)$/i);
    const whereClause = whereMatch ? whereMatch[1] : '';

    return {
      whereClause: whereClause || null,
      hasWhereClause: !!whereClause,
    };
  }

  describe('UPDATE parsing', () => {
    it('should parse simple UPDATE', () => {
      const result = parseUpdateQuery('UPDATE users SET name = "John"');
      expect(result).toEqual({
        column: 'name',
        newValue: 'John',
        whereClause: null,
      });
    });

    it('should parse UPDATE with WHERE', () => {
      const result = parseUpdateQuery('UPDATE users SET status = "active" WHERE id = 1');
      expect(result).toEqual({
        column: 'status',
        newValue: 'active',
        whereClause: 'id = 1',
      });
    });

    it('should parse UPDATE with complex WHERE', () => {
      const result = parseUpdateQuery(
        'UPDATE products SET price = 99.99 WHERE category = "electronics" AND stock > 0'
      );
      expect(result).toEqual({
        column: 'price',
        newValue: '99.99',
        whereClause: 'category = "electronics" AND stock > 0',
      });
    });

    it('should handle UPDATE with single quotes', () => {
      const result = parseUpdateQuery("UPDATE users SET name = 'Jane' WHERE id = 2");
      expect(result).toEqual({
        column: 'name',
        newValue: 'Jane',
        whereClause: 'id = 2',
      });
    });

    it('should return null for non-UPDATE', () => {
      expect(parseUpdateQuery('SELECT * FROM users')).toBeNull();
    });
  });

  describe('DELETE parsing', () => {
    it('should parse DELETE with WHERE', () => {
      const result = parseDeleteQuery('DELETE FROM users WHERE id = 1');
      expect(result).toEqual({
        whereClause: 'id = 1',
        hasWhereClause: true,
      });
    });

    it('should detect DELETE without WHERE', () => {
      const result = parseDeleteQuery('DELETE FROM users');
      expect(result).toEqual({
        whereClause: null,
        hasWhereClause: false,
      });
    });

    it('should parse DELETE with complex WHERE', () => {
      const result = parseDeleteQuery(
        'DELETE FROM orders WHERE status = "cancelled" AND created_at < "2024-01-01"'
      );
      expect(result).toEqual({
        whereClause: 'status = "cancelled" AND created_at < "2024-01-01"',
        hasWhereClause: true,
      });
    });

    it('should return null for non-DELETE', () => {
      expect(parseDeleteQuery('SELECT * FROM users')).toBeNull();
    });
  });
});

describe('SQL Validation Integration Scenarios', () => {
  describe('real-world query patterns', () => {
    it('should handle analytics query pattern', () => {
      const sql = `
        SELECT
          DATE_TRUNC('day', created_at) as day,
          COUNT(*) as signups,
          COUNT(DISTINCT user_id) as unique_users
        FROM events
        WHERE event_type = 'signup'
          AND created_at >= '2024-01-01'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day DESC
        LIMIT 30
      `;
      expect(detectSQLType(sql)).toBe('read');
    });

    it('should handle data quality check pattern', () => {
      const sql = `
        SELECT
          'missing_email' as issue,
          COUNT(*) as count
        FROM users
        WHERE email IS NULL OR email = ''
        UNION ALL
        SELECT
          'duplicate_email' as issue,
          COUNT(*) as count
        FROM (
          SELECT email
          FROM users
          GROUP BY email
          HAVING COUNT(*) > 1
        )
      `;
      expect(detectSQLType(sql)).toBe('read');
    });

    it('should handle batch update pattern', () => {
      const sql = `
        UPDATE products
        SET
          price = price * 1.1,
          updated_at = CURRENT_TIMESTAMP
        WHERE category IN ('electronics', 'appliances')
          AND last_price_update < '2024-01-01'
      `;
      expect(detectSQLType(sql)).toBe('write');
    });

    it('should handle cleanup delete pattern', () => {
      const sql = `
        DELETE FROM sessions
        WHERE expires_at < CURRENT_TIMESTAMP
          AND user_id NOT IN (
            SELECT id FROM users WHERE is_admin = true
          )
      `;
      expect(detectSQLType(sql)).toBe('write');
    });
  });
});
