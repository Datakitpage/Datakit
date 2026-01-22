import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseNaturalLanguage, type AIDataCommand, type AICommandContext } from '@/lib/ai/dataCommands';

interface AICommandInputProps {
  /** Context for AI parsing (schema, sample data, etc.) */
  aiContext: AICommandContext | null;
  /** Whether DuckDB is ready for AI commands */
  isDuckDBReady: boolean;
  /** Current search/filter value */
  value: string;
  /** Called when input changes (for search) */
  onChange: (value: string) => void;
  /** Called when AI parses a valid command */
  onAICommand: (command: AIDataCommand) => void;
  /** Called when user wants to apply the previewed command */
  onApplyCommand: (command: AIDataCommand) => void;
  /** Optional function to fetch preview data for before/after diff */
  onFetchPreview?: (sql: string) => Promise<Record<string, unknown>[] | null>;
  /** Placeholder text */
  placeholder?: string;
  /** File type color for theming */
  accentColor?: string;
}

type ParseState = 'idle' | 'typing' | 'parsed' | 'searching';


// Debounce hook for parsing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function AICommandInput({
  aiContext,
  isDuckDBReady,
  value,
  onChange,
  onAICommand,
  onApplyCommand,
  onFetchPreview,
  placeholder = 'Search or ask AI anything...',
  accentColor = '#8B5CF6',
}: AICommandInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [parseState, setParseState] = useState<ParseState>('idle');
  const [parsedCommand, setParsedCommand] = useState<AIDataCommand | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the input for parsing
  const debouncedValue = useDebounce(value, 300);

  // Parse input when it changes
  useEffect(() => {
    if (!debouncedValue.trim()) {
      /* eslint-disable react-hooks/set-state-in-effect -- Intentional state reset on empty input */
      setParseState('idle');
      setParsedCommand(null);
      setShowPreview(false);
      setPreviewRows([]);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    // Check if it looks like an AI command vs a search
    const looksLikeCommand = /^(sort|filter|show|where|set|update|delete|group|find|order|convert|transform|replace|remove|add|create|compute)/i.test(debouncedValue.trim());

    if (looksLikeCommand && aiContext && isDuckDBReady) {
      setParseState('typing');

      // Try to parse as AI command
      const command = parseNaturalLanguage(debouncedValue, aiContext);

      if (command) {
        setParsedCommand(command);
        setParseState('parsed');
        setShowPreview(true);
        onAICommand(command);

        // Fetch preview rows if we have the capability
        if (onFetchPreview) {
          setIsLoadingPreview(true);
          // Build preview SQL based on command type
          let previewSQL = command.generatedSQL;

          if (command.type === 'update' || command.type === 'delete') {
            // Extract WHERE clause and table for preview
            const whereMatch = command.generatedSQL.match(/WHERE\s+(.+)$/i);
            const whereClause = whereMatch ? ` WHERE ${whereMatch[1]}` : '';
            previewSQL = `SELECT * FROM "${aiContext.viewName}"${whereClause} LIMIT 5`;
          } else if (command.type === 'filter' || command.type === 'sort') {
            previewSQL = command.generatedSQL.replace(/;?\s*$/, ' LIMIT 5');
          }

          onFetchPreview(previewSQL)
            .then(rows => {
              setPreviewRows(rows || []);
              setIsLoadingPreview(false);
            })
            .catch(() => {
              setPreviewRows([]);
              setIsLoadingPreview(false);
            });
        }
      } else {
        // Couldn't parse, treat as search
        setParseState('searching');
        setParsedCommand(null);
        setShowPreview(false);
        setPreviewRows([]);
      }
    } else {
      // Treat as regular search
      setParseState('searching');
      setParsedCommand(null);
      setShowPreview(false);
      setPreviewRows([]);
    }
  }, [debouncedValue, aiContext, isDuckDBReady, onAICommand, onFetchPreview]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsedCommand && showPreview) {
      e.preventDefault();
      onApplyCommand(parsedCommand);
      onChange('');
      setShowPreview(false);
      setParsedCommand(null);
    } else if (e.key === 'Escape') {
      if (showPreview) {
        setShowPreview(false);
      } else if (value) {
        onChange('');
      } else {
        inputRef.current?.blur();
      }
    }
  }, [parsedCommand, showPreview, value, onChange, onApplyCommand]);

  // Get status indicator content
  const statusIndicator = useMemo(() => {
    if (!isDuckDBReady) {
      return { icon: '○', label: 'Loading...', color: 'var(--text-tertiary)' };
    }

    switch (parseState) {
      case 'idle':
        return { icon: '✦', label: 'AI Ready', color: accentColor };
      case 'typing':
        return { icon: '◌', label: 'Parsing...', color: 'var(--text-tertiary)' };
      case 'parsed':
        return { icon: '✓', label: 'Command ready', color: '#10B981' };
      case 'searching':
        return { icon: '⌕', label: 'Searching', color: 'var(--text-secondary)' };
      default:
        return { icon: '✦', label: 'Ready', color: accentColor };
    }
  }, [parseState, isDuckDBReady, accentColor]);

  // Get command type badge
  const getCommandTypeBadge = (type: AIDataCommand['type']) => {
    const badges: Record<AIDataCommand['type'], { label: string; color: string; bg: string }> = {
      sort: { label: 'Sort', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
      filter: { label: 'Filter', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
      update: { label: 'Update', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
      delete: { label: 'Delete', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
      transform: { label: 'Transform', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
      compute: { label: 'Compute', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' },
    };
    return badges[type] || { label: type, color: 'var(--text-secondary)', bg: 'var(--surface-secondary)' };
  };

  return (
    <div className="relative">
      {/* Main input container */}
      <div
        className="relative flex items-center gap-2 rounded-xl transition-all duration-200"
        style={{
          backgroundColor: isFocused ? 'var(--surface-primary)' : 'var(--surface-secondary)',
          border: `1px solid ${isFocused ? accentColor : 'var(--border-default)'}`,
          boxShadow: isFocused ? `0 0 0 3px ${accentColor}15` : 'none',
        }}
      >
        {/* AI status indicator */}
        <motion.div
          className="flex items-center justify-center w-10 h-10 ml-1"
          animate={{
            scale: parseState === 'typing' ? [1, 1.1, 1] : 1,
          }}
          transition={{
            duration: 0.6,
            repeat: parseState === 'typing' ? Infinity : 0,
          }}
        >
          <span
            className="text-sm"
            style={{ color: statusIndicator.color }}
          >
            {statusIndicator.icon}
          </span>
        </motion.div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 py-2.5 pr-4 text-sm bg-transparent outline-none"
          style={{ color: 'var(--text-primary)' }}
        />

        {/* Right side hints */}
        <div className="flex items-center gap-2 pr-3">
          {value && parseState === 'parsed' && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: '#10B98120', color: '#10B981' }}
            >
              ↵ Apply
            </motion.span>
          )}
          {!value && (
            <kbd
              className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--text-tertiary)' }}
            >
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Parsing feedback panel */}
      <AnimatePresence>
        {showPreview && parsedCommand && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--surface-primary)',
              border: `1px solid ${parsedCommand.type === 'delete' ? '#EF4444' : 'var(--border-default)'}`,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Command header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: parsedCommand.type === 'delete' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-sm px-2 py-0.5 rounded-md font-medium"
                  style={{
                    backgroundColor: getCommandTypeBadge(parsedCommand.type).bg,
                    color: getCommandTypeBadge(parsedCommand.type).color,
                  }}
                >
                  {getCommandTypeBadge(parsedCommand.type).label}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  ~{parsedCommand.affectedRowsEstimate.toLocaleString()} rows affected
                </span>
                {parsedCommand.confidence < 0.8 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}
                  >
                    Low confidence
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  className="text-xs px-2.5 py-1.5 rounded-md transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewRows([]);
                  }}
                  whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="text-xs px-3 py-1.5 rounded-md font-medium"
                  style={{
                    backgroundColor: parsedCommand.type === 'delete' ? '#EF4444' : accentColor,
                    color: 'white',
                  }}
                  onClick={() => {
                    onApplyCommand(parsedCommand);
                    onChange('');
                    setShowPreview(false);
                    setParsedCommand(null);
                    setPreviewRows([]);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {parsedCommand.type === 'delete' ? 'Delete Rows' : 'Apply'}
                </motion.button>
              </div>
            </div>

            {/* Before/After Preview for destructive operations */}
            {(parsedCommand.type === 'update' || parsedCommand.type === 'delete' || parsedCommand.type === 'transform') && (
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                    {parsedCommand.type === 'delete' ? 'Rows to be deleted' : 'Preview of affected rows'}
                  </div>
                  {isLoadingPreview && (
                    <motion.div
                      className="w-3 h-3 border border-t-transparent rounded-full"
                      style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'transparent' }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>

                {previewRows.length > 0 ? (
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                          {Object.keys(previewRows[0]).filter(k => k !== '_rowid' && k !== '_hasChanges').slice(0, 4).map(key => (
                            <th
                              key={key}
                              className="px-3 py-2 text-left font-medium truncate"
                              style={{ color: 'var(--text-secondary)', maxWidth: 120 }}
                            >
                              {key}
                            </th>
                          ))}
                          {Object.keys(previewRows[0]).filter(k => k !== '_rowid' && k !== '_hasChanges').length > 4 && (
                            <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-tertiary)' }}>
                              +{Object.keys(previewRows[0]).filter(k => k !== '_rowid' && k !== '_hasChanges').length - 4} more
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 3).map((row, i) => (
                          <tr
                            key={i}
                            style={{
                              backgroundColor: parsedCommand.type === 'delete' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                              borderTop: '1px solid var(--border-subtle)',
                            }}
                          >
                            {Object.entries(row).filter(([k]) => k !== '_rowid' && k !== '_hasChanges').slice(0, 4).map(([key, val]) => (
                              <td
                                key={key}
                                className="px-3 py-2 truncate"
                                style={{
                                  color: parsedCommand.type === 'delete' ? '#EF4444' : 'var(--text-primary)',
                                  maxWidth: 120,
                                  textDecoration: parsedCommand.type === 'delete' ? 'line-through' : 'none',
                                  opacity: parsedCommand.type === 'delete' ? 0.7 : 1,
                                }}
                              >
                                {val === null ? <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>null</span> : String(val)}
                              </td>
                            ))}
                            {Object.keys(row).filter(k => k !== '_rowid' && k !== '_hasChanges').length > 4 && (
                              <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>...</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewRows.length > 3 && (
                      <div
                        className="px-3 py-1.5 text-[10px] text-center"
                        style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}
                      >
                        +{previewRows.length - 3} more rows shown, ~{parsedCommand.affectedRowsEstimate - 3} total affected
                      </div>
                    )}
                  </div>
                ) : !isLoadingPreview && (
                  <div
                    className="px-3 py-4 text-xs text-center rounded-lg"
                    style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}
                  >
                    No preview available
                  </div>
                )}
              </div>
            )}

            {/* Sample output for sort/filter */}
            {(parsedCommand.type === 'sort' || parsedCommand.type === 'filter') && previewRows.length > 0 && (
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {parsedCommand.type === 'sort' ? 'Result preview (first 3 rows)' : 'Matching rows preview'}
                </div>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                        {Object.keys(previewRows[0]).filter(k => k !== '_rowid' && k !== '_hasChanges').slice(0, 4).map(key => (
                          <th
                            key={key}
                            className="px-3 py-2 text-left font-medium truncate"
                            style={{ color: 'var(--text-secondary)', maxWidth: 120 }}
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 3).map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          {Object.entries(row).filter(([k]) => k !== '_rowid' && k !== '_hasChanges').slice(0, 4).map(([key, val]) => (
                            <td key={key} className="px-3 py-2 truncate" style={{ color: 'var(--text-primary)', maxWidth: 120 }}>
                              {val === null ? <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>null</span> : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SQL Preview - collapsible for better UX */}
            <details className="group">
              <summary
                className="px-4 py-2 text-[10px] uppercase tracking-wide cursor-pointer select-none flex items-center gap-2"
                style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--surface-secondary)' }}
              >
                <span className="transition-transform group-open:rotate-90">▶</span>
                Generated SQL
              </summary>
              <div className="px-4 py-3">
                <code
                  className="block text-xs font-mono p-2 rounded-lg overflow-x-auto whitespace-pre-wrap"
                  style={{
                    backgroundColor: 'var(--surface-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {parsedCommand.generatedSQL}
                </code>
              </div>
            </details>

            {/* Warnings */}
            {parsedCommand.warnings.length > 0 && (
              <div
                className="px-4 py-2 flex items-start gap-2"
                style={{
                  backgroundColor: parsedCommand.type === 'delete' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                }}
              >
                <span className="text-xs" style={{ color: parsedCommand.type === 'delete' ? '#EF4444' : '#F59E0B' }}>⚠</span>
                <div className="text-xs" style={{ color: parsedCommand.type === 'delete' ? '#EF4444' : '#F59E0B' }}>
                  {parsedCommand.warnings.join(' · ')}
                </div>
              </div>
            )}

            {/* Keyboard hint */}
            <div
              className="px-4 py-2 flex items-center gap-4 text-[10px]"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>
                <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>↵</kbd> apply
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>esc</kbd> cancel
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AICommandInput;
