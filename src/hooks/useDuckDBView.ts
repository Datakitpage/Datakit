import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDuckDBViewStore, type QueryParams, type ChangeRecord, type ColumnSchema, type PaginatedResult, type FilterCondition } from '@/store/duckDBViewStore';
import { parseFormula, translateToSQL, isFormula, type FormulaResult } from '@/lib/formulas';

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

// Formula cell tracking for auto-recalculation
export interface FormulaCell {
  formula: string;
  dependencies: Set<string>;
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
    dataVersion: storeDataVersion,
  } = useDuckDBViewStore();

  // Local state
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 0,
    pageSize: initialPageSize,
  });
  const [queryResult, setQueryResult] = useState<PaginatedResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Formula tracking for auto-recalculation
  // Maps "rowId:column" -> { formula, dependencies: Set<columnName> }
  const [formulaCells, setFormulaCells] = useState<Map<string, FormulaCell>>(new Map());
  const [pendingRecalcColumn, setPendingRecalcColumn] = useState<string | null>(null);

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

  // Track the data version for the active view to re-query when underlying data is replaced
  const activeDataVersion = activeViewName ? storeDataVersion.get(activeViewName) : undefined;

  // Query data when params change or underlying data is refreshed (e.g. after sync/pull)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mergeDataWithChanges and pendingChanges intentionally excluded; activeDataVersion triggers re-query after data replacement
  }, [activeViewName, queryParams, queryView, autoQuery, activeDataVersion]);

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
  const editCell = useCallback((rowId: number, column: string, newValue: unknown, options?: { formula?: string; isFormulaResult?: boolean; skipRecalc?: boolean }) => {
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
      formula: options?.formula,
      isFormulaResult: options?.isFormulaResult,
    });

    // Optimistic update
    setData(prevData => prevData.map(r =>
      r._rowid === rowId
        ? { ...r, [column]: newValue, _hasChanges: true, [`_changed_${column}`]: true }
        : r
    ));

    // Trigger recalculation for dependent formulas (unless this is already a recalculation)
    if (!options?.skipRecalc && !options?.isFormulaResult) {
      setPendingRecalcColumn(column);
    }
  }, [activeViewName, data, recordChange]);

  // Recalculate formulas that depend on a changed column
  const recalculateDependentFormulas = useCallback(async (changedColumn: string) => {
    if (!viewDef || formulaCells.size === 0) return;

    // Find all formula cells that depend on the changed column
    const dependentFormulas: Array<{ cellKey: string; formula: string; rowId: number; column: string }> = [];

    formulaCells.forEach((formulaCell, cellKey) => {
      if (formulaCell.dependencies.has(changedColumn)) {
        const [rowIdStr, column] = cellKey.split(':');
        const rowId = parseInt(rowIdStr, 10);
        if (!isNaN(rowId)) {
          dependentFormulas.push({ cellKey, formula: formulaCell.formula, rowId, column });
        }
      }
    });

    // Re-evaluate each dependent formula
    for (const { formula, rowId, column } of dependentFormulas) {
      const parseResult = parseFormula(formula, viewDef.schema);
      if (!parseResult.success) continue;

      const isAggregate = parseResult.ast.isAggregate;
      const { sql } = translateToSQL(parseResult.ast, {
        viewName: activeViewName!,
        rowId: isAggregate ? undefined : rowId,
        schema: viewDef.schema,
      });

      try {
        const result = await executeSQL(sql);
        if (result && result.length > 0) {
          const newValue = result[0].result;
          // Update cell with new value (skipRecalc to prevent infinite loop)
          editCell(rowId, column, newValue, { formula, isFormulaResult: true, skipRecalc: true });
        }
      } catch (err) {
        // Silently ignore errors in auto-recalculation
        console.warn(`Auto-recalculation failed for formula in ${column}:`, err);
      }
    }
  }, [activeViewName, viewDef, formulaCells, executeSQL, editCell]);

  // Trigger recalculation when a column changes
  useEffect(() => {
    if (pendingRecalcColumn) {
      recalculateDependentFormulas(pendingRecalcColumn);
      setPendingRecalcColumn(null);
    }
  }, [pendingRecalcColumn, recalculateDependentFormulas]);

  // Evaluate a formula and return the result
  const evaluateFormula = useCallback(async (
    formula: string,
    rowId: number,
    _column: string
  ): Promise<FormulaResult> => {
    if (!activeViewName || !viewDef) {
      return { success: false, error: 'No active view' };
    }

    // Check if input is a formula
    if (!isFormula(formula)) {
      return { success: false, error: 'Input is not a formula (must start with =)' };
    }

    // Parse the formula
    const parseResult = parseFormula(formula, viewDef.schema);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // Check if formula is aggregate (determines if rowId is used)
    const isAggregate = parseResult.ast.isAggregate;

    // Translate to SQL
    const { sql } = translateToSQL(parseResult.ast, {
      viewName: activeViewName,
      rowId: isAggregate ? undefined : rowId,
      schema: viewDef.schema,
    });

    // Execute the SQL
    try {
      const result = await executeSQL(sql);
      if (!result || result.length === 0) {
        return { success: false, error: 'No result returned from query' };
      }

      const value = result[0].result;
      return {
        success: true,
        value,
        sql,
        isAggregate,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Formula evaluation failed',
      };
    }
  }, [activeViewName, viewDef, executeSQL]);

  // Edit cell with formula - evaluates and applies the result
  const editCellWithFormula = useCallback(async (
    rowId: number,
    column: string,
    formula: string
  ): Promise<FormulaResult> => {
    const result = await evaluateFormula(formula, rowId, column);

    if (result.success && viewDef) {
      // Apply the computed value to the cell
      editCell(rowId, column, result.value, {
        formula,
        isFormulaResult: true,
      });

      // Track formula and its dependencies for auto-recalculation
      const parseResult = parseFormula(formula, viewDef.schema);
      if (parseResult.success) {
        const cellKey = `${rowId}:${column}`;
        const dependencies = new Set(parseResult.ast.columnRefs);

        setFormulaCells(prev => {
          const next = new Map(prev);
          next.set(cellKey, { formula, dependencies });
          return next;
        });
      }
    }

    return result;
  }, [evaluateFormula, editCell, viewDef]);

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
  const exportData = useCallback(async (format: 'csv' | 'json' | 'parquet' | 'xlsx', fileName?: string) => {
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
    editCellWithFormula,
    evaluateFormula,
    deleteRow,

    // Formula tracking (for auto-recalculation)
    formulaCells,

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
