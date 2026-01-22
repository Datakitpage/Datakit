/**
 * Command History Hook
 *
 * A simple, generic hook for tracking command history with undo capability.
 * Can be used for any type of command tracking.
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface HistoryEntry<T, S = unknown> {
  /** The command that was executed */
  command: T;
  /** State before the command was executed (for undo) */
  previousState: S;
  /** When the command was executed */
  timestamp: number;
  /** Optional label for display */
  label?: string;
}

export interface UseCommandHistoryOptions<T, S> {
  /** Maximum number of entries to keep */
  maxSize?: number;
  /** Generate a label for an entry */
  getLabel?: (command: T) => string;
  /** Called when an entry is added */
  onAdd?: (entry: HistoryEntry<T, S>) => void;
  /** Called when an entry is undone */
  onUndo?: (entry: HistoryEntry<T, S>) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useCommandHistory<T, S = unknown>(
  options: UseCommandHistoryOptions<T, S> = {}
) {
  const { maxSize = 50, getLabel, onAdd, onUndo } = options;

  const [entries, setEntries] = useState<HistoryEntry<T, S>[]>([]);

  /**
   * Add a new entry to history
   */
  const add = useCallback((command: T, previousState: S) => {
    const entry: HistoryEntry<T, S> = {
      command,
      previousState,
      timestamp: Date.now(),
      label: getLabel?.(command),
    };

    setEntries(prev => [entry, ...prev].slice(0, maxSize));
    onAdd?.(entry);

    return entry;
  }, [maxSize, getLabel, onAdd]);

  /**
   * Pop and return the most recent entry
   */
  const pop = useCallback((): HistoryEntry<T, S> | null => {
    if (entries.length === 0) return null;

    const [first, ...rest] = entries;
    setEntries(rest);
    onUndo?.(first);

    return first;
  }, [entries, onUndo]);

  /**
   * Peek at the most recent entry without removing it
   */
  const peek = useCallback((): HistoryEntry<T, S> | null => {
    return entries[0] || null;
  }, [entries]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  /**
   * Get entries of a specific type (using predicate)
   */
  const filter = useCallback((predicate: (entry: HistoryEntry<T, S>) => boolean) => {
    return entries.filter(predicate);
  }, [entries]);

  /**
   * Get recent entries (up to n)
   */
  const recent = useCallback((n: number = 5) => {
    return entries.slice(0, n);
  }, [entries]);

  // Computed values
  const canUndo = entries.length > 0;
  const size = entries.length;
  const isEmpty = entries.length === 0;

  // Summary of recent commands for display
  const summary = useMemo(() => {
    return entries.slice(0, 3).map(e => e.label || 'Command').join(', ');
  }, [entries]);

  return {
    // State
    entries,
    canUndo,
    size,
    isEmpty,
    summary,

    // Actions
    add,
    pop,
    peek,
    clear,
    filter,
    recent,
  };
}

// ============================================================================
// Specialized Hook for AI Commands
// ============================================================================

import type { AICommand } from '@/lib/ai/parseAICommand';
import type { QueryParams } from '@/store/duckDBViewStore';

/**
 * Get a human-readable label for an AI command
 */
function getAICommandLabel(command: AICommand): string {
  switch (command.type) {
    case 'sort':
      return `Sort by ${command.parsed.column} ${command.parsed.direction?.toLowerCase() || ''}`.trim();
    case 'filter':
      return `Filter ${command.parsed.column}`;
    case 'search':
      return `Search "${command.parsed.value}"`;
    case 'export':
      return `Export ${command.parsed.value}`;
    case 'update':
    case 'fill':
      return `Update ${command.parsed.column}`;
    case 'delete':
      return 'Delete rows';
    case 'theme':
      return 'Toggle theme';
    default:
      return command.naturalLanguage;
  }
}

/**
 * Specialized hook for AI command history
 */
export function useAICommandHistory(options: Omit<UseCommandHistoryOptions<AICommand, QueryParams>, 'getLabel'> = {}) {
  return useCommandHistory<AICommand, QueryParams>({
    ...options,
    getLabel: getAICommandLabel,
  });
}

// ============================================================================
// Exports
// ============================================================================

export default useCommandHistory;
