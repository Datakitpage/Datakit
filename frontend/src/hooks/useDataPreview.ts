import { useState, useCallback, useEffect } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';
import { useDataPreviewStore } from '@/store/dataPreviewStore';
import { selectActiveFile } from '@/store/selectors/appSelectors';
import { postgreSQLService } from '@/lib/api/postgresService';

interface DataPreviewResult {
  // Data state
  results: string[][] | null;
  columns: string[] | null;
  error: string | null;
  
  // Pagination state
  totalRows: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  
  // Loading states
  isLoading: boolean;
  isChangingPage: boolean;
  isCountLoading: boolean;
  
  // Functions
  loadInitialData: () => Promise<void>;
  changePage: (newPage: number) => Promise<void>;
  changeRowsPerPage: (newRowsPerPage: number) => Promise<void>;
  refreshData: () => Promise<void>;
}

/**
 * Custom hook for data preview with pagination
 * Follows the same pattern as useQueryExecution for consistency
 */
export const useDataPreview = (targetFileId?: string): DataPreviewResult => {
  const activeFile = useAppStore(selectActiveFile);
  const { executePaginatedQuery, getObjectType, ensureTableExists } = useDuckDBStore();
  
  const { 
    getFileState, 
    updateFileState, 
    initializeFileState 
  } = useDataPreviewStore();
  
  // Local loading state for page changes
  const [isChangingPage, setIsChangingPage] = useState(false);
  
  // Use provided fileId or fall back to active file
  const fileId = targetFileId || activeFile?.id || '';
  const fileState = getFileState(fileId) || {
    currentPage: 1,
    rowsPerPage: 1000,
    totalRows: 0,
    totalPages: 0,
    data: null,
    columns: null,
    isLoading: false,
    isCountLoading: false,
    error: null,
    lastFetchTime: 0,
  };
  
  // Get current file based on fileId parameter
  const currentFile = targetFileId 
    ? useAppStore.getState().files.find(f => f.id === targetFileId)
    : activeFile;

  // Initialize file state when file changes
  useEffect(() => {
    if (fileId) {
      initializeFileState(fileId);
    }
  }, [fileId, initializeFileState]);
  
  /**
   * Load initial data for the target file
   */
  const loadInitialData = useCallback(async () => {
    if (!currentFile?.tableName || !fileId) return;
    
    const existingState = getFileState(fileId);
    
    // If we already have data cached and it's recent (< 5 minutes), use it
    if (existingState?.data && existingState.lastFetchTime > Date.now() - 5 * 60 * 1000) {
      console.log('[useDataPreview] Using cached data for file:', currentFile.fileName);
      return;
    }
    
    try {
      updateFileState(fileId, { 
        isLoading: true, 
        error: null 
      });
      
      const tableName = currentFile.tableName;
      
      // Check if this is a remote PostgreSQL table
      if (currentFile.isRemote && currentFile.remoteProvider === 'postgresql') {
        console.log(`[useDataPreview] Loading remote PostgreSQL data for ${currentFile.fileName}`);
        
        // Extract PostgreSQL connection info from the file metadata
        const postgresqlInfo = (currentFile as any).postgresql;
        if (!postgresqlInfo) {
          throw new Error('PostgreSQL connection information not found');
        }
        
        const { connectionId, schema, table: tableNameOnly } = postgresqlInfo;
        
        if (!schema || !tableNameOnly) {
          throw new Error(`Invalid PostgreSQL table metadata: schema="${schema}", table="${tableNameOnly}"`);
        }
        const pageSize = fileState.rowsPerPage || 1000;
        
        // Execute query through backend PostgreSQL proxy
        const query = {
          sql: `SELECT * FROM "${schema}"."${tableNameOnly}" LIMIT ${pageSize}`,
          timeout: 30000,
        };
        
        console.log(`[useDataPreview] Executing PostgreSQL query:`, query.sql);
        
        const result = await postgreSQLService.executeQuery(connectionId, query);
        
        if (result.success && result.data) {
          // Transform PostgreSQL API response to data grid format
          const headers = result.columns?.map(col => col.name) || [];
          const dataRows = result.data || [];
          
          // Convert PostgreSQL result objects to string arrays
          const dataWithRowNumbers = dataRows.map((rowObj, index) => {
            const rowArray = headers.map(header => String(rowObj[header] || ''));
            return [(index + 1).toString(), ...rowArray];
          });
          
          // Add header row with row number column
          const fullData = [
            [' ', ...headers],
            ...dataWithRowNumbers
          ];
          
          updateFileState(fileId, {
            data: fullData,
            columns: headers,
            totalRows: result.metadata?.rowCount || dataRows.length,
            totalPages: Math.ceil((result.metadata?.rowCount || dataRows.length) / pageSize),
            currentPage: 1,
            isLoading: false,
            lastFetchTime: Date.now(),
          });
          
          console.log(`[useDataPreview] PostgreSQL data loaded: ${dataRows.length} rows, ${headers.length} columns`);
        } else {
          throw new Error(result.error?.message || 'Failed to execute PostgreSQL query');
        }
        return;
      }
      
      // For non-PostgreSQL tables, ensure table exists and get correct name
      if (!tableName || tableName.trim() === '') {
        throw new Error('Invalid table name for DuckDB query');
      }

      // Fix table synchronization issues using our new method
      const actualTableName = await ensureTableExists(tableName);
      if (!actualTableName) {
        throw new Error(`Table "${tableName}" not found in database`);
      }

      // Update the file in app store if table name was corrected
      if (actualTableName !== tableName && currentFile) {
        console.log(`[useDataPreview] Correcting table name: ${tableName} → ${actualTableName}`);
        const appStore = useAppStore.getState();
        appStore.updateFile(currentFile.id, { tableName: actualTableName });
      }
      
      const query = `SELECT * FROM "${actualTableName}"`;
      
      console.log(`[useDataPreview] Loading initial data for ${actualTableName}`);
      
      // First, get the initial page of data quickly (NO COUNT for speed)
      const result = await executePaginatedQuery(
        query, 
        1, 
        fileState.rowsPerPage || 1000,
        true,  // applyPagination
        false  // countTotalRows - SKIP COUNT for instant loading!
      );
      
      if (result) {
        // Extract headers and data
        const headers = result.columns;
        const dataWithoutHeaders = result.data;
        
        // Convert objects to string arrays (DuckDB returns objects, Grid expects string[][])
        const dataWithRowNumbers = dataWithoutHeaders.map((rowObj, index) => {
          // Convert object to array of strings in the same order as headers
          const rowArray = headers.map(header => String(rowObj[header] || ''));
          return [(index + 1).toString(), ...rowArray];
        });
        
        // Add header row with row number column
        const fullData = [
          [' ', ...headers],
          ...dataWithRowNumbers
        ];
        
        updateFileState(fileId, {
          data: fullData,
          columns: headers,
          totalRows: 0, // We'll get this from background count
          totalPages: 0, // We'll calculate this when count completes
          currentPage: 1,
          isLoading: false,
          lastFetchTime: Date.now(),
        });
        
        // Start background count for exact totals (progressive loading)
        // Skip counting for views to avoid blocking
        loadExactCount(fileId, tableName);
      }
    } catch (err) {
      console.error('[useDataPreview] Error loading initial data:', err);
      updateFileState(fileId, {
        error: err instanceof Error ? err.message : 'Failed to load data',
        isLoading: false,
      });
    }
  }, [currentFile, fileId, executePaginatedQuery, fileState.rowsPerPage, getFileState, updateFileState, ensureTableExists]);
  
  /**
   * Load exact row count in background (progressive loading)
   * Skip counting for views to avoid blocking DuckDB
   */
  const loadExactCount = useCallback(async (fileId: string, tableName: string) => {
    try {
      // Check if this is a view - if so, skip counting
      const objectType = await getObjectType(tableName);
      
      if (objectType === 'view') {
        console.log(`[useDataPreview] Skipping count for view: ${tableName}`);
        updateFileState(fileId, {
          totalRows: -1, // -1 indicates unknown/unlimited
          totalPages: -1, // -1 indicates unknown/unlimited
          isCountLoading: false,
        });
        return;
      }
      
      updateFileState(fileId, { isCountLoading: true });
      
      const countQuery = `SELECT COUNT(*) as total_rows FROM "${tableName}"`;
      console.log(`[useDataPreview] Getting exact count for table: ${tableName}`);
      
      const result = await executePaginatedQuery(
        countQuery, 
        1, 
        1,
        false, // no pagination for count query
        false  // no need to count the count query
      );
      
      if (result && result.data.length > 0) {
        const totalRows = Number(result.data[0].total_rows) || 0;
        const currentState = getFileState(fileId);
        const rowsPerPage = currentState?.rowsPerPage || 1000;
        
        updateFileState(fileId, {
          totalRows,
          totalPages: Math.ceil(totalRows / rowsPerPage),
          isCountLoading: false,
        });
      }
    } catch (err) {
      console.error('[useDataPreview] Error getting exact count:', err);
      updateFileState(fileId, { isCountLoading: false });
    }
  }, [executePaginatedQuery, getFileState, updateFileState, getObjectType]);
  
  /**
   * Change to a different page of results
   */
  const changePage = useCallback(async (newPage: number) => {
    if (!activeFile?.tableName || !activeFile?.id) return;
    
    const currentState = getFileState(activeFile.id);
    if (!currentState) return;
    
    // For views (totalPages = -1), allow any page number >= 1
    // For tables, respect the totalPages limit
    if (newPage < 1 || newPage === currentState.currentPage) {
      return;
    }
    
    // For regular tables, check page bounds
    if (currentState.totalPages > 0 && newPage > currentState.totalPages) {
      return;
    }
    
    try {
      setIsChangingPage(true);
      updateFileState(activeFile.id, { error: null });
      
      const tableName = activeFile.tableName;
      
      // Check if this is a remote PostgreSQL table
      if (activeFile.isRemote && activeFile.remoteProvider === 'postgresql') {
        console.log(`[useDataPreview] Changing PostgreSQL page to ${newPage}`);
        
        const postgresqlInfo = (activeFile as any).postgresql;
        if (!postgresqlInfo) {
          throw new Error('PostgreSQL connection information not found');
        }
        
        const { connectionId, schema, table: tableNameOnly } = postgresqlInfo;
        const offset = (newPage - 1) * currentState.rowsPerPage;
        
        const query = {
          sql: `SELECT * FROM "${schema}"."${tableNameOnly}" LIMIT ${currentState.rowsPerPage} OFFSET ${offset}`,
          timeout: 30000,
        };
        
        const result = await postgreSQLService.executeQuery(connectionId, query);
        
        if (result.success && result.data) {
          const headers = result.columns?.map(col => col.name) || [];
          const dataRows = result.data || [];
          
          const dataWithRowNumbers = dataRows.map((rowObj, index) => {
            const rowArray = headers.map(header => String(rowObj[header] || ''));
            return [(offset + index + 1).toString(), ...rowArray];
          });
          
          const fullData = [
            [' ', ...headers],
            ...dataWithRowNumbers
          ];
          
          updateFileState(activeFile.id, {
            data: fullData,
            currentPage: newPage,
            lastFetchTime: Date.now(),
          });
        } else {
          throw new Error(result.error?.message || 'Failed to execute PostgreSQL query');
        }
      } else {
        // Regular DuckDB table pagination with table sync fix
        if (!tableName || tableName.trim() === '') {
          throw new Error('Invalid table name for DuckDB query');
        }

        // Ensure table exists and get correct name
        const actualTableName = await ensureTableExists(tableName);
        if (!actualTableName) {
          throw new Error(`Table "${tableName}" not found in database`);
        }

        // Update the file if table name was corrected
        if (actualTableName !== tableName) {
          console.log(`[useDataPreview] Correcting table name for pagination: ${tableName} → ${actualTableName}`);
          const appStore = useAppStore.getState();
          appStore.updateFile(activeFile.id, { tableName: actualTableName });
        }
        
        const query = `SELECT * FROM "${actualTableName}"`;
        
        console.log(`[useDataPreview] Changing to page ${newPage} for table ${actualTableName}`);
        
        const result = await executePaginatedQuery(
          query,
          newPage,
          currentState.rowsPerPage,
          true,  // applyPagination
          false  // don't count again, we already have it
        );
      
        if (result) {
          // Process data with row numbers - convert objects to string arrays
          const offset = (newPage - 1) * currentState.rowsPerPage;
          const dataWithRowNumbers = result.data.map((rowObj, index) => {
            const rowArray = result.columns.map(header => String(rowObj[header] || ''));
            return [(offset + index + 1).toString(), ...rowArray];
          });
          
          const fullData = [
            [' ', ...result.columns],
            ...dataWithRowNumbers
          ];
          
          updateFileState(activeFile.id, {
            data: fullData,
            currentPage: newPage,
            lastFetchTime: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error('[useDataPreview] Page change error:', err);
      updateFileState(activeFile.id, {
        error: err instanceof Error ? err.message : 'Error fetching page data',
      });
    } finally {
      setIsChangingPage(false);
    }
  }, [activeFile, executePaginatedQuery, getFileState, updateFileState, ensureTableExists]);
  
  /**
   * Change the number of rows per page
   */
  const changeRowsPerPage = useCallback(async (newRowsPerPage: number) => {
    if (!activeFile?.tableName || !activeFile?.id) return;
    
    try {
      setIsChangingPage(true);
      updateFileState(activeFile.id, { 
        error: null,
        rowsPerPage: newRowsPerPage 
      });
      
      const tableName = activeFile.tableName;
      
      // Check if this is a remote PostgreSQL table
      if (activeFile.isRemote && activeFile.remoteProvider === 'postgresql') {
        console.log(`[useDataPreview] Changing PostgreSQL rows per page to ${newRowsPerPage}`);
        
        const postgresqlInfo = (activeFile as any).postgresql;
        if (!postgresqlInfo) {
          throw new Error('PostgreSQL connection information not found');
        }
        
        const { connectionId, schema, table: tableNameOnly } = postgresqlInfo;
        
        const query = {
          sql: `SELECT * FROM "${schema}"."${tableNameOnly}" LIMIT ${newRowsPerPage}`,
          timeout: 30000,
        };
        
        const result = await postgreSQLService.executeQuery(connectionId, query);
        
        if (result.success && result.data) {
          const headers = result.columns?.map(col => col.name) || [];
          const dataRows = result.data || [];
          
          const dataWithRowNumbers = dataRows.map((rowObj, index) => {
            const rowArray = headers.map(header => String(rowObj[header] || ''));
            return [(index + 1).toString(), ...rowArray];
          });
          
          const fullData = [
            [' ', ...headers],
            ...dataWithRowNumbers
          ];
          
          const currentState = getFileState(activeFile.id);
          const existingTotalRows = currentState?.totalRows || 0;
          
          updateFileState(activeFile.id, {
            data: fullData,
            columns: headers,
            totalPages: existingTotalRows > 0 ? Math.ceil(existingTotalRows / newRowsPerPage) : 0,
            currentPage: 1,
            lastFetchTime: Date.now(),
          });
        } else {
          throw new Error(result.error?.message || 'Failed to execute PostgreSQL query');
        }
      } else {
        // Regular DuckDB table pagination
        if (!tableName || tableName.trim() === '') {
          throw new Error('Invalid table name for DuckDB query');
        }
        
        const query = `SELECT * FROM "${tableName}"`;
        
        console.log(`[useDataPreview] Changing rows per page to ${newRowsPerPage}`);
        
        const result = await executePaginatedQuery(
          query, 
          1, 
          newRowsPerPage,
          true,  // applyPagination
          false  // don't recount, use existing count
        );
        
        if (result) {
          // Process data with row numbers - convert objects to string arrays
          const dataWithRowNumbers = result.data.map((rowObj, index) => {
            const rowArray = result.columns.map(header => String(rowObj[header] || ''));
            return [(index + 1).toString(), ...rowArray];
          });
          
          const fullData = [
            [' ', ...result.columns],
            ...dataWithRowNumbers
          ];
          
          const currentState = getFileState(activeFile.id);
          const existingTotalRows = currentState?.totalRows || 0;
          
          updateFileState(activeFile.id, {
            data: fullData,
            columns: result.columns,
            totalPages: existingTotalRows > 0 ? Math.ceil(existingTotalRows / newRowsPerPage) : 0,
            currentPage: 1,
            lastFetchTime: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error('[useDataPreview] Rows per page change error:', err);
      updateFileState(activeFile.id, {
        error: err instanceof Error ? err.message : 'Error changing results per page',
      });
    } finally {
      setIsChangingPage(false);
    }
  }, [activeFile, executePaginatedQuery, updateFileState, getFileState]);
  
  /**
   * Refresh current page data
   */
  const refreshData = useCallback(async () => {
    if (!activeFile?.id) return;
    
    const currentState = getFileState(activeFile.id);
    if (!currentState) return;
    
    // Clear cache timestamp to force reload
    updateFileState(activeFile.id, { lastFetchTime: 0 });
    
    // Reload current page
    if (currentState.currentPage === 1) {
      await loadInitialData();
    } else {
      await changePage(currentState.currentPage);
    }
  }, [activeFile, getFileState, updateFileState, loadInitialData, changePage]);
  
  return {
    // Data
    results: fileState.data,
    columns: fileState.columns,
    error: fileState.error,
    
    // Pagination
    totalRows: fileState.totalRows || 0,
    currentPage: fileState.currentPage,
    totalPages: fileState.totalPages,
    rowsPerPage: fileState.rowsPerPage,
    
    // Loading states
    isLoading: fileState.isLoading,
    isChangingPage,
    isCountLoading: fileState.isCountLoading,
    
    // Functions
    loadInitialData,
    changePage,
    changeRowsPerPage,
    refreshData,
  };
};