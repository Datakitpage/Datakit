/**
 * Google Sheets and Drive API client
 *
 * Provides functions to:
 * - List spreadsheets from Drive (with pagination)
 * - Get spreadsheet metadata (sheet tabs)
 * - Fetch sheet data (with truncation detection)
 *
 * All API calls use googleFetch() which handles:
 * - 401 → TokenExpiredError (prompt re-auth)
 * - 403 → PermissionError
 * - 429 → Retry with exponential backoff
 * - 5xx → Retry once
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// --- Error types ---

export class TokenExpiredError extends Error {
  constructor(message = 'Session expired. Please reconnect your Google account.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class PermissionError extends Error {
  constructor(message = 'You don\'t have permission to access this resource.') {
    super(message);
    this.name = 'PermissionError';
  }
}

// --- Fetch wrapper ---

interface GoogleFetchOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
}

async function googleFetch(url: string, accessToken: string, options: GoogleFetchOptions = {}): Promise<Response> {
  const { method = 'GET', body } = options;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    const fetchInit: RequestInit = { method, headers };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      fetchInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchInit);

    if (response.ok) return response;

    if (response.status === 401) {
      throw new TokenExpiredError();
    }

    if (response.status === 403) {
      const errBody = await response.json().catch(() => ({}));
      throw new PermissionError(
        errBody.error?.message || 'You don\'t have permission to access this resource.'
      );
    }

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    if (response.status >= 500 && attempt < 1) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    // Non-retryable error
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Google API error: ${response.status}`);
  }

  throw new Error('Google API request failed after retries');
}

// --- Types ---

export interface SpreadsheetListItem {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink?: string;
}

export interface SpreadsheetListResult {
  spreadsheets: SpreadsheetListItem[];
  nextPageToken: string | null;
}

export interface SheetTab {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: SheetTab[];
}

export interface SheetData {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  columnCount: number;
  isTruncated: boolean;
}

// --- API functions ---

/**
 * List spreadsheets from user's Drive
 *
 * Returns a page of results plus a nextPageToken for loading more.
 */
export async function listSpreadsheets(
  accessToken: string,
  query?: string,
  pageSize = 100,
  pageToken?: string
): Promise<SpreadsheetListResult> {
  let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    fields: 'nextPageToken,files(id,name,modifiedTime,webViewLink,iconLink)',
    orderBy: 'modifiedTime desc',
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await googleFetch(`${DRIVE_API_BASE}/files?${params}`, accessToken);
  const data = await response.json();

  const spreadsheets = (data.files || []).map((file: {
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink: string;
    iconLink?: string;
  }) => ({
    id: file.id,
    name: file.name,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
    iconLink: file.iconLink,
  }));

  return {
    spreadsheets,
    nextPageToken: data.nextPageToken || null,
  };
}

/**
 * Get spreadsheet metadata including sheet tabs
 */
export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields: 'spreadsheetId,properties.title,sheets.properties(sheetId,title,gridProperties)',
  });

  const response = await googleFetch(
    `${SHEETS_API_BASE}/${spreadsheetId}?${params}`,
    accessToken
  );
  const data = await response.json();

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Untitled',
    sheets: (data.sheets || []).map((sheet: {
      properties: {
        sheetId: number;
        title: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }) => ({
      sheetId: sheet.properties.sheetId,
      title: sheet.properties.title,
      rowCount: sheet.properties.gridProperties?.rowCount || 0,
      columnCount: sheet.properties.gridProperties?.columnCount || 0,
    })),
  };
}

/**
 * Fetch data from a specific sheet
 *
 * Returns isTruncated=true if the sheet has more rows than maxRows.
 */
export async function getSheetData(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  maxRows = 10000
): Promise<SheetData> {
  // Fetch maxRows + 1 header row
  const range = encodeURIComponent(`'${sheetName}'!A1:ZZ${maxRows + 1}`);

  const params = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const response = await googleFetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?${params}`,
    accessToken
  );

  const data = await response.json();
  const values: unknown[][] = data.values || [];

  if (values.length === 0) {
    return {
      headers: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
      isTruncated: false,
    };
  }

  // First row is headers
  const rawHeaders = values[0] as (string | number | boolean | null)[];
  const headers = rawHeaders.map((h, i) => {
    if (h === null || h === undefined || h === '') {
      return `Column ${i + 1}`;
    }
    return String(h);
  });

  // Deduplicate header names
  const headerCounts: Record<string, number> = {};
  const uniqueHeaders = headers.map((h) => {
    if (headerCounts[h] === undefined) {
      headerCounts[h] = 0;
      return h;
    }
    headerCounts[h]++;
    return `${h}_${headerCounts[h]}`;
  });

  // Data rows (excluding header)
  const dataRows = values.slice(1);
  const isTruncated = dataRows.length >= maxRows;
  const rowsToUse = isTruncated ? dataRows.slice(0, maxRows) : dataRows;

  // Convert to records
  const rows = rowsToUse.map((row) => {
    const record: Record<string, unknown> = {};
    uniqueHeaders.forEach((header, i) => {
      record[header] = row[i] ?? null;
    });
    return record;
  });

  return {
    headers: uniqueHeaders,
    rows,
    rowCount: rows.length,
    columnCount: uniqueHeaders.length,
    isTruncated,
  };
}

/**
 * Helper to format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

// --- Write API functions ---

/**
 * Convert 0-based column index to Google Sheets column letter (A, B, ..., Z, AA, AB, ...)
 */
export function columnIndexToLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Batch update cell values in a spreadsheet (1 API call for many cells)
 *
 * Each entry in `data` specifies a range (e.g., "Sheet1!B3") and values.
 */
export async function batchUpdateValues(
  accessToken: string,
  spreadsheetId: string,
  data: { range: string; values: unknown[][] }[]
): Promise<void> {
  if (data.length === 0) return;

  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`;
  await googleFetch(url, accessToken, {
    method: 'POST',
    body: {
      valueInputOption: 'RAW',
      data,
    },
  });
}

/**
 * Append rows at the end of a sheet
 */
export async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;

  const range = encodeURIComponent(`'${sheetName}'!A:A`);
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  await googleFetch(url, accessToken, {
    method: 'POST',
    body: { values: rows },
  });
}

/**
 * Batch structural update (add/delete rows, add/delete columns)
 *
 * Uses the spreadsheets:batchUpdate endpoint which accepts an array of requests.
 * See: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request
 */
export async function batchStructuralUpdate(
  accessToken: string,
  spreadsheetId: string,
  requests: Record<string, unknown>[]
): Promise<void> {
  if (requests.length === 0) return;

  const url = `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`;
  await googleFetch(url, accessToken, {
    method: 'POST',
    body: { requests },
  });
}

/**
 * Get file's last modified time from Drive API (for conflict detection)
 */
export async function getFileModifiedTime(
  accessToken: string,
  fileId: string
): Promise<string> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?fields=modifiedTime`;
  const response = await googleFetch(url, accessToken);
  const data = await response.json();
  return data.modifiedTime;
}
