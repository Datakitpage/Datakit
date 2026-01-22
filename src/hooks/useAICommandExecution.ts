/**
 * AI Command Execution Hook
 *
 * Handles the execution of parsed AI commands against the DuckDB view.
 * Provides execution state, feedback, and history for READ operations.
 */

import { useState, useCallback, useRef } from 'react';
import type { AICommand } from '@/lib/ai/parseAICommand';
import { isWriteOperation } from '@/lib/ai/parseAICommand';
import type { QueryParams, FilterCondition } from '@/store/duckDBViewStore';

// ============================================================================
// Types
// ============================================================================

export type ExecutionStatus = 'idle' | 'executing' | 'success' | 'error';

export interface ExecutionResult {
  success: boolean;
  command: AICommand;
  timestamp: number;
  duration: number;
  affectedRows?: number;
  message?: string;
  error?: string;
}

export interface CommandHistoryEntry {
  command: AICommand;
  previousState: QueryParams;
  timestamp: number;
}

export interface DuckDBViewActions {
  setSort: (column: string | null, direction?: 'ASC' | 'DESC') => void;
  setSearch: (search: string, columns?: string[]) => void;
  addFilter: (filter: FilterCondition) => void;
  clearFilters: () => void;
  exportData: (format: 'csv' | 'json' | 'parquet', fileName?: string) => Promise<boolean>;
  editCell: (rowId: number, column: string, newValue: unknown) => void;
  deleteRow: (rowId: number) => void;
  executeSQL?: (sql: string) => Promise<unknown[] | null>;
}

export interface UseAICommandExecutionOptions {
  /** Maximum entries in command history */
  maxHistorySize?: number;
  /** Callback when a command is executed */
  onExecute?: (result: ExecutionResult) => void;
  /** Callback when a write operation is about to execute (return false to cancel) */
  onWriteOperation?: (command: AICommand) => boolean | Promise<boolean>;
  /** Toggle theme callback */
  onToggleTheme?: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useAICommandExecution(
  actions: DuckDBViewActions,
  queryParams: QueryParams,
  options: UseAICommandExecutionOptions = {}
) {
  const {
    maxHistorySize = 50,
    onExecute,
    onWriteOperation,
    onToggleTheme,
  } = options;

  // State
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);

  // Refs for current state access in callbacks
  const queryParamsRef = useRef(queryParams);
  queryParamsRef.current = queryParams;

  /**
   * Execute a READ command (sort, filter, search, export, theme)
   */
  const executeReadCommand = useCallback(async (command: AICommand): Promise<ExecutionResult> => {
    const startTime = performance.now();
    const previousState = { ...queryParamsRef.current };

    try {
      switch (command.type) {
        case 'sort': {
          const { column, direction } = command.parsed;
          if (!column) throw new Error('Sort command requires a column');
          actions.setSort(column, direction);
          break;
        }

        case 'filter': {
          const { column, operator, value } = command.parsed;
          if (!column || !operator) throw new Error('Filter command requires column and operator');
          actions.addFilter({
            column,
            operator: operator as FilterCondition['operator'],
            value: value as string | number,
          });
          break;
        }

        case 'search': {
          const { value } = command.parsed;
          if (!value) throw new Error('Search command requires a search term');
          // Strip LIKE wildcards for search
          const searchTerm = String(value).replace(/%/g, '');
          actions.setSearch(searchTerm);
          break;
        }

        case 'export': {
          const format = command.parsed.value as 'csv' | 'json' | 'parquet';
          if (!format) throw new Error('Export command requires a format');
          const success = await actions.exportData(format);
          if (!success) throw new Error('Export failed');
          break;
        }

        case 'theme': {
          if (onToggleTheme) {
            onToggleTheme();
          }
          break;
        }

        default:
          throw new Error(`Unknown command type: ${command.type}`);
      }

      const duration = performance.now() - startTime;
      const result: ExecutionResult = {
        success: true,
        command,
        timestamp: Date.now(),
        duration,
        message: getSuccessMessage(command),
      };

      // Add to history (only for commands that change query state)
      if (['sort', 'filter', 'search'].includes(command.type)) {
        setHistory(prev => {
          const newHistory = [{ command, previousState, timestamp: Date.now() }, ...prev];
          return newHistory.slice(0, maxHistorySize);
        });
      }

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        command,
        timestamp: Date.now(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [actions, onToggleTheme, maxHistorySize]);

  /**
   * Execute a WRITE command (update, fill, delete)
   */
  const executeWriteCommand = useCallback(async (
    command: AICommand,
    data: Record<string, unknown>[]
  ): Promise<ExecutionResult> => {
    const startTime = performance.now();

    try {
      // Check with callback before proceeding
      if (onWriteOperation) {
        const proceed = await onWriteOperation(command);
        if (!proceed) {
          return {
            success: false,
            command,
            timestamp: Date.now(),
            duration: 0,
            message: 'Operation cancelled by user',
          };
        }
      }

      let affectedRows = 0;

      switch (command.type) {
        case 'fill':
        case 'update': {
          const { column, newValue, condition, targetRows } = command.parsed;
          if (!column) throw new Error('Update command requires a column');

          // Find matching rows
          const matchingRows = findMatchingRows(data, condition, targetRows);
          affectedRows = matchingRows.length;

          // Apply updates
          for (const row of matchingRows) {
            const rowId = row._rowid as number;
            actions.editCell(rowId, column, newValue);
          }
          break;
        }

        case 'delete': {
          const { condition, targetRows } = command.parsed;
          if (!condition) throw new Error('Delete command requires a condition');

          // Find matching rows
          const matchingRows = findMatchingRows(data, condition, targetRows);
          affectedRows = matchingRows.length;

          // Delete rows
          for (const row of matchingRows) {
            const rowId = row._rowid as number;
            actions.deleteRow(rowId);
          }
          break;
        }

        default:
          throw new Error(`Unknown write command type: ${command.type}`);
      }

      const duration = performance.now() - startTime;
      return {
        success: true,
        command,
        timestamp: Date.now(),
        duration,
        affectedRows,
        message: `${command.type === 'delete' ? 'Deleted' : 'Updated'} ${affectedRows} row${affectedRows !== 1 ? 's' : ''}`,
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        command,
        timestamp: Date.now(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [actions, onWriteOperation]);

  /**
   * Main execute function - routes to read or write executor
   */
  const execute = useCallback(async (
    command: AICommand,
    data?: Record<string, unknown>[]
  ): Promise<ExecutionResult> => {
    setStatus('executing');

    let result: ExecutionResult;

    if (isWriteOperation(command)) {
      if (!data) {
        result = {
          success: false,
          command,
          timestamp: Date.now(),
          duration: 0,
          error: 'Write operations require data array',
        };
      } else {
        result = await executeWriteCommand(command, data);
      }
    } else {
      result = await executeReadCommand(command);
    }

    setStatus(result.success ? 'success' : 'error');
    setLastResult(result);
    onExecute?.(result);

    // Reset status after a delay
    setTimeout(() => setStatus('idle'), 2000);

    return result;
  }, [executeReadCommand, executeWriteCommand, onExecute]);

  /**
   * Undo last READ command by restoring previous query state
   */
  const undoLastRead = useCallback(() => {
    if (history.length === 0) return null;

    const [lastEntry, ...remainingHistory] = history;
    const { previousState, command } = lastEntry;

    // Restore previous state
    if (previousState.sortColumn !== undefined) {
      actions.setSort(previousState.sortColumn || null, previousState.sortDirection);
    } else {
      actions.setSort(null);
    }

    if (previousState.search !== undefined) {
      actions.setSearch(previousState.search || '');
    }

    // Clear filters and re-add previous ones
    actions.clearFilters();
    if (previousState.filters) {
      previousState.filters.forEach(filter => actions.addFilter(filter));
    }

    setHistory(remainingHistory);

    return command;
  }, [history, actions]);

  /**
   * Clear command history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setLastResult(null);
  }, []);

  return {
    // State
    status,
    lastResult,
    history,
    canUndo: history.length > 0,

    // Actions
    execute,
    undoLastRead,
    clearHistory,
    reset,

    // Utilities
    isWriteOperation: (cmd: AICommand) => isWriteOperation(cmd),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find rows matching a condition
 */
function findMatchingRows(
  data: Record<string, unknown>[],
  condition: { column: string; operator: string; value: unknown } | undefined,
  targetRows: 'all' | 'filtered' | 'selected' | undefined
): Record<string, unknown>[] {
  // If no condition and targeting all, return all rows
  if (!condition && targetRows === 'all') {
    return data;
  }

  if (!condition) {
    return [];
  }

  const { column, operator, value } = condition;

  return data.filter(row => {
    const cellValue = row[column];

    switch (operator) {
      case '=':
        return String(cellValue) === String(value);
      case '!=':
        return String(cellValue) !== String(value);
      case '>':
        return Number(cellValue) > Number(value);
      case '<':
        return Number(cellValue) < Number(value);
      case '>=':
        return Number(cellValue) >= Number(value);
      case '<=':
        return Number(cellValue) <= Number(value);
      case 'LIKE': {
        // Simple LIKE with wildcards
        const pattern = String(value)
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(String(cellValue));
      }
      case 'IS NULL':
        return cellValue === null || cellValue === undefined || cellValue === '';
      case 'IS NOT NULL':
        return cellValue !== null && cellValue !== undefined && cellValue !== '';
      default:
        return false;
    }
  });
}

/**
 * Generate a user-friendly success message for a command
 */
function getSuccessMessage(command: AICommand): string {
  switch (command.type) {
    case 'sort':
      return `Sorted by ${command.parsed.column} ${command.parsed.direction?.toLowerCase() || 'ascending'}`;
    case 'filter':
      return `Filtered ${command.parsed.column} ${command.parsed.operator} ${command.parsed.value}`;
    case 'search':
      return `Searching for "${command.parsed.value}"`;
    case 'export':
      return `Exported as ${command.parsed.value}`;
    case 'theme':
      return 'Toggled theme';
    default:
      return 'Command executed';
  }
}

// ============================================================================
// Exports
// ============================================================================

export default useAICommandExecution;
