# DuckDB-Powered Focused File View: Architectural Vision

## Executive Summary

Transform the focused file view from a simple data viewer into a **best-in-class data manipulation interface** powered by DuckDB. By treating every file as a queryable VIEW, we enable:

- **Millions of records** rendered smoothly with SQL-level virtual scrolling
- **In-place cell editing** with change tracking and atomic commits
- **AI-powered transformations** via natural language → SQL
- **Universal file support** through DuckDB's native parsers

---

## Core Architecture

### The VIEW-First Paradigm

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FILE SOURCES                                 │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│    CSV      │    JSON     │   Parquet   │    Excel    │   Database  │
│   (view)    │   (view)    │   (view)    │   (table)   │   (attach)  │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴─────────────┴─────────────┴─────────────┘
                                   │
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │                    DUCKDB ENGINE                      │
       │  • In-browser WASM execution                          │
       │  • Native file format readers                         │
       │  • SQL query optimization                             │
       │  • Memory-efficient streaming                         │
       └───────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │  SELECT   │  │   EDIT    │  │    AI     │
            │  (view)   │  │  (delta)  │  │ (mutate)  │
            └───────────┘  └───────────┘  └───────────┘
```

**Key Insight**: Files remain on disk (via browser File System Access API). DuckDB creates lightweight **VIEWs** that read data on-demand. This means:

- **Instant file opening** - No loading 10GB into memory
- **Native performance** - DuckDB's columnar engine is faster than JS
- **Query pushdown** - Only fetch rows/columns you need

---

## Data Layer Architecture

### 1. Universal File Registration

```typescript
interface ViewDefinition {
  viewName: string;           // "sales_2024"
  sourceFile: FileSystemFileHandle;
  fileType: 'csv' | 'json' | 'parquet' | 'xlsx';
  createStatement: string;    // "CREATE VIEW sales_2024 AS SELECT * FROM read_csv(...)"
  schema: ColumnSchema[];     // Cached column info
  estimatedRowCount?: number; // From file header/metadata
}

// Example: Opening a 5GB CSV creates a VIEW, not a TABLE
const view = await createFileView(fileHandle, 'sales_2024');
// Executes: CREATE VIEW "sales_2024" AS SELECT * FROM read_csv('file.csv', header=true, auto_detect=true)
```

### 2. Paginated Data Access

Instead of loading all data into JavaScript arrays, we use SQL-level pagination:

```typescript
interface PaginatedViewQuery {
  viewName: string;
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  filters?: FilterCondition[];
  search?: string;
}

async function queryView(query: PaginatedViewQuery): Promise<PaginatedResult> {
  const sql = buildPaginatedSQL(query);
  // SELECT * FROM "sales_2024"
  // WHERE name ILIKE '%search%'
  // ORDER BY revenue DESC
  // LIMIT 50 OFFSET 100

  return await duckdb.executePaginatedQuery(sql, query.page, query.pageSize);
}
```

**Benefits**:
- Render row 1,000,000 as fast as row 1
- Sort 100M rows using DuckDB (not JS Array.sort)
- Filter pushdown to file format reader
- Memory stays constant regardless of file size

---

## Change Tracking Architecture

### The Delta Table Pattern

Edits don't modify the source file. Instead, we maintain a **delta table** of changes:

```sql
-- For each opened file, create a shadow delta table
CREATE TABLE "sales_2024_delta" (
  row_id BIGINT,              -- Original row position (or generated)
  column_name VARCHAR,
  old_value VARCHAR,          -- JSON-encoded original
  new_value VARCHAR,          -- JSON-encoded new value
  change_type VARCHAR,        -- 'update', 'insert', 'delete'
  timestamp TIMESTAMP,
  source VARCHAR              -- 'user' or 'ai'
);
```

### Merged View Pattern

When displaying data, we merge the original VIEW with pending deltas:

```sql
-- Create a materialized view that shows current state
CREATE VIEW "sales_2024_current" AS
SELECT
  COALESCE(d.new_value, v.*) as current_row,
  d.change_type IS NOT NULL as has_changes
FROM "sales_2024" v
LEFT JOIN "sales_2024_delta" d ON v.rowid = d.row_id
WHERE d.change_type != 'delete' OR d.change_type IS NULL
```

### Change Log UI Component

```
┌─────────────────────────────────────────────────────────────────┐
│ Pending Changes (12)                              [Commit] [⌘Z] │
├─────────────────────────────────────────────────────────────────┤
│ ○ Row 1,234: "revenue" → $45,000 (was $42,000)          [Undo] │
│ ○ Row 5,678: "status" → "shipped" (was "pending")       [Undo] │
│ ○ Row 9,012: DELETED                                    [Undo] │
│ ● AI: Set all "region" = "EMEA" where country IN (...)  [Undo] │
│   └─ Affected 2,341 rows                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## In-Place Cell Editing

### The Cell Edit Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. User Double-Clicks Cell                                       │
│    └─ Cell becomes editable input                                │
│                                                                  │
│ 2. User Edits Value                                              │
│    └─ Live validation against column type                        │
│    └─ Show inline preview of change                              │
│                                                                  │
│ 3. User Presses Enter (or Tab to move)                           │
│    └─ INSERT INTO delta table                                    │
│    └─ Cell shows "changed" indicator (orange dot)                │
│    └─ Change appears in pending changes panel                    │
│                                                                  │
│ 4. User Clicks "Commit" (or ⌘S)                                  │
│    └─ Generate SQL/file write based on file type                 │
│    └─ For CSV: Re-export entire file (optimized)                 │
│    └─ For Parquet: Row-group level updates                       │
│    └─ Clear delta table on success                               │
└──────────────────────────────────────────────────────────────────┘
```

### Optimistic UI Updates

```typescript
interface CellEditState {
  rowId: string;
  column: string;
  originalValue: unknown;
  currentValue: unknown;
  validationError?: string;
  commitStatus: 'pending' | 'committed' | 'failed';
}

// The table shows edited values immediately (optimistic)
// Delta table is the source of truth for uncommitted changes
// On commit failure, we can rollback UI to match delta state
```

### Keyboard-First Editing

| Key | Action |
|-----|--------|
| `Enter` | Edit selected cell |
| `Tab` | Move to next cell (and commit current) |
| `Shift+Tab` | Move to previous cell |
| `Escape` | Cancel edit, revert to original |
| `⌘Z` | Undo last change |
| `⌘S` | Commit all pending changes |
| `Delete` | Mark row for deletion |
| `⌘D` | Duplicate current row |

---

## AI-Powered Modifications

### Natural Language → SQL Pipeline

```
┌────────────────────────────────────────────────────────────────────┐
│                     AI COMMAND INTERFACE                           │
├────────────────────────────────────────────────────────────────────┤
│ User: "Set the status to 'shipped' for all orders over $1000"      │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ AI Analysis:                                                 │   │
│ │ • Target column: status                                      │   │
│ │ • Condition: order_total > 1000                              │   │
│ │ • New value: 'shipped'                                       │   │
│ │ • Estimated affected rows: 2,341                             │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ Generated SQL:                                                     │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ UPDATE "orders_2024"                                         │   │
│ │ SET status = 'shipped'                                       │   │
│ │ WHERE order_total > 1000                                     │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ [Preview Changes]  [Apply]  [Edit SQL]  [Cancel]                   │
└────────────────────────────────────────────────────────────────────┘
```

### AI Command Types

```typescript
interface AIDataCommand {
  type: 'update' | 'delete' | 'insert' | 'transform' | 'derive';
  naturalLanguage: string;
  generatedSQL: string;
  affectedRowCount: number;
  previewRows: Row[];  // Sample of affected rows
  confidence: number;  // AI confidence in interpretation
}

const aiCommands = [
  // Column transformations
  "Convert all dates to ISO format",
  "Split 'full_name' into 'first_name' and 'last_name'",
  "Normalize phone numbers to E.164 format",

  // Conditional updates
  "Set discount to 10% where customer_type is 'premium'",
  "Mark as 'expired' if expiry_date < today",

  // Bulk operations
  "Delete all rows where email is null",
  "Fill empty cities with 'Unknown'",

  // Derived columns
  "Add a 'profit_margin' column calculated as (revenue - cost) / revenue",
  "Create 'age_group' buckets: 0-18, 19-35, 36-55, 56+",
];
```

### AI Change Preview

Before applying AI changes, show a diff preview:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Preview: "Set status to 'shipped' where order_total > 1000"         │
├─────────────────────────────────────────────────────────────────────┤
│ Showing 5 of 2,341 affected rows                                    │
│                                                                     │
│ ┌─────┬────────────┬──────────────┬─────────────────────────────┐   │
│ │ Row │ order_id   │ order_total  │ status                      │   │
│ ├─────┼────────────┼──────────────┼─────────────────────────────┤   │
│ │ 123 │ ORD-001    │ $1,234.56    │ pending → shipped           │   │
│ │ 456 │ ORD-002    │ $2,000.00    │ processing → shipped        │   │
│ │ 789 │ ORD-003    │ $1,500.00    │ pending → shipped           │   │
│ │ ... │ ...        │ ...          │ ...                         │   │
│ └─────┴────────────┴──────────────┴─────────────────────────────┘   │
│                                                                     │
│ ⚠️ This will modify 2,341 rows. Changes can be undone.              │
│                                                                     │
│ [Apply Changes]  [Cancel]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Virtual Scrolling Architecture

### SQL-Level Virtualization

Traditional virtual scroll loads chunks into memory. We go further:

```typescript
interface VirtualScrollState {
  viewName: string;
  totalRows: number;           // FROM: SELECT COUNT(*) FROM view
  visibleStartRow: number;     // Current scroll position
  visibleRowCount: number;     // Viewport capacity
  overscan: number;            // Buffer rows above/below
  sortState?: SortState;
  filterState?: FilterState;
}

// On scroll, we query ONLY the visible window
async function fetchVisibleRows(state: VirtualScrollState) {
  const offset = Math.max(0, state.visibleStartRow - state.overscan);
  const limit = state.visibleRowCount + (state.overscan * 2);

  return duckdb.query(`
    SELECT * FROM "${state.viewName}"
    ${buildWhereClause(state.filterState)}
    ${buildOrderByClause(state.sortState)}
    LIMIT ${limit} OFFSET ${offset}
  `);
}
```

### Smooth Scrolling with Prefetch

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCROLL BUFFER STRATEGY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [...cached rows 0-50...]     ← Upper prefetch buffer          │
│                                                                 │
│   ┌─────────────────────────┐  ← VISIBLE VIEWPORT               │
│   │ Row 51                  │                                   │
│   │ Row 52                  │                                   │
│   │ ...                     │                                   │
│   │ Row 80                  │                                   │
│   └─────────────────────────┘                                   │
│                                                                 │
│   [...cached rows 81-130...]   ← Lower prefetch buffer          │
│                                                                 │
│   [...rows 131+ not loaded...] ← Fetch on scroll                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Row Height Estimation

For millions of rows, we can't measure each. Use statistical estimation:

```typescript
interface RowHeightEstimator {
  defaultRowHeight: number;      // 40px base
  measuredHeights: Map<number, number>;  // Actual measured rows
  estimatedTotalHeight: number;  // totalRows * avgHeight
}

// Calculate scroll position from row index
function rowToScrollPosition(rowIndex: number, estimator: RowHeightEstimator): number {
  // Use measured heights for rows we've seen
  // Estimate for rows we haven't
  let position = 0;
  for (let i = 0; i < rowIndex; i++) {
    position += estimator.measuredHeights.get(i) ?? estimator.defaultRowHeight;
  }
  return position;
}
```

---

## Commit/Export Strategies

### File Type-Specific Export

| File Type | Commit Strategy |
|-----------|-----------------|
| **CSV** | Re-export entire file (optimized streaming write) |
| **JSON** | Re-export with formatting preserved |
| **Parquet** | Row-group level updates (surgical edits) |
| **Excel** | Update cells in-place via xlsx library |

### Commit Workflow

```typescript
interface CommitOperation {
  viewName: string;
  changes: ChangeRecord[];
  targetFile: FileSystemFileHandle;

  // Options
  createBackup: boolean;      // .bak file before overwrite
  validateSchema: boolean;    // Ensure types match
  preserveFormatting: boolean; // For JSON/CSV
}

async function commitChanges(op: CommitOperation): Promise<CommitResult> {
  // 1. Create backup if requested
  if (op.createBackup) {
    await createBackupFile(op.targetFile);
  }

  // 2. Build merged dataset
  const mergedSQL = `
    SELECT * FROM "${op.viewName}_current"  -- VIEW with deltas applied
  `;

  // 3. Export based on file type
  switch (getFileType(op.targetFile)) {
    case 'csv':
      return exportToCSV(mergedSQL, op.targetFile);
    case 'parquet':
      return exportToParquet(mergedSQL, op.targetFile);
    case 'json':
      return exportToJSON(mergedSQL, op.targetFile);
  }

  // 4. Clear delta table on success
  await duckdb.query(`DELETE FROM "${op.viewName}_delta"`);

  // 5. Refresh VIEW to point to new file
  await refreshView(op.viewName);
}
```

---

## UI Component Architecture

### Component Hierarchy

```
FocusedFileView (DuckDB-powered)
├── FileTabs
│   └── FileTab (with dirty indicator)
├── Toolbar
│   ├── SearchInput (→ SQL WHERE ILIKE)
│   ├── SortDropdown (→ SQL ORDER BY)
│   ├── FilterBuilder (→ SQL WHERE)
│   └── AICommandButton
├── QuickStats (→ SQL aggregates)
│   ├── RowCount
│   ├── ColumnTypes
│   └── NullPercentage
├── VirtualDataTable
│   ├── TableHeader (sortable, resizable)
│   ├── VirtualRowRenderer
│   │   └── EditableCell
│   └── ChangeIndicators
├── ColumnInspector
│   ├── TypeBadge
│   ├── Statistics (→ DuckDB SUMMARIZE)
│   ├── MiniHistogram
│   └── QuickActions
├── ChangeLog
│   ├── PendingChangesList
│   ├── UndoButton
│   └── CommitButton
└── AICommandPalette
    ├── NaturalLanguageInput
    ├── SQLPreview
    └── ChangePreview
```

### State Management

```typescript
interface DuckDBFocusedViewState {
  // View registry
  openViews: Map<string, ViewDefinition>;
  activeViewName: string | null;

  // Query state (not data!)
  viewQueryState: Map<string, ViewQueryState>;

  // Change tracking
  pendingChanges: Map<string, ChangeRecord[]>;
  changeHistory: ChangeRecord[];  // For undo

  // UI state
  selectedCell: CellPosition | null;
  editingCell: CellPosition | null;
  inspectorColumn: string | null;
  commandPaletteOpen: boolean;

  // Actions
  openFile: (file: FileSystemFileHandle) => Promise<string>;
  closeView: (viewName: string) => void;
  editCell: (position: CellPosition, newValue: unknown) => void;
  undoChange: () => void;
  commitChanges: (viewName: string) => Promise<void>;
  executeAICommand: (command: string) => Promise<AICommandResult>;
}
```

---

## Implementation Phases

### Phase 1: DuckDB Integration Foundation
- [ ] Create `useDuckDBView` hook for VIEW-based file access
- [ ] Implement paginated query builder
- [ ] Replace in-memory data with SQL queries
- [ ] Add basic virtual scrolling

### Phase 2: Change Tracking
- [ ] Create delta table schema and management
- [ ] Implement `_current` merged view pattern
- [ ] Add cell editing with optimistic updates
- [ ] Build ChangeLog component

### Phase 3: AI Integration
- [ ] Design AI command schema
- [ ] Implement natural language → SQL pipeline
- [ ] Build change preview UI
- [ ] Add confidence indicators and validation

### Phase 4: Commit & Export
- [ ] Implement file-type-specific export
- [ ] Add backup creation
- [ ] Build commit confirmation UI
- [ ] Handle large file streaming export

### Phase 5: Polish & Performance
- [ ] Optimize virtual scroll for 100M+ rows
- [ ] Add keyboard navigation
- [ ] Implement column resize/reorder
- [ ] Add undo/redo stack

---

## Performance Targets

| Metric | Target |
|--------|--------|
| File open (any size) | < 500ms |
| Scroll to row 1,000,000 | < 100ms |
| Cell edit response | < 50ms |
| AI command preview | < 2s |
| Commit 10K changes | < 5s |
| Memory usage (10GB file) | < 100MB |

---

## Key Design Principles

1. **Files are immutable until commit** - All edits live in delta tables
2. **SQL is the data access layer** - Never load full datasets into JS
3. **AI suggests, user confirms** - Always preview before bulk changes
4. **Keyboard-first editing** - Power users can edit without mouse
5. **Progressive disclosure** - Simple view first, power features on demand

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| DuckDB WASM memory limits | Use VIEWs (lazy loading) instead of TABLEs |
| Slow AI response | Show skeleton preview, stream results |
| Large file export | Stream write, show progress |
| Lost changes on crash | Auto-save delta table to IndexedDB |
| Complex merge conflicts | Show diff UI, let user resolve |

---

This architecture transforms the focused file view from a "view-only" modal into a **full-featured data manipulation IDE** that can handle enterprise-scale datasets while maintaining a simple, intuitive interface.
