# Implementation Guide: DuckDB-Powered Data Editing

This guide provides concrete code patterns for implementing the DuckDB-powered focused file view.

---

## 1. DuckDB View Hook

```typescript
// src/hooks/useDuckDBView.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';

interface ViewState {
  viewName: string;
  schema: ColumnSchema[];
  totalRows: number;
  isLoading: boolean;
  error: string | null;
}

interface QueryParams {
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  filters?: FilterCondition[];
  search?: string;
}

interface UseViewResult {
  state: ViewState;
  data: Record<string, unknown>[];
  query: (params: QueryParams) => Promise<void>;
  editCell: (rowId: string, column: string, value: unknown) => Promise<void>;
  getPendingChanges: () => ChangeRecord[];
  commitChanges: () => Promise<void>;
  undoLastChange: () => void;
}

export function useDuckDBView(fileHandle: FileSystemFileHandle | null): UseViewResult {
  const { connection, executePaginatedQuery } = useDuckDBStore();
  const [state, setState] = useState<ViewState>({
    viewName: '',
    schema: [],
    totalRows: 0,
    isLoading: false,
    error: null,
  });
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const pendingChanges = useRef<ChangeRecord[]>([]);

  // Create VIEW when file handle changes
  useEffect(() => {
    if (!fileHandle || !connection) return;

    const createView = async () => {
      setState(s => ({ ...s, isLoading: true, error: null }));

      try {
        const fileName = fileHandle.name;
        const viewName = sanitizeTableName(fileName);
        const fileExt = fileName.split('.').pop()?.toLowerCase();

        // Register file with DuckDB
        const file = await fileHandle.getFile();
        const registeredName = `view_${Date.now()}.${fileExt}`;
        await db.registerFileHandle(registeredName, file, DuckDBDataProtocol.BROWSER_FILEREADER, true);

        // Create VIEW (not TABLE) for lazy loading
        const createSQL = buildCreateViewSQL(viewName, registeredName, fileExt);
        await connection.query(createSQL);

        // Also create delta table for changes
        await connection.query(`
          CREATE TABLE IF NOT EXISTS "${viewName}_delta" (
            row_id BIGINT,
            column_name VARCHAR,
            old_value VARCHAR,
            new_value VARCHAR,
            change_type VARCHAR,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            source VARCHAR DEFAULT 'user'
          )
        `);

        // Get schema and row count
        const schema = await getViewSchema(connection, viewName);
        const countResult = await connection.query(`SELECT COUNT(*) as cnt FROM "${viewName}"`);
        const totalRows = countResult.toArray()[0]?.cnt ?? 0;

        setState({
          viewName,
          schema,
          totalRows,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setState(s => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to create view',
        }));
      }
    };

    createView();
  }, [fileHandle, connection]);

  // Query data with pagination
  const query = useCallback(async (params: QueryParams) => {
    if (!state.viewName || !connection) return;

    setState(s => ({ ...s, isLoading: true }));

    try {
      const sql = buildPaginatedSQL(state.viewName, params);
      const result = await executePaginatedQuery(sql, params.page, params.pageSize);

      // Merge with pending changes for optimistic display
      const mergedData = mergeWithPendingChanges(result.data, pendingChanges.current);

      setData(mergedData);
      setState(s => ({
        ...s,
        totalRows: result.totalRows,
        isLoading: false,
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Query failed',
      }));
    }
  }, [state.viewName, connection, executePaginatedQuery]);

  // Edit a cell
  const editCell = useCallback(async (rowId: string, column: string, value: unknown) => {
    if (!state.viewName || !connection) return;

    // Get original value
    const originalValue = data.find(r => r._rowid === rowId)?.[column];

    // Record change
    const change: ChangeRecord = {
      id: `${Date.now()}-${Math.random()}`,
      rowId,
      column,
      oldValue: originalValue,
      newValue: value,
      changeType: 'update',
      timestamp: new Date(),
      source: 'user',
    };

    // Insert into delta table
    await connection.query(`
      INSERT INTO "${state.viewName}_delta"
      (row_id, column_name, old_value, new_value, change_type, source)
      VALUES (${rowId}, '${column}', '${JSON.stringify(originalValue)}', '${JSON.stringify(value)}', 'update', 'user')
    `);

    pendingChanges.current.push(change);

    // Optimistic update
    setData(d => d.map(row =>
      row._rowid === rowId ? { ...row, [column]: value, _modified: true } : row
    ));
  }, [state.viewName, connection, data]);

  // Commit changes
  const commitChanges = useCallback(async () => {
    if (!state.viewName || !connection || pendingChanges.current.length === 0) return;

    setState(s => ({ ...s, isLoading: true }));

    try {
      // Export merged data back to file
      const mergedSQL = `SELECT * FROM "${state.viewName}_current"`;
      const fileType = getFileTypeFromViewName(state.viewName);

      await exportToFile(connection, mergedSQL, fileHandle!, fileType);

      // Clear delta table
      await connection.query(`DELETE FROM "${state.viewName}_delta"`);
      pendingChanges.current = [];

      // Refresh view
      await refreshView(connection, state.viewName);

      setState(s => ({ ...s, isLoading: false }));
    } catch (err) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Commit failed',
      }));
    }
  }, [state.viewName, connection, fileHandle]);

  // Undo last change
  const undoLastChange = useCallback(() => {
    const lastChange = pendingChanges.current.pop();
    if (!lastChange) return;

    // Revert optimistic update
    setData(d => d.map(row =>
      row._rowid === lastChange.rowId
        ? { ...row, [lastChange.column]: lastChange.oldValue, _modified: false }
        : row
    ));

    // Remove from delta table
    connection?.query(`
      DELETE FROM "${state.viewName}_delta"
      WHERE row_id = ${lastChange.rowId}
      AND column_name = '${lastChange.column}'
      ORDER BY timestamp DESC
      LIMIT 1
    `);
  }, [state.viewName, connection]);

  return {
    state,
    data,
    query,
    editCell,
    getPendingChanges: () => pendingChanges.current,
    commitChanges,
    undoLastChange,
  };
}

// Helper functions
function buildCreateViewSQL(viewName: string, fileName: string, fileExt: string): string {
  switch (fileExt) {
    case 'csv':
      return `CREATE VIEW "${viewName}" AS SELECT rowid as _rowid, * FROM read_csv('${fileName}', header=true, auto_detect=true)`;
    case 'json':
      return `CREATE VIEW "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_json_auto('${fileName}')`;
    case 'parquet':
      return `CREATE VIEW "${viewName}" AS SELECT rowid as _rowid, * FROM read_parquet('${fileName}')`;
    default:
      throw new Error(`Unsupported file type: ${fileExt}`);
  }
}

function buildPaginatedSQL(viewName: string, params: QueryParams): string {
  let sql = `SELECT * FROM "${viewName}"`;

  // WHERE clause
  const conditions: string[] = [];
  if (params.search) {
    // Search across all text columns
    conditions.push(`(${searchAllColumns(params.search)})`);
  }
  if (params.filters?.length) {
    conditions.push(...params.filters.map(f => filterToSQL(f)));
  }
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // ORDER BY
  if (params.sortColumn) {
    sql += ` ORDER BY "${params.sortColumn}" ${params.sortDirection || 'ASC'}`;
  }

  // LIMIT/OFFSET
  const offset = params.page * params.pageSize;
  sql += ` LIMIT ${params.pageSize} OFFSET ${offset}`;

  return sql;
}
```

---

## 2. Virtual Scroll Table Component

```typescript
// src/components/flow/focused/VirtualDataTable.tsx

import { useCallback, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualDataTableProps {
  viewName: string;
  totalRows: number;
  columns: ColumnSchema[];
  onFetchPage: (page: number, pageSize: number) => Promise<Row[]>;
  onCellEdit: (rowId: string, column: string, value: unknown) => void;
  pendingChanges: ChangeRecord[];
}

export function VirtualDataTable({
  viewName,
  totalRows,
  columns,
  onFetchPage,
  onCellEdit,
  pendingChanges,
}: VirtualDataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [rowCache, setRowCache] = useState<Map<number, Row>>(new Map());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);

  const ROW_HEIGHT = 40;
  const PAGE_SIZE = 100;
  const OVERSCAN = 20;

  // Virtual row renderer
  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Fetch pages as needed
  useEffect(() => {
    const fetchMissingRows = async () => {
      const visibleIndices = virtualRows.map(v => v.index);
      const missingPages = new Set<number>();

      for (const index of visibleIndices) {
        if (!rowCache.has(index)) {
          missingPages.add(Math.floor(index / PAGE_SIZE));
        }
      }

      for (const page of missingPages) {
        const rows = await onFetchPage(page, PAGE_SIZE);
        setRowCache(cache => {
          const newCache = new Map(cache);
          rows.forEach((row, i) => {
            newCache.set(page * PAGE_SIZE + i, row);
          });
          return newCache;
        });
      }
    };

    fetchMissingRows();
  }, [virtualRows, rowCache, onFetchPage]);

  // Cell edit handler
  const handleCellDoubleClick = useCallback((rowIndex: number, column: string) => {
    setEditingCell({ rowIndex, column });
  }, []);

  const handleCellEditComplete = useCallback((value: unknown) => {
    if (!editingCell) return;

    const row = rowCache.get(editingCell.rowIndex);
    if (row) {
      onCellEdit(row._rowid, editingCell.column, value);
    }
    setEditingCell(null);
  }, [editingCell, rowCache, onCellEdit]);

  // Check if row has pending changes
  const getRowChangeStatus = useCallback((rowId: string): 'none' | 'modified' | 'deleted' => {
    const changes = pendingChanges.filter(c => c.rowId === rowId);
    if (changes.some(c => c.changeType === 'delete')) return 'deleted';
    if (changes.length > 0) return 'modified';
    return 'none';
  }, [pendingChanges]);

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      style={{ contain: 'strict' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex"
        style={{
          backgroundColor: 'var(--surface-secondary)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {columns.map(col => (
          <div
            key={col.name}
            className="px-4 py-2 font-medium text-sm"
            style={{
              width: col.width || 150,
              color: 'var(--text-primary)',
            }}
          >
            <span className="mr-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {getTypeIcon(col.type)}
            </span>
            {col.name}
          </div>
        ))}
      </div>

      {/* Virtual rows */}
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map(virtualRow => {
          const row = rowCache.get(virtualRow.index);
          const changeStatus = row ? getRowChangeStatus(row._rowid) : 'none';

          return (
            <div
              key={virtualRow.key}
              className="absolute flex w-full"
              style={{
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
                backgroundColor: changeStatus === 'modified'
                  ? 'rgba(245, 158, 11, 0.1)'
                  : changeStatus === 'deleted'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'transparent',
              }}
            >
              {row ? (
                columns.map(col => (
                  <EditableCell
                    key={col.name}
                    value={row[col.name]}
                    column={col}
                    isEditing={
                      editingCell?.rowIndex === virtualRow.index &&
                      editingCell?.column === col.name
                    }
                    hasChange={pendingChanges.some(
                      c => c.rowId === row._rowid && c.column === col.name
                    )}
                    onDoubleClick={() => handleCellDoubleClick(virtualRow.index, col.name)}
                    onEditComplete={handleCellEditComplete}
                  />
                ))
              ) : (
                <CellSkeleton columns={columns} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Editable cell component
function EditableCell({
  value,
  column,
  isEditing,
  hasChange,
  onDoubleClick,
  onEditComplete,
}: {
  value: unknown;
  column: ColumnSchema;
  isEditing: boolean;
  hasChange: boolean;
  onDoubleClick: () => void;
  onEditComplete: (value: unknown) => void;
}) {
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(String(value ?? ''));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEditComplete(parseValue(editValue, column.type));
    } else if (e.key === 'Escape') {
      onEditComplete(value); // Revert
    }
  };

  if (isEditing) {
    return (
      <div className="px-4 py-2" style={{ width: column.width || 150 }}>
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onEditComplete(parseValue(editValue, column.type))}
          className="w-full px-2 py-1 text-sm rounded focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--primary)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="px-4 py-2 text-sm truncate cursor-pointer"
      style={{
        width: column.width || 150,
        color: hasChange ? '#F59E0B' : 'var(--text-primary)',
      }}
      onDoubleClick={onDoubleClick}
    >
      {hasChange && <span className="mr-1">●</span>}
      {formatCellValue(value, column.type)}
    </div>
  );
}
```

---

## 3. AI Command Handler

```typescript
// src/lib/ai/dataCommands.ts

interface AICommandContext {
  viewName: string;
  schema: ColumnSchema[];
  sampleRows: Row[];
  totalRows: number;
}

interface AICommandResult {
  generatedSQL: string;
  affectedRowsEstimate: number;
  previewRows: Row[];
  confidence: number;
  warnings: string[];
}

export async function generateDataCommand(
  naturalLanguage: string,
  context: AICommandContext
): Promise<AICommandResult> {
  // Build prompt with context
  const prompt = buildPrompt(naturalLanguage, context);

  // Call AI API
  const response = await fetch('/api/ai/data-command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const { sql, confidence } = await response.json();

  // Validate and sanitize SQL
  const validatedSQL = validateSQL(sql, context.viewName);

  // Estimate affected rows
  const countSQL = buildCountQuery(validatedSQL);
  const countResult = await duckdb.query(countSQL);
  const affectedRowsEstimate = countResult.toArray()[0]?.count ?? 0;

  // Get preview rows
  const previewSQL = `${validatedSQL.replace(/;$/, '')} LIMIT 10`;
  const previewResult = await duckdb.query(previewSQL);

  return {
    generatedSQL: validatedSQL,
    affectedRowsEstimate,
    previewRows: previewResult.toArray(),
    confidence,
    warnings: generateWarnings(validatedSQL, affectedRowsEstimate),
  };
}

function buildPrompt(naturalLanguage: string, context: AICommandContext): string {
  return `You are a SQL expert helping modify data in a table.

Table: "${context.viewName}"
Columns:
${context.schema.map(c => `  - ${c.name} (${c.type})`).join('\n')}

Sample data (first 5 rows):
${JSON.stringify(context.sampleRows.slice(0, 5), null, 2)}

Total rows: ${context.totalRows}

User request: "${naturalLanguage}"

Generate a safe SQL statement to fulfill this request. Rules:
1. Only use UPDATE, DELETE, or INSERT statements
2. Never use DROP, TRUNCATE, or ALTER
3. Include a WHERE clause for UPDATE/DELETE (never modify all rows without explicit condition)
4. Return only the SQL, no explanation

SQL:`;
}

function validateSQL(sql: string, allowedTable: string): string {
  // Security checks
  const forbidden = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];
  for (const keyword of forbidden) {
    if (sql.toUpperCase().includes(keyword)) {
      throw new Error(`Forbidden SQL keyword: ${keyword}`);
    }
  }

  // Ensure only our table is referenced
  const tablePattern = /(?:UPDATE|INSERT INTO|DELETE FROM)\s+"?([^"\s]+)"?/i;
  const match = sql.match(tablePattern);
  if (match && match[1] !== allowedTable) {
    throw new Error(`SQL references unauthorized table: ${match[1]}`);
  }

  return sql;
}

function generateWarnings(sql: string, affectedRows: number): string[] {
  const warnings: string[] = [];

  if (affectedRows > 1000) {
    warnings.push(`This will modify ${affectedRows.toLocaleString()} rows`);
  }

  if (!sql.toUpperCase().includes('WHERE')) {
    warnings.push('No WHERE clause - this affects all rows');
  }

  if (sql.toUpperCase().includes('DELETE')) {
    warnings.push('This is a DELETE operation - rows will be marked for removal');
  }

  return warnings;
}
```

---

## 4. Change Log Component

```typescript
// src/components/flow/focused/ChangeLog.tsx

interface ChangeLogProps {
  changes: ChangeRecord[];
  onUndo: (changeId: string) => void;
  onCommit: () => void;
  onDiscardAll: () => void;
  isCommitting: boolean;
}

export function ChangeLog({
  changes,
  onUndo,
  onCommit,
  onDiscardAll,
  isCommitting,
}: ChangeLogProps) {
  const hasChanges = changes.length > 0;

  // Group changes by row for display
  const groupedChanges = useMemo(() => {
    const groups = new Map<string, ChangeRecord[]>();
    changes.forEach(change => {
      const existing = groups.get(change.rowId) || [];
      groups.set(change.rowId, [...existing, change]);
    });
    return Array.from(groups.entries());
  }, [changes]);

  return (
    <motion.div
      className="fixed bottom-4 right-4 w-80 rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--surface-primary)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-xl)',
      }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: hasChanges ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: hasChanges ? '#F59E0B' : 'var(--text-tertiary)' }}>
            ●
          </span>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {hasChanges ? `${changes.length} Pending Changes` : 'No Changes'}
          </span>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={onDiscardAll}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Discard
            </button>
            <button
              onClick={onCommit}
              disabled={isCommitting}
              className="text-xs px-3 py-1 rounded font-medium"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'white',
                opacity: isCommitting ? 0.5 : 1,
              }}
            >
              {isCommitting ? 'Saving...' : 'Commit'}
            </button>
          </div>
        )}
      </div>

      {/* Changes list */}
      {hasChanges && (
        <div className="max-h-64 overflow-auto">
          {groupedChanges.slice(0, 10).map(([rowId, rowChanges]) => (
            <div
              key={rowId}
              className="px-4 py-2 flex items-start gap-2"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Row {rowId}
              </span>
              <div className="flex-1">
                {rowChanges.map(change => (
                  <div key={change.id} className="text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {change.column}:
                    </span>
                    <span style={{ color: '#EF4444', textDecoration: 'line-through' }}>
                      {formatValue(change.oldValue)}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}> → </span>
                    <span style={{ color: '#10B981' }}>
                      {formatValue(change.newValue)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => rowChanges.forEach(c => onUndo(c.id))}
                className="text-xs px-2 py-1 rounded hover:bg-surface-secondary"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Undo
              </button>
            </div>
          ))}
          {groupedChanges.length > 10 && (
            <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              +{groupedChanges.length - 10} more changes
            </div>
          )}
        </div>
      )}

      {/* Keyboard hints */}
      <div
        className="px-4 py-2 flex items-center gap-4 text-[10px]"
        style={{
          backgroundColor: 'var(--surface-secondary)',
          color: 'var(--text-tertiary)',
        }}
      >
        <span>
          <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
            ⌘Z
          </kbd>{' '}
          Undo
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
            ⌘S
          </kbd>{' '}
          Commit
        </span>
      </div>
    </motion.div>
  );
}
```

---

## 5. File Export Functions

```typescript
// src/lib/duckdb/export.ts

interface ExportOptions {
  createBackup?: boolean;
  preserveFormatting?: boolean;
  streamChunkSize?: number;
}

export async function exportToCSV(
  connection: DuckDBConnection,
  sql: string,
  fileHandle: FileSystemFileHandle,
  options: ExportOptions = {}
): Promise<void> {
  const writable = await fileHandle.createWritable();

  try {
    // Create backup if requested
    if (options.createBackup) {
      const backupHandle = await createBackupFile(fileHandle);
      const original = await fileHandle.getFile();
      const backupWritable = await backupHandle.createWritable();
      await backupWritable.write(await original.arrayBuffer());
      await backupWritable.close();
    }

    // Stream export for large files
    const chunkSize = options.streamChunkSize || 10000;
    let offset = 0;
    let isFirstChunk = true;

    while (true) {
      const chunkSQL = `${sql} LIMIT ${chunkSize} OFFSET ${offset}`;
      const result = await connection.query(chunkSQL);
      const rows = result.toArray();

      if (rows.length === 0) break;

      // Convert to CSV
      const csv = rowsToCSV(rows, isFirstChunk);
      await writable.write(csv);

      isFirstChunk = false;
      offset += chunkSize;

      // Yield to prevent blocking UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  } finally {
    await writable.close();
  }
}

export async function exportToParquet(
  connection: DuckDBConnection,
  sql: string,
  fileHandle: FileSystemFileHandle,
  options: ExportOptions = {}
): Promise<void> {
  // Parquet supports efficient partial updates
  // Use DuckDB's native COPY TO
  const tempFileName = `export_${Date.now()}.parquet`;

  await connection.query(`
    COPY (${sql}) TO '${tempFileName}' (FORMAT PARQUET, COMPRESSION ZSTD)
  `);

  // Read the exported file and write to handle
  const exportedFile = await db.copyFileToBuffer(tempFileName);
  const writable = await fileHandle.createWritable();
  await writable.write(exportedFile);
  await writable.close();
}

export async function exportToJSON(
  connection: DuckDBConnection,
  sql: string,
  fileHandle: FileSystemFileHandle,
  options: ExportOptions = {}
): Promise<void> {
  const writable = await fileHandle.createWritable();

  try {
    await writable.write('[\n');

    const chunkSize = options.streamChunkSize || 10000;
    let offset = 0;
    let isFirstRow = true;

    while (true) {
      const chunkSQL = `${sql} LIMIT ${chunkSize} OFFSET ${offset}`;
      const result = await connection.query(chunkSQL);
      const rows = result.toArray();

      if (rows.length === 0) break;

      for (const row of rows) {
        const prefix = isFirstRow ? '  ' : ',\n  ';
        await writable.write(prefix + JSON.stringify(row));
        isFirstRow = false;
      }

      offset += chunkSize;
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    await writable.write('\n]');
  } finally {
    await writable.close();
  }
}

function rowsToCSV(rows: Record<string, unknown>[], includeHeader: boolean): string {
  if (rows.length === 0) return '';

  const columns = Object.keys(rows[0]);
  let csv = '';

  if (includeHeader) {
    csv = columns.map(c => escapeCSVField(c)).join(',') + '\n';
  }

  for (const row of rows) {
    csv += columns.map(c => escapeCSVField(String(row[c] ?? ''))).join(',') + '\n';
  }

  return csv;
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

---

## Usage Example

```typescript
// In your FocusedFileView component:

function FocusedFileView({ fileHandle }: { fileHandle: FileSystemFileHandle }) {
  const {
    state,
    data,
    query,
    editCell,
    getPendingChanges,
    commitChanges,
    undoLastChange,
  } = useDuckDBView(fileHandle);

  // Initial query
  useEffect(() => {
    if (state.viewName) {
      query({ page: 0, pageSize: 50 });
    }
  }, [state.viewName, query]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        commitChanges();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undoLastChange();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commitChanges, undoLastChange]);

  return (
    <div className="h-full flex flex-col">
      <VirtualDataTable
        viewName={state.viewName}
        totalRows={state.totalRows}
        columns={state.schema}
        onFetchPage={(page, pageSize) => query({ page, pageSize })}
        onCellEdit={editCell}
        pendingChanges={getPendingChanges()}
      />
      <AnimatePresence>
        {getPendingChanges().length > 0 && (
          <ChangeLog
            changes={getPendingChanges()}
            onUndo={(id) => undoLastChange()}
            onCommit={commitChanges}
            onDiscardAll={() => {/* ... */}}
            isCommitting={state.isLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

This implementation guide provides the concrete patterns needed to build the DuckDB-powered data editing experience. The key principles are:

1. **VIEWs for lazy loading** - Never load full dataset into memory
2. **Delta tables for changes** - Track all edits without modifying source
3. **Virtual scrolling** - SQL-level pagination for infinite scroll
4. **Optimistic UI** - Immediate visual feedback, sync in background
5. **Streaming export** - Handle arbitrarily large files
