import { useCallback } from 'react';
import { useQueryResultsImport } from './useQueryResultsImport';

interface ExportData {
  results: any[];
  columns: string[];
  query?: string;
  sourceFileName?: string;
}

interface ActiveFile {
  fileName?: string;
  tableName?: string;
}

interface RestAPIConfig {
  endpoint: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  authentication: {
    type: 'none' | 'bearer' | 'api-key' | 'basic';
    value?: string;
    headerName?: string;
  };
  dataFormat: 'json' | 'csv' | 'ndjson';
  batchSize: number;
  includeMetadata: boolean;
}

interface LocalTableConfig {
  tableName: string;
}

type ExportProvider = 'local-table' | 'rest-api';
type ExportConfig = LocalTableConfig | RestAPIConfig;

export const useExportProvider = (
  exportData: ExportData,
  activeFile?: ActiveFile | null,
  onSuccess?: () => void
) => {
  const { importQueryResultsAsTable } = useQueryResultsImport();

  const handleExportWithProvider = useCallback(async (
    provider: ExportProvider, 
    config: ExportConfig
  ) => {
    const { results, columns, query, sourceFileName } = exportData;
    
    if (!results || !columns) {
      console.warn('[Export] No results or columns available for export');
      return;
    }

    if (provider === 'local-table') {
      // Handle local table export
      const localConfig = config as LocalTableConfig;
      const finalSourceFileName = sourceFileName || activeFile?.fileName || activeFile?.tableName;
      
      try {
        const success = await importQueryResultsAsTable(
          results,
          columns,
          finalSourceFileName,
          query,
          localConfig.tableName
        );
        
        if (success && onSuccess) {
          onSuccess();
        }
      } catch (error) {
        console.error('[Export] Local table export failed:', error);
        throw error;
      }
    } else if (provider === 'rest-api') {
      // Handle REST API export
      const apiConfig = config as RestAPIConfig;
      
      try {
        const { 
          endpoint, 
          method, 
          headers, 
          authentication, 
          dataFormat, 
          batchSize, 
          includeMetadata 
        } = apiConfig;
        
        // Build auth headers
        const authHeaders: Record<string, string> = {};
        if (authentication.type === 'bearer' && authentication.value) {
          authHeaders['Authorization'] = `Bearer ${authentication.value}`;
        } else if (authentication.type === 'api-key' && authentication.value && authentication.headerName) {
          authHeaders[authentication.headerName] = authentication.value;
        } else if (authentication.type === 'basic' && authentication.value) {
          const encoded = btoa(authentication.value);
          authHeaders['Authorization'] = `Basic ${encoded}`;
        }
        
        // Prepare metadata
        const metadata = includeMetadata ? {
          source: sourceFileName || activeFile?.fileName || activeFile?.tableName || 'DataKit Export',
          timestamp: new Date().toISOString(),
          totalRows: results.length,
          columns: columns,
          query: query,
        } : null;
        
        // Helper function to convert data to specific format
        const convertToFormat = (data: any[], includeHeader = true) => {
          if (dataFormat === 'csv') {
            const csvRows = [];
            if (includeHeader) {
              csvRows.push(columns.join(','));
            }
            csvRows.push(...data.map(row => 
              columns.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return '';
                const str = String(val);
                return str.includes(',') || str.includes('"') || str.includes('\n') 
                  ? `"${str.replace(/"/g, '""')}"` 
                  : str;
              }).join(',')
            ));
            return csvRows.join('\n');
          } else if (dataFormat === 'ndjson') {
            return data.map(row => JSON.stringify(row)).join('\n');
          } else {
            // JSON format
            return JSON.stringify({
              ...(metadata && { metadata }),
              data,
            });
          }
        };
        
        // Set content type
        const finalHeaders = { ...headers };
        if (dataFormat === 'csv') {
          finalHeaders['Content-Type'] = 'text/csv';
        } else if (dataFormat === 'ndjson') {
          finalHeaders['Content-Type'] = 'application/x-ndjson';
        } else {
          finalHeaders['Content-Type'] = 'application/json';
        }
        
        // Send in batches if needed
        const batches = [];
        for (let i = 0; i < results.length; i += batchSize) {
          batches.push(results.slice(i, i + batchSize));
        }
        
        console.log(`[Export] Sending ${batches.length} batch(es) to ${endpoint}`);
        
        // Send requests
        for (let i = 0; i < batches.length; i++) {
          const batchData = batches[i];
          let batchBody: string;
          
          if (dataFormat === 'json') {
            // For JSON, include metadata only in first batch
            const batchMetadata = metadata && i === 0 
              ? { ...metadata, batchNumber: i + 1, totalBatches: batches.length }
              : null;
            
            batchBody = JSON.stringify({
              ...(batchMetadata && { metadata: batchMetadata }),
              data: batchData,
            });
          } else {
            // For CSV/NDJSON, convert batch data
            batchBody = convertToFormat(batchData, i === 0); // Include header only in first batch for CSV
          }
          
          const response = await fetch(endpoint, {
            method,
            headers: {
              ...finalHeaders,
              ...authHeaders,
            },
            body: batchBody,
          });
          
          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }
          
          console.log(`[Export] Batch ${i + 1}/${batches.length} sent successfully`);
        }
        
        console.log('[Export] All data exported successfully');
        
        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        console.error('[Export] API export failed:', error);
        alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }
  }, [exportData, activeFile, importQueryResultsAsTable, onSuccess]);

  return {
    handleExportWithProvider,
  };
};