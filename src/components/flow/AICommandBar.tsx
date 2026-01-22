import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import anthropicIcon from '@/assets/anthropic.webp';

// ============================================================================
// Types
// ============================================================================

interface CommandItem {
  id: string;
  type: 'action' | 'file' | 'transform' | 'ai' | 'setting';
  icon: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  keywords?: string[];
  action: () => void;
}

interface AICommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  recentCommands?: string[];
  onAIQuery?: (query: string) => Promise<string>;
  onAIQueryStream?: (
    query: string,
    onChunk: (text: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void
  ) => void;
  placeholder?: string;
}

// ============================================================================
// Fuzzy Search
// ============================================================================

function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
  if (!query) return { match: true, score: 0 };

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (textLower.includes(queryLower)) {
    return { match: true, score: 100 - textLower.indexOf(queryLower) };
  }

  // Fuzzy match
  let queryIdx = 0;
  let score = 0;
  let consecutive = 0;

  for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      score += 10 + consecutive * 5;
      consecutive++;
      queryIdx++;
    } else {
      consecutive = 0;
    }
  }

  return {
    match: queryIdx === queryLower.length,
    score,
  };
}

function searchCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query) return commands.slice(0, 10);

  const results = commands
    .map(cmd => {
      const titleMatch = fuzzyMatch(cmd.title, query);
      const subtitleMatch = cmd.subtitle ? fuzzyMatch(cmd.subtitle, query) : { match: false, score: 0 };
      const keywordMatches = (cmd.keywords || []).map(k => fuzzyMatch(k, query));
      const keywordScore = Math.max(0, ...keywordMatches.map(m => (m.match ? m.score : 0)));

      const score = Math.max(titleMatch.score, subtitleMatch.score * 0.8, keywordScore * 0.6);
      const match = titleMatch.match || subtitleMatch.match || keywordMatches.some(m => m.match);

      return { cmd, score, match };
    })
    .filter(r => r.match)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(r => r.cmd);

  return results;
}

// ============================================================================
// Components
// ============================================================================

export function AICommandBar({
  isOpen,
  onClose,
  commands,
  onAIQuery,
  onAIQueryStream,
  placeholder = 'Search commands, ask AI, or type a query...',
}: AICommandBarProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'search' | 'ai'>('search');
  const [aiResponse, setAIResponse] = useState<string>('');
  const [aiLoading, setAILoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands
  const filteredCommands = useMemo(() => {
    return searchCommands(commands, query);
  }, [commands, query]);

  // AI mode detection
  const isAIQuery = query.startsWith('/') || query.startsWith('?') || query.length > 50;

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect -- Intentional state reset when modal opens */
      setQuery('');
      setSelectedIndex(0);
      setMode('search');
      setAIResponse('');
      setIsStreaming(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when filtered results change
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Handle AI query - defined before the useEffect that uses it
  const handleAIQuery = useCallback(async () => {
    const trimmedQuery = query.replace(/^[/?]/, '').trim();
    if (!trimmedQuery) return;

    setAILoading(true);
    setIsStreaming(true);
    setAIResponse('');
    setMode('ai');

    // Prefer streaming if available
    if (onAIQueryStream) {
      onAIQueryStream(
        trimmedQuery,
        (chunk) => setAIResponse(prev => prev + chunk),
        () => {
          setAILoading(false);
          setIsStreaming(false);
        },
        (err) => {
          setAILoading(false);
          setIsStreaming(false);
          setAIResponse(`Sorry, I encountered an error: ${err.message}`);
        }
      );
    } else if (onAIQuery) {
      // Fallback to non-streaming
      try {
        const response = await onAIQuery(trimmedQuery);
        setAIResponse(response);
      } catch {
        setAIResponse('Sorry, I encountered an error. Please try again.');
      }
      setAILoading(false);
      setIsStreaming(false);
    }
  }, [query, onAIQuery, onAIQueryStream]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          // Trigger AI if: in AI mode, or query has AI prefix (/?) or is long
          if ((mode === 'ai' || isAIQuery) && (onAIQuery || onAIQueryStream) && query.trim()) {
            handleAIQuery();
          } else if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          setMode(m => (m === 'search' ? 'ai' : 'search'));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, isAIQuery, onAIQuery, onAIQueryStream, onClose, mode, query, handleAIQuery]);

  const typeColors: Record<string, string> = {
    action: '#10B981',
    file: '#3B82F6',
    transform: '#8B5CF6',
    ai: '#EC4899',
    setting: '#6B7280',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Command bar */}
          <motion.div
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div
              className="rounded-2xl shadow-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {isAIQuery ? (
                  <img src={anthropicIcon} alt="" className="w-5 h-5 opacity-70 invert dark:invert-0" />
                ) : (
                  <span className="text-lg" style={{ color: 'var(--text-tertiary)' }}>⌘</span>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 text-base outline-none bg-transparent"
                  style={{ color: 'var(--text-primary)' }}
                />
                {query && (
                  <motion.button
                    className="text-xs hover:opacity-80"
                    style={{ color: 'var(--text-tertiary)' }}
                    onClick={() => setQuery('')}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    Clear
                  </motion.button>
                )}
              </div>

              {/* Mode tabs */}
              <div
                className="flex gap-1 px-3 py-2"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-secondary)',
                }}
              >
                <button
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: mode === 'search' ? 'var(--surface-primary)' : 'transparent',
                    color: mode === 'search' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    boxShadow: mode === 'search' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                  onClick={() => setMode('search')}
                >
                  Commands
                </button>
                <button
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    backgroundColor: mode === 'ai' ? 'var(--primary-muted)' : 'transparent',
                    color: mode === 'ai' ? 'var(--primary)' : 'var(--text-tertiary)',
                    boxShadow: mode === 'ai' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                  onClick={() => setMode('ai')}
                >
                  <img src={anthropicIcon} alt="" className="w-3 h-3 opacity-70 invert dark:invert-0" />
                  AI
                </button>
                <div className="flex-1" />
                <span className="text-[10px] self-center" style={{ color: 'var(--text-disabled)' }}>
                  Tab to switch
                </span>
              </div>

              {/* Content */}
              <div className="max-h-80 overflow-y-auto">
                {mode === 'ai' ? (
                  <div className="p-4">
                    {/* Loading state - before any response */}
                    {aiLoading && !aiResponse && (
                      <div className="flex items-center gap-2">
                        <motion.div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'var(--primary)' }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          Thinking...
                        </span>
                      </div>
                    )}
                    {/* Streaming/complete response */}
                    {aiResponse && (
                      <div className="space-y-3">
                        <div className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--primary)' }}>
                          <img src={anthropicIcon} alt="" className="w-3 h-3 opacity-70 invert dark:invert-0" />
                          AI
                        </div>
                        <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                          {aiResponse}
                          {/* Streaming cursor */}
                          {isStreaming && (
                            <motion.span
                              className="inline-block w-1.5 h-4 ml-0.5 align-middle"
                              style={{ backgroundColor: 'var(--primary)' }}
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    {/* Empty state - show suggestions */}
                    {!aiLoading && !aiResponse && (
                      <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        <p className="mb-3">Ask me anything about your files:</p>
                        <ul className="space-y-2 text-xs">
                          <li className="flex gap-2">
                            <span style={{ color: 'var(--primary)' }}>?</span>
                            <span>"What files do I have?"</span>
                          </li>
                          <li className="flex gap-2">
                            <span style={{ color: 'var(--primary)' }}>?</span>
                            <span>"Which file has sales data?"</span>
                          </li>
                          <li className="flex gap-2">
                            <span style={{ color: 'var(--primary)' }}>?</span>
                            <span>"How can I filter my data?"</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                ) : filteredCommands.length > 0 ? (
                  <div className="py-1">
                    {filteredCommands.map((cmd, idx) => (
                      <motion.button
                        key={cmd.id}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors"
                        style={{
                          backgroundColor: idx === selectedIndex ? 'var(--surface-secondary)' : 'transparent',
                        }}
                        onClick={() => {
                          cmd.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        layout
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                          style={{
                            backgroundColor: `${typeColors[cmd.type]}15`,
                            color: typeColors[cmd.type],
                          }}
                        >
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {cmd.title}
                          </div>
                          {cmd.subtitle && (
                            <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                              {cmd.subtitle}
                            </div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                            style={{
                              backgroundColor: 'var(--surface-secondary)',
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {idx === selectedIndex && (
                          <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>↵</span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    <div className="text-2xl mb-2">◎</div>
                    <div className="text-sm">No commands found</div>
                    <div className="text-xs mt-1">
                      Try asking AI with <span style={{ color: 'var(--primary)' }}>?</span> prefix
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="px-4 py-2 flex items-center gap-4 text-xs"
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-secondary)',
                  color: 'var(--text-disabled)',
                }}
              >
                <span>
                  <kbd className="px-1 rounded" style={{ backgroundColor: 'var(--surface-tertiary)' }}>↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="px-1 rounded" style={{ backgroundColor: 'var(--surface-tertiary)' }}>↵</kbd> Select
                </span>
                <span>
                  <kbd className="px-1 rounded" style={{ backgroundColor: 'var(--surface-tertiary)' }}>esc</kbd> Close
                </span>
                <div className="flex-1" />
                <span className="flex items-center gap-1" style={{ color: 'var(--text-disabled)' }}>Powered by <img src={anthropicIcon} alt="Anthropic" className="w-3 h-3 opacity-50 invert dark:invert-0" /></span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
