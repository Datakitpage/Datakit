import * as XLSX from 'xlsx';

export interface XlsxParseResult {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rowCount: number;
  columnCount: number;
  csvContent: string;
}

/**
 * Parse an Excel file and extract metadata + CSV content for DuckDB registration.
 * DuckDB WASM cannot read xlsx natively, so we convert to CSV first.
 */
export async function parseXlsxFile(
  file: File,
  sheetName?: string
): Promise<XlsxParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellStyles: false,
  });

  const targetSheet = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];

  if (!worksheet) {
    throw new Error(`Sheet "${targetSheet}" not found in workbook`);
  }

  // Extract headers from first row
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: false,
  });

  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
  const rowCount = jsonData.length;
  const columnCount = headers.length;

  // Convert to CSV for DuckDB registration
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);

  return {
    sheetNames: workbook.SheetNames,
    activeSheet: targetSheet,
    headers,
    rowCount,
    columnCount,
    csvContent,
  };
}

/**
 * Create an xlsx Blob from row data and column names for export.
 */
export function createXlsxBlob(
  data: Record<string, unknown>[],
  columns: string[]
): Blob {
  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });

  // Auto-size columns based on content
  const colWidths = columns.map(col => {
    const maxLen = Math.max(
      col.length,
      ...data.slice(0, 100).map(row => String(row[col] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  const xlsxBuffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  });

  return new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
