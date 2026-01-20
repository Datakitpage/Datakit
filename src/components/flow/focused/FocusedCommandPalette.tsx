import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentNodeData, ContentType } from '../ContentNode';

interface FocusedCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeFile: ContentNodeData;
  selectedColumn?: string;
  currentSort?: { column: string; direction: 'asc' | 'desc' };
  onCommand: (command: Command) => void;
}

export interface Command {
  type: 'filter' | 'sort' | 'group' | 'select' | 'ai' | 'export' | 'navigate';
  params: Record<string, unknown>;
}

interface CommandItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  type: 'action' | 'column' | 'ai';
  command: Command;
}

// Type configurations for context display
const typeConfigs: Record<ContentType, { icon: string; color: string }> = {
  csv: { icon: '⊞', color: '#10B981' },
  json: { icon: '{ }', color: '#F59E0B' },
  xlsx: { icon: '▦', color: '#059669' },
  parquet: { icon: '⬡', color: '#8B5CF6' },
  txt: { icon: '≡', color: '#6B7280' },
  md: { icon: 'M↓', color: '#6366F1' },
  image: { icon: '◐', color: '#EC4899' },
  pdf: { icon: '▤', color: '#EF4444' },
  unknown: { icon: '?', color: '#9CA3AF' },
};

function generateCommands(
  file: ContentNodeData,
  selectedColumn?: string,
  query?: string
): CommandItem[] {
  const commands: CommandItem[] = [];

  // Column-specific commands when a column is selected
  if (selectedColumn) {
    commands.push(
      {
        id: `sort-${selectedColumn}-asc`,
        icon: '↑',
        title: `Sort by ${selectedColumn}`,
        subtitle: 'Ascending (A→Z)',
        type: 'column',
        command: { type: 'sort', params: { column: selectedColumn, direction: 'asc' } },
      },
      {
        id: `sort-${selectedColumn}-desc`,
        icon: '↓',
        title: `Sort by ${selectedColumn}`,
        subtitle: 'Descending (Z→A)',
        type: 'column',
        command: { type: 'sort', params: { column: selectedColumn, direction: 'desc' } },
      },
      {
        id: `filter-${selectedColumn}`,
        icon: '⊘',
        title: `Filter ${selectedColumn}...`,
        subtitle: 'Show matching rows',
        type: 'column',
        command: { type: 'filter', params: { column: selectedColumn } },
      },
      {
        id: `group-${selectedColumn}`,
        icon: 'Σ',
        title: `Group by ${selectedColumn}`,
        subtitle: 'Aggregate data',
        type: 'column',
        command: { type: 'group', params: { column: selectedColumn } },
      }
    );
  }

  // General commands
  commands.push(
    {
      id: 'filter',
      icon: '⊘',
      title: 'Filter rows...',
      subtitle: 'Show rows matching condition',
      type: 'action',
      command: { type: 'filter', params: {} },
    },
    {
      id: 'sort',
      icon: '↕',
      title: 'Sort data...',
      subtitle: 'Order by column',
      type: 'action',
      command: { type: 'sort', params: {} },
    },
    {
      id: 'group',
      icon: 'Σ',
      title: 'Group by...',
      subtitle: 'Aggregate and summarize',
      type: 'action',
      command: { type: 'group', params: {} },
    },
    {
      id: 'ai',
      icon: '✦',
      title: 'Ask AI about this data',
      subtitle: 'Natural language queries',
      type: 'ai',
      command: { type: 'ai', params: {} },
    },
    {
      id: 'export',
      icon: '↗',
      title: 'Export data',
      subtitle: 'Download as CSV or JSON',
      type: 'action',
      command: { type: 'export', params: {} },
    }
  );

  // Column navigation commands
  if (file.columns && file.columns.length > 0) {
    file.columns.forEach(col => {
      commands.push({
        id: `select-col-${col}`,
        icon: '◎',
        title: col,
        subtitle: 'Select column',
        type: 'column',
        command: { type: 'select', params: { column: col } },
      });
    });
  }

  // Filter by query
  if (query && query.length > 0) {
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle?.toLowerCase().includes(q)
    );
  }

  return commands;
}

// Parse natural language queries
function parseNaturalLanguage(
  query: string,
  columns: string[]
): Command | null {
  const q = query.toLowerCase().trim();

  // Sort patterns
  const sortMatch = q.match(/sort\s+(?:by\s+)?(\w+)(?:\s+(asc|desc|ascending|descending))?/i);
  if (sortMatch) {
    const col = columns.find(c => c.toLowerCase() === sortMatch[1].toLowerCase());
    if (col) {
      const dir = sortMatch[2]?.startsWith('desc') ? 'desc' : 'asc';
      return { type: 'sort', params: { column: col, direction: dir } };
    }
  }

  // Filter patterns
  const filterMatch = q.match(/(?:show|filter|where)\s+(?:rows?\s+)?(?:where\s+)?(\w+)\s*(>|<|=|>=|<=|contains?|is)\s*(.+)/i);
  if (filterMatch) {
    const col = columns.find(c => c.toLowerCase() === filterMatch[1].toLowerCase());
    if (col) {
      return {
        type: 'filter',
        params: {
          column: col,
          operator: filterMatch[2],
          value: filterMatch[3].replace(/["']/g, '').trim(),
        },
      };
    }
  }

  // Group patterns
  const groupMatch = q.match(/group\s+(?:by\s+)?(\w+)/i);
  if (groupMatch) {
    const col = columns.find(c => c.toLowerCase() === groupMatch[1].toLowerCase());
    if (col) {
      return { type: 'group', params: { column: col } };
    }
  }

  return null;
}

export function FocusedCommandPalette({
  isOpen,
  onClose,
  activeFile,
  selectedColumn,
  currentSort,
  onCommand,
}: FocusedCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = typeConfigs[activeFile.type];

  // Generate context-aware commands
  const commands = useMemo(
    () => generateCommands(activeFile, selectedColumn, query),
    [activeFile, selectedColumn, query]
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, commands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (commands[selectedIndex]) {
          onCommand(commands[selectedIndex].command);
          onClose();
        } else if (query && activeFile.columns) {
          // Try natural language parsing
          const parsed = parseNaturalLanguage(query, activeFile.columns);
          if (parsed) {
            onCommand(parsed);
            onClose();
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [commands, selectedIndex, query, activeFile.columns, onCommand, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-primary)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Context header */}
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <span style={{ color: config.color }}>{config.icon}</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            In {activeFile.name}
            {activeFile.rowCount && ` · ${activeFile.rowCount.toLocaleString()} rows`}
            {selectedColumn && (
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}> · Column: {selectedColumn}</span>
            )}
          </span>
        </div>

        {/* Search input */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Commands list */}
        <div className="max-h-64 overflow-auto">
          {commands.length > 0 ? (
            commands.slice(0, 10).map((cmd, i) => (
              <motion.div
                key={cmd.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                style={{
                  backgroundColor: i === selectedIndex ? 'var(--surface-secondary)' : 'transparent',
                }}
                onClick={() => {
                  onCommand(cmd.command);
                  onClose();
                }}
                onMouseEnter={(e) => {
                  if (i !== selectedIndex) e.currentTarget.style.backgroundColor = 'var(--surface-secondary)';
                }}
                onMouseLeave={(e) => {
                  if (i !== selectedIndex) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{
                    backgroundColor: cmd.type === 'ai' ? 'rgba(139, 92, 246, 0.15)' : 'var(--surface-secondary)',
                    color: cmd.type === 'ai' ? '#8B5CF6' : 'var(--text-secondary)',
                  }}
                >
                  {cmd.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{cmd.title}</div>
                  {cmd.subtitle && (
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{cmd.subtitle}</div>
                  )}
                </div>
                {cmd.type === 'column' && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}
                  >
                    column
                  </span>
                )}
              </motion.div>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No matching commands</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>
                Try "sort by column" or "filter where..."
              </div>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ backgroundColor: 'var(--surface-secondary)', borderTop: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>↵</kbd> select
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>esc</kbd> close
            </span>
          </div>
          <div className="text-[10px]" style={{ color: '#8B5CF6' }}>
            ✦ Try natural language
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default FocusedCommandPalette;
