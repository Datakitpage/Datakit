import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandHistory, useAICommandHistory, type HistoryEntry } from './useCommandHistory';
import type { AICommand } from '@/lib/ai/parseAICommand';
import type { QueryParams } from '@/store/duckDBViewStore';

// Helper to create default QueryParams
const defaultQueryParams: QueryParams = { page: 0, pageSize: 50 };

describe('useCommandHistory', () => {
  describe('basic operations', () => {
    it('should initialize with empty history', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      expect(result.current.entries).toEqual([]);
      expect(result.current.size).toBe(0);
      expect(result.current.isEmpty).toBe(true);
      expect(result.current.canUndo).toBe(false);
    });

    it('should add entries to history', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      act(() => {
        result.current.add('command1', { previous: 'state1' });
      });

      expect(result.current.size).toBe(1);
      expect(result.current.isEmpty).toBe(false);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.entries[0].command).toBe('command1');
    });

    it('should add entries in reverse chronological order (newest first)', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      act(() => {
        result.current.add('command1', 'state1');
        result.current.add('command2', 'state2');
        result.current.add('command3', 'state3');
      });

      expect(result.current.entries[0].command).toBe('command3');
      expect(result.current.entries[1].command).toBe('command2');
      expect(result.current.entries[2].command).toBe('command1');
    });

    it('should pop most recent entry', () => {
      const { result } = renderHook(() => useCommandHistory<string, string>());

      act(() => {
        result.current.add('command1', 'state1');
        result.current.add('command2', 'state2');
      });

      // Track the popped entry in a container that TypeScript can reason about
      const popped: { entry: HistoryEntry<string, string> | null } = { entry: null };
      act(() => {
        popped.entry = result.current.pop();
      });

      expect(popped.entry?.command).toBe('command2');
      expect(result.current.size).toBe(1);
      expect(result.current.entries[0].command).toBe('command1');
    });

    it('should return null when popping from empty history', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      let poppedEntry: HistoryEntry<string, unknown> | null = null;
      act(() => {
        poppedEntry = result.current.pop();
      });

      expect(poppedEntry).toBeNull();
    });

    it('should peek at most recent entry without removing', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      act(() => {
        result.current.add('command1', 'state1');
        result.current.add('command2', 'state2');
      });

      const peekedEntry = result.current.peek();

      expect(peekedEntry?.command).toBe('command2');
      expect(result.current.size).toBe(2); // Size unchanged
    });

    it('should return null when peeking at empty history', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      const peekedEntry = result.current.peek();

      expect(peekedEntry).toBeNull();
    });

    it('should clear all history', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      act(() => {
        result.current.add('command1', 'state1');
        result.current.add('command2', 'state2');
        result.current.add('command3', 'state3');
      });

      expect(result.current.size).toBe(3);

      act(() => {
        result.current.clear();
      });

      expect(result.current.size).toBe(0);
      expect(result.current.isEmpty).toBe(true);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('maxSize option', () => {
    it('should respect maxSize limit', () => {
      const { result } = renderHook(() => useCommandHistory<string>({ maxSize: 3 }));

      act(() => {
        result.current.add('command1', 'state1');
        result.current.add('command2', 'state2');
        result.current.add('command3', 'state3');
        result.current.add('command4', 'state4');
        result.current.add('command5', 'state5');
      });

      expect(result.current.size).toBe(3);
      // Should have newest 3 commands
      expect(result.current.entries[0].command).toBe('command5');
      expect(result.current.entries[1].command).toBe('command4');
      expect(result.current.entries[2].command).toBe('command3');
    });

    it('should use default maxSize of 50', () => {
      const { result } = renderHook(() => useCommandHistory<number>());

      act(() => {
        for (let i = 0; i < 60; i++) {
          result.current.add(i, i);
        }
      });

      expect(result.current.size).toBe(50);
    });
  });

  describe('filter and recent', () => {
    it('should filter entries by predicate', () => {
      const { result } = renderHook(() =>
        useCommandHistory<{ type: string; value: number }>()
      );

      act(() => {
        result.current.add({ type: 'add', value: 1 }, null);
        result.current.add({ type: 'remove', value: 2 }, null);
        result.current.add({ type: 'add', value: 3 }, null);
        result.current.add({ type: 'update', value: 4 }, null);
      });

      const addEntries = result.current.filter(e => e.command.type === 'add');

      expect(addEntries.length).toBe(2);
      expect(addEntries[0].command.value).toBe(3);
      expect(addEntries[1].command.value).toBe(1);
    });

    it('should return recent entries', () => {
      const { result } = renderHook(() => useCommandHistory<string>());

      act(() => {
        result.current.add('command1', 'state1');
        result.current.add('command2', 'state2');
        result.current.add('command3', 'state3');
        result.current.add('command4', 'state4');
        result.current.add('command5', 'state5');
      });

      const recentTwo = result.current.recent(2);
      expect(recentTwo.length).toBe(2);
      expect(recentTwo[0].command).toBe('command5');
      expect(recentTwo[1].command).toBe('command4');

      // Default is 5
      const recentDefault = result.current.recent();
      expect(recentDefault.length).toBe(5);
    });
  });

  describe('callbacks', () => {
    it('should call onAdd when entry is added', () => {
      const onAdd = vi.fn();
      const { result } = renderHook(() => useCommandHistory<string>({ onAdd }));

      act(() => {
        result.current.add('test-command', 'test-state');
      });

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'test-command',
          previousState: 'test-state',
        })
      );
    });

    it('should call onUndo when entry is popped', () => {
      const onUndo = vi.fn();
      const { result } = renderHook(() => useCommandHistory<string>({ onUndo }));

      act(() => {
        result.current.add('test-command', 'test-state');
      });

      act(() => {
        result.current.pop();
      });

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(onUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'test-command',
          previousState: 'test-state',
        })
      );
    });
  });

  describe('getLabel option', () => {
    it('should generate labels using getLabel function', () => {
      const getLabel = (cmd: { action: string; target: string }) =>
        `${cmd.action} ${cmd.target}`;

      const { result } = renderHook(() =>
        useCommandHistory<{ action: string; target: string }>({ getLabel })
      );

      act(() => {
        result.current.add({ action: 'Delete', target: 'row 5' }, null);
      });

      expect(result.current.entries[0].label).toBe('Delete row 5');
    });

    it('should generate summary from labels', () => {
      const getLabel = (cmd: string) => `Command: ${cmd}`;

      const { result } = renderHook(() => useCommandHistory<string>({ getLabel }));

      act(() => {
        result.current.add('A', null);
        result.current.add('B', null);
        result.current.add('C', null);
      });

      expect(result.current.summary).toBe('Command: C, Command: B, Command: A');
    });
  });

  describe('entry timestamps', () => {
    it('should record timestamp for each entry', () => {
      const { result } = renderHook(() => useCommandHistory<string>());
      const beforeTime = Date.now();

      act(() => {
        result.current.add('command', 'state');
      });

      const afterTime = Date.now();
      const entryTime = result.current.entries[0].timestamp;

      expect(entryTime).toBeGreaterThanOrEqual(beforeTime);
      expect(entryTime).toBeLessThanOrEqual(afterTime);
    });
  });
});

describe('useAICommandHistory', () => {
  it('should generate labels for AI commands', () => {
    const { result } = renderHook(() => useAICommandHistory());

    const sortCommand: AICommand = {
      type: 'sort',
      naturalLanguage: 'sort by name',
      parsed: { action: 'sort', column: 'name', direction: 'ASC' },
    };

    const filterCommand: AICommand = {
      type: 'filter',
      naturalLanguage: 'filter age > 30',
      parsed: { action: 'filter', column: 'age', operator: '>', value: '30' },
    };

    const searchCommand: AICommand = {
      type: 'search',
      naturalLanguage: 'search John',
      parsed: { action: 'search', value: 'John' },
    };

    act(() => {
      result.current.add(sortCommand, defaultQueryParams);
      result.current.add(filterCommand, defaultQueryParams);
      result.current.add(searchCommand, defaultQueryParams);
    });

    expect(result.current.entries[0].label).toBe('Search "John"');
    expect(result.current.entries[1].label).toBe('Filter age');
    expect(result.current.entries[2].label).toBe('Sort by name asc');
  });

  it('should generate labels for update/fill commands', () => {
    const { result } = renderHook(() => useAICommandHistory());

    const updateCommand: AICommand = {
      type: 'update',
      naturalLanguage: 'set status to active',
      parsed: { action: 'update', column: 'status', value: 'active' },
    };

    const fillCommand: AICommand = {
      type: 'fill',
      naturalLanguage: 'fill missing values',
      parsed: { action: 'fill', column: 'email' },
    };

    act(() => {
      result.current.add(updateCommand, defaultQueryParams);
      result.current.add(fillCommand, defaultQueryParams);
    });

    expect(result.current.entries[0].label).toBe('Update email');
    expect(result.current.entries[1].label).toBe('Update status');
  });

  it('should generate labels for export and delete commands', () => {
    const { result } = renderHook(() => useAICommandHistory());

    const exportCommand: AICommand = {
      type: 'export',
      naturalLanguage: 'export to csv',
      parsed: { action: 'export', value: 'csv' },
    };

    const deleteCommand: AICommand = {
      type: 'delete',
      naturalLanguage: 'delete empty rows',
      parsed: { action: 'delete' },
    };

    act(() => {
      result.current.add(exportCommand, defaultQueryParams);
      result.current.add(deleteCommand, defaultQueryParams);
    });

    expect(result.current.entries[0].label).toBe('Delete rows');
    expect(result.current.entries[1].label).toBe('Export csv');
  });

  it('should use natural language as fallback label for unknown types', () => {
    const { result } = renderHook(() => useAICommandHistory());

    const customCommand: AICommand = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing unknown type handling
      type: 'unknown' as any,
      naturalLanguage: 'do something special',
      parsed: { action: 'unknown' },
    };

    act(() => {
      result.current.add(customCommand, defaultQueryParams);
    });

    expect(result.current.entries[0].label).toBe('do something special');
  });
});
