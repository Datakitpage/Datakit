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
  /** Placeholder text */
  placeholder?: string;
  /** File type color for theming */
  accentColor?: string;
}

type ParseState = 'idle' | 'typing' | 'parsed' | 'searching';

interface ParseResult {
  command: AIDataCommand | null;
  isSearch: boolean;
  searchQuery: string;
}

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
  placeholder = 'Search or ask AI anything...',
  accentColor = '#8B5CF6',
}: AICommandInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [parseState, setParseState] = useState<ParseState>('idle');
  const [parsedCommand, setParsedCommand] = useState<AIDataCommand | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the input for parsing
  const debouncedValue = useDebounce(value, 300);

  // Parse input when it changes
  useEffect(() => {
    if (!debouncedValue.trim()) {
      setParseState('idle');
      setParsedCommand(null);
      setShowPreview(false);
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
      } else {
        // Couldn't parse, treat as search
        setParseState('searching');
        setParsedCommand(null);
        setShowPreview(false);
      }
    } else {
      // Treat as regular search
      setParseState('searching');
      setParsedCommand(null);
      setShowPreview(false);
    }
  }, [debouncedValue, aiContext, isDuckDBReady, onAICommand]);

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
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Command header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
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
                  {parsedCommand.affectedRowsEstimate.toLocaleString()} rows
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
                  className="text-xs px-2.5 py-1 rounded-md transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onClick={() => setShowPreview(false)}
                  whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  Dismiss
                </motion.button>
                <motion.button
                  className="text-xs px-3 py-1 rounded-md font-medium"
                  style={{ backgroundColor: accentColor, color: 'white' }}
                  onClick={() => {
                    onApplyCommand(parsedCommand);
                    onChange('');
                    setShowPreview(false);
                    setParsedCommand(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Apply
                </motion.button>
              </div>
            </div>

            {/* SQL Preview */}
            <div className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Generated SQL
              </div>
              <code
                className="block text-xs font-mono p-2 rounded-lg overflow-x-auto"
                style={{
                  backgroundColor: 'var(--surface-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {parsedCommand.generatedSQL}
              </code>
            </div>

            {/* Warnings */}
            {parsedCommand.warnings.length > 0 && (
              <div
                className="px-4 py-2 flex items-start gap-2"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)' }}
              >
                <span className="text-xs" style={{ color: '#F59E0B' }}>⚠</span>
                <div className="text-xs" style={{ color: '#F59E0B' }}>
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
                <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>esc</kbd> dismiss
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AICommandInput;
