import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useViewStateHistory,
  generateChangeDescription,
  type ViewState,
} from './useViewStateHistory';

describe('useViewStateHistory', () => {
  describe('initial state', () => {
    it('should start with default state', () => {
      const { result } = renderHook(() => useViewStateHistory());

      expect(result.current.currentState.sortColumn).toBeNull();
      expect(result.current.currentState.sortDirection).toBeNull();
      expect(result.current.currentState.search).toBe('');
      expect(result.current.currentState.page).toBe(0);
      expect(result.current.currentState.pageSize).toBe(50);
      expect(result.current.currentState.filters).toEqual([]);
    });

    it('should not allow undo or redo initially', () => {
      const { result } = renderHook(() => useViewStateHistory());

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.historyLength).toBe(1);
      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('pushState', () => {
    it('should add a new state to history', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          { sortColumn: 'name', sortDirection: 'ASC' },
          'sort',
          'Sort by name ascending'
        );
      });

      expect(result.current.currentState.sortColumn).toBe('name');
      expect(result.current.currentState.sortDirection).toBe('ASC');
      expect(result.current.historyLength).toBe(2);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('should preserve unchanged state fields', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState({ search: 'test' }, 'search', 'Search test');
      });

      // Original defaults should be preserved
      expect(result.current.currentState.sortColumn).toBeNull();
      expect(result.current.currentState.page).toBe(0);
      expect(result.current.currentState.pageSize).toBe(50);
      // New value should be set
      expect(result.current.currentState.search).toBe('test');
    });

    it('should truncate forward history when pushing after undo', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // Add some states
      act(() => {
        result.current.pushState({ search: 'a' }, 'search', 'Search a');
      });
      act(() => {
        result.current.pushState({ search: 'b' }, 'search', 'Search b');
      });
      act(() => {
        result.current.pushState({ search: 'c' }, 'search', 'Search c');
      });

      expect(result.current.historyLength).toBe(4);

      // Undo twice
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.search).toBe('a');
      expect(result.current.canRedo).toBe(true);

      // Push new state - should truncate forward history
      act(() => {
        result.current.pushState({ search: 'd' }, 'search', 'Search d');
      });

      expect(result.current.currentState.search).toBe('d');
      expect(result.current.historyLength).toBe(3); // initial + 'a' + 'd'
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('undo', () => {
    it('should return to previous state', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          { sortColumn: 'name', sortDirection: 'ASC' },
          'sort',
          'Sort by name'
        );
      });

      act(() => {
        const previousState = result.current.undo();
        expect(previousState).not.toBeNull();
        expect(previousState?.sortColumn).toBeNull();
      });

      expect(result.current.currentState.sortColumn).toBeNull();
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it('should return null when at beginning of history', () => {
      const { result } = renderHook(() => useViewStateHistory());

      let undoResult: ViewState | null = null;
      act(() => {
        undoResult = result.current.undo();
      });

      expect(undoResult).toBeNull();
    });

    it('should allow multiple undos', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState({ search: 'a' }, 'search', 'Search a');
      });
      act(() => {
        result.current.pushState({ search: 'b' }, 'search', 'Search b');
      });
      act(() => {
        result.current.pushState({ search: 'c' }, 'search', 'Search c');
      });

      expect(result.current.currentState.search).toBe('c');

      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState.search).toBe('b');

      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState.search).toBe('a');

      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState.search).toBe('');
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('redo', () => {
    it('should restore next state after undo', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          { sortColumn: 'name', sortDirection: 'DESC' },
          'sort',
          'Sort by name desc'
        );
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.sortColumn).toBeNull();

      act(() => {
        const nextState = result.current.redo();
        expect(nextState).not.toBeNull();
        expect(nextState?.sortColumn).toBe('name');
      });

      expect(result.current.currentState.sortColumn).toBe('name');
      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });

    it('should return null when at end of history', () => {
      const { result } = renderHook(() => useViewStateHistory());

      let redoResult: ViewState | null = null;
      act(() => {
        redoResult = result.current.redo();
      });

      expect(redoResult).toBeNull();
    });

    it('should allow multiple redos', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState({ page: 1 }, 'page', 'Go to page 2');
      });
      act(() => {
        result.current.pushState({ page: 2 }, 'page', 'Go to page 3');
      });
      act(() => {
        result.current.pushState({ page: 3 }, 'page', 'Go to page 4');
      });

      // Undo all - must be separate act() calls to avoid batching issues
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.page).toBe(0);

      // Redo all
      act(() => {
        result.current.redo();
      });
      expect(result.current.currentState.page).toBe(1);

      act(() => {
        result.current.redo();
      });
      expect(result.current.currentState.page).toBe(2);

      act(() => {
        result.current.redo();
      });
      expect(result.current.currentState.page).toBe(3);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear history and return to default state', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // Must be separate act() calls to avoid batching issues
      act(() => {
        result.current.pushState({ search: 'test' }, 'search', 'Search');
      });
      act(() => {
        result.current.pushState({ page: 5 }, 'page', 'Go to page 6');
      });
      act(() => {
        result.current.pushState({ sortColumn: 'name', sortDirection: 'ASC' }, 'sort', 'Sort');
      });

      expect(result.current.historyLength).toBe(4);

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentState.search).toBe('');
      expect(result.current.currentState.page).toBe(0);
      expect(result.current.currentState.sortColumn).toBeNull();
      expect(result.current.historyLength).toBe(1);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('change descriptions', () => {
    it('should provide undo description', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          { sortColumn: 'name', sortDirection: 'ASC' },
          'sort',
          'Sort by name ascending'
        );
      });

      expect(result.current.getUndoDescription()).toBe('Undo: Sort by name ascending');
    });

    it('should provide redo description after undo', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          { search: 'hello' },
          'search',
          'Search "hello"'
        );
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.getRedoDescription()).toBe('Redo: Search "hello"');
    });

    it('should return null for descriptions when not available', () => {
      const { result } = renderHook(() => useViewStateHistory());

      expect(result.current.getUndoDescription()).toBeNull();
      expect(result.current.getRedoDescription()).toBeNull();
    });
  });

  describe('max history size', () => {
    it('should trim old states when exceeding max size', () => {
      const { result } = renderHook(() =>
        useViewStateHistory({ maxHistorySize: 3 })
      );

      act(() => {
        result.current.pushState({ page: 1 }, 'page', 'Page 2');
      });
      act(() => {
        result.current.pushState({ page: 2 }, 'page', 'Page 3');
      });
      act(() => {
        result.current.pushState({ page: 3 }, 'page', 'Page 4');
      });
      act(() => {
        result.current.pushState({ page: 4 }, 'page', 'Page 5');
      });

      // Should be trimmed to 3
      expect(result.current.historyLength).toBe(3);
      expect(result.current.currentState.page).toBe(4);
    });
  });

  describe('onStateChange callback', () => {
    it('should call callback when state changes', () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useViewStateHistory({ onStateChange })
      );

      act(() => {
        result.current.pushState(
          { sortColumn: 'name', sortDirection: 'DESC' },
          'sort',
          'Sort by name descending'
        );
      });

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sort',
          description: 'Sort by name descending',
        })
      );
    });
  });
});

describe('useViewStateHistory with query results', () => {
  describe('queryResult state', () => {
    it('should store query result in state', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT name FROM users WHERE age > 30',
              schema: [{ name: 'name', type: 'VARCHAR' }],
              rowCount: 10,
            },
          },
          'query',
          'Query result (10 rows)'
        );
      });

      expect(result.current.currentState.queryResult).toBeDefined();
      expect(result.current.currentState.queryResult?.sql).toBe('SELECT name FROM users WHERE age > 30');
      expect(result.current.currentState.queryResult?.rowCount).toBe(10);
    });

    it('should allow undo/redo of query results', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM users',
              schema: [{ name: 'id', type: 'INTEGER' }],
              rowCount: 100,
            },
          },
          'query',
          'Query result'
        );
      });

      expect(result.current.currentState.queryResult?.sql).toBe('SELECT * FROM users');

      act(() => {
        result.current.undo();
      });

      // After undo, queryResult should be undefined (initial state)
      expect(result.current.currentState.queryResult).toBeUndefined();

      act(() => {
        result.current.redo();
      });

      // After redo, should be back
      expect(result.current.currentState.queryResult?.sql).toBe('SELECT * FROM users');
    });

    it('should clear query result when pushing non-query state', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // First, set a query result
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM users',
              schema: [],
              rowCount: 50,
            },
          },
          'query',
          'Query'
        );
      });

      // Then push a sort state (which should preserve queryResult since we're merging)
      act(() => {
        result.current.pushState(
          { sortColumn: 'name', sortDirection: 'ASC' },
          'sort',
          'Sort'
        );
      });

      // Query result should still be there (merging behavior)
      expect(result.current.currentState.queryResult?.sql).toBe('SELECT * FROM users');
      expect(result.current.currentState.sortColumn).toBe('name');
    });

    it('should explicitly clear query result', () => {
      const { result } = renderHook(() => useViewStateHistory());

      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM users',
              schema: [],
              rowCount: 50,
            },
          },
          'query',
          'Query'
        );
      });

      // Explicitly clear by setting to null
      act(() => {
        result.current.pushState(
          { queryResult: null },
          'reset',
          'Clear query'
        );
      });

      expect(result.current.currentState.queryResult).toBeNull();
    });
  });

  describe('complex AI query workflows', () => {
    /**
     * Scenario: AI query → sort on query result → undo to before query
     * View state history allows navigating through different view configurations
     */
    it('should handle AI query followed by sort and navigation', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // Step 1: Run AI query
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT name, age FROM users WHERE age > 30',
              schema: [
                { name: 'name', type: 'VARCHAR' },
                { name: 'age', type: 'INTEGER' },
              ],
              rowCount: 25,
            },
          },
          'query',
          'Query result (25 rows)'
        );
      });

      expect(result.current.currentState.queryResult?.rowCount).toBe(25);
      expect(result.current.historyLength).toBe(2);

      // Step 2: Sort the query results
      act(() => {
        result.current.pushState(
          { sortColumn: 'age', sortDirection: 'DESC' },
          'sort',
          'Sort by age desc'
        );
      });

      expect(result.current.currentState.sortColumn).toBe('age');
      expect(result.current.currentState.queryResult?.rowCount).toBe(25); // Preserved
      expect(result.current.historyLength).toBe(3);

      // Step 3: Undo sort
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.sortColumn).toBeNull();
      expect(result.current.currentState.queryResult?.rowCount).toBe(25); // Still there

      // Step 4: Undo query
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.queryResult).toBeUndefined();
      expect(result.current.historyLength).toBe(3);
      expect(result.current.canRedo).toBe(true);
    });

    /**
     * Scenario: Multiple AI queries in sequence
     * Each query creates a new view state entry
     */
    it('should handle multiple sequential AI queries', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // Query 1
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM users',
              schema: [{ name: 'id', type: 'INTEGER' }],
              rowCount: 100,
            },
          },
          'query',
          'Query result (100 rows)'
        );
      });

      // Query 2 (different query)
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM orders',
              schema: [{ name: 'order_id', type: 'INTEGER' }],
              rowCount: 500,
            },
          },
          'query',
          'Query result (500 rows)'
        );
      });

      // Query 3
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM products WHERE price > 50',
              schema: [{ name: 'product_id', type: 'INTEGER' }],
              rowCount: 42,
            },
          },
          'query',
          'Query result (42 rows)'
        );
      });

      expect(result.current.historyLength).toBe(4);
      expect(result.current.currentState.queryResult?.rowCount).toBe(42);

      // Undo to query 2
      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState.queryResult?.rowCount).toBe(500);

      // Undo to query 1
      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState.queryResult?.rowCount).toBe(100);

      // Redo back to query 3
      act(() => {
        result.current.redo();
      });
      act(() => {
        result.current.redo();
      });
      expect(result.current.currentState.queryResult?.rowCount).toBe(42);
    });

    /**
     * Scenario: AI query combined with search, filter, and sort
     * All view state changes are tracked together
     */
    it('should track AI query with search, filter, and sort together', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // Run AI query
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM sales',
              schema: [],
              rowCount: 1000,
            },
          },
          'query',
          'Sales data'
        );
      });

      // Apply search within results
      act(() => {
        result.current.pushState(
          { search: 'premium' },
          'search',
          'Search "premium"'
        );
      });

      // Sort results
      act(() => {
        result.current.pushState(
          { sortColumn: 'amount', sortDirection: 'DESC' },
          'sort',
          'Sort by amount desc'
        );
      });

      // Change page
      act(() => {
        result.current.pushState(
          { page: 2 },
          'page',
          'Go to page 3'
        );
      });

      // Verify all state is combined
      expect(result.current.currentState.queryResult?.sql).toBe('SELECT * FROM sales');
      expect(result.current.currentState.search).toBe('premium');
      expect(result.current.currentState.sortColumn).toBe('amount');
      expect(result.current.currentState.page).toBe(2);

      // Undo descriptions should be correct
      expect(result.current.getUndoDescription()).toBe('Undo: Go to page 3');

      // Undo page change
      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState.page).toBe(0);
      expect(result.current.getUndoDescription()).toBe('Undo: Sort by amount desc');
    });

    /**
     * Scenario: Clear query result explicitly
     * User can clear query result to go back to base table view
     */
    it('should handle clearing query result to return to base view', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // Run AI query
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM users WHERE active = true',
              schema: [],
              rowCount: 50,
            },
          },
          'query',
          'Active users'
        );
      });

      // Sort query results
      act(() => {
        result.current.pushState(
          { sortColumn: 'name', sortDirection: 'ASC' },
          'sort',
          'Sort by name'
        );
      });

      // Clear query to return to base table
      act(() => {
        result.current.pushState(
          { queryResult: null, sortColumn: null, sortDirection: null },
          'reset',
          'Clear query'
        );
      });

      expect(result.current.currentState.queryResult).toBeNull();
      expect(result.current.currentState.sortColumn).toBeNull();

      // Can undo to get query back
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.queryResult?.sql).toBe('SELECT * FROM users WHERE active = true');
      expect(result.current.currentState.sortColumn).toBe('name');
    });

    /**
     * Scenario: New query after undo truncates history
     * Similar to git branching - new changes truncate forward history
     */
    it('should truncate forward history when running new query after undo', () => {
      const { result } = renderHook(() => useViewStateHistory());

      // Query 1
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM users',
              schema: [],
              rowCount: 100,
            },
          },
          'query',
          'Users query'
        );
      });

      // Query 2
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM orders',
              schema: [],
              rowCount: 200,
            },
          },
          'query',
          'Orders query'
        );
      });

      // Query 3
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM products',
              schema: [],
              rowCount: 300,
            },
          },
          'query',
          'Products query'
        );
      });

      expect(result.current.historyLength).toBe(4);

      // Undo twice (back to query 1)
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.queryResult?.sql).toBe('SELECT * FROM users');
      expect(result.current.canRedo).toBe(true);

      // Run a different query (should truncate query 2 and 3)
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM inventory',
              schema: [],
              rowCount: 150,
            },
          },
          'query',
          'Inventory query'
        );
      });

      expect(result.current.historyLength).toBe(3); // initial + users + inventory
      expect(result.current.canRedo).toBe(false);
      expect(result.current.currentState.queryResult?.sql).toBe('SELECT * FROM inventory');
    });

    /**
     * Scenario: Schema changes between queries
     * Different queries may have different schemas
     */
    it('should preserve schema information for each query state', () => {
      const { result } = renderHook(() => useViewStateHistory());

      const usersSchema = [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'VARCHAR' },
        { name: 'email', type: 'VARCHAR' },
      ];

      const ordersSchema = [
        { name: 'order_id', type: 'INTEGER' },
        { name: 'user_id', type: 'INTEGER' },
        { name: 'total', type: 'DECIMAL' },
      ];

      // Users query
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM users',
              schema: usersSchema,
              rowCount: 100,
            },
          },
          'query',
          'Users'
        );
      });

      // Orders query
      act(() => {
        result.current.pushState(
          {
            queryResult: {
              sql: 'SELECT * FROM orders',
              schema: ordersSchema,
              rowCount: 500,
            },
          },
          'query',
          'Orders'
        );
      });

      expect(result.current.currentState.queryResult?.schema).toEqual(ordersSchema);

      // Undo to users
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentState.queryResult?.schema).toEqual(usersSchema);
    });
  });
});

describe('generateChangeDescription', () => {
  describe('sort', () => {
    it('should generate sort description with column and direction', () => {
      expect(
        generateChangeDescription('sort', { column: 'name', direction: 'ASC' })
      ).toBe('Sort by name asc');
    });

    it('should generate clear sort description when no column', () => {
      expect(generateChangeDescription('sort')).toBe('Clear sort');
    });
  });

  describe('filter', () => {
    it('should generate filter description', () => {
      expect(
        generateChangeDescription('filter', { column: 'status', value: 'active' })
      ).toBe('Filter status');
    });

    it('should generate clear filter description', () => {
      expect(generateChangeDescription('filter')).toBe('Clear filter');
    });
  });

  describe('search', () => {
    it('should generate search description', () => {
      expect(
        generateChangeDescription('search', { value: 'hello world' })
      ).toBe('Search "hello world"');
    });

    it('should generate clear search description', () => {
      expect(generateChangeDescription('search')).toBe('Clear search');
    });
  });

  describe('page', () => {
    it('should generate page description (1-indexed)', () => {
      expect(generateChangeDescription('page', { page: 0 })).toBe('Go to page 1');
      expect(generateChangeDescription('page', { page: 4 })).toBe('Go to page 5');
    });
  });

  describe('limit', () => {
    it('should generate limit description', () => {
      expect(generateChangeDescription('limit', { limit: 100 })).toBe('Show 100 rows');
    });
  });

  describe('reset', () => {
    it('should generate reset description', () => {
      expect(generateChangeDescription('reset')).toBe('Reset view');
    });
  });

  describe('query', () => {
    it('should generate query description with row count', () => {
      expect(generateChangeDescription('query', { rowCount: 42 })).toBe('Query result (42 rows)');
    });

    it('should generate query description without row count', () => {
      expect(generateChangeDescription('query')).toBe('Custom query');
    });

    it('should handle zero row count', () => {
      expect(generateChangeDescription('query', { rowCount: 0 })).toBe('Query result (0 rows)');
    });
  });
});
