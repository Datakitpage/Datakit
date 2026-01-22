/**
 * View State History Hook
 *
 * Tracks view state changes (sort, filter, page, search, limit) with undo/redo support.
 * Provides a consistent way to navigate through view state history.
 */

import { useState, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface QueryResultState {
  sql: string;
  schema: { name: string; type: string }[];
  rowCount: number;
}

export interface ViewState {
  sortColumn: string | null;
  sortDirection: 'ASC' | 'DESC' | null;
  search: string;
  page: number;
  pageSize: number;
  filters: FilterState[];
  timestamp: number;
  // Custom SQL query result (when set, table shows query results instead of base data)
  queryResult?: QueryResultState | null;
}

export interface FilterState {
  column: string;
  operator: string;
  value: unknown;
}

export interface ViewStateChange {
  type: 'sort' | 'filter' | 'search' | 'page' | 'limit' | 'reset' | 'query';
  description: string;
  previousState: ViewState;
  newState: ViewState;
}

export interface UseViewStateHistoryOptions {
  maxHistorySize?: number;
  onStateChange?: (change: ViewStateChange) => void;
}

export interface UseViewStateHistoryReturn {
  // Current state
  currentState: ViewState;

  // History info
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;

  // Actions
  pushState: (newState: Partial<ViewState>, changeType: ViewStateChange['type'], description: string) => void;
  undo: () => ViewState | null;
  redo: () => ViewState | null;
  reset: () => void;

  // Get change description for UI
  getUndoDescription: () => string | null;
  getRedoDescription: () => string | null;
}

// ============================================================================
// Default State
// ============================================================================

const createDefaultState = (): ViewState => ({
  sortColumn: null,
  sortDirection: null,
  search: '',
  page: 0,
  pageSize: 50,
  filters: [],
  timestamp: Date.now(),
});

// ============================================================================
// Hook Implementation
// ============================================================================

export function useViewStateHistory(
  options: UseViewStateHistoryOptions = {}
): UseViewStateHistoryReturn {
  const { maxHistorySize = 50, onStateChange } = options;

  // History stack and current position
  const [history, setHistory] = useState<ViewState[]>([createDefaultState()]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Store change descriptions separately (parallel array)
  const changeDescriptions = useRef<Map<number, { type: ViewStateChange['type']; description: string }>>(new Map());

  // Current state is always at currentIndex
  const currentState = history[currentIndex];

  // Can undo if we're not at the beginning
  const canUndo = currentIndex > 0;

  // Can redo if we're not at the end
  const canRedo = currentIndex < history.length - 1;

  // Push a new state to history
  const pushState = useCallback((
    newStatePartial: Partial<ViewState>,
    changeType: ViewStateChange['type'],
    description: string
  ) => {
    setHistory(prev => {
      // Get current state
      const current = prev[currentIndex];

      // Create new state by merging with current
      const newState: ViewState = {
        ...current,
        ...newStatePartial,
        timestamp: Date.now(),
      };

      // If we're in the middle of history, truncate everything after current
      const truncated = prev.slice(0, currentIndex + 1);

      // Add new state
      const updated = [...truncated, newState];

      // Trim if exceeds max size
      if (updated.length > maxHistorySize) {
        const trimmed = updated.slice(updated.length - maxHistorySize);
        // Adjust change descriptions map
        const offset = updated.length - maxHistorySize;
        const newDescriptions = new Map<number, { type: ViewStateChange['type']; description: string }>();
        changeDescriptions.current.forEach((value, key) => {
          if (key >= offset) {
            newDescriptions.set(key - offset, value);
          }
        });
        changeDescriptions.current = newDescriptions;
        return trimmed;
      }

      return updated;
    });

    // Update current index to point to new state
    setCurrentIndex(prev => {
      const newIndex = Math.min(prev + 1, maxHistorySize - 1);

      // Store the change description
      changeDescriptions.current.set(newIndex, { type: changeType, description });

      // Notify callback
      if (onStateChange) {
        const current = history[currentIndex];
        const newState: ViewState = {
          ...current,
          ...newStatePartial,
          timestamp: Date.now(),
        };
        onStateChange({
          type: changeType,
          description,
          previousState: current,
          newState,
        });
      }

      return newIndex;
    });
  }, [currentIndex, history, maxHistorySize, onStateChange]);

  // Undo - go back one state
  const undo = useCallback((): ViewState | null => {
    if (!canUndo) return null;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [canUndo, currentIndex, history]);

  // Redo - go forward one state
  const redo = useCallback((): ViewState | null => {
    if (!canRedo) return null;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [canRedo, currentIndex, history]);

  // Reset - clear history and start fresh
  const reset = useCallback(() => {
    setHistory([createDefaultState()]);
    setCurrentIndex(0);
    changeDescriptions.current.clear();
  }, []);

  // Get description of what undo will do
  const getUndoDescription = useCallback((): string | null => {
    if (!canUndo) return null;
    const change = changeDescriptions.current.get(currentIndex);
    return change ? `Undo: ${change.description}` : 'Undo';
  }, [canUndo, currentIndex]);

  // Get description of what redo will do
  const getRedoDescription = useCallback((): string | null => {
    if (!canRedo) return null;
    const change = changeDescriptions.current.get(currentIndex + 1);
    return change ? `Redo: ${change.description}` : 'Redo';
  }, [canRedo, currentIndex]);

  return {
    currentState,
    canUndo,
    canRedo,
    historyLength: history.length,
    currentIndex,
    pushState,
    undo,
    redo,
    reset,
    getUndoDescription,
    getRedoDescription,
  };
}

// ============================================================================
// Helper to generate change descriptions
// ============================================================================

export function generateChangeDescription(
  type: ViewStateChange['type'],
  details?: { column?: string; direction?: string; value?: unknown; page?: number; limit?: number; sql?: string; rowCount?: number }
): string {
  switch (type) {
    case 'sort':
      if (details?.column) {
        return `Sort by ${details.column}${details.direction ? ` ${details.direction.toLowerCase()}` : ''}`;
      }
      return 'Clear sort';
    case 'filter':
      if (details?.column && details?.value !== undefined) {
        return `Filter ${details.column}`;
      }
      return 'Clear filter';
    case 'search':
      if (details?.value) {
        return `Search "${details.value}"`;
      }
      return 'Clear search';
    case 'page':
      return `Go to page ${(details?.page ?? 0) + 1}`;
    case 'limit':
      return `Show ${details?.limit} rows`;
    case 'reset':
      return 'Reset view';
    case 'query':
      if (details?.rowCount !== undefined) {
        return `Query result (${details.rowCount} rows)`;
      }
      return 'Custom query';
    default:
      return 'View changed';
  }
}

export default useViewStateHistory;
