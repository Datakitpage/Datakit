import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import Editor, { OnMount, useMonaco } from "@monaco-editor/react";
import { useDuckDBStore } from "@/store/duckDBStore";
import { format } from "sql-formatter";

import { DUCKDB_FUNCTIONS, SQL_KEYWORDS, SQL_SNIPPETS } from "./constants";

interface DatabaseObject {
  name: string;
  type: "table" | "view";
  columns: string[];
  database?: string;
  source: "local" | "motherduck";
}

interface MonacoEditorProps {
  /** Current query/code value */
  value: string;
  /** Callback when the content changes */
  onChange: (value: string) => void;
  /** Callback to execute the query/code */
  onExecute?: () => void;
  /** Editor language (default: 'sql') */
  language?: string;
  /** Editor height (default: '100%') */
  height?: string | number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Additional class names */
  className?: string;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  onExecute,
  language = "sql",
  height = "100%",
  minHeight,
  maxHeight,
  className = "",
}) => {
  const {
    getAvailableTables,
    registeredTables,
    executeQuery,
    getObjectType,
    lastTableRefresh,
    motherDuckConnected,
    motherDuckSchemas,
    executeMotherDuckQuery,
  } = useDuckDBStore();

  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const schemaLoadedRef = useRef<string>("");

  // Include MotherDuck schemas in dependency key
  const schemaDependencyKey = useMemo(() => {
    const tableNames = getAvailableTables().sort().join(",");
    const registeredKeys = Array.from(registeredTables.keys()).sort().join(",");
    const motherDuckKeys = Array.from(motherDuckSchemas.entries())
      .map(([db, schemas]) => `${db}:${schemas.map((s) => s.name).join(",")}`)
      .join(";");
    return `${tableNames}-${registeredKeys}-${lastTableRefresh}-${motherDuckKeys}`;
  }, [
    getAvailableTables,
    registeredTables,
    lastTableRefresh,
    motherDuckSchemas,
  ]);

  const formatSql = useCallback(() => {
    if (!editorRef.current) return;

    try {
      const formatted = format(editorRef.current.getValue(), {
        language: "sql",
        keywordCase: "upper",
        indentStyle: "standard",
        logicalOperatorNewline: "before",
      });

      editorRef.current.setValue(formatted);
    } catch (err) {
      console.error("Error formatting SQL:", err);
    }
  }, []);

  const loadSchemaData = useCallback(async () => {
    if (!monaco) return null;

    try {
      console.log("[MonacoEditor] Loading schema data...");
      const validObjects: DatabaseObject[] = [];

      // Load local tables
      const objectNames = getAvailableTables();
      const localObjectPromises = objectNames.map(async (objectName) => {
        try {
          const objectType = await getObjectType(objectName);
          const result = await executeQuery(`DESCRIBE "${objectName}"`);

          if (result && objectType) {
            const columns = result
              .toArray()
              .map((row) => row.column_name || row.name || "");

            return {
              name: objectName,
              type: objectType,
              columns,
              source: "local" as const,
            };
          }
        } catch (err) {
          console.warn(
            `[MonacoEditor] Failed to load schema for ${objectName}:`,
            err
          );
        }
        return null;
      });

      const localResults = await Promise.all(localObjectPromises);
      validObjects.push(
        ...localResults.filter((obj): obj is DatabaseObject => obj !== null)
      );

      // Load MotherDuck tables if connected
      if (motherDuckConnected) {
        console.log("[MonacoEditor] Loading MotherDuck schemas...");

        for (const [database, schemas] of motherDuckSchemas.entries()) {
          for (const schema of schemas) {
            try {
              // Try to get columns for MotherDuck tables
              const result = await executeMotherDuckQuery(
                `DESCRIBE "${database}"."${schema.name}"`,
                database
              );

              if (result && Array.isArray(result)) {
                const columns = result.map(
                  (row: any) => row.column_name || row.name || ""
                );

                validObjects.push({
                  name: schema.name,
                  type: schema.type as "table" | "view",
                  columns,
                  database,
                  source: "motherduck",
                });
              }
            } catch (err) {
              // If we can't get columns, still add the table without columns
              console.warn(
                `[MonacoEditor] Failed to load columns for ${database}.${schema.name}, adding without columns`
              );
              validObjects.push({
                name: schema.name,
                type: schema.type as "table" | "view",
                columns: [],
                database,
                source: "motherduck",
              });
            }
          }
        }
      }

      console.log("[MonacoEditor] Loaded schema data:", {
        total: validObjects.length,
        local: validObjects.filter((o) => o.source === "local").length,
        motherduck: validObjects.filter((o) => o.source === "motherduck")
          .length,
        tables: validObjects.filter((o) => o.type === "table").length,
        views: validObjects.filter((o) => o.type === "view").length,
      });

      return { objects: validObjects };
    } catch (err) {
      console.error("[MonacoEditor] Error loading schema data:", err);
      return { objects: [] };
    }
  }, [
    monaco,
    getAvailableTables,
    getObjectType,
    executeQuery,
    motherDuckConnected,
    motherDuckSchemas,
    executeMotherDuckQuery,
  ]);

  const registerLanguageProviders = useCallback(
    (schema: { objects: DatabaseObject[] }) => {
      if (!monaco) return;

      // Register completionItemProvider
      const completionDisposable =
        monaco.languages.registerCompletionItemProvider("sql", {
          triggerCharacters: [" ", ".", '"', "'"],
          provideCompletionItems: (model, position) => {
            const textUntilPosition = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });

            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            // Base suggestions array
            const suggestions: any[] = [];

            // Add SQL keywords
            SQL_KEYWORDS.forEach((keyword) => {
              suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                range,
              });
            });

            // Add DuckDB functions
            DUCKDB_FUNCTIONS.forEach((func) => {
              suggestions.push({
                label: func,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: func,
                range,
              });
            });

            // Add SQL snippets
            SQL_SNIPPETS.forEach((snippet) => {
              suggestions.push({
                ...snippet,
                range,
              });
            });

            // Check if we're after a database name (for MotherDuck)
            const dbMatch = textUntilPosition.match(/"([^"]+)"\s*\.\s*$/);
            if (dbMatch) {
              const databaseName = dbMatch[1];
              // Show only tables from this database
              schema.objects
                .filter((obj) => obj.database === databaseName)
                .forEach((obj) => {
                  const kind =
                    obj.type === "view"
                      ? monaco.languages.CompletionItemKind.Interface
                      : monaco.languages.CompletionItemKind.Class;

                  suggestions.push({
                    label: obj.name,
                    kind: kind,
                    insertText: `"${obj.name}"`,
                    range,
                    detail: `${obj.type} in ${databaseName}`,
                    documentation:
                      obj.columns.length > 0
                        ? `Columns: ${obj.columns.join(", ")}`
                        : "Columns not loaded",
                  });
                });
            } else {
              // Add all tables/views with appropriate formatting
              schema.objects.forEach((obj) => {
                const kind =
                  obj.type === "view"
                    ? monaco.languages.CompletionItemKind.Interface
                    : monaco.languages.CompletionItemKind.Class;

                const detail =
                  obj.source === "motherduck"
                    ? `${obj.type} (${obj.database})`
                    : `${obj.type} (local)`;

                const insertText =
                  obj.source === "motherduck" && obj.database
                    ? `"${obj.database}"."${obj.name}"`
                    : `"${obj.name}"`;

                suggestions.push({
                  label:
                    obj.source === "motherduck"
                      ? `${obj.database}.${obj.name}`
                      : obj.name,
                  kind: kind,
                  insertText: insertText,
                  range,
                  detail: detail,
                  documentation:
                    obj.columns.length > 0
                      ? `Columns: ${obj.columns.join(", ")}`
                      : "Columns not loaded",
                  sortText:
                    obj.source === "local"
                      ? `0_${obj.name}`
                      : `1_${obj.database}_${obj.name}`,
                });
              });
            }

            // Column suggestions after table reference
            const patterns = [
              // Pattern 1: FROM "database"."table" alias
              /FROM\s+"([^"]+)"\."([^"]+)"\s+(?:AS\s+)?([a-zA-Z_]\w*)?\s*$/i,
              // Pattern 2: FROM "table" alias (local tables)
              /FROM\s+"([^"]+)"\s+(?:AS\s+)?([a-zA-Z_]\w*)?\s*$/i,
              // Pattern 3: JOIN patterns
              /JOIN\s+"([^"]+)"\."([^"]+)"\s+(?:AS\s+)?([a-zA-Z_]\w*)?\s*$/i,
              /JOIN\s+"([^"]+)"\s+(?:AS\s+)?([a-zA-Z_]\w*)?\s*$/i,
            ];

            for (const pattern of patterns) {
              const match = textUntilPosition.match(pattern);
              if (match) {
                let dbObject: DatabaseObject | undefined;
                let alias: string | undefined;

                if (match.length === 4 && match[2]) {
                  // Database.table pattern
                  const [, database, table, tableAlias] = match;
                  dbObject = schema.objects.find(
                    (obj) => obj.database === database && obj.name === table
                  );
                  alias = tableAlias;
                } else if (match.length === 3) {
                  // Local table pattern
                  const [, table, tableAlias] = match;
                  dbObject = schema.objects.find(
                    (obj) => obj.source === "local" && obj.name === table
                  );
                  alias = tableAlias;
                }

                // Check if we're typing after alias.
                if (alias && textUntilPosition.endsWith(`${alias}.`)) {
                  if (dbObject && dbObject.columns.length > 0) {
                    dbObject.columns.forEach((column) => {
                      suggestions.push({
                        label: column,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: `"${column}"`,
                        range,
                        detail: `Column from ${dbObject.name}`,
                      });
                    });
                  }
                }
              }
            }

            return { suggestions };
          },
        });

      const hoverDisposable = monaco.languages.registerHoverProvider("sql", {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          const wordText = word.word.toLowerCase();

          // Check for database.table pattern
          const line = model.getLineContent(position.lineNumber);
          const beforeWord = line.substring(0, word.startColumn - 1);
          const afterWord = line.substring(word.endColumn - 1);

          let dbObject: DatabaseObject | undefined;

          // Check if we're hovering over a database name
          if (afterWord.match(/^\s*\.\s*"/)) {
            const tables = schema.objects.filter(
              (obj) => obj.database?.toLowerCase() === wordText
            );
            if (tables.length > 0) {
              return {
                contents: [
                  { value: `**${wordText}** (MotherDuck Database)` },
                  {
                    value: `Tables: ${
                      tables.filter((t) => t.type === "table").length
                    }`,
                  },
                  {
                    value: `Views: ${
                      tables.filter((t) => t.type === "view").length
                    }`,
                  },
                ],
              };
            }
          }

          // Check if it's a table/view name
          dbObject = schema.objects.find(
            (obj) => obj.name.toLowerCase() === wordText
          );

          if (dbObject) {
            const typeLabel = dbObject.type === "view" ? "View" : "Table";
            const location =
              dbObject.source === "motherduck"
                ? `MotherDuck (${dbObject.database})`
                : "Local";

            return {
              contents: [
                { value: `**${dbObject.name}** (${typeLabel})` },
                { value: `Location: ${location}` },
                {
                  value:
                    dbObject.columns.length > 0
                      ? `Columns: ${dbObject.columns.join(", ")}`
                      : "Columns not loaded",
                },
              ],
            };
          }

          // Check if it's a SQL keyword
          if (SQL_KEYWORDS.some((k) => k.toLowerCase() === wordText)) {
            const keyword = SQL_KEYWORDS.find(
              (k) => k.toLowerCase() === wordText
            );

            const keywordDocs: Record<string, string> = {
              select: "Retrieves data from one or more tables or views",
              from: "Specifies the table(s) or view(s) to query",
              where: "Filters rows based on a condition",
              join: "Combines rows from two or more tables or views",
              "group by": "Groups rows that have the same values",
              having: "Filters groups based on a condition",
              "order by": "Sorts the result set",
              limit: "Limits the number of rows returned",
              "create view":
                "Creates a virtual table based on a SELECT statement",
              "drop view": "Removes a view from the database",
            };

            return {
              contents: [
                { value: `**${keyword}**` },
                { value: keywordDocs[wordText] || "SQL keyword" },
              ],
            };
          }

          // Check if it's a DuckDB function
          if (DUCKDB_FUNCTIONS.some((f) => f.toLowerCase() === wordText)) {
            const func = DUCKDB_FUNCTIONS.find(
              (f) => f.toLowerCase() === wordText
            );

            return {
              contents: [
                { value: `**${func}**` },
                { value: "DuckDB SQL function" },
              ],
            };
          }

          return null;
        },
      });

      // Store disposables for cleanup if needed
      return () => {
        completionDisposable.dispose();
        hoverDisposable.dispose();
      };
    },
    [monaco]
  );

  // Only load schema and register providers when dependencies actually change and language is SQL
  useEffect(() => {
    if (!monaco || schemaDependencyKey === schemaLoadedRef.current || language !== "sql") {
      return;
    }

    schemaLoadedRef.current = schemaDependencyKey;

    loadSchemaData().then((schema) => {
      if (schema) {
        registerLanguageProviders(schema);
      }
    });
  }, [schemaDependencyKey, monaco, language, loadSchemaData, registerLanguageProviders]);

  // Cleanup auto-height disposables on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current && (editorRef.current as any)._autoHeightDisposables) {
        (editorRef.current as any)._autoHeightDisposables.forEach((disposable: any) => {
          disposable.dispose();
        });
      }
    };
  }, []);

  // Handle editor mount
  const handleEditorDidMount: OnMount = useCallback(
    (editor, monacoInstance) => {
      editorRef.current = editor;

      // Add keyboard shortcut for execution (works for both SQL and Python)
      const executionLabel = language === "sql" ? "Execute Query" : "Execute Code";
      editor.addAction({
        id: 'execute-code',
        label: executionLabel,
        keybindings: [
          monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter
        ],
        run: () => {
          if (onExecute) onExecute();
        }
      });

      // Add SQL-specific shortcuts only for SQL language
      if (language === "sql") {
        // Add keyboard shortcut for SQL formatting
        editor.addCommand(
          monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF,
          () => {
            formatSql();
          }
        );

        // Add context menu for formatting
        editor.addAction({
          id: "format-sql",
          label: "Format SQL",
          keybindings: [monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF],
          contextMenuGroupId: "modification",
          run: formatSql,
        });
      }

      // Auto-height functionality when height is "auto"
      if (height === "auto") {
        let updateTimeoutId: NodeJS.Timeout;
        
        const updateHeight = () => {
          clearTimeout(updateTimeoutId);
          updateTimeoutId = setTimeout(() => {
            const model = editor.getModel();
            if (!model) return;

            const lineCount = model.getLineCount();
            const lineHeight = editor.getOption(monacoInstance.editor.EditorOption.lineHeight);
            
            // Calculate content height
            const contentHeight = lineCount * lineHeight;
            const padding = 10; // Small padding
            const calculatedHeight = Math.max(
              contentHeight + padding,
              minHeight || 80
            );
            
            const finalHeight = maxHeight 
              ? Math.min(calculatedHeight, maxHeight)
              : calculatedHeight;

            // Get container
            const container = editor.getContainerDomNode();
            if (container && container.parentElement) {
              // Update container height
              container.style.height = `${finalHeight}px`;
              container.parentElement.style.height = `${finalHeight}px`;
              
              // Layout editor
              editor.layout();
            }
          }, 10);
        };

        // Listen for content changes
        const disposable = editor.onDidChangeModelContent(updateHeight);
        
        // Initial update
        updateHeight();

        // Store disposable for cleanup
        (window as any).editorDisposable = disposable;
      }
    },
    [onExecute, formatSql, language, height, minHeight, maxHeight]
  );

  // For auto height, start with minHeight and let JS update it
  const effectiveHeight = height === "auto" ? `${minHeight || 80}px` : height;

  return (
    <div className={`${height === "auto" ? "" : "h-full"} ${className}`}>
      <Editor
        height={effectiveHeight}
        defaultLanguage={language}
        defaultValue={value}
        value={value}
        onChange={(value) => onChange(value || "")}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          wrappingIndent: "indent",
          automaticLayout: true,
          tabSize: 2,
          fontSize: 14,
          fontFamily: "JetBrains Mono, monospace",
          insertSpaces: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
          glyphMargin: false,
          folding: true,
          contextmenu: true,
          quickSuggestions: true,
          suggest: {
            showKeywords: true,
            showSnippets: true,
            preview: true,
          },
          parameterHints: {
            enabled: true,
          },
          formatOnPaste: true,
          formatOnType: false,
          lineNumbers: "on",
          lineDecorationsWidth: 10,
          renderWhitespace: "selection",
          bracketPairColorization: {
            enabled: true,
          },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          // Auto-height specific options
          scrollbar: {
            vertical: height === "auto" ? "hidden" : "auto",
            horizontal: "auto",
            alwaysConsumeMouseWheel: false,
          },
          overviewRulerLanes: height === "auto" ? 0 : 3,
          // Ensure the editor doesn't scroll vertically when auto-height
          scrollBeyondLastLine: height === "auto" ? false : false,
          fixedOverflowWidgets: height === "auto" ? true : false,
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default MonacoEditor;
