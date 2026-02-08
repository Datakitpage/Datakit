import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeRecord, ColumnSchema } from '@/store/duckDBViewStore';

// Mock the sheetsApi module
vi.mock('./sheetsApi', () => ({
  batchUpdateValues: vi.fn().mockResolvedValue(undefined),
  batchStructuralUpdate: vi.fn().mockResolvedValue(undefined),
  appendRows: vi.fn().mockResolvedValue(undefined),
  getFileModifiedTime: vi.fn().mockResolvedValue('2025-06-01T12:00:00Z'),
  columnIndexToLetter: (index: number) => {
    let letter = '';
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode((n % 26) + 65) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  },
}));

import { pushChanges, hasRemoteChanges, checkForConflicts } from './syncEngine';
import {
  batchUpdateValues,
  batchStructuralUpdate,
  appendRows,
  getFileModifiedTime,
} from './sheetsApi';

const baseSchema: ColumnSchema[] = [
  { name: '_rowid', type: 'INTEGER' },
  { name: 'Name', type: 'VARCHAR' },
  { name: 'Age', type: 'INTEGER' },
  { name: 'City', type: 'VARCHAR' },
];

function makeChange(overrides: Partial<ChangeRecord>): ChangeRecord {
  return {
    id: `change-${Math.random()}`,
    viewName: 'test_view',
    rowId: 1,
    column: 'Name',
    oldValue: 'Alice',
    newValue: 'Bob',
    changeType: 'update',
    timestamp: Date.now(),
    source: 'user',
    ...overrides,
  };
}

describe('syncEngine — pushChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should push cell updates via batchUpdateValues', async () => {
    const changes = [
      makeChange({ rowId: 1, column: 'Name', newValue: 'Bob', changeType: 'update' }),
      makeChange({ rowId: 3, column: 'Age', newValue: 30, changeType: 'update' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(true);
    expect(result.remoteModifiedTime).toBe('2025-06-01T12:00:00Z');
    expect(batchUpdateValues).toHaveBeenCalledOnce();

    // Check the data passed to batchUpdateValues
    const callArgs = vi.mocked(batchUpdateValues).mock.calls[0];
    const data = callArgs[2]; // third arg is the data array
    expect(data).toHaveLength(2);

    // _rowid 1 maps to Google Sheets row 2 (1-based + header), column Name is A
    expect(data[0].range).toBe("'Sheet1'!A2");
    expect(data[0].values).toEqual([['Bob']]);

    // _rowid 3 maps to row 4, column Age is B
    expect(data[1].range).toBe("'Sheet1'!B4");
    expect(data[1].values).toEqual([[30]]);
  });

  it('should push row deletes via batchStructuralUpdate (highest first)', async () => {
    const changes = [
      makeChange({ rowId: 2, changeType: 'delete' }),
      makeChange({ rowId: 5, changeType: 'delete' }),
      makeChange({ rowId: 1, changeType: 'delete' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(true);
    expect(batchStructuralUpdate).toHaveBeenCalledOnce();

    const callArgs = vi.mocked(batchStructuralUpdate).mock.calls[0];
    const requests = callArgs[2] as Array<{ deleteDimension: { range: { startIndex: number } } }>;

    // Should be sorted descending by rowId: 5, 2, 1
    expect(requests).toHaveLength(3);
    expect(requests[0].deleteDimension.range.startIndex).toBe(5);
    expect(requests[1].deleteDimension.range.startIndex).toBe(2);
    expect(requests[2].deleteDimension.range.startIndex).toBe(1);
  });

  it('should adjust row indices for updates when rows are deleted', async () => {
    const changes = [
      makeChange({ rowId: 2, changeType: 'delete' }),
      makeChange({ rowId: 5, column: 'Name', newValue: 'Updated', changeType: 'update' }),
    ];

    await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    const updateCallArgs = vi.mocked(batchUpdateValues).mock.calls[0];
    const data = updateCallArgs[2];
    expect(data).toHaveLength(1);

    // _rowid 5, but row 2 was deleted (below 5), so adjusted: 5 + 1 - 1 = 5
    expect(data[0].range).toBe("'Sheet1'!A5");
  });

  it('should skip updates on deleted rows', async () => {
    const changes = [
      makeChange({ rowId: 3, changeType: 'delete' }),
      makeChange({ rowId: 3, column: 'Name', newValue: 'Ghost', changeType: 'update' }),
    ];

    await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    // batchUpdateValues should not be called (no valid updates)
    expect(batchUpdateValues).not.toHaveBeenCalled();
  });

  it('should push add_column changes with header write', async () => {
    const schema: ColumnSchema[] = [
      ...baseSchema,
      { name: 'Email', type: 'VARCHAR' },
    ];

    const changes = [
      makeChange({ column: 'Email', changeType: 'add_column', columnType: 'VARCHAR' }),
    ];

    await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema,
    });

    // Should call batchStructuralUpdate to append dimension
    expect(batchStructuralUpdate).toHaveBeenCalledOnce();
    const structReqs = vi.mocked(batchStructuralUpdate).mock.calls[0][2];
    expect(structReqs[0]).toHaveProperty('appendDimension');

    // Should write the header for new column
    expect(batchUpdateValues).toHaveBeenCalledOnce();
    const data = vi.mocked(batchUpdateValues).mock.calls[0][2];
    // Column at index 3 (after Name, Age, City) → D
    expect(data[0].range).toBe("'Sheet1'!D1");
    expect(data[0].values).toEqual([['Email']]);
  });

  it('should handle BigInt rowId values from DuckDB', async () => {
    const changes = [
      makeChange({ rowId: BigInt(1) as unknown as number, column: 'Name', newValue: 'BigIntBob', changeType: 'update' }),
      makeChange({ rowId: BigInt(3) as unknown as number, column: 'Age', newValue: BigInt(42) as unknown, changeType: 'update' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(true);
    expect(batchUpdateValues).toHaveBeenCalledOnce();

    const callArgs = vi.mocked(batchUpdateValues).mock.calls[0];
    const data = callArgs[2];
    expect(data).toHaveLength(2);

    // BigInt rowIds should be converted to Number for arithmetic
    expect(data[0].range).toBe("'Sheet1'!A2");
    expect(data[0].values).toEqual([['BigIntBob']]);
    // BigInt newValue should be converted to Number
    expect(data[1].range).toBe("'Sheet1'!B4");
    expect(data[1].values).toEqual([[42]]);
  });

  it('should handle BigInt rowId in deletes (sorted correctly)', async () => {
    const changes = [
      makeChange({ rowId: BigInt(2) as unknown as number, changeType: 'delete' }),
      makeChange({ rowId: BigInt(5) as unknown as number, changeType: 'delete' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(true);
    expect(batchStructuralUpdate).toHaveBeenCalledOnce();

    const requests = vi.mocked(batchStructuralUpdate).mock.calls[0][2] as Array<{ deleteDimension: { range: { startIndex: number } } }>;
    // Should be sorted descending: 5, 2
    expect(requests[0].deleteDimension.range.startIndex).toBe(5);
    expect(requests[1].deleteDimension.range.startIndex).toBe(2);
  });

  it('should handle empty changes gracefully', async () => {
    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes: [],
      schema: baseSchema,
    });

    expect(result.success).toBe(true);
    expect(batchUpdateValues).not.toHaveBeenCalled();
    expect(batchStructuralUpdate).not.toHaveBeenCalled();
    expect(appendRows).not.toHaveBeenCalled();
  });

  it('should return error on API failure', async () => {
    vi.mocked(batchUpdateValues).mockRejectedValueOnce(new Error('Network error'));

    const changes = [
      makeChange({ rowId: 1, column: 'Name', newValue: 'Fail', changeType: 'update' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should push insert changes via appendRows', async () => {
    const changes = [
      makeChange({ rowId: 100, column: 'Name', newValue: 'New Person', changeType: 'insert' }),
      makeChange({ rowId: 100, column: 'Age', newValue: 28, changeType: 'insert' }),
      makeChange({ rowId: 100, column: 'City', newValue: 'Berlin', changeType: 'insert' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(true);
    expect(appendRows).toHaveBeenCalledOnce();

    const callArgs = vi.mocked(appendRows).mock.calls[0];
    expect(callArgs[0]).toBe('token');
    expect(callArgs[1]).toBe('sheet-id');
    expect(callArgs[2]).toBe('Sheet1');

    const rows = callArgs[3];
    expect(rows).toHaveLength(1);
    // Row should have values in schema order (Name, Age, City)
    expect(rows[0]).toEqual(['New Person', 28, 'Berlin']);
  });

  it('should push multiple inserted rows grouped by rowId', async () => {
    const changes = [
      makeChange({ rowId: 100, column: 'Name', newValue: 'Alice', changeType: 'insert' }),
      makeChange({ rowId: 100, column: 'Age', newValue: 30, changeType: 'insert' }),
      makeChange({ rowId: 101, column: 'Name', newValue: 'Bob', changeType: 'insert' }),
      makeChange({ rowId: 101, column: 'Age', newValue: 25, changeType: 'insert' }),
    ];

    await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(appendRows).toHaveBeenCalledOnce();
    const rows = vi.mocked(appendRows).mock.calls[0][3];
    expect(rows).toHaveLength(2);
  });

  it('should fill missing columns with empty string in inserted rows', async () => {
    const changes = [
      makeChange({ rowId: 100, column: 'Name', newValue: 'Sparse', changeType: 'insert' }),
      // Age and City not provided
    ];

    await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    const rows = vi.mocked(appendRows).mock.calls[0][3];
    expect(rows[0]).toEqual(['Sparse', '', '']);
  });

  it('should handle mixed change types (update + delete + insert)', async () => {
    const changes = [
      makeChange({ rowId: 2, changeType: 'delete' }),
      makeChange({ rowId: 1, column: 'Name', newValue: 'Updated', changeType: 'update' }),
      makeChange({ rowId: 100, column: 'Name', newValue: 'Inserted', changeType: 'insert' }),
      makeChange({ rowId: 100, column: 'Age', newValue: 99, changeType: 'insert' }),
      makeChange({ rowId: 100, column: 'City', newValue: 'Tokyo', changeType: 'insert' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(true);

    // Deletes via structural update
    expect(batchStructuralUpdate).toHaveBeenCalledOnce();

    // Updates via batch values
    expect(batchUpdateValues).toHaveBeenCalledOnce();

    // Inserts via append
    expect(appendRows).toHaveBeenCalledOnce();
    const rows = vi.mocked(appendRows).mock.calls[0][3];
    expect(rows[0]).toEqual(['Inserted', 99, 'Tokyo']);
  });

  it('should handle null newValue in updates', async () => {
    const changes = [
      makeChange({ rowId: 1, column: 'Name', newValue: null, changeType: 'update' }),
    ];

    await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    const data = vi.mocked(batchUpdateValues).mock.calls[0][2];
    // null should be replaced with empty string
    expect(data[0].values).toEqual([['']]);
  });

  it('should not call appendRows when inserts list is empty', async () => {
    const changes = [
      makeChange({ rowId: 1, column: 'Name', newValue: 'X', changeType: 'update' }),
    ];

    await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(appendRows).not.toHaveBeenCalled();
  });

  it('should return error for non-Error throw', async () => {
    vi.mocked(batchUpdateValues).mockRejectedValueOnce('string error');

    const changes = [
      makeChange({ rowId: 1, column: 'Name', newValue: 'Fail', changeType: 'update' }),
    ];

    const result = await pushChanges({
      accessToken: 'token',
      spreadsheetId: 'sheet-id',
      sheetId: 0,
      sheetName: 'Sheet1',
      changes,
      schema: baseSchema,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Push failed');
  });
});

describe('syncEngine — hasRemoteChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect remote changes when modifiedTime is after lastSynced', async () => {
    vi.mocked(getFileModifiedTime).mockResolvedValueOnce('2025-06-01T12:00:00Z');

    const lastSynced = new Date('2025-06-01T11:00:00Z').getTime();
    const result = await hasRemoteChanges('token', 'sheet-id', lastSynced);

    expect(result.changed).toBe(true);
    expect(result.remoteModifiedTime).toBe('2025-06-01T12:00:00Z');
  });

  it('should not detect changes when modifiedTime is before lastSynced', async () => {
    vi.mocked(getFileModifiedTime).mockResolvedValueOnce('2025-06-01T10:00:00Z');

    const lastSynced = new Date('2025-06-01T11:00:00Z').getTime();
    const result = await hasRemoteChanges('token', 'sheet-id', lastSynced);

    expect(result.changed).toBe(false);
  });
});

describe('syncEngine — checkForConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect conflict when both local and remote changed', async () => {
    vi.mocked(getFileModifiedTime).mockResolvedValueOnce('2025-06-01T12:00:00Z');

    const lastSynced = new Date('2025-06-01T11:00:00Z').getTime();
    const result = await checkForConflicts('token', 'sheet-id', lastSynced, true);

    expect(result.hasConflict).toBe(true);
  });

  it('should not conflict when only remote changed (no local changes)', async () => {
    vi.mocked(getFileModifiedTime).mockResolvedValueOnce('2025-06-01T12:00:00Z');

    const lastSynced = new Date('2025-06-01T11:00:00Z').getTime();
    const result = await checkForConflicts('token', 'sheet-id', lastSynced, false);

    expect(result.hasConflict).toBe(false);
  });

  it('should not conflict when only local changed (no remote changes)', async () => {
    vi.mocked(getFileModifiedTime).mockResolvedValueOnce('2025-06-01T10:00:00Z');

    const lastSynced = new Date('2025-06-01T11:00:00Z').getTime();
    const result = await checkForConflicts('token', 'sheet-id', lastSynced, true);

    expect(result.hasConflict).toBe(false);
  });

  it('should not conflict when neither side changed', async () => {
    vi.mocked(getFileModifiedTime).mockResolvedValueOnce('2025-06-01T10:00:00Z');

    const lastSynced = new Date('2025-06-01T11:00:00Z').getTime();
    const result = await checkForConflicts('token', 'sheet-id', lastSynced, false);

    expect(result.hasConflict).toBe(false);
  });
});
