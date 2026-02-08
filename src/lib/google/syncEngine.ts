/**
 * Google Sheets Sync Engine
 *
 * Handles two-way sync between local DuckDB data and Google Sheets:
 * - pushChanges: Apply local edits (cell updates, row deletes, column adds) to Google Sheets
 * - checkForConflicts: Compare Drive modifiedTime vs local lastSynced
 * - hasRemoteChanges: Quick check if remote has been modified
 */

import type { ChangeRecord, ColumnSchema } from '@/store/duckDBViewStore';
import {
  batchUpdateValues,
  batchStructuralUpdate,
  appendRows,
  getFileModifiedTime,
  columnIndexToLetter,
} from './sheetsApi';

export interface PushChangesParams {
  accessToken: string;
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  changes: ChangeRecord[];
  schema: ColumnSchema[];
}

export interface PushResult {
  success: boolean;
  error?: string;
  remoteModifiedTime?: string;
}

/**
 * Build a mapping of column name → column letter based on schema order
 */
function buildColumnMap(schema: ColumnSchema[]): Map<string, string> {
  const map = new Map<string, string>();
  // Skip _rowid column (index 0 if present)
  const columns = schema.filter(col => col.name !== '_rowid');
  columns.forEach((col, i) => {
    map.set(col.name, columnIndexToLetter(i));
  });
  return map;
}

/**
 * Push local changes to Google Sheets
 *
 * Order of operations:
 * 1. Delete rows (from highest _rowid to lowest to avoid index shifting)
 * 2. Add columns via appendDimension
 * 3. Update cell values (batch)
 * 4. Write headers for new columns
 * 5. Append new rows
 */
export async function pushChanges(params: PushChangesParams): Promise<PushResult> {
  const { accessToken, spreadsheetId, sheetId, sheetName, changes, schema } = params;

  try {
    const columnMap = buildColumnMap(schema);

    // Normalize BigInt values (DuckDB BIGINT comes as JavaScript BigInt,
    // which can't be mixed with Number in arithmetic or serialized to JSON)
    const toBigIntSafe = (v: unknown): unknown =>
      typeof v === 'bigint' ? Number(v) : v;
    const normalize = (c: ChangeRecord): ChangeRecord => ({
      ...c,
      rowId: typeof c.rowId === 'bigint' ? Number(c.rowId) : c.rowId,
      newValue: toBigIntSafe(c.newValue),
      oldValue: toBigIntSafe(c.oldValue),
    });
    const normalizedChanges = changes.map(normalize);

    // Group changes by type
    const deletes = normalizedChanges.filter(c => c.changeType === 'delete');
    const updates = normalizedChanges.filter(c => c.changeType === 'update');
    const addColumns = normalizedChanges.filter(c => c.changeType === 'add_column');
    const inserts = normalizedChanges.filter(c => c.changeType === 'insert');

    // 1. Structural changes: delete rows (highest _rowid first)
    if (deletes.length > 0) {
      // Sort by rowId descending to avoid index shifting
      const sortedDeletes = [...deletes].sort((a, b) => b.rowId - a.rowId);
      const deleteRequests = sortedDeletes.map(del => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            // _rowid is 1-based from row_number(), Google Sheets row index is 0-based
            // Header is row 0, so data row N maps to index N
            startIndex: del.rowId,
            endIndex: del.rowId + 1,
          },
        },
      }));

      await batchStructuralUpdate(accessToken, spreadsheetId, deleteRequests);
    }

    // 2. Structural changes: add columns
    if (addColumns.length > 0) {
      const addColRequests = addColumns.map(() => ({
        appendDimension: {
          sheetId,
          dimension: 'COLUMNS',
          length: 1,
        },
      }));

      await batchStructuralUpdate(accessToken, spreadsheetId, addColRequests);
    }

    // 3. Cell value updates via batchUpdateValues
    // For deleted rows, we need to adjust rowIds: rows above the deleted row shift down
    const deletedRowIds = new Set(deletes.map(d => d.rowId));

    // Calculate row offset: for a given _rowid, how many deleted rows are below it?
    const getAdjustedRow = (rowId: number): number => {
      let offset = 0;
      for (const deletedId of deletedRowIds) {
        if (deletedId < rowId) offset++;
      }
      // _rowid is 1-based, Google Sheets data starts at row 2 (row 1 is header)
      return rowId + 1 - offset;
    };

    const valueUpdates: { range: string; values: unknown[][] }[] = [];

    for (const update of updates) {
      if (deletedRowIds.has(update.rowId)) continue; // Skip updates on deleted rows

      const colLetter = columnMap.get(update.column);
      if (!colLetter) continue;

      const sheetRow = getAdjustedRow(update.rowId);
      valueUpdates.push({
        range: `'${sheetName}'!${colLetter}${sheetRow}`,
        values: [[update.newValue ?? '']],
      });
    }

    // 4. Write headers for new columns
    if (addColumns.length > 0) {
      // New columns are appended at the end — their index starts after existing schema
      const existingColCount = schema.filter(c => c.name !== '_rowid').length - addColumns.length;
      addColumns.forEach((col, i) => {
        const colLetter = columnIndexToLetter(existingColCount + i);
        valueUpdates.push({
          range: `'${sheetName}'!${colLetter}1`,
          values: [[col.column]],
        });
      });
    }

    if (valueUpdates.length > 0) {
      await batchUpdateValues(accessToken, spreadsheetId, valueUpdates);
    }

    // 5. Append new rows
    if (inserts.length > 0) {
      // Group inserts by rowId (each insert is a single cell in a new row)
      const rowMap = new Map<number, Map<string, unknown>>();
      for (const ins of inserts) {
        if (!rowMap.has(ins.rowId)) rowMap.set(ins.rowId, new Map());
        rowMap.get(ins.rowId)!.set(ins.column, ins.newValue);
      }

      const columns = schema.filter(c => c.name !== '_rowid');
      const rows: unknown[][] = [];
      for (const [, colValues] of rowMap) {
        const row = columns.map(col => colValues.get(col.name) ?? '');
        rows.push(row);
      }

      if (rows.length > 0) {
        await appendRows(accessToken, spreadsheetId, sheetName, rows);
      }
    }

    // Fetch updated remote modified time
    const remoteModifiedTime = await getFileModifiedTime(accessToken, spreadsheetId);

    return { success: true, remoteModifiedTime };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Push failed';
    console.error('[SyncEngine] Push failed:', err);
    return { success: false, error };
  }
}

/**
 * Check if remote has been modified since our last sync
 */
export async function hasRemoteChanges(
  accessToken: string,
  spreadsheetId: string,
  lastSyncedTimestamp: number
): Promise<{ changed: boolean; remoteModifiedTime: string }> {
  const remoteModifiedTime = await getFileModifiedTime(accessToken, spreadsheetId);
  const remoteTime = new Date(remoteModifiedTime).getTime();
  return {
    changed: remoteTime > lastSyncedTimestamp,
    remoteModifiedTime,
  };
}

/**
 * Check for conflicts: both local and remote have changes
 */
export async function checkForConflicts(
  accessToken: string,
  spreadsheetId: string,
  lastSyncedTimestamp: number,
  hasLocalChanges: boolean
): Promise<{ hasConflict: boolean; remoteModifiedTime: string }> {
  const { changed: remoteChanged, remoteModifiedTime } = await hasRemoteChanges(
    accessToken,
    spreadsheetId,
    lastSyncedTimestamp
  );

  return {
    hasConflict: remoteChanged && hasLocalChanges,
    remoteModifiedTime,
  };
}
