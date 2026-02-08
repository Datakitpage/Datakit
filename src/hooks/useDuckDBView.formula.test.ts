/**
 * useDuckDBView Formula Tests
 *
 * Tests for the formula evaluation functionality including:
 * - evaluateFormula function
 * - editCellWithFormula function
 * - Integration with pending changes
 * - Version control integration
 * - Error handling
 * - Complex scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDuckDBView } from './useDuckDBView';
import { useDuckDBViewStore } from '@/store/duckDBViewStore';
import type { ColumnSchema, ViewDefinition } from '@/store/duckDBViewStore';

// Mock the DuckDB store
vi.mock('@/store/duckDBViewStore', () => ({
  useDuckDBViewStore: vi.fn(),
}));

// Test schema
const testSchema: ColumnSchema[] = [
  { name: '_rowid', type: 'BIGINT' },
  { name: 'id', type: 'BIGINT' },
  { name: 'product', type: 'VARCHAR' },
  { name: 'price', type: 'DOUBLE' },
  { name: 'quantity', type: 'INTEGER' },
  { name: 'discount', type: 'DOUBLE' },
  { name: 'total', type: 'DOUBLE' },
];

// Test data
const testData = [
  { _rowid: 1, id: 1, product: 'Widget', price: 100, quantity: 5, discount: 0.1, total: 450 },
  { _rowid: 2, id: 2, product: 'Gadget', price: 200, quantity: 3, discount: 0.05, total: 570 },
  { _rowid: 3, id: 3, product: 'Gizmo', price: 150, quantity: 10, discount: 0.15, total: 1275 },
];

// Mock view definition
const mockViewDef: ViewDefinition = {
  viewName: 'test_view',
  fileName: 'test.csv',
  fileType: 'csv',
  schema: testSchema,
  totalRows: 3,
  createdAt: Date.now(),
};

describe('useDuckDBView - Formula Evaluation', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  function createMockStore() {
    const pendingChanges = new Map();
    const changeHistory: any[] = [];

    return {
      initialize: vi.fn().mockResolvedValue(true),
      createViewFromFile: vi.fn(),
      createViewFromData: vi.fn(),
      dropView: vi.fn(),
      queryView: vi.fn().mockResolvedValue({
        data: testData,
        totalRows: 3,
        totalPages: 1,
        currentPage: 0,
        pageSize: 50,
        queryTime: 10,
      }),
      executeSQL: vi.fn(),
      validateSQL: vi.fn().mockResolvedValue({ valid: true }),
      exportView: vi.fn(),
      refreshViewSchema: vi.fn(),
      addColumnWithVersion: vi.fn(),
      views: new Map([['test_view', mockViewDef]]),
      activeViewName: 'test_view' as string | null,
      isLoading: false,
      error: null,
      pendingChanges,
      recordChange: vi.fn((change) => {
        const viewChanges = pendingChanges.get(change.viewName) || [];
        pendingChanges.set(change.viewName, [...viewChanges, { ...change, id: `change_${Date.now()}`, timestamp: Date.now() }]);
        changeHistory.push(change);
      }),
      undoLastChange: vi.fn(),
      discardChanges: vi.fn(),
      commitChanges: vi.fn().mockResolvedValue(true),
      getPendingChanges: vi.fn((viewName) => pendingChanges.get(viewName) || []),
      resetError: vi.fn(),
      undoVersion: vi.fn(),
      redoVersion: vi.fn(),
      canUndoVersion: vi.fn().mockReturnValue(false),
      canRedoVersion: vi.fn().mockReturnValue(false),
      getVersionInfo: vi.fn().mockReturnValue({ current: 0, total: 0, description: null }),
      committedVersions: new Map(),
      currentVersionIndex: new Map(),
      dataVersion: new Map([['test_view', 1]]),
      changeHistory,
    };
  }

  beforeEach(() => {
    mockStore = createMockStore();
    vi.mocked(useDuckDBViewStore).mockReturnValue(mockStore as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluateFormula', () => {
    it('should evaluate simple arithmetic formula', async () => {
      mockStore.executeSQL.mockResolvedValue([{ result: 500 }]);

      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=price * quantity', 1, 'total');
        expect(evalResult.success).toBe(true);
        if (evalResult.success) {
          expect(evalResult.value).toBe(500);
          expect(evalResult.sql).toContain('"price"');
          expect(evalResult.sql).toContain('"quantity"');
          expect(evalResult.isAggregate).toBe(false);
        }
      });

      expect(mockStore.executeSQL).toHaveBeenCalled();
    });

    it('should evaluate aggregate formula', async () => {
      mockStore.executeSQL.mockResolvedValue([{ result: 450 }]);

      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=SUM(price)', 1, 'total');
        expect(evalResult.success).toBe(true);
        if (evalResult.success) {
          expect(evalResult.value).toBe(450);
          expect(evalResult.isAggregate).toBe(true);
          // Aggregate should not have WHERE clause
          expect(evalResult.sql).not.toContain('WHERE _rowid');
        }
      });
    });

    it('should return error for invalid formula', async () => {
      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=UNKNOWN(price)', 1, 'total');
        expect(evalResult.success).toBe(false);
        if (!evalResult.success) {
          expect(evalResult.error).toContain('Unknown function');
        }
      });

      expect(mockStore.executeSQL).not.toHaveBeenCalled();
    });

    it('should return error for invalid column reference', async () => {
      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=nonexistent + price', 1, 'total');
        expect(evalResult.success).toBe(false);
        if (!evalResult.success) {
          expect(evalResult.error).toContain('Unknown column');
        }
      });
    });

    it('should return error for non-formula input', async () => {
      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('just a value', 1, 'total');
        expect(evalResult.success).toBe(false);
        if (!evalResult.success) {
          expect(evalResult.error).toContain('must start with =');
        }
      });
    });

    it('should return error when no active view', async () => {
      mockStore.activeViewName = null;
      vi.mocked(useDuckDBViewStore).mockReturnValue(mockStore as any);

      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=price * 2', 1, 'total');
        expect(evalResult.success).toBe(false);
        if (!evalResult.success) {
          expect(evalResult.error).toContain('No active view');
        }
      });
    });

    it('should handle SQL execution error', async () => {
      mockStore.executeSQL.mockRejectedValue(new Error('SQL execution failed'));

      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=price * quantity', 1, 'total');
        expect(evalResult.success).toBe(false);
        if (!evalResult.success) {
          expect(evalResult.error).toContain('SQL execution failed');
        }
      });
    });

    it('should handle empty result from SQL', async () => {
      mockStore.executeSQL.mockResolvedValue([]);

      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=price * quantity', 1, 'total');
        expect(evalResult.success).toBe(false);
        if (!evalResult.success) {
          expect(evalResult.error).toContain('No result');
        }
      });
    });

    it('should handle null result from SQL', async () => {
      mockStore.executeSQL.mockResolvedValue(null);

      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.evaluateFormula('=price * quantity', 1, 'total');
        expect(evalResult.success).toBe(false);
      });
    });
  });

  describe('editCellWithFormula', () => {
    it('should evaluate and apply formula result', async () => {
      mockStore.executeSQL.mockResolvedValue([{ result: 500 }]);

      const { result } = renderHook(() => useDuckDBView());

      // Wait for initial query
      await waitFor(() => {
        expect(result.current.data.length).toBeGreaterThan(0);
      });

      await act(async () => {
        const evalResult = await result.current.editCellWithFormula(1, 'total', '=price * quantity');
        expect(evalResult.success).toBe(true);
      });

      // Should record change with formula metadata
      expect(mockStore.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({
          rowId: 1,
          column: 'total',
          newValue: 500,
          formula: '=price * quantity',
          isFormulaResult: true,
        })
      );
    });

    it('should not record change on formula error', async () => {
      const { result } = renderHook(() => useDuckDBView());

      await act(async () => {
        const evalResult = await result.current.editCellWithFormula(1, 'total', '=UNKNOWN(price)');
        expect(evalResult.success).toBe(false);
      });

      expect(mockStore.recordChange).not.toHaveBeenCalled();
    });

    it('should track formula in change record', async () => {
      mockStore.executeSQL.mockResolvedValue([{ result: 150 }]);

      const { result } = renderHook(() => useDuckDBView());

      await waitFor(() => {
        expect(result.current.data.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.editCellWithFormula(2, 'total', '=price * (1 - discount)');
      });

      const changeCall = mockStore.recordChange.mock.calls[0][0];
      expect(changeCall.formula).toBe('=price * (1 - discount)');
      expect(changeCall.isFormulaResult).toBe(true);
    });
  });

  describe('editCell with formula options', () => {
    it('should accept formula metadata in options', async () => {
      const { result } = renderHook(() => useDuckDBView());

      await waitFor(() => {
        expect(result.current.data.length).toBeGreaterThan(0);
      });

      await act(async () => {
        result.current.editCell(1, 'total', 500, {
          formula: '=price * quantity',
          isFormulaResult: true,
        });
      });

      expect(mockStore.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({
          formula: '=price * quantity',
          isFormulaResult: true,
        })
      );
    });

    it('should work without formula options', async () => {
      const { result } = renderHook(() => useDuckDBView());

      await waitFor(() => {
        expect(result.current.data.length).toBeGreaterThan(0);
      });

      await act(async () => {
        result.current.editCell(1, 'total', 999);
      });

      expect(mockStore.recordChange).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: 999,
          formula: undefined,
          isFormulaResult: undefined,
        })
      );
    });
  });
});

describe('useDuckDBView - Formula with Pending Changes', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  function createMockStore() {
    const pendingChanges = new Map();

    return {
      initialize: vi.fn().mockResolvedValue(true),
      createViewFromFile: vi.fn(),
      createViewFromData: vi.fn(),
      dropView: vi.fn(),
      queryView: vi.fn().mockResolvedValue({
        data: testData,
        totalRows: 3,
        totalPages: 1,
        currentPage: 0,
        pageSize: 50,
        queryTime: 10,
      }),
      executeSQL: vi.fn(),
      validateSQL: vi.fn().mockResolvedValue({ valid: true }),
      exportView: vi.fn(),
      refreshViewSchema: vi.fn(),
      addColumnWithVersion: vi.fn(),
      views: new Map([['test_view', mockViewDef]]),
      activeViewName: 'test_view',
      isLoading: false,
      error: null,
      pendingChanges,
      recordChange: vi.fn((change) => {
        const viewChanges = pendingChanges.get(change.viewName) || [];
        pendingChanges.set(change.viewName, [...viewChanges, { ...change, id: `change_${Date.now()}`, timestamp: Date.now() }]);
      }),
      undoLastChange: vi.fn(),
      discardChanges: vi.fn(),
      commitChanges: vi.fn().mockResolvedValue(true),
      getPendingChanges: vi.fn((viewName) => pendingChanges.get(viewName) || []),
      resetError: vi.fn(),
      undoVersion: vi.fn(),
      redoVersion: vi.fn(),
      canUndoVersion: vi.fn().mockReturnValue(false),
      canRedoVersion: vi.fn().mockReturnValue(false),
      getVersionInfo: vi.fn().mockReturnValue({ current: 0, total: 0, description: null }),
      committedVersions: new Map(),
      currentVersionIndex: new Map(),
      dataVersion: new Map([['test_view', 1]]),
    };
  }

  beforeEach(() => {
    mockStore = createMockStore();
    vi.mocked(useDuckDBViewStore).mockReturnValue(mockStore as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should add formula changes to pending changes', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 500 }]);

    const { result } = renderHook(() => useDuckDBView());

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.editCellWithFormula(1, 'total', '=price * quantity');
    });

    // Verify recordChange was called with formula metadata
    expect(mockStore.recordChange).toHaveBeenCalled();
    const recordedChange = mockStore.recordChange.mock.calls[0][0];
    expect(recordedChange).toMatchObject({
      viewName: 'test_view',
      rowId: 1,
      column: 'total',
      newValue: 500,
      formula: '=price * quantity',
      isFormulaResult: true,
    });
    // Verify changes were added to pending changes Map
    expect(mockStore.getPendingChanges('test_view').length).toBe(1);
  });

  it('should track multiple formula changes', async () => {
    mockStore.executeSQL
      .mockResolvedValueOnce([{ result: 500 }])
      .mockResolvedValueOnce([{ result: 600 }])
      .mockResolvedValueOnce([{ result: 1500 }]);

    const { result } = renderHook(() => useDuckDBView());

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.editCellWithFormula(1, 'total', '=price * quantity');
      await result.current.editCellWithFormula(2, 'total', '=price * quantity');
      await result.current.editCellWithFormula(3, 'total', '=price * quantity');
    });

    expect(mockStore.recordChange).toHaveBeenCalledTimes(3);
  });

  it('should preserve formula metadata through commit', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 500 }]);

    const { result } = renderHook(() => useDuckDBView());

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.editCellWithFormula(1, 'total', '=price * quantity');
    });

    // Get the recorded change
    const pendingChanges = mockStore.getPendingChanges('test_view');
    expect(pendingChanges[0].formula).toBe('=price * quantity');

    await act(async () => {
      await result.current.commit();
    });

    expect(mockStore.commitChanges).toHaveBeenCalledWith('test_view');
  });
});

describe('useDuckDBView - Complex Formula Scenarios', () => {
  let mockStore: any;

  beforeEach(() => {
    const pendingChanges = new Map();

    mockStore = {
      initialize: vi.fn().mockResolvedValue(true),
      createViewFromFile: vi.fn(),
      createViewFromData: vi.fn(),
      dropView: vi.fn(),
      queryView: vi.fn().mockResolvedValue({
        data: testData,
        totalRows: 3,
        totalPages: 1,
        currentPage: 0,
        pageSize: 50,
        queryTime: 10,
      }),
      executeSQL: vi.fn(),
      validateSQL: vi.fn().mockResolvedValue({ valid: true }),
      exportView: vi.fn(),
      refreshViewSchema: vi.fn(),
      addColumnWithVersion: vi.fn(),
      views: new Map([['test_view', mockViewDef]]),
      activeViewName: 'test_view',
      isLoading: false,
      error: null,
      pendingChanges,
      recordChange: vi.fn((change) => {
        const viewChanges = pendingChanges.get(change.viewName) || [];
        pendingChanges.set(change.viewName, [...viewChanges, { ...change, id: `change_${Date.now()}`, timestamp: Date.now() }]);
      }),
      undoLastChange: vi.fn((viewName) => {
        const changes = pendingChanges.get(viewName) || [];
        if (changes.length > 0) {
          changes.pop();
          pendingChanges.set(viewName, changes);
          return changes[changes.length - 1] || null;
        }
        return null;
      }),
      discardChanges: vi.fn(),
      commitChanges: vi.fn().mockResolvedValue(true),
      getPendingChanges: vi.fn((viewName) => pendingChanges.get(viewName) || []),
      resetError: vi.fn(),
      undoVersion: vi.fn(),
      redoVersion: vi.fn(),
      canUndoVersion: vi.fn().mockReturnValue(false),
      canRedoVersion: vi.fn().mockReturnValue(false),
      getVersionInfo: vi.fn().mockReturnValue({ current: 0, total: 0, description: null }),
      committedVersions: new Map(),
      currentVersionIndex: new Map(),
      dataVersion: new Map([['test_view', 1]]),
    };

    vi.mocked(useDuckDBViewStore).mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle IF formula', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 'expensive' }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula(
        "=IF(price > 100, 'expensive', 'cheap')",
        2,
        'category'
      );
      expect(evalResult.success).toBe(true);
      if (evalResult.success) {
        expect(evalResult.value).toBe('expensive');
        expect(evalResult.sql).toContain('CASE WHEN');
      }
    });
  });

  it('should handle complex discount calculation', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 427.5 }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula(
        '=(price * quantity) * (1 - discount)',
        1,
        'total'
      );
      expect(evalResult.success).toBe(true);
      if (evalResult.success) {
        expect(evalResult.value).toBe(427.5);
      }
    });
  });

  it('should handle nested functions', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 500 }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula(
        '=ROUND(price * quantity, 2)',
        1,
        'total'
      );
      expect(evalResult.success).toBe(true);
      if (evalResult.success) {
        expect(evalResult.sql).toContain('ROUND');
      }
    });
  });

  it('should handle SUM for total calculation', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 2295 }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula('=SUM(total)', 1, 'result');
      expect(evalResult.success).toBe(true);
      if (evalResult.success) {
        expect(evalResult.value).toBe(2295);
        expect(evalResult.isAggregate).toBe(true);
      }
    });
  });

  it('should handle AVG for average calculation', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 150 }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula('=AVG(price)', 1, 'result');
      expect(evalResult.success).toBe(true);
      if (evalResult.success) {
        expect(evalResult.value).toBe(150);
        expect(evalResult.isAggregate).toBe(true);
      }
    });
  });
});

describe('useDuckDBView - Large Dataset Scenarios', () => {
  let mockStore: any;

  const largeSchema: ColumnSchema[] = [
    { name: '_rowid', type: 'BIGINT' },
    ...Array.from({ length: 50 }, (_, i) => ({
      name: `col_${i}`,
      type: i % 3 === 0 ? 'DOUBLE' : i % 3 === 1 ? 'INTEGER' : 'VARCHAR',
    })),
  ];

  const largeData = Array.from({ length: 1000 }, (_, i) => ({
    _rowid: i + 1,
    ...Object.fromEntries(
      Array.from({ length: 50 }, (_, j) => [
        `col_${j}`,
        j % 3 === 0 ? Math.random() * 1000 : j % 3 === 1 ? Math.floor(Math.random() * 100) : `value_${i}_${j}`,
      ])
    ),
  }));

  const largeViewDef: ViewDefinition = {
    viewName: 'large_view',
    fileName: 'large.csv',
    fileType: 'csv',
    schema: largeSchema,
    totalRows: 1000,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    mockStore = {
      initialize: vi.fn().mockResolvedValue(true),
      createViewFromFile: vi.fn(),
      createViewFromData: vi.fn(),
      dropView: vi.fn(),
      queryView: vi.fn().mockResolvedValue({
        data: largeData.slice(0, 50),
        totalRows: 1000,
        totalPages: 20,
        currentPage: 0,
        pageSize: 50,
        queryTime: 50,
      }),
      executeSQL: vi.fn(),
      validateSQL: vi.fn().mockResolvedValue({ valid: true }),
      exportView: vi.fn(),
      refreshViewSchema: vi.fn(),
      addColumnWithVersion: vi.fn(),
      views: new Map([['large_view', largeViewDef]]),
      activeViewName: 'large_view',
      isLoading: false,
      error: null,
      pendingChanges: new Map(),
      recordChange: vi.fn(),
      undoLastChange: vi.fn(),
      discardChanges: vi.fn(),
      commitChanges: vi.fn().mockResolvedValue(true),
      getPendingChanges: vi.fn().mockReturnValue([]),
      resetError: vi.fn(),
      undoVersion: vi.fn(),
      redoVersion: vi.fn(),
      canUndoVersion: vi.fn().mockReturnValue(false),
      canRedoVersion: vi.fn().mockReturnValue(false),
      getVersionInfo: vi.fn().mockReturnValue({ current: 0, total: 0, description: null }),
      committedVersions: new Map(),
      currentVersionIndex: new Map(),
      dataVersion: new Map([['large_view', 1]]),
    };

    vi.mocked(useDuckDBViewStore).mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle formula on large dataset', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 50000 }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula('=SUM(col_0)', 1, 'result');
      expect(evalResult.success).toBe(true);
    });
  });

  it('should handle formula with many column references', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: 1234.56 }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula(
        '=col_0 + col_3 + col_6 + col_9 + col_12',
        1,
        'result'
      );
      expect(evalResult.success).toBe(true);
    });
  });

  it('should efficiently validate formulas against large schema', async () => {
    const { result } = renderHook(() => useDuckDBView());

    const start = performance.now();

    await act(async () => {
      for (let i = 0; i < 100; i++) {
        await result.current.evaluateFormula('=col_0 * col_3', 1, 'result');
      }
    });

    const elapsed = performance.now() - start;
    // Should complete quickly (excluding SQL execution time)
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('useDuckDBView - Error Recovery', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      initialize: vi.fn().mockResolvedValue(true),
      createViewFromFile: vi.fn(),
      createViewFromData: vi.fn(),
      dropView: vi.fn(),
      queryView: vi.fn().mockResolvedValue({
        data: testData,
        totalRows: 3,
        totalPages: 1,
        currentPage: 0,
        pageSize: 50,
        queryTime: 10,
      }),
      executeSQL: vi.fn(),
      validateSQL: vi.fn().mockResolvedValue({ valid: true }),
      exportView: vi.fn(),
      refreshViewSchema: vi.fn(),
      addColumnWithVersion: vi.fn(),
      views: new Map([['test_view', mockViewDef]]),
      activeViewName: 'test_view',
      isLoading: false,
      error: null,
      pendingChanges: new Map(),
      recordChange: vi.fn(),
      undoLastChange: vi.fn(),
      discardChanges: vi.fn(),
      commitChanges: vi.fn().mockResolvedValue(true),
      getPendingChanges: vi.fn().mockReturnValue([]),
      resetError: vi.fn(),
      undoVersion: vi.fn(),
      redoVersion: vi.fn(),
      canUndoVersion: vi.fn().mockReturnValue(false),
      canRedoVersion: vi.fn().mockReturnValue(false),
      getVersionInfo: vi.fn().mockReturnValue({ current: 0, total: 0, description: null }),
      committedVersions: new Map(),
      currentVersionIndex: new Map(),
      dataVersion: new Map([['test_view', 1]]),
    };

    vi.mocked(useDuckDBViewStore).mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should recover from SQL error and allow retry', async () => {
    // First call fails
    mockStore.executeSQL.mockRejectedValueOnce(new Error('Connection lost'));
    // Second call succeeds
    mockStore.executeSQL.mockResolvedValueOnce([{ result: 500 }]);

    const { result } = renderHook(() => useDuckDBView());

    // First attempt fails
    await act(async () => {
      const evalResult = await result.current.evaluateFormula('=price * quantity', 1, 'total');
      expect(evalResult.success).toBe(false);
    });

    // Second attempt succeeds
    await act(async () => {
      const evalResult = await result.current.evaluateFormula('=price * quantity', 1, 'total');
      expect(evalResult.success).toBe(true);
    });
  });

  it('should handle division by zero gracefully', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: Infinity }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula('=price / 0', 1, 'result');
      expect(evalResult.success).toBe(true);
      if (evalResult.success) {
        expect(evalResult.value).toBe(Infinity);
      }
    });
  });

  it('should handle null result from calculation', async () => {
    mockStore.executeSQL.mockResolvedValue([{ result: null }]);

    const { result } = renderHook(() => useDuckDBView());

    await act(async () => {
      const evalResult = await result.current.evaluateFormula('=discount', 1, 'result');
      expect(evalResult.success).toBe(true);
      if (evalResult.success) {
        expect(evalResult.value).toBeNull();
      }
    });
  });
});
