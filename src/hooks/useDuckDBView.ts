import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDuckDBViewStore, type QueryParams, type ChangeRecord, type ColumnSchema, type PaginatedResult, type FilterCondition } from '@/store/duckDBViewStore';

interface UseDuckDBViewOptions {
  initialPageSize?: number;
  autoQuery?: boolean;
}

interface ViewState {
  viewName: string | null;
  schema: ColumnSchema[];
  totalRows: number;
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
}

export function useDuckDBView(options: UseDuckDBViewOptions = {}) {
  const { initialPageSize = 50, autoQuery = true } = options;

  const {
    initialize,
    createViewFromFile,
    createViewFromData,
    dropView,
    queryView,
    executeSQL,
    validateSQL,
    exportView,
    refreshViewSchema,
    addColumnWithVersion: storeAddColumnWithVersion,
    views,
    activeViewName,
    isLoading: storeLoading,
    error: storeError,
    pendingChanges: storePendingChanges,
    recordChange,
    undoLastChange,
    discardChanges,
    commitChanges,
    getPendingChanges,
    resetError,
    undoVersion: storeUndoVersion,
    redoVersion: storeRedoVersion,
    canUndoVersion: storeCanUndoVersion,
    canRedoVersion: storeCanRedoVersion,
    getVersionInfo: storeGetVersionInfo,
    committedVersions: storeCommittedVersions,
    currentVersionIndex: storeCurrentVersionIndex,
  } = useDuckDBViewStore();

  // Local state
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 0,
    pageSize: initialPageSize,
  });
  const [queryResult, setQueryResult] = useState<PaginatedResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Get current view definition
  const viewDef = activeViewName ? views.get(activeViewName) : null;

  // Combined view state
  const viewState: ViewState = useMemo(() => ({
    viewName: activeViewName,
    schema: viewDef?.schema || [],
    totalRows: queryResult?.totalRows ?? viewDef?.totalRows ?? 0,
    isLoading: storeLoading,
    error: storeError || localError,
    isReady: !!activeViewName && !!viewDef,
  }), [activeViewName, viewDef, queryResult, storeLoading, storeError, localError]);

  // Get pending changes for current view
  const pendingChanges = useMemo(() => {
    if (!activeViewName) return [];
    return getPendingChanges(activeViewName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storePendingChanges triggers re-computation when store changes
  }, [activeViewName, storePendingChanges, getPendingChanges]);

  // Initialize DuckDB on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Merge data with pending changes for display - defined before useEffect that uses it
  const mergeDataWithChanges = useCallback((
    originalData: Record<string, unknown>[],
    changes: ChangeRecord[]
  ): Record<string, unknown>[] => {
    if (changes.length === 0) return originalData;

    return originalData.map(row => {
      const rowId = row._rowid as number;
      const rowChanges = changes.filter(c => c.rowId === rowId && c.changeType !== 'delete');

      if (rowChanges.length === 0) return row;

      const modifiedRow: Record<string, unknown> = { ...row, _hasChanges: true };
      rowChanges.forEach(change => {
        modifiedRow[change.column] = change.newValue;
        modifiedRow[`_changed_${change.column}`] = true;
      });

      return modifiedRow;
    }).filter(row => {
      // Filter out deleted rows
      const rowId = row._rowid as number;
      return !changes.some(c => c.rowId === rowId && c.changeType === 'delete');
    });
  }, []);

  // Query data when params change
  useEffect(() => {
    if (!activeViewName || !autoQuery) return;

    const fetchData = async () => {
      const result = await queryView(activeViewName, queryParams);
      if (result) {
        setQueryResult(result);
        // Merge with pending changes for optimistic display
        const mergedData = mergeDataWithChanges(result.data, pendingChanges);
        setData(mergedData);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mergeDataWithChanges and pendingChanges intentionally excluded
  }, [activeViewName, queryParams, queryView, autoQuery]);

  // Load file and create view
  const loadFile = useCallback(async (file: File, viewName?: string) => {
    setLocalError(null);
    const result = await createViewFromFile(file, viewName);
    if (result) {
      setQueryParams(prev => ({ ...prev, page: 0 }));
    }
    return result;
  }, [createViewFromFile]);

  // Load data array and create view
  const loadData = useCallback(async (
    viewName: string,
    dataArray: Record<string, unknown>[],
    columns: string[]
  ) => {
    setLocalError(null);
    const result = await createViewFromData(viewName, dataArray, columns);
    if (result) {
      setQueryParams(prev => ({ ...prev, page: 0 }));
    }
    return result;
  }, [createViewFromData]);

  // Refresh current query
  const refresh = useCallback(async () => {
    if (!activeViewName) return;
    const result = await queryView(activeViewName, queryParams);
    if (result) {
      setQueryResult(result);
      // Get fresh pending changes from store to avoid stale closure
      // (important when called from undo() where store has updated but React hasn't re-rendered)
      const freshPendingChanges = getPendingChanges(activeViewName);
      const mergedData = mergeDataWithChanges(result.data, freshPendingChanges);
      setData(mergedData);
    }
  }, [activeViewName, queryParams, queryView, getPendingChanges, mergeDataWithChanges]);

  // Pagination
  const setPage = useCallback((page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setQueryParams(prev => ({ ...prev, pageSize, page: 0 }));
  }, []);

  const nextPage = useCallback(() => {
    if (queryResult && queryParams.page < queryResult.totalPages - 1) {
      setQueryParams(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [queryResult, queryParams.page]);

  const prevPage = useCallback(() => {
    if (queryParams.page > 0) {
      setQueryParams(prev => ({ ...prev, page: prev.page - 1 }));
    }
  }, [queryParams.page]);

  // Sorting
  const setSort = useCallback((column: string | null, direction?: 'ASC' | 'DESC') => {
    setQueryParams(prev => ({
      ...prev,
      sortColumn: column || undefined,
      sortDirection: column ? (direction || 'ASC') : undefined,
      page: 0,
    }));
  }, []);

  const toggleSort = useCallback((column: string) => {
    setQueryParams(prev => {
      if (prev.sortColumn === column) {
        if (prev.sortDirection === 'ASC') {
          return { ...prev, sortDirection: 'DESC' as const };
        } else {
          return { ...prev, sortColumn: undefined, sortDirection: undefined };
        }
      }
      return { ...prev, sortColumn: column, sortDirection: 'ASC' as const, page: 0 };
    });
  }, []);

  // Search
  const setSearch = useCallback((search: string, columns?: string[]) => {
    setQueryParams(prev => ({
      ...prev,
      search: search || undefined,
      searchColumns: columns,
      page: 0,
    }));
  }, []);

  // Filtering
  const addFilter = useCallback((filter: FilterCondition) => {
    setQueryParams(prev => ({
      ...prev,
      filters: [...(prev.filters || []), filter],
      page: 0,
    }));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setQueryParams(prev => ({
      ...prev,
      filters: prev.filters?.filter((_, i) => i !== index),
      page: 0,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setQueryParams(prev => ({
      ...prev,
      filters: undefined,
      page: 0,
    }));
  }, []);

  // Cell editing
  const editCell = useCallback((rowId: number, column: string, newValue: unknown) => {
    if (!activeViewName) return;

    // Find current value
    const row = data.find(r => r._rowid === rowId);
    const oldValue = row ? row[column] : undefined;

    // Skip if value hasn't changed
    if (oldValue === newValue) return;

    // Record the change
    recordChange({
      viewName: activeViewName,
      rowId,
      column,
      oldValue,
      newValue,
      changeType: 'update',
      source: 'user',
    });

    // Optimistic update
    setData(prevData => prevData.map(r =>
      r._rowid === rowId
        ? { ...r, [column]: newValue, _hasChanges: true, [`_changed_${column}`]: true }
        : r
    ));
  }, [activeViewName, data, recordChange]);

  // Delete row
  const deleteRow = useCallback((rowId: number) => {
    if (!activeViewName) return;

    const row = data.find(r => r._rowid === rowId);
    if (!row) return;

    recordChange({
      viewName: activeViewName,
      rowId,
      column: '*',
      oldValue: row,
      newValue: null,
      changeType: 'delete',
      source: 'user',
    });

    // Optimistic update - remove from display
    setData(prevData => prevData.filter(r => r._rowid !== rowId));
  }, [activeViewName, data, recordChange]);

  // Undo
  const undo = useCallback(() => {
    if (!activeViewName) return null;
    const undone = undoLastChange(activeViewName);
    if (undone) {
      // Refresh to get correct data
      refresh();
    }
    return undone;
  }, [activeViewName, undoLastChange, refresh]);

  // Discard all changes
  const discard = useCallback(() => {
    if (!activeViewName) return;
    discardChanges(activeViewName);
    refresh();
  }, [activeViewName, discardChanges, refresh]);

  // Commit changes
  const commit = useCallback(async () => {
    if (!activeViewName) return false;
    const success = await commitChanges(activeViewName);
    if (success) {
      refresh();
    }
    return success;
  }, [activeViewName, commitChanges, refresh]);

  // Close view
  const closeView = useCallback(async () => {
    if (!activeViewName) return;
    await dropView(activeViewName);
    setData([]);
    setQueryResult(null);
  }, [activeViewName, dropView]);

  // Clear error
  const clearError = useCallback(() => {
    setLocalError(null);
    resetError();
  }, [resetError]);

  // Export data to file and trigger download
  const exportData = useCallback(async (format: 'csv' | 'json' | 'parquet', fileName?: string) => {
    if (!activeViewName) return false;

    const blob = await exportView(activeViewName, format, fileName);
    if (!blob) return false;

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `${activeViewName}_export.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  }, [activeViewName, exportView]);

  // Version navigation - undo a committed version
  const undoCommittedVersion = useCallback(async () => {
    if (!activeViewName) return false;
    const success = await storeUndoVersion(activeViewName);
    if (success) {
      refresh();
    }
    return success;
  }, [activeViewName, storeUndoVersion, refresh]);

  // Version navigation - redo a committed version
  const redoCommittedVersion = useCallback(async () => {
    if (!activeViewName) return false;
    const success = await storeRedoVersion(activeViewName);
    if (success) {
      refresh();
    }
    return success;
  }, [activeViewName, storeRedoVersion, refresh]);

  // Check if can undo version
  const canUndoVersion = useMemo(() => {
    if (!activeViewName) return false;
    return storeCanUndoVersion(activeViewName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storeCommittedVersions and storeCurrentVersionIndex trigger re-computation when store changes
  }, [activeViewName, storeCanUndoVersion, storeCommittedVersions, storeCurrentVersionIndex]);

  // Check if can redo version
  const canRedoVersion = useMemo(() => {
    if (!activeViewName) return false;
    return storeCanRedoVersion(activeViewName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storeCommittedVersions and storeCurrentVersionIndex trigger re-computation when store changes
  }, [activeViewName, storeCanRedoVersion, storeCommittedVersions, storeCurrentVersionIndex]);

  // Get version info
  const versionInfo = useMemo(() => {
    if (!activeViewName) return { current: 0, total: 0, description: null };
    return storeGetVersionInfo(activeViewName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storeCommittedVersions and storeCurrentVersionIndex trigger re-computation when store changes
  }, [activeViewName, storeGetVersionInfo, storeCommittedVersions, storeCurrentVersionIndex]);

  // Refresh schema (useful after ALTER TABLE)
  const refreshSchema = useCallback(async () => {
    if (!activeViewName) return false;
    return refreshViewSchema(activeViewName);
  }, [activeViewName, refreshViewSchema]);

  // Add column with version tracking
  const addColumn = useCallback(async (columnName: string, columnType: string) => {
    if (!activeViewName) return false;
    const success = await storeAddColumnWithVersion(activeViewName, columnName, columnType);
    if (success) {
      // Refresh data after adding column
      await refresh();
    }
    return success;
  }, [activeViewName, storeAddColumnWithVersion, refresh]);

  return {
    // State
    viewState,
    data,
    queryParams,
    queryResult,
    pendingChanges,
    hasPendingChanges: pendingChanges.length > 0,

    // File operations
    loadFile,
    loadData,
    closeView,
    refresh,

    // Pagination
    setPage,
    setPageSize,
    nextPage,
    prevPage,

    // Sorting
    setSort,
    toggleSort,

    // Search & Filter
    setSearch,
    addFilter,
    removeFilter,
    clearFilters,

    // Cell editing
    editCell,
    deleteRow,

    // Change management
    undo,
    discard,
    commit,

    // Version navigation (committed changes)
    undoCommittedVersion,
    redoCommittedVersion,
    canUndoVersion,
    canRedoVersion,
    versionInfo,

    // Schema operations
    addColumn,
    refreshSchema,

    // Utilities
    clearError,
    executeSQL,
    validateSQL,

    // Export
    exportData,
  };
}

export default useDuckDBView;
