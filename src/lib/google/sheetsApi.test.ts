import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { columnIndexToLetter, formatRelativeTime, TokenExpiredError, PermissionError } from './sheetsApi';

describe('sheetsApi — columnIndexToLetter', () => {
  it('should convert 0 to A', () => {
    expect(columnIndexToLetter(0)).toBe('A');
  });

  it('should convert 1 to B', () => {
    expect(columnIndexToLetter(1)).toBe('B');
  });

  it('should convert 25 to Z', () => {
    expect(columnIndexToLetter(25)).toBe('Z');
  });

  it('should convert 26 to AA', () => {
    expect(columnIndexToLetter(26)).toBe('AA');
  });

  it('should convert 27 to AB', () => {
    expect(columnIndexToLetter(27)).toBe('AB');
  });

  it('should convert 51 to AZ', () => {
    expect(columnIndexToLetter(51)).toBe('AZ');
  });

  it('should convert 52 to BA', () => {
    expect(columnIndexToLetter(52)).toBe('BA');
  });

  it('should convert 701 to ZZ', () => {
    expect(columnIndexToLetter(701)).toBe('ZZ');
  });

  it('should convert 702 to AAA', () => {
    expect(columnIndexToLetter(702)).toBe('AAA');
  });
});

describe('sheetsApi — formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for < 60 seconds', () => {
    expect(formatRelativeTime('2025-06-15T11:59:30Z')).toBe('just now');
  });

  it('should return "1 min ago" for 1 minute', () => {
    expect(formatRelativeTime('2025-06-15T11:59:00Z')).toBe('1 min ago');
  });

  it('should return "5 mins ago" for 5 minutes', () => {
    expect(formatRelativeTime('2025-06-15T11:55:00Z')).toBe('5 mins ago');
  });

  it('should return "1 hour ago" for 1 hour', () => {
    expect(formatRelativeTime('2025-06-15T11:00:00Z')).toBe('1 hour ago');
  });

  it('should return "3 hours ago" for 3 hours', () => {
    expect(formatRelativeTime('2025-06-15T09:00:00Z')).toBe('3 hours ago');
  });

  it('should return "1 day ago" for 1 day', () => {
    expect(formatRelativeTime('2025-06-14T12:00:00Z')).toBe('1 day ago');
  });

  it('should return "5 days ago" for 5 days', () => {
    expect(formatRelativeTime('2025-06-10T12:00:00Z')).toBe('5 days ago');
  });

  it('should return "1 week ago" for 7 days', () => {
    expect(formatRelativeTime('2025-06-08T12:00:00Z')).toBe('1 week ago');
  });

  it('should return "3 weeks ago" for 21 days', () => {
    expect(formatRelativeTime('2025-05-25T12:00:00Z')).toBe('3 weeks ago');
  });

  it('should return "1 month ago" for ~30 days', () => {
    expect(formatRelativeTime('2025-05-16T12:00:00Z')).toBe('1 month ago');
  });

  it('should return "6 months ago" for ~180 days', () => {
    expect(formatRelativeTime('2024-12-15T12:00:00Z')).toBe('6 months ago');
  });

  it('should return formatted date for > 12 months', () => {
    const result = formatRelativeTime('2024-01-01T12:00:00Z');
    // Should be a locale date string, not a relative time
    expect(result).not.toContain('ago');
  });
});

describe('sheetsApi — error types', () => {
  it('TokenExpiredError should have correct name and default message', () => {
    const err = new TokenExpiredError();
    expect(err.name).toBe('TokenExpiredError');
    expect(err.message).toContain('Session expired');
    expect(err).toBeInstanceOf(Error);
  });

  it('TokenExpiredError should accept custom message', () => {
    const err = new TokenExpiredError('Custom message');
    expect(err.message).toBe('Custom message');
  });

  it('PermissionError should have correct name and default message', () => {
    const err = new PermissionError();
    expect(err.name).toBe('PermissionError');
    expect(err.message).toContain('permission');
    expect(err).toBeInstanceOf(Error);
  });

  it('PermissionError should accept custom message', () => {
    const err = new PermissionError('No access');
    expect(err.message).toBe('No access');
  });
});

describe('sheetsApi — getSheetData (via dynamic import with mocked fetch)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(data: { values?: unknown[][] }) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    } as unknown as Response);
  }

  // We need to test getSheetData which internally calls googleFetch (which calls fetch)
  // Since googleFetch is not mocked, we mock the global fetch directly

  it('should return empty result for empty sheet', async () => {
    mockFetch({ values: [] });

    const { getSheetData } = await import('./sheetsApi');
    const result = await getSheetData('token', 'spreadsheet-id', 'Sheet1');

    expect(result).toEqual({
      headers: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
      isTruncated: false,
    });
  });

  it('should parse headers from first row and data from subsequent rows', async () => {
    mockFetch({
      values: [
        ['Name', 'Age', 'City'],
        ['Alice', 30, 'NYC'],
        ['Bob', 25, 'LA'],
      ],
    });

    const { getSheetData } = await import('./sheetsApi');
    const result = await getSheetData('token', 'spreadsheet-id', 'Sheet1');

    expect(result.headers).toEqual(['Name', 'Age', 'City']);
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(3);
    expect(result.isTruncated).toBe(false);
    expect(result.rows).toEqual([
      { Name: 'Alice', Age: 30, City: 'NYC' },
      { Name: 'Bob', Age: 25, City: 'LA' },
    ]);
  });

  it('should handle empty/null headers by generating Column N names', async () => {
    mockFetch({
      values: [
        ['Name', '', null, 'City'],
        ['Alice', 'x', 'y', 'NYC'],
      ],
    });

    const { getSheetData } = await import('./sheetsApi');
    const result = await getSheetData('token', 'spreadsheet-id', 'Sheet1');

    expect(result.headers).toEqual(['Name', 'Column 2', 'Column 3', 'City']);
  });

  it('should deduplicate header names', async () => {
    mockFetch({
      values: [
        ['Name', 'Name', 'Name'],
        ['a', 'b', 'c'],
      ],
    });

    const { getSheetData } = await import('./sheetsApi');
    const result = await getSheetData('token', 'spreadsheet-id', 'Sheet1');

    expect(result.headers).toEqual(['Name', 'Name_1', 'Name_2']);
  });

  it('should fill missing cell values with null', async () => {
    mockFetch({
      values: [
        ['Name', 'Age', 'City'],
        ['Alice'],  // Missing Age and City
      ],
    });

    const { getSheetData } = await import('./sheetsApi');
    const result = await getSheetData('token', 'spreadsheet-id', 'Sheet1');

    expect(result.rows[0]).toEqual({ Name: 'Alice', Age: null, City: null });
  });

  it('should detect truncation when rows >= maxRows', async () => {
    const values = [['Header']];
    // Add maxRows + 1 data rows to trigger truncation (using maxRows=3 for simplicity)
    for (let i = 0; i < 4; i++) {
      values.push([`row-${i}`]);
    }
    mockFetch({ values });

    const { getSheetData } = await import('./sheetsApi');
    const result = await getSheetData('token', 'spreadsheet-id', 'Sheet1', 3);

    expect(result.isTruncated).toBe(true);
    expect(result.rowCount).toBe(3);
  });

  it('should throw TokenExpiredError on 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const { getSheetData, TokenExpiredError: TErr } = await import('./sheetsApi');

    await expect(getSheetData('bad-token', 'id', 'Sheet1')).rejects.toThrow(TErr);
  });

  it('should throw PermissionError on 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: 'Forbidden' } }),
    } as unknown as Response);

    const { getSheetData, PermissionError: PErr } = await import('./sheetsApi');

    await expect(getSheetData('token', 'id', 'Sheet1')).rejects.toThrow(PErr);
  });
});
