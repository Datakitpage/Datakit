import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ColumnSchema } from '@/store/duckDBViewStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  streamCommandAssistant,
  generateSmartSuggestions,
  parseAICommand,
  isWriteOperation,
  validateApiKey,
  type CommandContext,
  type AICommand,
  type ParseResult,
} from '@/lib/ai';

// Lazy load Monaco SQL Editor
const SQLEditor = lazy(() => import('./SQLEditor'));

interface FloatingAICommandProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: AICommand) => void;
  validateSQL?: (sql: string) => Promise<{ valid: boolean; error?: string }>;
  schema: ColumnSchema[];
  totalRows: number;
  accentColor: string;
  viewName?: string;
  recentCommands?: string[];
}

// Re-export the AICommand type for backwards compatibility
export type { AICommand } from '@/lib/ai';

// Command type labels for visual feedback
const COMMAND_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  sort: { label: 'Sort', color: 'var(--info)', icon: '↕️' },
  filter: { label: 'Filter', color: 'var(--info)', icon: '🔍' },
  search: { label: 'Search', color: 'var(--info)', icon: '🔎' },
  limit: { label: 'Limit', color: 'var(--info)', icon: '📊' },
  page: { label: 'Page', color: 'var(--info)', icon: '📄' },
  reset: { label: 'Reset', color: 'var(--success)', icon: '🔄' },
  export: { label: 'Export', color: 'var(--success)', icon: '📤' },
  theme: { label: 'Theme', color: 'var(--text-secondary)', icon: '🎨' },
  fill: { label: 'Fill', color: 'var(--warning)', icon: '✏️' },
  update: { label: 'Update', color: 'var(--warning)', icon: '✏️' },
  delete: { label: 'Delete', color: 'var(--error)', icon: '🗑️' },
  sql: { label: 'SQL', color: 'var(--info)', icon: '⌨️' },
};

// SQL Editor loading placeholder
function SQLEditorLoading() {
  return (
    <div
      className="flex items-center justify-center w-full"
      style={{
        height: '140px',
        backgroundColor: 'var(--surface-secondary)',
        borderRadius: '6px',
      }}
    >
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <div
          className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'transparent' }}
        />
        Loading SQL editor...
      </div>
    </div>
  );
}

export function FloatingAICommand({
  isOpen,
  onClose,
  onCommand,
  validateSQL,
  schema,
  totalRows,
  accentColor,
  viewName = 'data',
}: FloatingAICommandProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Mode: 'ai' for natural language, 'sql' for direct SQL
  const [mode, setMode] = useState<'ai' | 'sql'>('ai');

  // AI state
  const [aiResponse, setAiResponse] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [suggestedCommand, setSuggestedCommand] = useState<string | null>(null);
  const anthropicApiKey = useSettingsStore((state) => state.anthropicApiKey);
  const setAnthropicApiKey = useSettingsStore((state) => state.setAnthropicApiKey);
  const theme = useSettingsStore((state) => state.theme);

  // API key inline setup state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationError, setKeyValidationError] = useState<string | null>(null);
  const [keyValidationSuccess, setKeyValidationSuccess] = useState(false);

  // Auto-execute state
  const [isAutoExecuting, setIsAutoExecuting] = useState(false);
  const [autoExecuteError, setAutoExecuteError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Smart suggestions state
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsLoadedRef = useRef(false);

  // Focus input when opened or mode changes
  useEffect(() => {
    if (isOpen) {
      // Reset all state when opening
      setInput('');
      setAiResponse('');
      setSuggestedCommand(null);
      setSelectedIndex(-1);
      setIsAILoading(false);
      setIsAutoExecuting(false);
      setIsSuggestedSQL(false);
      setAutoExecuteError(null);
      setRetryCount(0);
      // Focus the AI input when opening (Monaco handles its own focus)
      if (mode === 'ai') {
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, mode]);

  // Fetch smart suggestions when modal opens (only once per session)
  useEffect(() => {
    if (isOpen && anthropicApiKey && schema.length > 0 && !suggestionsLoadedRef.current) {
      suggestionsLoadedRef.current = true;
      setIsLoadingSuggestions(true);
      generateSmartSuggestions(anthropicApiKey, { schema, totalRows, tableName: viewName })
        .then(suggestions => {
          setSmartSuggestions(suggestions);
          setIsLoadingSuggestions(false);
        })
        .catch(() => setIsLoadingSuggestions(false));
    }
  }, [isOpen, anthropicApiKey, schema, totalRows, viewName]);

  // Track if suggested command is SQL
  const [isSuggestedSQL, setIsSuggestedSQL] = useState(false);

  // Store original query for retries
  const originalQueryRef = useRef<string>('');

  // Auto-execute SQL and retry on failure
  const autoExecuteSQL = useCallback(async (sql: string, currentRetry: number) => {
    if (!validateSQL) {
      // No validation function provided, just show the suggestion
      setIsAILoading(false);
      return;
    }

    setIsAutoExecuting(true);
    setAutoExecuteError(null);

    try {
      const result = await validateSQL(sql);
      if (result.valid) {
        // SQL is valid - execute it
        setIsAutoExecuting(false);
        setIsAILoading(false);
        const sqlCommand: AICommand = {
          type: 'sql',
          naturalLanguage: sql,
          sql: sql,
          parsed: {
            action: 'sql',
            value: sql,
          },
          isWriteOperation: sql.trim().toUpperCase().startsWith('SELECT') === false,
        };
        onCommand(sqlCommand);
        onClose();
      } else {
        // SQL failed - retry with AI
        setAutoExecuteError(result.error || 'SQL validation failed');

        if (currentRetry < MAX_RETRIES && anthropicApiKey) {
          setRetryCount(currentRetry + 1);
          setAiResponse(prev => prev + `\n\n⚠️ Error: ${result.error}\n\nRetrying (${currentRetry + 1}/${MAX_RETRIES})...`);

          // Ask AI to fix the SQL
          const fixPrompt = `The SQL query failed with error: "${result.error}"\n\nOriginal query:\n\`\`\`sql\n${sql}\n\`\`\`\n\nPlease fix the SQL query. Return ONLY the corrected SQL in a \`\`\`sql code block.`;

          const context: CommandContext = {
            schema,
            totalRows,
            tableName: viewName,
          };

          await streamCommandAssistant(
            anthropicApiKey,
            fixPrompt,
            context,
            (chunk) => setAiResponse(prev => prev + chunk),
            async (fullText) => {
              const sqlMatch = fullText.match(/```sql\n?([\s\S]*?)```/);
              if (sqlMatch) {
                const fixedSQL = sqlMatch[1].trim();
                setSuggestedCommand(fixedSQL);
                // Recursively try the fixed SQL
                await autoExecuteSQL(fixedSQL, currentRetry + 1);
              } else {
                setIsAutoExecuting(false);
                setIsAILoading(false);
              }
            },
            (error) => {
              setIsAutoExecuting(false);
              setIsAILoading(false);
              setAiResponse(prev => prev + `\n\nFailed to fix: ${error.message}`);
            }
          );
        } else {
          // Max retries reached
          setIsAutoExecuting(false);
          setIsAILoading(false);
          if (currentRetry >= MAX_RETRIES) {
            setAiResponse(prev => prev + `\n\n❌ Max retries reached. You can edit the query manually or try a different approach.`);
          }
        }
      }
    } catch (error) {
      setIsAutoExecuting(false);
      setIsAILoading(false);
      setAutoExecuteError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [validateSQL, anthropicApiKey, schema, totalRows, viewName, onCommand, onClose]);

  // Call AI - this is the PRIMARY handler for all user input
  const askAI = useCallback(async (query: string) => {
    if (!anthropicApiKey) {
      setAiResponse('API key not configured. Go to Settings to add your Anthropic API key.');
      return;
    }

    setIsAILoading(true);
    setAiResponse('');
    setSuggestedCommand(null);
    setIsSuggestedSQL(false);
    setAutoExecuteError(null);
    setRetryCount(0);
    originalQueryRef.current = query;

    const context: CommandContext = {
      schema,
      totalRows,
      tableName: viewName,
    };

    await streamCommandAssistant(
      anthropicApiKey,
      query,
      context,
      (chunk) => setAiResponse(prev => prev + chunk),
      async (fullText) => {
        // Check for SQL code block first (```sql)
        const sqlMatch = fullText.match(/```sql\n?([\s\S]*?)```/);
        if (sqlMatch) {
          const sql = sqlMatch[1].trim();
          setSuggestedCommand(sql);
          setIsSuggestedSQL(true);

          // Auto-execute the SQL if validation is available
          if (validateSQL) {
            await autoExecuteSQL(sql, 0);
          } else {
            setIsAILoading(false);
          }
          return;
        }
        // Then check for regular command code block
        const cmdMatch = fullText.match(/```\n?([\s\S]*?)```/);
        if (cmdMatch) {
          setSuggestedCommand(cmdMatch[1].trim());
          setIsSuggestedSQL(false);
        }
        setIsAILoading(false);
      },
      (error) => {
        setIsAILoading(false);
        setAiResponse(`Error: ${error.message}`);
      }
    );
  }, [anthropicApiKey, schema, totalRows, viewName, validateSQL, autoExecuteSQL]);

  // Parse the current input to show preview
  const parseResult: ParseResult = useMemo(() => {
    if (input.trim().length < 2) {
      return { success: false, command: null };
    }
    return parseAICommand(input, { schema });
  }, [input, schema]);

  // Execute a command (either from AI suggestion or direct parse)
  const executeCommand = useCallback((commandText: string) => {
    const result = parseAICommand(commandText, { schema });
    if (result.success && result.command) {
      onCommand(result.command);
      onClose();
      return true;
    }
    return false;
  }, [schema, onCommand, onClose]);

  // Detect if SQL is a read (SELECT) or write (UPDATE/DELETE/INSERT) operation
  const detectSQLType = useCallback((sql: string): 'read' | 'write' => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('EXPLAIN') || trimmed.startsWith('DESCRIBE') || trimmed.startsWith('SHOW')) {
      return 'read';
    }
    return 'write';
  }, []);

  // Handle SQL execution
  const handleSQLExecute = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const sqlType = detectSQLType(trimmed);

    // Create a SQL command
    const sqlCommand: AICommand = {
      type: 'sql',
      naturalLanguage: trimmed,
      sql: trimmed,
      parsed: {
        action: 'sql',
        value: trimmed,
      },
      isWriteOperation: sqlType === 'write',
    };

    onCommand(sqlCommand);
    onClose();
  }, [input, detectSQLType, onCommand, onClose]);

  // Handle Enter key
  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // First, try to parse as a direct command
    if (executeCommand(trimmed)) {
      return;
    }

    // Otherwise, ask AI
    if (!isAILoading) {
      askAI(trimmed);
    }
  }, [input, executeCommand, isAILoading, askAI]);

  // Execute suggested command from AI
  const executeSuggestedCommand = useCallback(() => {
    if (!suggestedCommand) return;

    // If it's a SQL suggestion, execute directly as SQL
    if (isSuggestedSQL) {
      const sqlCommand: AICommand = {
        type: 'sql',
        naturalLanguage: suggestedCommand,
        sql: suggestedCommand,
        parsed: {
          action: 'sql',
          value: suggestedCommand,
        },
        isWriteOperation: detectSQLType(suggestedCommand) === 'write',
      };
      onCommand(sqlCommand);
      onClose();
      return;
    }

    // Otherwise try to parse as a regular command
    if (!executeCommand(suggestedCommand)) {
      // If AI's suggestion doesn't parse, set it as input for editing
      setInput(suggestedCommand);
      setSuggestedCommand(null);
      setAiResponse('');
    }
  }, [suggestedCommand, isSuggestedSQL, executeCommand, detectSQLType, onCommand, onClose]);

  // Handle keyboard for AI mode (single-line input)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // Tab to toggle between modes
      e.preventDefault();
      setMode(m => m === 'ai' ? 'sql' : 'ai');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Only navigate if showing suggestions (no input, no AI response)
      if (!aiResponse && !isAILoading && input.length === 0 && smartSuggestions.length > 0) {
        setSelectedIndex(prev => Math.min(prev + 1, smartSuggestions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Only navigate if showing suggestions
      if (!aiResponse && !isAILoading && input.length === 0 && smartSuggestions.length > 0) {
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestedCommand) {
        executeSuggestedCommand();
      } else if (selectedIndex >= 0 && smartSuggestions[selectedIndex]) {
        // Execute selected suggestion
        const suggestion = smartSuggestions[selectedIndex];
        setInput(suggestion);
        askAI(suggestion);
        setSelectedIndex(-1);
      } else {
        handleSubmit();
      }
    }
  }, [onClose, suggestedCommand, executeSuggestedCommand, handleSubmit, aiResponse, isAILoading, input, smartSuggestions, selectedIndex, askAI]);

  // Handle API key validation and storage
  const handleApiKeySubmit = useCallback(async () => {
    const trimmedKey = apiKeyInput.trim();
    if (!trimmedKey) return;

    setIsValidatingKey(true);
    setKeyValidationError(null);
    setKeyValidationSuccess(false);

    try {
      const result = await validateApiKey(trimmedKey);
      if (result.valid) {
        setAnthropicApiKey(trimmedKey);
        setKeyValidationSuccess(true);
        setApiKeyInput('');
        // Clear success message after a delay
        setTimeout(() => setKeyValidationSuccess(false), 2000);
      } else {
        setKeyValidationError(result.error || 'Invalid API key');
      }
    } catch (error) {
      setKeyValidationError(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidatingKey(false);
    }
  }, [apiKeyInput, setAnthropicApiKey]);

  // Derived state for visual feedback
  const commandPreview = parseResult.success && parseResult.command ? parseResult.command : null;
  const commandError = parseResult.error;
  const isWriteCmd = commandPreview ? isWriteOperation(commandPreview) : false;
  const commandTypeInfo = commandPreview ? COMMAND_TYPE_LABELS[commandPreview.type] : null;
  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            onClick={onClose}
          />

          {/* Command overlay */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-24 -translate-x-1/2 z-50 w-full max-w-xl"
          >
            <div
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              {/* Input area - AI mode (single line) */}
              {mode === 'ai' && (
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your data..."
                    className="flex-1 bg-transparent text-base outline-none"
                    style={{ color: 'var(--text-primary)' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                  {isAILoading && (
                    <motion.div
                      className="w-5 h-5 border-2 rounded-full"
                      style={{ borderColor: 'var(--border-subtle)', borderTopColor: accentColor }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                  {/* Command type badge with visual feedback */}
                  {commandPreview && commandTypeInfo && (
                    <motion.span
                      className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1"
                      style={{
                        backgroundColor: isWriteCmd ? 'var(--warning-subtle)' : `${accentColor}20`,
                        color: isWriteCmd ? 'var(--warning)' : accentColor,
                      }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <span>{commandTypeInfo.icon}</span>
                      <span>{commandTypeInfo.label}</span>
                      {isWriteCmd && <span className="opacity-60">• Write</span>}
                    </motion.span>
                  )}
                  {!commandPreview && !isAILoading && input.length > 2 && anthropicApiKey && !commandError && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--info-subtle)', color: 'var(--info)' }}
                    >
                      AI
                    </span>
                  )}
                </div>
              )}

              {/* Input area - SQL mode (Monaco Editor) */}
              {mode === 'sql' && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm" style={{ color: accentColor }}>⌨️</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>SQL Editor</span>
                    {input.trim().length > 0 && (
                      <motion.span
                        className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ml-auto"
                        style={{
                          backgroundColor: detectSQLType(input) === 'write' ? 'var(--warning-subtle)' : `${accentColor}20`,
                          color: detectSQLType(input) === 'write' ? 'var(--warning)' : accentColor,
                        }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <span>{detectSQLType(input) === 'write' ? 'Write' : 'Read'}</span>
                      </motion.span>
                    )}
                  </div>
                  <Suspense fallback={<SQLEditorLoading />}>
                    <SQLEditor
                      value={input}
                      onChange={setInput}
                      onExecute={handleSQLExecute}
                      onClose={onClose}
                      onSwitchMode={() => setMode('ai')}
                      schema={schema}
                      viewName={viewName}
                      isDark={isDark}
                      minHeight="140px"
                      maxHeight="350px"
                    />
                  </Suspense>
                </div>
              )}

              {/* Mode tabs - inspired by AICommandBar */}
              <div
                className="flex gap-1 px-3 py-2"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-secondary)',
                }}
              >
                <button
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    backgroundColor: mode === 'ai' ? 'var(--surface-primary)' : 'transparent',
                    color: mode === 'ai' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    boxShadow: mode === 'ai' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                  onClick={() => setMode('ai')}
                >
                  <span>🧠</span>
                  AI Assistant
                </button>
                <button
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    backgroundColor: mode === 'sql' ? `${accentColor}15` : 'transparent',
                    color: mode === 'sql' ? accentColor : 'var(--text-tertiary)',
                    boxShadow: mode === 'sql' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                  onClick={() => setMode('sql')}
                >
                  SQL
                </button>
                <div className="flex-1" />
                <span className="text-[10px] self-center" style={{ color: 'var(--text-disabled)' }}>
                  Tab to switch
                </span>
              </div>

              {/* Write operation warning for SQL mode */}
              {mode === 'sql' && input.trim().length > 0 && detectSQLType(input) === 'write' && (
                <motion.div
                  className="px-4 py-2"
                  style={{
                    backgroundColor: 'var(--warning-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <div className="text-xs flex items-center gap-2" style={{ color: 'var(--warning)' }}>
                    <span>⚠️</span>
                    <span>This query will modify data. Changes will be staged for review.</span>
                  </div>
                </motion.div>
              )}

              {/* Command Preview - shows what will be executed */}
              {mode === 'ai' && commandPreview && !aiResponse && (
                <motion.div
                  className="px-4 py-2"
                  style={{
                    backgroundColor: isWriteCmd ? 'var(--warning-subtle)' : 'var(--surface-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {commandPreview.type === 'sort' && (
                        <span>Sort by <strong>{commandPreview.parsed.column}</strong> {commandPreview.parsed.direction?.toLowerCase()}</span>
                      )}
                      {commandPreview.type === 'filter' && (
                        <span>Filter <strong>{commandPreview.parsed.column}</strong> {commandPreview.parsed.operator} {String(commandPreview.parsed.value)}</span>
                      )}
                      {commandPreview.type === 'search' && (
                        <span>Search for "<strong>{String(commandPreview.parsed.value)}</strong>"</span>
                      )}
                      {commandPreview.type === 'export' && (
                        <span>Export as <strong>{String(commandPreview.parsed.value).toUpperCase()}</strong></span>
                      )}
                      {commandPreview.type === 'limit' && (
                        <span>Show first <strong>{commandPreview.parsed.limit}</strong> rows</span>
                      )}
                      {commandPreview.type === 'page' && (
                        <span>Go to page <strong>{commandPreview.parsed.page}</strong></span>
                      )}
                      {commandPreview.type === 'reset' && (
                        <span>Reset view - <strong>clear all filters</strong> and show all data</span>
                      )}
                      {(commandPreview.type === 'update' || commandPreview.type === 'fill') && (
                        <span>
                          Update <strong>{commandPreview.parsed.column}</strong> to "{String(commandPreview.parsed.newValue)}"
                          {commandPreview.parsed.condition && (
                            <> where {commandPreview.parsed.condition.column} {commandPreview.parsed.condition.operator} {String(commandPreview.parsed.condition.value)}</>
                          )}
                        </span>
                      )}
                      {commandPreview.type === 'delete' && commandPreview.parsed.condition && (
                        <span>Delete rows where <strong>{commandPreview.parsed.condition.column}</strong> {commandPreview.parsed.condition.operator} {String(commandPreview.parsed.condition.value)}</span>
                      )}
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      Press Enter to run
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Parse Error - shows helpful suggestions */}
              {mode === 'ai' && commandError && !aiResponse && (
                <motion.div
                  className="px-4 py-2"
                  style={{
                    backgroundColor: 'var(--error-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <div className="text-xs" style={{ color: 'var(--error)' }}>
                    {commandError}
                  </div>
                </motion.div>
              )}

              {/* AI Response */}
              {mode === 'ai' && (aiResponse || isAILoading) && (
                <div
                  className="px-4 py-3"
                  style={{
                    backgroundColor: 'var(--surface-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 sticky top-0"
                      style={{ backgroundColor: 'var(--info-subtle)', color: 'var(--info)' }}
                    >
                      AI
                    </span>
                    <div className="flex-1 min-w-0">
                      {isAILoading && !aiResponse && (
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: 'var(--info)' }}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            Thinking...
                          </span>
                        </div>
                      )}
                      {aiResponse && (
                        <div
                          className="text-sm whitespace-pre-wrap"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {aiResponse}
                          {isAILoading && (
                            <motion.span
                              className="inline-block w-1.5 h-4 ml-0.5"
                              style={{ backgroundColor: 'var(--info)' }}
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Suggested command action */}
                  {suggestedCommand && (
                    <motion.div
                      className="mt-3"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {/* SQL badge with auto-execute status */}
                      {isSuggestedSQL && (
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-medium"
                            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                          >
                            SQL Query
                          </span>
                          {isAutoExecuting ? (
                            <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--info)' }}>
                              <motion.span
                                className="w-2 h-2 border border-t-transparent rounded-full inline-block"
                                style={{ borderColor: 'var(--info)', borderTopColor: 'transparent' }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                              />
                              {retryCount > 0 ? `Retrying (${retryCount}/${MAX_RETRIES})...` : 'Executing...'}
                            </span>
                          ) : autoExecuteError && retryCount >= MAX_RETRIES ? (
                            <span className="text-[10px]" style={{ color: 'var(--error)' }}>
                              Failed after {MAX_RETRIES} retries
                            </span>
                          ) : (
                            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                              {validateSQL ? 'Auto-executing...' : 'Ready to run'}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <code
                          className="flex-1 px-3 py-2 rounded text-sm font-mono whitespace-pre-wrap"
                          style={{
                            backgroundColor: 'var(--surface-primary)',
                            color: autoExecuteError && retryCount >= MAX_RETRIES ? 'var(--error)' : accentColor,
                            border: `1px solid ${autoExecuteError && retryCount >= MAX_RETRIES ? 'var(--error)' : 'var(--border-subtle)'}`,
                            maxHeight: isSuggestedSQL ? '150px' : 'auto',
                            overflowY: isSuggestedSQL ? 'auto' : 'visible',
                            display: 'block',
                          }}
                        >
                          {suggestedCommand}
                        </code>
                        <motion.button
                          className="px-3 py-2 rounded text-sm font-medium flex-shrink-0"
                          style={{
                            backgroundColor: isAutoExecuting ? 'var(--surface-tertiary)' : accentColor,
                            color: isAutoExecuting ? 'var(--text-tertiary)' : 'white',
                          }}
                          onClick={executeSuggestedCommand}
                          disabled={isAutoExecuting || isAILoading}
                          whileHover={!isAutoExecuting ? { scale: 1.02 } : {}}
                          whileTap={!isAutoExecuting ? { scale: 0.98 } : {}}
                        >
                          {isAutoExecuting ? 'Running...' : 'Run'}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {suggestedCommand && !isAILoading && !isAutoExecuting && (
                    <div className="mt-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      Press <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-primary)' }}>Enter</kbd> to run
                    </div>
                  )}
                </div>
              )}

              {/* Smart suggestions from AI - only in AI mode */}
              {mode === 'ai' && !aiResponse && !isAILoading && input.length === 0 && (
                <div className="px-4 py-3">
                  {isLoadingSuggestions ? (
                    <div className="flex items-center gap-2">
                      <motion.div
                        className="w-3 h-3 border-2 rounded-full"
                        style={{ borderColor: 'var(--border-subtle)', borderTopColor: accentColor }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        Analyzing your data...
                      </span>
                    </div>
                  ) : smartSuggestions.length > 0 ? (
                    <>
                      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        Try asking
                      </div>
                      <div className="space-y-1">
                        {smartSuggestions.map((suggestion, idx) => (
                          <motion.button
                            key={idx}
                            onClick={() => { setInput(suggestion); askAI(suggestion); setSelectedIndex(-1); }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                            style={{
                              color: 'var(--text-secondary)',
                              backgroundColor: selectedIndex === idx ? 'var(--surface-secondary)' : 'transparent',
                            }}
                            whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                          >
                            <span className="flex items-center gap-2">
                              {selectedIndex === idx && (
                                <span style={{ color: accentColor }}>→</span>
                              )}
                              <span>{suggestion}</span>
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </>
                  ) : !anthropicApiKey ? (
                    <div className="space-y-3">
                      {keyValidationSuccess ? (
                        <motion.div
                          className="flex items-center gap-2 text-sm"
                          style={{ color: 'var(--success)' }}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <span>✓</span>
                          <span>API key saved! You can now use AI features.</span>
                        </motion.div>
                      ) : (
                        <>
                          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            Enter your Anthropic API key to enable AI features
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={apiKeyInput}
                              onChange={(e) => {
                                setApiKeyInput(e.target.value);
                                setKeyValidationError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && apiKeyInput.trim()) {
                                  e.preventDefault();
                                  handleApiKeySubmit();
                                }
                              }}
                              placeholder="sk-ant-..."
                              className="flex-1 px-3 py-2 rounded-md text-sm bg-transparent outline-none"
                              style={{
                                border: `1px solid ${keyValidationError ? 'var(--error)' : 'var(--border-default)'}`,
                                color: 'var(--text-primary)',
                              }}
                              disabled={isValidatingKey}
                            />
                            <motion.button
                              onClick={handleApiKeySubmit}
                              disabled={!apiKeyInput.trim() || isValidatingKey}
                              className="px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: apiKeyInput.trim() ? accentColor : 'var(--surface-tertiary)',
                                color: apiKeyInput.trim() ? 'white' : 'var(--text-tertiary)',
                                opacity: isValidatingKey ? 0.7 : 1,
                              }}
                              whileHover={apiKeyInput.trim() ? { scale: 1.02 } : {}}
                              whileTap={apiKeyInput.trim() ? { scale: 0.98 } : {}}
                            >
                              {isValidatingKey ? (
                                <span className="flex items-center gap-2">
                                  <motion.span
                                    className="w-3 h-3 border-2 border-t-transparent rounded-full inline-block"
                                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'transparent' }}
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                  />
                                  Validating...
                                </span>
                              ) : (
                                'Save Key'
                              )}
                            </motion.button>
                          </div>
                          {keyValidationError && (
                            <motion.div
                              className="text-xs"
                              style={{ color: 'var(--error)' }}
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              {keyValidationError}
                            </motion.div>
                          )}
                          <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                            Get your API key from{' '}
                            <a
                              href="https://console.anthropic.com/settings/keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:no-underline"
                              style={{ color: accentColor }}
                            >
                              console.anthropic.com
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* SQL Mode hints */}
              {mode === 'sql' && input.length === 0 && (
                <div className="px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Quick Examples
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { label: 'Select all', sql: `SELECT * FROM "${viewName}" LIMIT 100` },
                      { label: 'Count rows', sql: `SELECT COUNT(*) FROM "${viewName}"` },
                      { label: 'Group by', sql: `SELECT column, COUNT(*) FROM "${viewName}" GROUP BY column` },
                    ].map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInput(example.sql)}
                        className="text-left px-2 py-1.5 rounded text-xs transition-colors"
                        style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
                      >
                        <span className="font-medium">{example.label}:</span>{' '}
                        <code className="font-mono text-[10px]" style={{ color: accentColor }}>{example.sql}</code>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span>Schema columns:</span>
                    <div className="flex flex-wrap gap-1">
                      {schema.filter(c => c.name !== '_rowid').slice(0, 5).map((col) => (
                        <code
                          key={col.name}
                          className="px-1 py-0.5 rounded font-mono"
                          style={{ backgroundColor: 'var(--surface-secondary)' }}
                        >
                          {col.name}
                        </code>
                      ))}
                      {schema.filter(c => c.name !== '_rowid').length > 5 && (
                        <span>+{schema.filter(c => c.name !== '_rowid').length - 5} more</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div
                className="flex items-center justify-between px-4 py-2 text-[10px]"
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-secondary)',
                  color: 'var(--text-tertiary)',
                }}
              >
                <div className="flex items-center gap-4">
                  {mode === 'ai' && (
                    <>
                      <span>
                        <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>↑↓</kbd> navigate
                      </span>
                      <span>
                        <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>Enter</kbd> send
                      </span>
                      <span>
                        <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>Tab</kbd> SQL
                      </span>
                      <span>
                        <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>Esc</kbd> close
                      </span>
                    </>
                  )}
                  {mode === 'sql' && (
                    <>
                      <span>
                        <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                        </kbd> run
                      </span>
                      <span>
                        <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>Esc</kbd> back
                      </span>
                    </>
                  )}
                </div>
                <span>{totalRows.toLocaleString()} rows</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default FloatingAICommand;
