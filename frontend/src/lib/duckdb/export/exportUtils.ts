/**
 * Utility functions for exporting data from DuckDB to files
 * Uses DuckDB's COPY command for efficient export without JavaScript memory overhead
 */

import { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export interface ExportProgress {
  stage: 'preparing' | 'exporting' | 'uploading' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  bytesProcessed?: number;
  totalBytes?: number;
}

export interface ExportOptions {
  format?: 'csv' | 'parquet' | 'json';
  delimiter?: string;
  header?: boolean;
  compression?: 'gzip' | 'none';
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  rowCount: number;
}

/**
 * Export a DuckDB table directly to a file using COPY command
 * This avoids JavaScript memory overhead by letting DuckDB handle the export
 */
export async function exportTableToFile(
  connection: AsyncDuckDBConnection,
  tableName: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const {
    format = 'csv',
    delimiter = ',',
    header = true,
    compression = 'none',
    onProgress
  } = options;

  try {
    // Report preparation stage
    onProgress?.({
      stage: 'preparing',
      progress: 0,
      message: 'Preparing export...'
    });

    // First, get the row count for progress tracking
    const countResult = await connection.query(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );
    const rowCount = countResult.toArray()[0].count as number;

    // Determine file extension and MIME type
    let fileExtension = format;
    let mimeType = 'text/csv';
    
    if (format === 'csv') {
      mimeType = 'text/csv';
      if (compression === 'gzip') {
        fileExtension = 'csv.gz';
        mimeType = 'application/gzip';
      }
    } else if (format === 'parquet') {
      fileExtension = 'parquet';
      mimeType = 'application/octet-stream';
    } else if (format === 'json') {
      fileExtension = 'json';
      mimeType = 'application/json';
      if (compression === 'gzip') {
        fileExtension = 'json.gz';
        mimeType = 'application/gzip';
      }
    }

    const fileName = `${tableName}_export.${fileExtension}`;

    // Report export stage
    onProgress?.({
      stage: 'exporting',
      progress: 10,
      message: `Exporting ${rowCount.toLocaleString()} rows to ${format.toUpperCase()}...`
    });

    // Build the COPY command based on format
    let copyCommand: string;
    
    if (format === 'csv') {
      const csvOptions = [
        header ? 'HEADER' : '',
        `DELIMITER '${delimiter}'`
      ].filter(Boolean).join(', ');
      
      copyCommand = `COPY (SELECT * FROM "${tableName}") TO '${fileName}' (${csvOptions})`;
      
      if (compression === 'gzip') {
        // DuckDB automatically compresses when extension is .gz
        copyCommand = `COPY (SELECT * FROM "${tableName}") TO '${fileName}' (${csvOptions})`;
      }
    } else if (format === 'parquet') {
      copyCommand = `COPY (SELECT * FROM "${tableName}") TO '${fileName}' (FORMAT PARQUET)`;
    } else if (format === 'json') {
      copyCommand = `COPY (SELECT * FROM "${tableName}") TO '${fileName}' (FORMAT JSON, ARRAY true)`;
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // Execute the COPY command
    // Note: In WASM, this will write to the virtual file system
    await connection.query(copyCommand);

    onProgress?.({
      stage: 'exporting',
      progress: 50,
      message: 'Reading exported file...'
    });

    // Read the file from DuckDB's virtual file system
    const fileDataResult = await connection.query(
      `SELECT * FROM read_blob('${fileName}')`
    );
    
    // Get the binary data
    const fileData = fileDataResult.toArray()[0];
    
    // Convert to Blob
    let blob: Blob;
    if (fileData && fileData[0]) {
      const uint8Array = new Uint8Array(fileData[0] as ArrayBuffer);
      blob = new Blob([uint8Array], { type: mimeType });
    } else {
      throw new Error('Failed to read exported file data');
    }

    // Clean up the temporary file
    await connection.query(`CALL remove_file('${fileName}')`);

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: `Export complete: ${rowCount.toLocaleString()} rows, ${formatBytes(blob.size)}`,
      bytesProcessed: blob.size,
      totalBytes: blob.size
    });

    return {
      blob,
      fileName,
      mimeType,
      size: blob.size,
      rowCount
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Export failed';
    
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: errorMessage
    });

    throw new Error(`Export failed: ${errorMessage}`);
  }
}

/**
 * Export a query result directly to a file
 */
export async function exportQueryToFile(
  connection: AsyncDuckDBConnection,
  query: string,
  outputFileName: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const {
    format = 'csv',
    delimiter = ',',
    header = true,
    compression = 'none',
    onProgress
  } = options;

  try {
    onProgress?.({
      stage: 'preparing',
      progress: 0,
      message: 'Preparing query export...'
    });

    // Create a temporary view for the query
    const tempViewName = `temp_export_view_${Date.now()}`;
    await connection.query(`CREATE TEMPORARY VIEW ${tempViewName} AS ${query}`);

    // Use the existing export function
    const result = await exportTableToFile(connection, tempViewName, options);

    // Clean up the temporary view
    await connection.query(`DROP VIEW IF EXISTS ${tempViewName}`);

    // Update the filename to use the provided name
    result.fileName = outputFileName;

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Query export failed';
    
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: errorMessage
    });

    throw new Error(`Query export failed: ${errorMessage}`);
  }
}

/**
 * Stream upload a blob to a URL with progress tracking
 */
export async function streamUploadBlob(
  blob: Blob,
  uploadUrl: string,
  options: {
    onProgress?: (progress: ExportProgress) => void;
    headers?: Record<string, string>;
    method?: string;
  } = {}
): Promise<Response> {
  const { onProgress, headers = {}, method = 'POST' } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress?.({
          stage: 'uploading',
          progress: percentComplete,
          message: `Uploading... ${formatBytes(event.loaded)} / ${formatBytes(event.total)}`,
          bytesProcessed: event.loaded,
          totalBytes: event.total
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({
          stage: 'complete',
          progress: 100,
          message: 'Upload complete',
          bytesProcessed: blob.size,
          totalBytes: blob.size
        });
        
        // Create a Response object to maintain compatibility
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders())
        });
        resolve(response);
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: Network error'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open(method, uploadUrl);
    
    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    // Create FormData and append the blob
    const formData = new FormData();
    formData.append('file', blob, blob.name || 'export.csv');

    xhr.send(formData);
  });
}

/**
 * Helper function to parse XHR headers into Headers object
 */
function parseHeaders(rawHeaders: string): Headers {
  const headers = new Headers();
  const lines = rawHeaders.trim().split(/[\r\n]+/);
  
  lines.forEach(line => {
    const parts = line.split(': ');
    const key = parts.shift();
    const value = parts.join(': ');
    if (key) {
      headers.append(key, value);
    }
  });
  
  return headers;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Test utility: Verify export functionality
 */
export async function testExportFunctionality(
  connection: AsyncDuckDBConnection
): Promise<boolean> {
  try {
    // Create a small test table
    await connection.query(`
      CREATE TEMPORARY TABLE IF NOT EXISTS test_export_table AS
      SELECT 
        1 as id,
        'Test' as name,
        CURRENT_TIMESTAMP as created_at
      UNION ALL
      SELECT 2, 'Export', CURRENT_TIMESTAMP
      UNION ALL
      SELECT 3, 'Utility', CURRENT_TIMESTAMP
    `);

    // Test CSV export
    const csvResult = await exportTableToFile(connection, 'test_export_table', {
      format: 'csv',
      header: true
    });

    if (!csvResult.blob || csvResult.size === 0) {
      throw new Error('CSV export produced empty result');
    }

    // Test Parquet export
    const parquetResult = await exportTableToFile(connection, 'test_export_table', {
      format: 'parquet'
    });

    if (!parquetResult.blob || parquetResult.size === 0) {
      throw new Error('Parquet export produced empty result');
    }

    // Clean up
    await connection.query('DROP TABLE IF EXISTS test_export_table');

    console.log('[ExportUtils] Test successful:', {
      csv: `${csvResult.size} bytes`,
      parquet: `${parquetResult.size} bytes`
    });

    return true;

  } catch (error) {
    console.error('[ExportUtils] Test failed:', error);
    return false;
  }
}