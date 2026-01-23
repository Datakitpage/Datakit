import { lazy, Suspense, useCallback, useEffect, useRef, useMemo } from 'react';
import type { OnMount, BeforeMount } from '@monaco-editor/react';
import type { editor, languages, IDisposable, Position } from 'monaco-editor';
import type * as Monaco from 'monaco-editor';
import type { ColumnSchema } from '@/store/duckDBViewStore';

// Lazy load Monaco Editor
const Editor = lazy(() => import('@monaco-editor/react'));

// SQL keywords for autocomplete
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'ILIKE',
  'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON', 'JOIN', 'INNER', 'LEFT', 'RIGHT',
  'OUTER', 'FULL', 'CROSS', 'NATURAL', 'USING', 'GROUP', 'BY', 'HAVING', 'ORDER',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
  'INTERSECT', 'EXCEPT', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'CAST', 'COALESCE', 'NULLIF', 'EXISTS', 'ANY', 'SOME', 'WITH', 'RECURSIVE',
  'UPDATE', 'SET', 'DELETE', 'INSERT', 'INTO', 'VALUES', 'DEFAULT', 'RETURNING',
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'CONSTRAINT', 'PRIMARY',
  'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'OVER', 'PARTITION',
  'WINDOW', 'ROWS', 'RANGE', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT',
  'ROW', 'QUALIFY', 'EXCLUDE', 'FILTER', 'WITHIN', 'STRUCT', 'LIST', 'MAP',
];

// DuckDB functions for autocomplete
const SQL_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST', 'LIST', 'STRING_AGG',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE',
  'LAST_VALUE', 'NTH_VALUE', 'PERCENT_RANK', 'CUME_DIST',
  'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'SUBSTRING', 'LENGTH',
  'CONCAT', 'CONCAT_WS', 'SPLIT_PART', 'REGEXP_EXTRACT', 'REGEXP_REPLACE',
  'ABS', 'CEIL', 'FLOOR', 'ROUND', 'TRUNC', 'MOD', 'POWER', 'SQRT', 'LOG', 'LN',
  'EXP', 'SIGN', 'RANDOM', 'GREATEST', 'LEAST',
  'DATE_TRUNC', 'DATE_PART', 'DATE_DIFF', 'DATE_ADD', 'DATE_SUB', 'EXTRACT',
  'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'NOW', 'CURRENT_DATE',
  'CURRENT_TIMESTAMP', 'EPOCH', 'STRFTIME', 'STRPTIME',
  'COALESCE', 'NULLIF', 'IFNULL', 'IF', 'TRY_CAST', 'TYPEOF',
  'ARRAY_AGG', 'UNNEST', 'GENERATE_SERIES', 'RANGE', 'JSON_EXTRACT',
];

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onClose: () => void;
  onSwitchMode?: () => void;  // Switch to AI mode (Escape key)
  schema: ColumnSchema[];
  viewName: string;
  isDark: boolean;
  minHeight?: string | number;
  maxHeight?: string | number;
}

// Loading placeholder
function EditorLoading() {
  return (
    <div
      className="flex items-center justify-center w-full"
      style={{
        height: '80px',
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

export function SQLEditor({
  value,
  onChange,
  onExecute,
  onClose,
  onSwitchMode,
  schema,
  viewName,
  isDark,
  minHeight = '80px',
  maxHeight = '250px',
}: SQLEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const completionDisposable = useRef<IDisposable | null>(null);

  // Use refs to avoid stale closures in Monaco command handlers
  const onExecuteRef = useRef(onExecute);
  const onCloseRef = useRef(onClose);
  const onSwitchModeRef = useRef(onSwitchMode);

  // Keep refs updated
  useEffect(() => {
    onExecuteRef.current = onExecute;
  }, [onExecute]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onSwitchModeRef.current = onSwitchMode;
  }, [onSwitchMode]);

  // Create column suggestions from schema
  const columnSuggestions = useMemo(() => {
    return schema
      .filter(col => col.name !== '_rowid')
      .map(col => ({
        label: col.name,
        kind: 5, // Field
        insertText: `"${col.name}"`,
        detail: col.type,
        documentation: `Column: ${col.name} (${col.type})`,
      }));
  }, [schema]);

  // Configure Monaco before mount
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco;

    // Define custom DuckDB SQL theme (dark)
    monaco.editor.defineTheme('duckdb-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'comment', foreground: '6a9955' },
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'delimiter', foreground: 'd4d4d4' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'function', foreground: 'dcdcaa' },
      ],
      colors: {
        'editor.background': '#1a1a1a',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editorCursor.foreground': '#aeafad',
        'editor.lineHighlightBackground': '#2a2d2e',
      },
    });

    // Define custom DuckDB SQL theme (light)
    monaco.editor.defineTheme('duckdb-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'af00db' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '098658' },
        { token: 'comment', foreground: '008000' },
        { token: 'operator', foreground: '000000' },
        { token: 'delimiter', foreground: '000000' },
        { token: 'type', foreground: '267f99' },
        { token: 'function', foreground: '795e26' },
      ],
      colors: {
        'editor.background': '#fafafa',
        'editor.foreground': '#1a1a1a',
        'editorLineNumber.foreground': '#999999',
        'editorLineNumber.activeForeground': '#333333',
        'editor.selectionBackground': '#add6ff',
        'editor.inactiveSelectionBackground': '#e5ebf1',
        'editorCursor.foreground': '#000000',
        'editor.lineHighlightBackground': '#f0f0f0',
      },
    });
  }, []);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Focus the editor
    editor.focus();

    // Add keyboard shortcuts - use refs to avoid stale closures
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecuteRef.current();
    });

    // Escape switches to AI mode (if handler provided), otherwise closes
    editor.addCommand(monaco.KeyCode.Escape, () => {
      if (onSwitchModeRef.current) {
        onSwitchModeRef.current();
      } else {
        onCloseRef.current();
      }
    });

    // Shift+Tab also switches mode (alternative to Tab which is used for indentation)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => {
      if (onSwitchModeRef.current) {
        onSwitchModeRef.current();
      }
    });

    // Register completion provider for SQL with schema awareness
    completionDisposable.current = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: Monaco.editor.ITextModel, position: Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: languages.CompletionItem[] = [
          // Table name
          {
            label: viewName,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `"${viewName}"`,
            detail: 'Current table',
            documentation: `Table: ${viewName}`,
            range,
          },
          // SQL Keywords
          ...SQL_KEYWORDS.map(keyword => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range,
          })),
          // SQL Functions
          ...SQL_FUNCTIONS.map(func => ({
            label: func,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${func}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Function',
            range,
          })),
          // Columns from schema
          ...columnSuggestions.map(col => ({
            ...col,
            kind: monaco.languages.CompletionItemKind.Field,
            range,
          })),
        ];

        return { suggestions };
      },
      triggerCharacters: ['.', '"', ' '],
    });

    // Auto-resize based on content
    const updateHeight = () => {
      const contentHeight = Math.min(
        parseInt(String(maxHeight)) || 250,
        Math.max(parseInt(String(minHeight)) || 80, editor.getContentHeight())
      );
      const containerElement = editor.getContainerDomNode();
      if (containerElement) {
        containerElement.style.height = `${contentHeight}px`;
        editor.layout();
      }
    };

    editor.onDidContentSizeChange(updateHeight);
    updateHeight();
  }, [viewName, columnSuggestions, minHeight, maxHeight]);

  // Clean up completion provider on unmount
  useEffect(() => {
    return () => {
      if (completionDisposable.current) {
        completionDisposable.current.dispose();
      }
    };
  }, []);

  // Update theme when dark mode changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      monacoRef.current.editor.setTheme(isDark ? 'duckdb-dark' : 'duckdb-light');
    }
  }, [isDark]);

  return (
    <Suspense fallback={<EditorLoading />}>
      <div
        className="rounded-md overflow-hidden"
        style={{
          border: '1px solid var(--border-subtle)',
          minHeight,
          maxHeight,
        }}
      >
        <Editor
          defaultLanguage="sql"
          value={value}
          onChange={(newValue) => onChange(newValue || '')}
          onMount={handleEditorMount}
          beforeMount={handleBeforeMount}
          theme={isDark ? 'duckdb-dark' : 'duckdb-light'}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 8,
            lineHeight: 20,
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            tabSize: 2,
            automaticLayout: true,
            wordWrap: 'on',
            wrappingStrategy: 'advanced',
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'line',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'hidden',
              verticalScrollbarSize: 8,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'off',
            parameterHints: { enabled: true },
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
            contextmenu: false,
            // Fix: render widgets (autocomplete, etc) as fixed position in body
            // so they can overflow the editor container
            fixedOverflowWidgets: true,
            // Customize suggest widget
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showClasses: true,
              showFunctions: true,
              showFields: true,
              preview: true,
              filterGraceful: true,
              localityBonus: true,
            },
          }}
          loading={<EditorLoading />}
        />
      </div>
    </Suspense>
  );
}

export default SQLEditor;
