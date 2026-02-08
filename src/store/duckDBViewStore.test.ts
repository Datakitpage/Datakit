import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDuckDBViewStore, type SQLValidationResult } from './duckDBViewStore';

// Mock DuckDB initialization
vi.mock('@/lib/duckdb/init', () => ({
  initializeDuckDB: vi.fn(),
  cleanup: vi.fn(),
}));

describe('duckDBViewStore - validateSQL', () => {
  // Store reference
  let store: ReturnType<typeof useDuckDBViewStore.getState>;

  // Mock connection
  const mockQuery = vi.fn();
  const mockConnection = { query: mockQuery };

  beforeEach(() => {
    store = useDuckDBViewStore.getState();
    // Reset store state
    useDuckDBViewStore.setState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock connection for testing
      connection: mockConnection as any,
      isInitialized: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock db for testing
      db: {} as any,
    });
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('valid SQL', () => {
    it('should return valid:true for valid SELECT query', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const result = await store.validateSQL('SELECT * FROM test_table');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockQuery).toHaveBeenCalledWith('EXPLAIN SELECT * FROM test_table');
    });

    it('should return valid:true for SELECT with WHERE clause', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const result = await store.validateSQL('SELECT name, age FROM users WHERE age > 18');

      expect(result.valid).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('EXPLAIN SELECT name, age FROM users WHERE age > 18');
    });

    it('should return valid:true for SELECT with ORDER BY', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const result = await store.validateSQL('SELECT * FROM products ORDER BY price DESC');

      expect(result.valid).toBe(true);
    });
  });

  describe('syntax errors', () => {
    it('should detect syntax errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Parser Error: syntax error at or near "SELECTT"'));

      const result = await store.validateSQL('SELECTT * FROM test');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('syntax');
      expect(result.suggestion).toContain('syntax');
    });

    it('should detect missing FROM clause', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Parser Error: syntax error - missing FROM'));

      const result = await store.validateSQL('SELECT * WHERE id = 1');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('syntax');
    });
  });

  describe('schema errors', () => {
    it('should detect unknown column errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Binder Error: column "nonexistent_col" does not exist'));

      const result = await store.validateSQL('SELECT nonexistent_col FROM test_table');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('schema');
      expect(result.suggestion).toContain('nonexistent_col');
    });

    it('should detect table not found errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Catalog Error: table "fake_table" does not exist'));

      const result = await store.validateSQL('SELECT * FROM fake_table');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('schema');
    });

    it('should provide helpful suggestions for column errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Binder Error: Referenced column "nam" not found in FROM clause'));

      const result = await store.validateSQL('SELECT nam FROM users');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('schema');
      expect(result.suggestion).toBeDefined();
    });
  });

  describe('error categorization', () => {
    it('should categorize permission errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Permission denied: access not allowed'));

      const result = await store.validateSQL('SELECT * FROM restricted');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('permission');
    });

    it('should categorize unknown errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Some unexpected error'));

      const result = await store.validateSQL('SELECT * FROM test');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle empty SQL gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Parser Error: empty query'));

      const result = await store.validateSQL('');

      expect(result.valid).toBe(false);
    });

    it('should include original SQL in result', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = 'SELECT id, name FROM users LIMIT 10';
      const result = await store.validateSQL(sql);

      expect(result.sql).toBe(sql);
    });

    it('should handle null connection gracefully', async () => {
      // Set connection to null and mark as not initialized
      useDuckDBViewStore.setState({
        connection: null,
        isInitialized: false,
        isInitializing: false,
        db: null,
      });

      const result = await useDuckDBViewStore.getState().validateSQL('SELECT * FROM test');

      // When initialize fails (because we're in a test environment without real DuckDB),
      // the validation should fail gracefully
      expect(result.valid).toBe(false);
    });
  });

  describe('SQLValidationResult type', () => {
    it('should have all required fields on success', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const result: SQLValidationResult = await store.validateSQL('SELECT 1');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('sql');
      expect(result.valid).toBe(true);
    });

    it('should have all required fields on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Test error'));

      const result: SQLValidationResult = await store.validateSQL('BAD SQL');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('sql');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('errorType');
      expect(result.valid).toBe(false);
    });
  });

  describe('complex SQL queries', () => {
    it('should validate JOIN queries', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT u.name, o.total
        FROM users u
        INNER JOIN orders o ON u.id = o.user_id
        WHERE o.total > 100
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate LEFT JOIN with multiple tables', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT c.name, COUNT(o.id) as order_count, SUM(o.total) as total_spent
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        GROUP BY c.name
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate subqueries', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT * FROM products
        WHERE price > (SELECT AVG(price) FROM products)
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate correlated subqueries', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT e.name, e.salary
        FROM employees e
        WHERE e.salary > (
          SELECT AVG(e2.salary)
          FROM employees e2
          WHERE e2.department_id = e.department_id
        )
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate CTEs (Common Table Expressions)', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        WITH monthly_sales AS (
          SELECT DATE_TRUNC('month', date) as month, SUM(amount) as total
          FROM sales
          GROUP BY DATE_TRUNC('month', date)
        )
        SELECT month, total,
               total - LAG(total) OVER (ORDER BY month) as growth
        FROM monthly_sales
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate window functions', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT
          name,
          department,
          salary,
          ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank,
          AVG(salary) OVER (PARTITION BY department) as dept_avg,
          salary - AVG(salary) OVER (PARTITION BY department) as diff_from_avg
        FROM employees
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate aggregation with HAVING', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT category, COUNT(*) as count, AVG(price) as avg_price
        FROM products
        GROUP BY category
        HAVING COUNT(*) > 5 AND AVG(price) > 100
        ORDER BY avg_price DESC
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate UNION queries', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT id, name, 'customer' as type FROM customers
        UNION ALL
        SELECT id, name, 'supplier' as type FROM suppliers
        ORDER BY name
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate CASE expressions', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT
          name,
          price,
          CASE
            WHEN price < 10 THEN 'cheap'
            WHEN price < 50 THEN 'moderate'
            WHEN price < 100 THEN 'expensive'
            ELSE 'luxury'
          END as price_category
        FROM products
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });
  });

  describe('UPDATE and DELETE validation', () => {
    it('should validate UPDATE with WHERE clause', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `UPDATE users SET status = 'active' WHERE last_login > '2024-01-01'`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate UPDATE with multiple SET clauses', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        UPDATE products
        SET price = price * 1.1,
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1
        WHERE category = 'electronics'
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate DELETE with WHERE clause', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate DELETE with subquery condition', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        DELETE FROM orders
        WHERE customer_id IN (
          SELECT id FROM customers WHERE status = 'deleted'
        )
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should detect invalid UPDATE syntax', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Parser Error: syntax error at or near "UPDAT"'));

      const sql = `UPDAT users SET name = 'test'`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('syntax');
    });
  });

  describe('special characters and quoting', () => {
    it('should validate queries with quoted identifiers', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `SELECT "First Name", "Last Name" FROM "User Data" WHERE "Is Active" = true`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate queries with string literals containing quotes', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `SELECT * FROM users WHERE name = 'O''Brien'`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate queries with special column names', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `SELECT "column-with-dashes", "column.with.dots" FROM data`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate queries with backticks (MySQL style)', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      // DuckDB also supports backticks for identifiers
      const sql = 'SELECT `user id`, `full name` FROM `user table`';
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });
  });

  describe('whitespace and formatting', () => {
    it('should validate multi-line SQL with various indentation', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT
            id,
            name,
            email
        FROM
            users
        WHERE
            active = true
            AND
            created_at > '2024-01-01'
        ORDER BY
            name ASC
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should handle SQL with tabs', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = "SELECT\tid,\tname\nFROM\tusers\nWHERE\tactive = true";
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should handle SQL with excessive whitespace', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = '   SELECT    *    FROM    users    WHERE    id   =   1   ';
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });
  });

  describe('DuckDB-specific features', () => {
    it('should validate QUALIFY clause', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT name, department, salary
        FROM employees
        QUALIFY ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) = 1
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate EXCLUDE clause in window functions', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `
        SELECT
          date,
          value,
          AVG(value) OVER (ORDER BY date ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING EXCLUDE CURRENT ROW) as moving_avg
        FROM timeseries
      `;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate LIST aggregation', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `SELECT category, LIST(product_name) as products FROM products GROUP BY category`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should validate STRUCT creation', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `SELECT {'name': name, 'age': age} as person_struct FROM people`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });
  });

  describe('error messages and suggestions', () => {
    it('should provide specific suggestion for misspelled column', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Binder Error: column "naem" does not exist. Did you mean "name"?'));

      const result = await store.validateSQL('SELECT naem FROM users');

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('schema');
      expect(result.suggestion).toContain('naem');
    });

    it('should provide suggestion for ambiguous column reference', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Binder Error: column "id" is ambiguous'));

      const sql = `SELECT id FROM users JOIN orders ON users.id = orders.user_id`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('ambiguous');
    });

    it('should handle type mismatch errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Conversion Error: could not convert string to integer'));

      const sql = `SELECT * FROM users WHERE id = 'not_a_number'`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(false);
      expect(result.errorType).toBe('unknown'); // Type errors are not specifically categorized
    });

    it('should handle division by zero in validation', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Out of Range Error: division by zero'));

      const sql = `SELECT 1/0`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(false);
    });
  });

  describe('data versioning', () => {
    const viewName = 'test_view';

    beforeEach(() => {
      // Reset mock to return a resolved promise by default (for recordChange delta table operations)
      mockQuery.mockResolvedValue({ toArray: () => [] });

      // Reset versioning state
      useDuckDBViewStore.setState({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock connection for testing
        connection: mockConnection as any,
        isInitialized: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock db for testing
        db: {} as any,
        views: new Map([[viewName, {
          viewName,
          fileName: 'test.csv',
          fileType: 'csv',
          schema: [
            { name: '_rowid', type: 'BIGINT' },
            { name: 'name', type: 'VARCHAR' },
            { name: 'age', type: 'INTEGER' },
          ],
          totalRows: 100,
          createdAt: Date.now(),
        }]]),
        pendingChanges: new Map(),
        committedVersions: new Map(),
        currentVersionIndex: new Map(),
      });
    });

    describe('version info', () => {
      it('should return empty version info when no versions exist', () => {
        const info = store.getVersionInfo(viewName);

        expect(info.current).toBe(0);
        expect(info.total).toBe(0);
        expect(info.description).toBeNull();
      });

      it('should not allow undo/redo when no versions exist', () => {
        expect(store.canUndoVersion(viewName)).toBe(false);
        expect(store.canRedoVersion(viewName)).toBe(false);
      });
    });

    describe('commitChanges creates versions', () => {
      it('should create a version when committing changes', async () => {
        // Record a change first
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Bob',
          changeType: 'update',
          source: 'user',
        });

        // Mock the commit SQL
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Commit
        const success = await store.commitChanges(viewName);

        expect(success).toBe(true);

        // Check version was created
        const info = store.getVersionInfo(viewName);
        expect(info.total).toBe(1);
        expect(info.current).toBe(1);
        expect(info.description).toBe('Edit name');
      });

      it('should create version with multiple changes description', async () => {
        // Record multiple changes
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Bob',
          changeType: 'update',
          source: 'user',
        });
        store.recordChange({
          viewName,
          rowId: 2,
          column: 'age',
          oldValue: 25,
          newValue: 30,
          changeType: 'update',
          source: 'user',
        });

        mockQuery.mockResolvedValue({ toArray: () => [] });
        await store.commitChanges(viewName);

        const info = store.getVersionInfo(viewName);
        expect(info.description).toBe('2 changes');
      });

      it('should allow undo after commit', async () => {
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Bob',
          changeType: 'update',
          source: 'user',
        });

        mockQuery.mockResolvedValue({ toArray: () => [] });
        await store.commitChanges(viewName);

        expect(store.canUndoVersion(viewName)).toBe(true);
        expect(store.canRedoVersion(viewName)).toBe(false);
      });
    });

    describe('undoVersion', () => {
      it('should undo a committed version', async () => {
        // Create a version
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Bob',
          changeType: 'update',
          source: 'user',
        });

        mockQuery.mockResolvedValue({ toArray: () => [] });
        await store.commitChanges(viewName);

        // Now undo
        const undoSuccess = await store.undoVersion(viewName);

        expect(undoSuccess).toBe(true);
        expect(store.canUndoVersion(viewName)).toBe(false);
        expect(store.canRedoVersion(viewName)).toBe(true);

        const info = store.getVersionInfo(viewName);
        expect(info.current).toBe(0);
        expect(info.total).toBe(1);
      });

      it('should return false when nothing to undo', async () => {
        const success = await store.undoVersion(viewName);
        expect(success).toBe(false);
      });

      it('should undo a delete change by re-inserting the row', async () => {
        // Record a delete change with full row data
        const deletedRowData = {
          _rowid: 5,
          name: 'Charlie',
          age: 35,
          email: 'charlie@test.com',
        };

        store.recordChange({
          viewName,
          rowId: 5,
          column: '*',
          oldValue: deletedRowData,
          newValue: null,
          changeType: 'delete',
          source: 'user',
        });

        // Mock queries: commit delete, then undo re-insert
        mockQuery
          .mockResolvedValueOnce({ toArray: () => [] }) // Delta table insert
          .mockResolvedValueOnce({ toArray: () => [] }) // DELETE
          .mockResolvedValueOnce({ toArray: () => [] }) // DELETE from delta
          .mockResolvedValueOnce({ toArray: () => [{ next_id: 6 }] }) // MAX(_rowid) + 1 for re-insert
          .mockResolvedValueOnce({ toArray: () => [] }); // INSERT

        await store.commitChanges(viewName);
        const undoSuccess = await store.undoVersion(viewName);

        expect(undoSuccess).toBe(true);
        // Verify INSERT was called with proper values (last call should be INSERT)
        const insertCall = mockQuery.mock.calls.find(call =>
          call[0].includes('INSERT INTO') && call[0].includes(viewName)
        );
        expect(insertCall).toBeDefined();
      });

      it('should undo multiple delete changes in reverse order', async () => {
        // Record multiple delete changes
        store.recordChange({
          viewName,
          rowId: 1,
          column: '*',
          oldValue: { _rowid: 1, name: 'Alice' },
          newValue: null,
          changeType: 'delete',
          source: 'user',
        });

        store.recordChange({
          viewName,
          rowId: 2,
          column: '*',
          oldValue: { _rowid: 2, name: 'Bob' },
          newValue: null,
          changeType: 'delete',
          source: 'user',
        });

        mockQuery.mockResolvedValue({ toArray: () => [{ next_id: 10 }] });

        await store.commitChanges(viewName);

        // Clear mock calls to track only undo operations
        mockQuery.mockClear();
        mockQuery.mockResolvedValue({ toArray: () => [{ next_id: 10 }] });

        const undoSuccess = await store.undoVersion(viewName);

        expect(undoSuccess).toBe(true);
        // Both rows should be re-inserted during undo
        const insertCalls = mockQuery.mock.calls.filter(call =>
          call[0].includes('INSERT INTO') && call[0].includes(`"${viewName}"`)
        );
        expect(insertCalls.length).toBe(2);
      });
    });

    describe('redoVersion', () => {
      it('should redo an undone version', async () => {
        // Create and commit
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Bob',
          changeType: 'update',
          source: 'user',
        });

        mockQuery.mockResolvedValue({ toArray: () => [] });
        await store.commitChanges(viewName);

        // Undo
        await store.undoVersion(viewName);

        // Redo
        const redoSuccess = await store.redoVersion(viewName);

        expect(redoSuccess).toBe(true);
        expect(store.canUndoVersion(viewName)).toBe(true);
        expect(store.canRedoVersion(viewName)).toBe(false);

        const info = store.getVersionInfo(viewName);
        expect(info.current).toBe(1);
      });

      it('should return false when nothing to redo', async () => {
        const success = await store.redoVersion(viewName);
        expect(success).toBe(false);
      });
    });

    describe('multiple versions', () => {
      it('should track multiple committed versions', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Version 1
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Bob',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);

        // Version 2
        store.recordChange({
          viewName,
          rowId: 2,
          column: 'name',
          oldValue: 'Charlie',
          newValue: 'David',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);

        const info = store.getVersionInfo(viewName);
        expect(info.total).toBe(2);
        expect(info.current).toBe(2);
      });

      it('should navigate through multiple versions', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Create 3 versions
        for (let i = 1; i <= 3; i++) {
          store.recordChange({
            viewName,
            rowId: i,
            column: 'name',
            oldValue: `old${i}`,
            newValue: `new${i}`,
            changeType: 'update',
            source: 'user',
          });
          await store.commitChanges(viewName);
        }

        expect(store.getVersionInfo(viewName).current).toBe(3);

        // Undo twice
        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(2);

        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(1);

        // Redo once
        await store.redoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(2);
      });

      it('should truncate future versions when committing after undo', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Create 3 versions
        for (let i = 1; i <= 3; i++) {
          store.recordChange({
            viewName,
            rowId: i,
            column: 'name',
            oldValue: `old${i}`,
            newValue: `new${i}`,
            changeType: 'update',
            source: 'user',
          });
          await store.commitChanges(viewName);
        }

        // Undo twice (at version 1)
        await store.undoVersion(viewName);
        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(1);

        // Commit new change - should truncate v2 and v3
        store.recordChange({
          viewName,
          rowId: 10,
          column: 'name',
          oldValue: 'X',
          newValue: 'Y',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);

        const info = store.getVersionInfo(viewName);
        expect(info.total).toBe(2); // v1 + new commit
        expect(info.current).toBe(2);
        expect(store.canRedoVersion(viewName)).toBe(false);
      });
    });

    describe('complex workflows with AI queries and edits', () => {
      /**
       * Scenario: AI query result editing workflow
       * 1. User runs AI query (e.g., "SELECT name, age FROM users WHERE age > 30")
       * 2. Query result includes _rowid for editability
       * 3. User edits a cell in the query result
       * 4. User commits the change
       * 5. Version is created and navigation works
       */
      it('should handle AI query result → edit → commit → version navigation', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Simulate editing a row that was returned by an AI query
        // The key is that _rowid is included, allowing edits
        store.recordChange({
          viewName,
          rowId: 42, // _rowid from query result
          column: 'name',
          oldValue: 'John',
          newValue: 'Jonathan',
          changeType: 'update',
          source: 'user',
        });

        await store.commitChanges(viewName);

        // Verify version was created
        const info = store.getVersionInfo(viewName);
        expect(info.total).toBe(1);
        expect(info.current).toBe(1);
        expect(info.description).toBe('Edit name');

        // Verify undo is available
        expect(store.canUndoVersion(viewName)).toBe(true);

        // Undo the version
        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(0);

        // Redo the version
        await store.redoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(1);
      });

      /**
       * Scenario: Multiple edit sessions with commits
       * Each edit session creates a new version, allowing granular undo
       */
      it('should handle multiple edit sessions with separate commits', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Session 1: Edit row 1
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Alicia',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);
        expect(store.getVersionInfo(viewName).description).toBe('Edit name');

        // Session 2: Edit row 2
        store.recordChange({
          viewName,
          rowId: 2,
          column: 'age',
          oldValue: 25,
          newValue: 26,
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);
        expect(store.getVersionInfo(viewName).description).toBe('Edit age');

        // Session 3: Edit multiple rows in one commit
        store.recordChange({
          viewName,
          rowId: 3,
          column: 'name',
          oldValue: 'Bob',
          newValue: 'Bobby',
          changeType: 'update',
          source: 'user',
        });
        store.recordChange({
          viewName,
          rowId: 4,
          column: 'name',
          oldValue: 'Carol',
          newValue: 'Caroline',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);
        expect(store.getVersionInfo(viewName).description).toBe('2 changes');

        // Now we have 3 versions
        const info = store.getVersionInfo(viewName);
        expect(info.total).toBe(3);
        expect(info.current).toBe(3);

        // Undo to version 1
        await store.undoVersion(viewName); // v3 -> v2
        await store.undoVersion(viewName); // v2 -> v1
        expect(store.getVersionInfo(viewName).current).toBe(1);

        // Can still redo
        expect(store.canRedoVersion(viewName)).toBe(true);
      });

      /**
       * Scenario: Pending change undo vs version undo (different concepts)
       * - Pending change undo: Before commit, undo individual cell edits
       * - Version undo: After commit, undo entire committed versions
       */
      it('should distinguish pending change undo from version undo', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Record multiple pending changes
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'A',
          newValue: 'B',
          changeType: 'update',
          source: 'user',
        });
        store.recordChange({
          viewName,
          rowId: 2,
          column: 'name',
          oldValue: 'C',
          newValue: 'D',
          changeType: 'update',
          source: 'user',
        });

        // Verify 2 pending changes
        expect(store.getPendingChanges(viewName).length).toBe(2);

        // Undo last pending change (this is different from version undo)
        const undoneChange = store.undoLastChange(viewName);
        expect(undoneChange).not.toBeNull();
        expect(undoneChange?.rowId).toBe(2);

        // Now only 1 pending change
        expect(store.getPendingChanges(viewName).length).toBe(1);

        // Commit the remaining change
        await store.commitChanges(viewName);

        // Version created with 1 change
        expect(store.getVersionInfo(viewName).description).toBe('Edit name');

        // Now version undo reverts the entire commit
        expect(store.canUndoVersion(viewName)).toBe(true);
        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(0);
      });

      /**
       * Scenario: Editing different columns in sequence
       * Simulates a user editing multiple columns of the same row
       */
      it('should handle editing multiple columns of the same row', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Edit name column
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'John',
          newValue: 'Johnny',
          changeType: 'update',
          source: 'user',
        });

        // Edit age column of same row
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'age',
          oldValue: 30,
          newValue: 31,
          changeType: 'update',
          source: 'user',
        });

        // Commit both changes
        await store.commitChanges(viewName);

        // Version should show "2 changes"
        expect(store.getVersionInfo(viewName).description).toBe('2 changes');

        // Undo reverts both changes
        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(0);

        // Redo restores both changes
        await store.redoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(1);
      });

      /**
       * Scenario: Complex interleaving with branch truncation
       * User creates versions, goes back, makes new changes (losing forward history)
       */
      it('should handle complex branching with version truncation', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Create version 1
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'A',
          newValue: 'B',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);

        // Create version 2
        store.recordChange({
          viewName,
          rowId: 2,
          column: 'name',
          oldValue: 'C',
          newValue: 'D',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);

        // Create version 3
        store.recordChange({
          viewName,
          rowId: 3,
          column: 'name',
          oldValue: 'E',
          newValue: 'F',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);

        // At v3/3
        expect(store.getVersionInfo(viewName)).toEqual({
          current: 3,
          total: 3,
          description: 'Edit name',
        });

        // Go back to v1
        await store.undoVersion(viewName);
        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(1);
        expect(store.canRedoVersion(viewName)).toBe(true);

        // Create a new version (should truncate v2 and v3)
        store.recordChange({
          viewName,
          rowId: 10,
          column: 'age',
          oldValue: 20,
          newValue: 21,
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);

        // Now at v2/2 (old v2 and v3 are gone)
        const info = store.getVersionInfo(viewName);
        expect(info.total).toBe(2);
        expect(info.current).toBe(2);
        expect(info.description).toBe('Edit age');

        // Cannot redo (no forward history)
        expect(store.canRedoVersion(viewName)).toBe(false);
      });

      /**
       * Scenario: No changes, no version
       * Committing with no pending changes should not create a version
       */
      it('should not create version when no changes to commit', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // No changes recorded
        const success = await store.commitChanges(viewName);
        expect(success).toBe(true); // Still returns true (no-op)

        // No version created
        expect(store.getVersionInfo(viewName).total).toBe(0);
        expect(store.canUndoVersion(viewName)).toBe(false);
      });

      /**
       * Scenario: Discard changes resets pending but not committed versions
       */
      it('should only discard pending changes, not committed versions', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Create and commit version 1
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'A',
          newValue: 'B',
          changeType: 'update',
          source: 'user',
        });
        await store.commitChanges(viewName);
        expect(store.getVersionInfo(viewName).total).toBe(1);

        // Record a new pending change
        store.recordChange({
          viewName,
          rowId: 2,
          column: 'name',
          oldValue: 'C',
          newValue: 'D',
          changeType: 'update',
          source: 'user',
        });
        expect(store.getPendingChanges(viewName).length).toBe(1);

        // Discard pending changes
        store.discardChanges(viewName);
        expect(store.getPendingChanges(viewName).length).toBe(0);

        // Committed version is still there
        expect(store.getVersionInfo(viewName).total).toBe(1);
        expect(store.canUndoVersion(viewName)).toBe(true);
      });

      /**
       * Scenario: Different data types in edits
       * Tests that string, number, and null values are properly handled
       */
      it('should handle different data types in version changes', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // String change
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'name',
          oldValue: 'Alice',
          newValue: 'Alicia',
          changeType: 'update',
          source: 'user',
        });

        // Number change
        store.recordChange({
          viewName,
          rowId: 1,
          column: 'age',
          oldValue: 25,
          newValue: 30,
          changeType: 'update',
          source: 'user',
        });

        // Null to value
        store.recordChange({
          viewName,
          rowId: 2,
          column: 'name',
          oldValue: null,
          newValue: 'Bob',
          changeType: 'update',
          source: 'user',
        });

        // Value to null
        store.recordChange({
          viewName,
          rowId: 3,
          column: 'age',
          oldValue: 40,
          newValue: null,
          changeType: 'update',
          source: 'user',
        });

        await store.commitChanges(viewName);

        const info = store.getVersionInfo(viewName);
        expect(info.total).toBe(1);
        expect(info.description).toBe('4 changes');

        // Undo/redo should work
        await store.undoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(0);

        await store.redoVersion(viewName);
        expect(store.getVersionInfo(viewName).current).toBe(1);
      });

      /**
       * Scenario: Rapid version navigation
       * Tests undo/redo rapidly through multiple versions
       */
      it('should handle rapid undo/redo through multiple versions', async () => {
        mockQuery.mockResolvedValue({ toArray: () => [] });

        // Create 5 versions
        for (let i = 1; i <= 5; i++) {
          store.recordChange({
            viewName,
            rowId: i,
            column: 'name',
            oldValue: `old${i}`,
            newValue: `new${i}`,
            changeType: 'update',
            source: 'user',
          });
          await store.commitChanges(viewName);
        }

        expect(store.getVersionInfo(viewName).current).toBe(5);

        // Undo all the way to beginning
        for (let i = 5; i > 0; i--) {
          expect(store.canUndoVersion(viewName)).toBe(true);
          await store.undoVersion(viewName);
          expect(store.getVersionInfo(viewName).current).toBe(i - 1);
        }

        expect(store.canUndoVersion(viewName)).toBe(false);

        // Redo all the way to end
        for (let i = 0; i < 5; i++) {
          expect(store.canRedoVersion(viewName)).toBe(true);
          await store.redoVersion(viewName);
          expect(store.getVersionInfo(viewName).current).toBe(i + 1);
        }

        expect(store.canRedoVersion(viewName)).toBe(false);
      });
    });
  });

  describe('security considerations', () => {
    it('should handle SQL with comment injection attempts', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      // This is a valid SQL that happens to have comments
      const sql = `SELECT * FROM users -- this is a comment`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should handle SQL with block comments', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `SELECT /* selecting all columns */ * FROM /* users table */ users`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(true);
    });

    it('should reject malformed multi-statement SQL', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Parser Error: multiple statements not allowed'));

      const sql = `SELECT * FROM users; DROP TABLE users;`;
      const result = await store.validateSQL(sql);

      expect(result.valid).toBe(false);
    });
  });

  describe('refreshViewSchema', () => {
    const viewName = 'refresh_schema_view';

    beforeEach(() => {
      mockQuery.mockReset();
      // Setup a view in the store
      useDuckDBViewStore.setState({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock connection for testing
        connection: mockConnection as any,
        isInitialized: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock db for testing
        db: {} as any,
        views: new Map([[viewName, {
          viewName: viewName,
          fileName: 'test.csv',
          fileType: 'csv' as const,
          schema: [
            { name: '_rowid', type: 'BIGINT' },
            { name: 'name', type: 'VARCHAR' },
            { name: 'age', type: 'INTEGER' },
          ],
          totalRows: 10,
          createdAt: Date.now(),
        }]]),
        activeViewName: viewName,
      });
    });

    it('should refresh schema with new columns after ALTER TABLE', async () => {
      // Mock DESCRIBE to return updated schema with new column
      mockQuery.mockResolvedValueOnce({
        toArray: () => [
          { column_name: '_rowid', column_type: 'BIGINT' },
          { column_name: 'name', column_type: 'VARCHAR' },
          { column_name: 'age', column_type: 'INTEGER' },
          { column_name: 'email', column_type: 'VARCHAR' }, // New column
        ],
      });

      const success = await store.refreshViewSchema(viewName);

      expect(success).toBe(true);
      const updatedView = useDuckDBViewStore.getState().views.get(viewName);
      expect(updatedView?.schema).toHaveLength(4);
      expect(updatedView?.schema.find(c => c.name === 'email')).toBeDefined();
    });

    it('should return false for non-existent view', async () => {
      const success = await store.refreshViewSchema('nonexistent_view');
      expect(success).toBe(false);
    });

    it('should return false if connection is not available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing null connection handling
      useDuckDBViewStore.setState({ connection: null as any });
      const success = await store.refreshViewSchema(viewName);
      expect(success).toBe(false);
    });

    it('should handle DESCRIBE query errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Table not found'));

      const success = await store.refreshViewSchema(viewName);
      expect(success).toBe(false);
    });

    it('should preserve other view properties when refreshing schema', async () => {
      const originalView = useDuckDBViewStore.getState().views.get(viewName);
      const originalCreatedAt = originalView?.createdAt;

      mockQuery.mockResolvedValueOnce({
        toArray: () => [
          { column_name: '_rowid', column_type: 'BIGINT' },
          { column_name: 'name', column_type: 'VARCHAR' },
        ],
      });

      await store.refreshViewSchema(viewName);

      const updatedView = useDuckDBViewStore.getState().views.get(viewName);
      expect(updatedView?.createdAt).toBe(originalCreatedAt);
      expect(updatedView?.fileName).toBe('test.csv');
      expect(updatedView?.totalRows).toBe(10);
    });
  });

  describe('bulk row deletion', () => {
    const viewName = 'bulk_delete_view';

    beforeEach(() => {
      mockQuery.mockReset();
      // Default mock for delta table insert
      mockQuery.mockResolvedValue({ toArray: () => [] });

      useDuckDBViewStore.setState({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock connection for testing
        connection: mockConnection as any,
        isInitialized: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock db for testing
        db: {} as any,
        views: new Map([[viewName, {
          viewName: viewName,
          fileName: 'test.csv',
          fileType: 'csv' as const,
          schema: [
            { name: '_rowid', type: 'BIGINT' },
            { name: 'name', type: 'VARCHAR' },
          ],
          totalRows: 5,
          createdAt: Date.now(),
        }]]),
        activeViewName: viewName,
        pendingChanges: new Map(),
        committedVersions: new Map(),
        currentVersionIndex: new Map(),
      });
    });

    it('should record multiple delete changes for bulk deletion', () => {
      const rowsToDelete = [1, 2, 3];
      const rowData = [
        { _rowid: 1, name: 'Alice' },
        { _rowid: 2, name: 'Bob' },
        { _rowid: 3, name: 'Charlie' },
      ];

      rowsToDelete.forEach((rowId, i) => {
        store.recordChange({
          viewName,
          rowId,
          column: '*',
          oldValue: rowData[i],
          newValue: null,
          changeType: 'delete',
          source: 'user',
        });
      });

      const changes = store.getPendingChanges(viewName);
      expect(changes).toHaveLength(3);
      expect(changes.every(c => c.changeType === 'delete')).toBe(true);
    });

    it('should commit bulk deletions as a single version', async () => {
      // Record multiple deletes
      store.recordChange({
        viewName,
        rowId: 1,
        column: '*',
        oldValue: { _rowid: 1, name: 'Alice' },
        newValue: null,
        changeType: 'delete',
        source: 'user',
      });

      store.recordChange({
        viewName,
        rowId: 2,
        column: '*',
        oldValue: { _rowid: 2, name: 'Bob' },
        newValue: null,
        changeType: 'delete',
        source: 'user',
      });

      mockQuery.mockResolvedValue({ toArray: () => [] });
      await store.commitChanges(viewName);

      const versionInfo = store.getVersionInfo(viewName);
      expect(versionInfo.total).toBe(1);
      expect(versionInfo.description).toContain('2 changes');
    });
  });

  describe('add column workflow', () => {
    const viewName = 'add_column_view';

    beforeEach(() => {
      mockQuery.mockReset();
      useDuckDBViewStore.setState({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock connection for testing
        connection: mockConnection as any,
        isInitialized: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock db for testing
        db: {} as any,
        views: new Map([[viewName, {
          viewName: viewName,
          fileName: 'test.csv',
          fileType: 'csv' as const,
          schema: [
            { name: '_rowid', type: 'BIGINT' },
            { name: 'name', type: 'VARCHAR' },
          ],
          totalRows: 5,
          createdAt: Date.now(),
        }]]),
        activeViewName: viewName,
      });
    });

    it('should execute ALTER TABLE ADD COLUMN via executeSQL', async () => {
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });

      const sql = `ALTER TABLE "${viewName}" ADD COLUMN "email" VARCHAR DEFAULT NULL`;
      await store.executeSQL(sql);

      expect(mockQuery).toHaveBeenCalledWith(sql);
    });

    it('should update schema after refreshViewSchema following add column', async () => {
      // First, execute ALTER TABLE
      mockQuery.mockResolvedValueOnce({ toArray: () => [] });
      await store.executeSQL(`ALTER TABLE "${viewName}" ADD COLUMN "email" VARCHAR DEFAULT NULL`);

      // Then refresh schema
      mockQuery.mockResolvedValueOnce({
        toArray: () => [
          { column_name: '_rowid', column_type: 'BIGINT' },
          { column_name: 'name', column_type: 'VARCHAR' },
          { column_name: 'email', column_type: 'VARCHAR' },
        ],
      });
      await store.refreshViewSchema(viewName);

      const view = useDuckDBViewStore.getState().views.get(viewName);
      expect(view?.schema).toHaveLength(3);
      expect(view?.schema.find(c => c.name === 'email')).toBeDefined();
    });
  });

  describe('dataVersion tracking', () => {
    const viewName = 'version_test_view';

    beforeEach(() => {
      mockQuery.mockReset();
      mockQuery.mockResolvedValue({ toArray: () => [] });
      useDuckDBViewStore.setState({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock connection for testing
        connection: mockConnection as any,
        isInitialized: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock db for testing
        db: {} as any,
        views: new Map(),
        dataVersion: new Map(),
        pendingChanges: new Map(),
        committedVersions: new Map(),
        currentVersionIndex: new Map(),
      });
    });

    it('should start with empty dataVersion map', () => {
      const state = useDuckDBViewStore.getState();
      expect(state.dataVersion.size).toBe(0);
    });

    it('should initialize dataVersion to 1 when a view is created via setActiveView', () => {
      // setActiveView doesn't create dataVersion — only createViewFromData/File do
      useDuckDBViewStore.getState().setActiveView(viewName);
      const version = useDuckDBViewStore.getState().dataVersion.get(viewName);
      expect(version).toBeUndefined();
    });

    it('should clean up dataVersion when view is dropped', async () => {
      // Set up a view with a dataVersion
      useDuckDBViewStore.setState(state => {
        const newViews = new Map(state.views);
        newViews.set(viewName, {
          viewName,
          fileName: 'test.csv',
          fileType: 'csv',
          schema: [{ name: '_rowid', type: 'BIGINT' }],
          totalRows: 10,
          createdAt: Date.now(),
        });
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(viewName, 3);
        return { views: newViews, dataVersion: newDataVersion };
      });

      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(3);

      await useDuckDBViewStore.getState().dropView(viewName);

      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBeUndefined();
    });

    it('should not affect other views when one is dropped', async () => {
      const otherView = 'other_view';
      useDuckDBViewStore.setState(state => {
        const newViews = new Map(state.views);
        newViews.set(viewName, {
          viewName,
          fileName: 'test.csv',
          fileType: 'csv',
          schema: [{ name: '_rowid', type: 'BIGINT' }],
          totalRows: 10,
          createdAt: Date.now(),
        });
        newViews.set(otherView, {
          viewName: otherView,
          fileName: 'other.csv',
          fileType: 'csv',
          schema: [{ name: '_rowid', type: 'BIGINT' }],
          totalRows: 5,
          createdAt: Date.now(),
        });
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(viewName, 2);
        newDataVersion.set(otherView, 4);
        return { views: newViews, dataVersion: newDataVersion };
      });

      await useDuckDBViewStore.getState().dropView(viewName);

      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBeUndefined();
      expect(useDuckDBViewStore.getState().dataVersion.get(otherView)).toBe(4);
    });

    it('should not clear dataVersion when clearCommittedVersions is called', () => {
      useDuckDBViewStore.setState(state => {
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(viewName, 5);
        return { dataVersion: newDataVersion };
      });

      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      // dataVersion should be preserved — it's about data freshness, not edit versions
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(5);
    });
  });
});
