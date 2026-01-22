# AI System Documentation

This directory contains the AI-powered functionality for OpenSheet, including natural language command processing, SQL generation, and intelligent data assistance.

## Architecture Overview

```
src/lib/ai/
├── anthropic.ts       # Core Anthropic API integration
├── parseAICommand.ts  # Local command parsing (no API calls)
├── dataCommands.ts    # Natural language to SQL conversion
├── index.ts           # Public exports
└── README.md          # This file
```

## Module Breakdown

### 1. anthropic.ts - Anthropic API Integration

The core module for interacting with Claude models via the Anthropic API.

**Models:**
- `HAIKU` (`claude-3-5-haiku-20241022`) - Fast, low-latency responses for command parsing and quick interactions
- `SONNET` (`claude-sonnet-4-20250514`) - Higher quality for complex analysis and SQL generation

**Key Functions:**

| Function | Model | Purpose |
|----------|-------|---------|
| `validateApiKey(apiKey)` | HAIKU | Validate an Anthropic API key |
| `chat(apiKey, messages, schema, tableName, sampleData)` | SONNET | General chat with schema awareness |
| `generateAutoDashboard(apiKey, schema, tableName, sampleData)` | SONNET | Auto-generate dashboard widgets |
| `streamCommandAssistant(apiKey, message, context, onChunk, onComplete, onError)` | HAIKU | Streaming data command assistance |
| `askCommandAssistant(apiKey, message, context)` | HAIKU | Non-streaming command assistance |
| `generateSmartSuggestions(apiKey, context)` | HAIKU | Generate contextual suggestions based on schema |
| `streamGlobalAssistant(apiKey, message, context, onChunk, onComplete, onError)` | HAIKU | Streaming workspace-level assistance |
| `askGlobalAssistant(apiKey, message, context)` | HAIKU | Non-streaming workspace assistance |

**Context Types:**

```typescript
// For data-specific commands
interface CommandContext {
  schema: ColumnSchema[];
  totalRows: number;
  sampleData?: Record<string, unknown>[];
  currentFilters?: string;
  currentSort?: { column: string; direction: string };
}

// For global workspace queries
interface GlobalSearchContext {
  files: FileContext[];
  folders: { name: string; fileCount: number }[];
}
```

---

### 2. parseAICommand.ts - Local Command Parsing

Handles parsing natural language commands into structured objects **without making API calls**. This enables fast, offline-capable command processing for common operations.

**Key Functions:**

```typescript
// Main parser - returns ParseResult
parseAICommand(input: string, context: ParseContext): ParseResult

// Column matching utilities
findColumn(columnName: string, schema: ColumnSchema[], caseSensitive?: boolean): ColumnSchema | undefined
validateColumn(columnName: string, schema: ColumnSchema[]): { valid: boolean; canonicalName?: string; error?: string }

// Helpers
looksLikeCommand(input: string): boolean  // Quick check if input looks like a command
isWriteOperation(command: AICommand): boolean  // Check if command modifies data
getCommandPatterns(): { name: string; example: string; description: string }[]  // For help/documentation
```

**Supported Command Types:**

| Type | Examples | Write Op |
|------|----------|----------|
| `sort` | `sort by name desc` | No |
| `filter` | `filter price > 100` | No |
| `search` | `search keyword` | No |
| `limit` | `show first 10 rows`, `limit 50` | No |
| `page` | `go to page 5`, `page 3` | No |
| `reset` | `reset view`, `clear filters`, `show all` | No |
| `export` | `export as csv`, `export as json` | No |
| `theme` | `toggle theme` | No |
| `fill` | `fill empty status with 'pending'` | **Yes** |
| `update` | `update status to 'active' where id = 1` | **Yes** |
| `delete` | `delete where status = 'cancelled'` | **Yes** |

**ParseResult Structure:**

```typescript
interface ParseResult {
  success: boolean;
  command: AICommand | null;
  error?: string;
  matchedPattern?: string;
}

interface AICommand {
  type: CommandType;
  naturalLanguage: string;
  parsed: ParsedCommand;
  sql?: string;
  isWriteOperation?: boolean;
}
```

---

### 3. dataCommands.ts - Natural Language to SQL

Higher-level natural language processing for data operations. Uses pattern matching to convert conversational input into DuckDB SQL queries.

**Key Functions:**

```typescript
// Parse natural language into SQL command
parseNaturalLanguage(input: string, context: AICommandContext): AIDataCommand | null

// Generate preview of affected rows
generatePreview(command: AIDataCommand, executeQuery: Function, limit?: number): Promise<Record<string, unknown>[]>

// Validate SQL for safety
validateSQL(sql: string, allowedTable: string): { valid: boolean; error?: string }
```

**AIDataCommand Structure:**

```typescript
interface AIDataCommand {
  type: 'update' | 'delete' | 'filter' | 'sort' | 'transform' | 'compute';
  naturalLanguage: string;
  generatedSQL: string;
  affectedRowsEstimate: number;
  previewRows?: Record<string, unknown>[];
  confidence: number;  // 0-1 confidence score
  warnings: string[];  // User-facing warnings
}
```

**Pattern Categories:**

| Category | Example Phrases |
|----------|-----------------|
| Sort | "sort by price", "order by name desc" |
| Filter | "show rows where status = active", "filter price > 100", "find rows with null email" |
| Update | "set status to active", "change name from 'old' to 'new'", "update price to 99 where category = 'sale'" |
| Delete | "delete where status = cancelled", "remove rows with null email" |
| Transform | "convert name to uppercase", "trim column values" |

---

## Data Flow

### Command Processing Pipeline

```
User Input
    │
    ▼
┌─────────────────────┐
│ looksLikeCommand()  │  Quick check if it's a command
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ parseAICommand()    │  Try local pattern matching (fast, no API)
└─────────────────────┘
    │
    ├── Match found ─────► Return AICommand
    │
    ▼ No match
┌─────────────────────┐
│ parseNaturalLanguage│  Try more flexible NL patterns
└─────────────────────┘
    │
    ├── Match found ─────► Return AIDataCommand with SQL
    │
    ▼ No match
┌─────────────────────┐
│ askCommandAssistant │  Call Anthropic API for complex queries
└─────────────────────┘
    │
    ▼
Return AI response with suggested command
```

### Write Operation Safety

Write operations (`fill`, `update`, `delete`) follow a staged changes pattern:

1. **Parse**: Convert natural language to SQL
2. **Validate**: Validate SQL using DuckDB's `EXPLAIN` command
3. **Preview**: Show affected rows before execution
4. **Stage**: Record changes locally (not yet persisted)
5. **Review**: User reviews staged changes in Change Log
6. **Commit**: Apply all changes atomically

---

## SQL Validation

The system uses DuckDB's `EXPLAIN` command to validate SQL before execution:

```typescript
// In duckDBViewStore.ts
async function validateSQLWithDuckDB(sql: string): Promise<{
  valid: boolean;
  error?: string;
  suggestion?: string;
}> {
  try {
    await db.query(`EXPLAIN ${sql}`);
    return { valid: true };
  } catch (error) {
    // Parse error and provide suggestions
    return categorizeError(error);
  }
}
```

**Error Categories:**
- `syntax`: SQL syntax errors
- `schema`: Column/table not found
- `permission`: Operation not allowed
- `unknown`: Unrecognized errors

---

## Security Considerations

### API Key Handling
- API keys are stored in `settingsStore` (persisted via Zustand)
- Keys are validated before use
- Format check: must start with `sk-ant-`

### SQL Safety
- **Forbidden operations**: `DROP TABLE`, `TRUNCATE`, `ALTER TABLE`, `CREATE TABLE`, `GRANT`, `REVOKE`
- **Table restriction**: Operations can only modify the current view's table
- **WHERE clause warnings**: Updates/deletes without WHERE show warnings
- **Preview before execute**: Destructive operations show affected rows first

### SQL Type Detection

```typescript
// Detect if SQL is a read or write operation
function detectSQLType(sql: string): 'read' | 'write' {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') ||
      trimmed.startsWith('EXPLAIN') ||
      trimmed.startsWith('DESCRIBE') ||
      trimmed.startsWith('SHOW')) {
    return 'read';
  }
  return 'write';  // UPDATE, DELETE, INSERT, etc.
}
```

---

## Usage Examples

### Parsing a Command Locally

```typescript
import { parseAICommand } from '@/lib/ai';

const result = parseAICommand('sort by price desc', {
  schema: [{ name: 'price', type: 'DOUBLE' }, { name: 'name', type: 'VARCHAR' }]
});

if (result.success) {
  console.log(result.command.parsed);
  // { action: 'sort', column: 'price', direction: 'DESC' }
}
```

### Using the Command Assistant (Streaming)

```typescript
import { streamCommandAssistant } from '@/lib/ai';

await streamCommandAssistant(
  apiKey,
  'show me the top 10 most expensive products',
  {
    schema: columns,
    totalRows: 1000,
    sampleData: firstRows,
  },
  (chunk) => setResponse(prev => prev + chunk),  // onChunk
  (fullText) => processResponse(fullText),       // onComplete
  (error) => setError(error.message)             // onError
);
```

### Generating Smart Suggestions

```typescript
import { generateSmartSuggestions } from '@/lib/ai';

const suggestions = await generateSmartSuggestions(apiKey, {
  schema: columns,
  totalRows: 5000,
});
// Returns: ["Sort by highest revenue", "Find empty emails", "Filter active users", "Show recent orders"]
```

---

## Component Integration

### FloatingAICommand
- Uses `parseAICommand` for fast local parsing
- Falls back to streaming AI for complex queries
- Supports SQL mode for direct query input

### FocusedFileView
- Handles command execution
- Manages staged changes for write operations
- Provides undo/redo for view state

### AICommandBar (Global)
- Uses `streamGlobalAssistant` for workspace-level queries
- Provides file search and navigation suggestions

---

## Testing

Tests are located alongside the modules:

- `parseAICommand.test.ts` - Unit tests for local command parsing
- `FloatingAICommand.test.ts` - SQL type detection and command generation tests
- `duckDBViewStore.test.ts` - SQL validation tests

Run tests with:
```bash
bun test
```

---

## Complete AI to DuckDB Flow

This section documents the complete data flow from AI command input through to DuckDB execution, including the preview mechanism, version history, and all the hooks involved.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  FloatingAICommand.tsx                 FocusedFileView.tsx                  │
│  ├─ AI mode input                      ├─ Main file view                    │
│  ├─ SQL mode input                     ├─ CanvasDataTable (data display)    │
│  └─ Command suggestions                └─ ChangeLog (pending changes)       │
└────────────────┬──────────────────────────────────┬─────────────────────────┘
                 │                                  │
                 ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 HOOKS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  useAICommandExecution                 useDuckDBView                        │
│  ├─ execute(command, data)             ├─ loadFile, loadData                │
│  ├─ executeReadCommand()               ├─ queryView, refresh                │
│  ├─ executeWriteCommand()              ├─ editCell, deleteRow               │
│  └─ undoLastRead()                     ├─ undo, commit, discard             │
│                                        ├─ undoCommittedVersion              │
│  useCommandHistory                     ├─ redoCommittedVersion              │
│  ├─ add, pop, peek                     └─ addColumn                         │
│  └─ recent, filter                                                          │
│                                        useOperationFeedback                 │
│  useViewStateHistory                   ├─ showSuccess, showError            │
│  └─ undo/redo view state               └─ dismiss, dismissAll               │
└────────────────┬──────────────────────────────────┬─────────────────────────┘
                 │                                  │
                 ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 STORES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  duckDBViewStore (Zustand)                                                  │
│  ├─ db, connection (DuckDB WASM)                                            │
│  ├─ views: Map<string, ViewDefinition>                                      │
│  ├─ pendingChanges: Map<string, ChangeRecord[]>                             │
│  ├─ committedVersions: Map<string, CommittedVersion[]>                      │
│  └─ currentVersionIndex: Map<string, number>                                │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DuckDB WASM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  In-browser SQL database                                                    │
│  ├─ CREATE TABLE from uploaded files (CSV, JSON, Parquet)                   │
│  ├─ SELECT queries with pagination                                          │
│  ├─ UPDATE, DELETE for data modifications                                   │
│  └─ ALTER TABLE for schema changes (ADD COLUMN, DROP COLUMN)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Flow: AI Command to DuckDB

#### 1. User Input Stage

```typescript
// FloatingAICommand.tsx
// User types: "sort by price desc"

const handleSubmit = async (input: string) => {
  // 1. First try local parsing (fast, no API)
  const parseResult = parseAICommand(input, { schema });

  if (parseResult.success) {
    // 2. Execute the command
    onCommand?.(parseResult.command);
    return;
  }

  // 3. Fall back to AI assistance for complex queries
  await streamCommandAssistant(apiKey, input, context, ...callbacks);
};
```

#### 2. Command Parsing Stage

```typescript
// parseAICommand.ts
// Matches input against patterns without API calls

export function parseAICommand(input: string, context: ParseContext): ParseResult {
  // Try each pattern: sort, filter, search, limit, page, reset, export, etc.
  for (const pattern of COMMAND_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      // Return structured command
      return {
        success: true,
        command: {
          type: 'sort',
          naturalLanguage: 'sort by price desc',
          parsed: { action: 'sort', column: 'price', direction: 'DESC' },
        },
      };
    }
  }
  return { success: false, command: null };
}
```

#### 3. Command Execution Stage

```typescript
// useAICommandExecution.ts
// Routes command to appropriate handler

const execute = async (command: AICommand, data?: Record<string, unknown>[]) => {
  if (isWriteOperation(command)) {
    // Write ops: update, fill, delete
    return executeWriteCommand(command, data);
  } else {
    // Read ops: sort, filter, search, export
    return executeReadCommand(command);
  }
};

// Read commands modify query params
const executeReadCommand = async (command: AICommand) => {
  switch (command.type) {
    case 'sort':
      actions.setSort(command.parsed.column, command.parsed.direction);
      break;
    case 'filter':
      actions.addFilter({ column, operator, value });
      break;
    // ...
  }
};

// Write commands modify data via pending changes
const executeWriteCommand = async (command: AICommand, data: Record<string, unknown>[]) => {
  const matchingRows = findMatchingRows(data, command.parsed.condition);
  for (const row of matchingRows) {
    actions.editCell(row._rowid, column, newValue);
  }
};
```

#### 4. DuckDB Query Stage

```typescript
// useDuckDBView.ts -> duckDBViewStore.ts

// Query params trigger refresh
useEffect(() => {
  const fetchData = async () => {
    const result = await queryView(activeViewName, queryParams);
    // Merge with pending changes for optimistic display
    const mergedData = mergeDataWithChanges(result.data, pendingChanges);
    setData(mergedData);
  };
  fetchData();
}, [queryParams]);

// duckDBViewStore.ts - Builds and executes SQL
queryView: async (viewName: string, params: QueryParams) => {
  const sql = get().buildPaginatedSQL(viewName, params);
  // e.g., SELECT * FROM "my_view" ORDER BY "price" DESC LIMIT 50 OFFSET 0
  const result = await conn.query(sql);
  return { data: result.toArray(), totalRows, ... };
};
```

### Preview Mechanism

Before executing write operations, users can preview affected rows:

```typescript
// dataCommands.ts

export async function generatePreview(
  command: AIDataCommand,
  executeQuery: (sql: string) => Promise<Record<string, unknown>[] | null>,
  limit: number = 5
): Promise<Record<string, unknown>[]> {
  // Convert UPDATE/DELETE to SELECT for preview
  let previewSQL = command.generatedSQL;

  if (command.type === 'update' || command.type === 'delete') {
    // Extract WHERE clause
    const whereMatch = command.generatedSQL.match(/WHERE\s+(.+)$/i);
    const whereClause = whereMatch ? ` WHERE ${whereMatch[1]}` : '';

    // Build preview SELECT
    previewSQL = `SELECT * FROM "${tableName}"${whereClause} LIMIT ${limit}`;
  }

  return await executeQuery(previewSQL) || [];
}
```

### Change Tracking System

Changes are tracked in layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Committed Versions                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ Version 1│──│ Version 2│──│ Version 3│  (undoable/redoable)  │
│  │ (base)   │  │ +5 rows  │  │ +column  │                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
│                                    ▲                            │
│                                    │ currentVersionIndex        │
└────────────────────────────────────┼────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────┐
│                    Pending Changes │                             │
│  ┌──────────┐  ┌──────────┐       │                             │
│  │ Edit 1   │──│ Edit 2   │  (undoable, not yet committed)      │
│  │ cell A1  │  │ cell B3  │                                     │
│  └──────────┘  └──────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

#### ChangeRecord Structure

```typescript
export interface ChangeRecord {
  id: string;
  viewName: string;
  rowId: number;          // Original _rowid (preserved for undo)
  column: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'update' | 'insert' | 'delete' | 'add_column';
  timestamp: number;
  source: 'user' | 'ai';
  columnType?: string;    // For schema changes
}
```

### Version History System

Version navigation allows undoing/redoing committed changes:

```typescript
// duckDBViewStore.ts

// Undo a committed version
undoVersion: async (viewName: string) => {
  const versions = get().committedVersions.get(viewName) || [];
  const currentIndex = get().currentVersionIndex.get(viewName) ?? versions.length;

  if (currentIndex <= 0) return false;

  const versionToUndo = versions[currentIndex - 1];

  // Reverse each change
  for (const change of [...versionToUndo.changes].reverse()) {
    if (change.changeType === 'update') {
      // Restore old value
      await conn.query(`UPDATE "${viewName}" SET "${change.column}" = ${oldValue} WHERE _rowid = ${change.rowId}`);
    } else if (change.changeType === 'delete') {
      // Re-insert with ORIGINAL _rowid to preserve position
      await conn.query(`INSERT INTO "${viewName}" (_rowid, ...) VALUES (${change.rowId}, ...)`);
    } else if (change.changeType === 'add_column') {
      // Drop the column
      await conn.query(`ALTER TABLE "${viewName}" DROP COLUMN "${change.column}"`);
    }
  }

  // Refresh schema (important for column changes)
  await get().refreshViewSchema(viewName);

  // Update index
  set(state => ({
    currentVersionIndex: new Map(state.currentVersionIndex).set(viewName, currentIndex - 1)
  }));
};

// Redo works similarly, re-applying the changes
```

### Hooks Reference

#### useDuckDBView

The main hook for DuckDB operations:

```typescript
const {
  // State
  viewState,           // { viewName, schema, totalRows, isLoading, error, isReady }
  data,                // Current page of data (merged with pending changes)
  queryParams,         // { page, pageSize, sortColumn, sortDirection, filters, search }
  pendingChanges,      // Array of uncommitted changes
  hasPendingChanges,   // boolean

  // File operations
  loadFile,            // (file: File) => Promise<ViewDefinition | null>
  loadData,            // (viewName, dataArray, columns) => Promise<ViewDefinition | null>
  closeView,           // () => Promise<void>
  refresh,             // () => Promise<void>

  // Pagination
  setPage,             // (page: number) => void
  setPageSize,         // (pageSize: number) => void
  nextPage,            // () => void
  prevPage,            // () => void

  // Sorting
  setSort,             // (column: string | null, direction?: 'ASC' | 'DESC') => void
  toggleSort,          // (column: string) => void

  // Search & Filter
  setSearch,           // (search: string, columns?: string[]) => void
  addFilter,           // (filter: FilterCondition) => void
  removeFilter,        // (index: number) => void
  clearFilters,        // () => void

  // Cell editing
  editCell,            // (rowId: number, column: string, newValue: unknown) => void
  deleteRow,           // (rowId: number) => void

  // Change management
  undo,                // () => ChangeRecord | null
  discard,             // () => void
  commit,              // () => Promise<boolean>

  // Version navigation (committed changes)
  undoCommittedVersion,  // () => Promise<boolean>
  redoCommittedVersion,  // () => Promise<boolean>
  canUndoVersion,        // boolean
  canRedoVersion,        // boolean
  versionInfo,           // { current: number, total: number, description: string | null }

  // Schema operations
  addColumn,           // (columnName: string, columnType: string) => Promise<boolean>
  refreshSchema,       // () => Promise<boolean>

  // Export
  exportData,          // (format: 'csv' | 'json' | 'parquet', fileName?: string) => Promise<boolean>
} = useDuckDBView();
```

#### useAICommandExecution

Handles execution of parsed AI commands:

```typescript
const {
  status,              // 'idle' | 'executing' | 'success' | 'error'
  lastResult,          // ExecutionResult | null
  history,             // CommandHistoryEntry[] (for read commands)
  canUndo,             // boolean

  execute,             // (command: AICommand, data?: Record<string, unknown>[]) => Promise<ExecutionResult>
  undoLastRead,        // () => AICommand | null
  clearHistory,        // () => void
  reset,               // () => void
} = useAICommandExecution(duckDBActions, queryParams, options);
```

#### useCommandHistory

Generic command history tracking:

```typescript
const {
  entries,             // HistoryEntry<T, S>[]
  size,                // number
  isEmpty,             // boolean
  canUndo,             // boolean
  summary,             // string (labels joined by comma)

  add,                 // (command: T, previousState: S) => void
  pop,                 // () => HistoryEntry | null
  peek,                // () => HistoryEntry | null
  clear,               // () => void
  filter,              // (predicate) => HistoryEntry[]
  recent,              // (count?: number) => HistoryEntry[]
} = useCommandHistory<AICommand, QueryParams>({ maxSize: 50 });
```

#### useOperationFeedback

Toast notifications for operation results:

```typescript
const {
  items,               // FeedbackItem[]

  show,                // (options: ShowFeedbackOptions) => string (returns id)
  showSuccess,         // (message: string, description?: string, action?) => string
  showError,           // (message: string, description?: string) => string
  showInfo,            // (message: string, description?: string) => string
  showWarning,         // (message: string, description?: string) => string
  dismiss,             // (id: string) => void
  dismissAll,          // () => void
} = useOperationFeedback({ maxItems: 5, defaultDuration: 4000 });
```

### SQL Type Detection

The system detects whether SQL is a read or write operation:

```typescript
// FloatingAICommand.tsx

function detectSQLType(sql: string): 'read' | 'write' {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') ||
      trimmed.startsWith('EXPLAIN') ||
      trimmed.startsWith('DESCRIBE') ||
      trimmed.startsWith('SHOW') ||
      trimmed.startsWith('WITH')) {  // CTEs that start with SELECT
    return 'read';
  }
  return 'write';  // UPDATE, DELETE, INSERT, ALTER, etc.
}
```

### Error Handling

Errors are categorized and user-friendly suggestions are provided:

```typescript
// duckDBViewStore.ts

validateSQL: async (sql: string): Promise<SQLValidationResult> => {
  try {
    await conn.query(`EXPLAIN ${sql}`);
    return { valid: true, sql };
  } catch (error) {
    // Categorize error
    const errorMsg = String(error);

    if (errorMsg.includes('syntax error')) {
      return { valid: false, errorType: 'syntax', error: errorMsg, sql };
    }
    if (errorMsg.includes('does not exist') || errorMsg.includes('not found')) {
      return { valid: false, errorType: 'schema', error: errorMsg, sql };
    }
    // ...
  }
}
```

### Best Practices

1. **Always validate columns** - Use `findColumn` or `validateColumn` before executing commands
2. **Preview destructive operations** - Use `generatePreview` before UPDATE/DELETE
3. **Check write permission** - Use `onWriteOperation` callback for confirmation
4. **Refresh after schema changes** - Call `refreshSchema` after ALTER TABLE
5. **Use original _rowid** - When undoing deletes, restore the original row ID to preserve order
