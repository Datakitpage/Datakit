import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAICommandExecution, type DuckDBViewActions, type ExecutionResult } from './useAICommandExecution';
import type { AICommand } from '@/lib/ai/parseAICommand';
import type { QueryParams } from '@/store/duckDBViewStore';

// ============================================================================
// Mocks
// ============================================================================

const createMockActions = (): DuckDBViewActions => ({
  setSort: vi.fn(),
  setSearch: vi.fn(),
  addFilter: vi.fn(),
  clearFilters: vi.fn(),
  exportData: vi.fn().mockResolvedValue(true),
  editCell: vi.fn(),
  deleteRow: vi.fn(),
});

const createMockQueryParams = (): QueryParams => ({
  page: 0,
  pageSize: 50,
});

// ============================================================================
// Test Commands
// ============================================================================

const sortCommand: AICommand = {
  type: 'sort',
  naturalLanguage: 'sort by name desc',
  parsed: {
    action: 'sort',
    column: 'name',
    direction: 'DESC',
  },
};

const filterCommand: AICommand = {
  type: 'filter',
  naturalLanguage: 'filter age > 25',
  parsed: {
    action: 'filter',
    column: 'age',
    operator: '>',
    value: '25',
  },
};

const searchCommand: AICommand = {
  type: 'search',
  naturalLanguage: 'search john',
  parsed: {
    action: 'search',
    value: 'john',
  },
};

const exportCommand: AICommand = {
  type: 'export',
  naturalLanguage: 'export as csv',
  parsed: {
    action: 'export',
    value: 'csv',
  },
};

const updateCommand: AICommand = {
  type: 'update',
  naturalLanguage: "update status to 'active'",
  parsed: {
    action: 'update',
    column: 'status',
    newValue: 'active',
    targetRows: 'all',
  },
  isWriteOperation: true,
};

const deleteCommand: AICommand = {
  type: 'delete',
  naturalLanguage: 'delete where id = 5',
  parsed: {
    action: 'delete',
    targetRows: 'filtered',
    condition: {
      column: 'id',
      operator: '=',
      value: '5',
    },
  },
  isWriteOperation: true,
};

// ============================================================================
// Tests: Basic Execution
// ============================================================================

describe('useAICommandExecution', () => {
  let mockActions: DuckDBViewActions;
  let mockQueryParams: QueryParams;

  beforeEach(() => {
    mockActions = createMockActions();
    mockQueryParams = createMockQueryParams();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes with idle status', () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.lastResult).toBeNull();
      expect(result.current.history).toEqual([]);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('READ operations', () => {
    it('executes sort command', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(sortCommand);
      });

      expect(mockActions.setSort).toHaveBeenCalledWith('name', 'DESC');
      expect(execResult?.success).toBe(true);
      expect(execResult?.command).toBe(sortCommand);
      expect(execResult?.message).toContain('Sorted by name');
    });

    it('executes filter command', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(filterCommand);
      });

      expect(mockActions.addFilter).toHaveBeenCalledWith({
        column: 'age',
        operator: '>',
        value: '25',
      });
      expect(execResult?.success).toBe(true);
    });

    it('executes search command', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(searchCommand);
      });

      expect(mockActions.setSearch).toHaveBeenCalledWith('john');
      expect(execResult?.success).toBe(true);
      expect(execResult?.message).toContain('Searching for');
    });

    it('executes export command', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(exportCommand);
      });

      expect(mockActions.exportData).toHaveBeenCalledWith('csv');
      expect(execResult?.success).toBe(true);
      expect(execResult?.message).toContain('Exported as csv');
    });

    it('handles export failure', async () => {
      mockActions.exportData = vi.fn().mockResolvedValue(false);

      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(exportCommand);
      });

      expect(execResult?.success).toBe(false);
      expect(execResult?.error).toContain('Export failed');
    });
  });

  describe('status management', () => {
    it('updates status during execution', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      expect(result.current.status).toBe('idle');

      // Start execution (don't await)
      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.execute(sortCommand);
      });

      // During execution, status should be 'executing'
      // Note: This is hard to test with renderHook, so we verify final state

      await act(async () => {
        await promise;
      });

      expect(result.current.status).toBe('success');
    });

    it('sets error status on failure', async () => {
      // Create a command that will fail
      const badCommand: AICommand = {
        type: 'sort',
        naturalLanguage: 'sort',
        parsed: {
          action: 'sort',
          // Missing column - will fail
        },
      };

      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      await act(async () => {
        await result.current.execute(badCommand);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.lastResult?.error).toContain('requires a column');
    });
  });

  describe('command history', () => {
    it('adds READ commands to history', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      await act(async () => {
        await result.current.execute(sortCommand);
      });

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].command).toBe(sortCommand);
      expect(result.current.canUndo).toBe(true);
    });

    it('does not add export commands to history', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      await act(async () => {
        await result.current.execute(exportCommand);
      });

      expect(result.current.history).toHaveLength(0);
      expect(result.current.canUndo).toBe(false);
    });

    it('maintains history order (newest first)', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      await act(async () => {
        await result.current.execute(sortCommand);
        await result.current.execute(filterCommand);
        await result.current.execute(searchCommand);
      });

      expect(result.current.history).toHaveLength(3);
      expect(result.current.history[0].command.type).toBe('search');
      expect(result.current.history[1].command.type).toBe('filter');
      expect(result.current.history[2].command.type).toBe('sort');
    });

    it('respects maxHistorySize option', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams, { maxHistorySize: 2 })
      );

      await act(async () => {
        await result.current.execute(sortCommand);
        await result.current.execute(filterCommand);
        await result.current.execute(searchCommand);
      });

      expect(result.current.history).toHaveLength(2);
      // Oldest entry (sort) should be dropped
      expect(result.current.history.map(h => h.command.type)).toEqual(['search', 'filter']);
    });
  });

  describe('undo functionality', () => {
    it('undoes last READ command', async () => {
      const initialQueryParams: QueryParams = {
        page: 0,
        pageSize: 50,
        sortColumn: 'id',
        sortDirection: 'ASC',
      };

      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, initialQueryParams)
      );

      await act(async () => {
        await result.current.execute(sortCommand);
      });

      expect(result.current.history).toHaveLength(1);

      let undoneCommand;
      act(() => {
        undoneCommand = result.current.undoLastRead();
      });

      expect(undoneCommand).toBe(sortCommand);
      expect(result.current.history).toHaveLength(0);
      expect(result.current.canUndo).toBe(false);

      // Should restore previous sort state
      expect(mockActions.setSort).toHaveBeenLastCalledWith('id', 'ASC');
    });

    it('returns null when no history', () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let undoneCommand;
      act(() => {
        undoneCommand = result.current.undoLastRead();
      });

      expect(undoneCommand).toBeNull();
    });

    it('clears history', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      await act(async () => {
        await result.current.execute(sortCommand);
        await result.current.execute(filterCommand);
      });

      expect(result.current.history).toHaveLength(2);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.history).toHaveLength(0);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('WRITE operations', () => {
    const mockData = [
      { _rowid: 1, id: '1', name: 'Alice', status: 'pending' },
      { _rowid: 2, id: '5', name: 'Bob', status: 'pending' },
      { _rowid: 3, id: '10', name: 'Charlie', status: 'active' },
    ];

    it('executes update command on all rows', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(updateCommand, mockData);
      });

      expect(mockActions.editCell).toHaveBeenCalledTimes(3);
      expect(execResult?.success).toBe(true);
      expect(execResult?.affectedRows).toBe(3);
    });

    it('executes delete command with condition', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(deleteCommand, mockData);
      });

      // Only row with id='5' should match
      expect(mockActions.deleteRow).toHaveBeenCalledTimes(1);
      expect(mockActions.deleteRow).toHaveBeenCalledWith(2); // _rowid of Bob
      expect(execResult?.success).toBe(true);
      expect(execResult?.affectedRows).toBe(1);
    });

    it('requires data array for write operations', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(updateCommand); // No data
      });

      expect(execResult?.success).toBe(false);
      expect(execResult?.error).toContain('require data array');
    });

    it('calls onWriteOperation callback', async () => {
      const onWriteOperation = vi.fn().mockResolvedValue(true);

      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams, { onWriteOperation })
      );

      await act(async () => {
        await result.current.execute(updateCommand, mockData);
      });

      expect(onWriteOperation).toHaveBeenCalledWith(updateCommand);
    });

    it('cancels write operation when callback returns false', async () => {
      const onWriteOperation = vi.fn().mockResolvedValue(false);

      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams, { onWriteOperation })
      );

      let execResult: ExecutionResult | undefined;
      await act(async () => {
        execResult = await result.current.execute(updateCommand, mockData);
      });

      expect(execResult?.success).toBe(false);
      expect(execResult?.message).toContain('cancelled');
      expect(mockActions.editCell).not.toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('calls onExecute callback after execution', async () => {
      const onExecute = vi.fn();

      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams, { onExecute })
      );

      await act(async () => {
        await result.current.execute(sortCommand);
      });

      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          command: sortCommand,
        })
      );
    });

    it('calls onToggleTheme for theme commands', async () => {
      const onToggleTheme = vi.fn();

      const themeCommand: AICommand = {
        type: 'theme',
        naturalLanguage: 'toggle theme',
        parsed: { action: 'toggle' },
      };

      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams, { onToggleTheme })
      );

      await act(async () => {
        await result.current.execute(themeCommand);
      });

      expect(onToggleTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('isWriteOperation utility', () => {
    it('correctly identifies write operations', () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      expect(result.current.isWriteOperation(sortCommand)).toBe(false);
      expect(result.current.isWriteOperation(filterCommand)).toBe(false);
      expect(result.current.isWriteOperation(searchCommand)).toBe(false);
      expect(result.current.isWriteOperation(exportCommand)).toBe(false);
      expect(result.current.isWriteOperation(updateCommand)).toBe(true);
      expect(result.current.isWriteOperation(deleteCommand)).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets status and lastResult', async () => {
      const { result } = renderHook(() =>
        useAICommandExecution(mockActions, mockQueryParams)
      );

      await act(async () => {
        await result.current.execute(sortCommand);
      });

      expect(result.current.lastResult).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.lastResult).toBeNull();
    });
  });
});

// ============================================================================
// Tests: Matching Rows (Integration)
// ============================================================================

describe('findMatchingRows behavior', () => {
  let mockActions: DuckDBViewActions;

  beforeEach(() => {
    mockActions = createMockActions();
  });

  const testData = [
    { _rowid: 1, name: 'Alice', age: 30, email: 'alice@gmail.com' },
    { _rowid: 2, name: 'Bob', age: 25, email: 'bob@yahoo.com' },
    { _rowid: 3, name: 'Charlie', age: 35, email: null },
    { _rowid: 4, name: 'Diana', age: 28, email: 'diana@gmail.com' },
  ];

  it('matches equality condition', async () => {
    const updateAgeCommand: AICommand = {
      type: 'update',
      naturalLanguage: "update name to 'Updated' where age = 30",
      parsed: {
        action: 'update',
        column: 'name',
        newValue: 'Updated',
        targetRows: 'filtered',
        condition: { column: 'age', operator: '=', value: '30' },
      },
      isWriteOperation: true,
    };

    const { result } = renderHook(() =>
      useAICommandExecution(mockActions, createMockQueryParams())
    );

    await act(async () => {
      await result.current.execute(updateAgeCommand, testData);
    });

    expect(mockActions.editCell).toHaveBeenCalledTimes(1);
    expect(mockActions.editCell).toHaveBeenCalledWith(1, 'name', 'Updated');
  });

  it('matches greater than condition', async () => {
    const deleteOldCommand: AICommand = {
      type: 'delete',
      naturalLanguage: 'delete where age > 28',
      parsed: {
        action: 'delete',
        targetRows: 'filtered',
        condition: { column: 'age', operator: '>', value: '28' },
      },
      isWriteOperation: true,
    };

    const { result } = renderHook(() =>
      useAICommandExecution(mockActions, createMockQueryParams())
    );

    await act(async () => {
      await result.current.execute(deleteOldCommand, testData);
    });

    // Should match Alice (30) and Charlie (35)
    expect(mockActions.deleteRow).toHaveBeenCalledTimes(2);
  });

  it('matches IS NULL condition', async () => {
    const fillNullCommand: AICommand = {
      type: 'fill',
      naturalLanguage: "fill empty email with 'no-email@example.com'",
      parsed: {
        action: 'fill',
        column: 'email',
        newValue: 'no-email@example.com',
        targetRows: 'filtered',
        condition: { column: 'email', operator: 'IS NULL', value: null },
      },
      isWriteOperation: true,
    };

    const { result } = renderHook(() =>
      useAICommandExecution(mockActions, createMockQueryParams())
    );

    await act(async () => {
      await result.current.execute(fillNullCommand, testData);
    });

    // Should match Charlie (null email)
    expect(mockActions.editCell).toHaveBeenCalledTimes(1);
    expect(mockActions.editCell).toHaveBeenCalledWith(3, 'email', 'no-email@example.com');
  });

  it('matches LIKE condition', async () => {
    const updateGmailCommand: AICommand = {
      type: 'update',
      naturalLanguage: "update name to 'Gmail User' where email contains gmail",
      parsed: {
        action: 'update',
        column: 'name',
        newValue: 'Gmail User',
        targetRows: 'filtered',
        condition: { column: 'email', operator: 'LIKE', value: '%gmail%' },
      },
      isWriteOperation: true,
    };

    const { result } = renderHook(() =>
      useAICommandExecution(mockActions, createMockQueryParams())
    );

    await act(async () => {
      await result.current.execute(updateGmailCommand, testData);
    });

    // Should match Alice and Diana
    expect(mockActions.editCell).toHaveBeenCalledTimes(2);
  });
});
