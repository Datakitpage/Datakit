import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { ContentNodeData, ContentType } from '../ContentNode';
import { ColumnInspector } from './ColumnInspector';
import { CanvasDataTable } from './CanvasDataTable';
import { ChangeLog, ChangeLogTrigger } from './ChangeLog';
import { MinimalHeader } from './MinimalHeader';
import { FloatingAICommand, type AICommand } from './FloatingAICommand';
import { OperationFeedback } from './OperationFeedback';
import { useDuckDBView } from '@/hooks/useDuckDBView';
import { useDuckDBViewStore } from '@/store/duckDBViewStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useViewStateHistory, generateChangeDescription } from '@/hooks/useViewStateHistory';
import { useOperationFeedback } from '@/hooks/useOperationFeedback';

interface FocusedFileViewProps {
  files: ContentNodeData[];
  activeFileId: string;
  onClose: () => void;
  onFileChange: (id: string) => void;
  onFileClose: (id: string) => void;
  onTabReorder: (newOrder: string[]) => void;
  onAction?: (action: string, params?: Record<string, unknown>) => void;
}

// Type configurations with gradients
const typeConfigs: Record<ContentType, {
  icon: string;
  label: string;
  color: string;
  gradient: string;
}> = {
  csv: { icon: '⊞', label: 'CSV', color: '#10B981', gradient: 'from-emerald-50/80 via-emerald-50/40 to-transparent' },
  json: { icon: '{ }', label: 'JSON', color: '#F59E0B', gradient: 'from-amber-50/80 via-amber-50/40 to-transparent' },
  xlsx: { icon: '▦', label: 'Excel', color: '#059669', gradient: 'from-green-50/80 via-green-50/40 to-transparent' },
  parquet: { icon: '⬡', label: 'Parquet', color: '#8B5CF6', gradient: 'from-violet-50/80 via-violet-50/40 to-transparent' },
  txt: { icon: '≡', label: 'Text', color: '#6B7280', gradient: 'from-stone-50/80 via-stone-50/40 to-transparent' },
  md: { icon: 'M↓', label: 'Markdown', color: '#6366F1', gradient: 'from-indigo-50/80 via-indigo-50/40 to-transparent' },
  image: { icon: '◐', label: 'Image', color: '#EC4899', gradient: 'from-pink-50/80 via-pink-50/40 to-transparent' },
  pdf: { icon: '▤', label: 'PDF', color: '#EF4444', gradient: 'from-red-50/80 via-red-50/40 to-transparent' },
  unknown: { icon: '?', label: 'File', color: '#9CA3AF', gradient: 'from-stone-50/80 via-stone-50/40 to-transparent' },
};


export function FocusedFileView({
  files,
  activeFileId,
  onClose,
  onFileChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Props available for future use
  onFileClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Props available for future use
  onTabReorder,
  onAction,
}: FocusedFileViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- State maintained for pagination but value not used in current implementation
  const [currentPage, setCurrentPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [changeLogOpen, setChangeLogOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [useDuckDB, setUseDuckDB] = useState(false);
  const [aiCommandOpen, setAiCommandOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [hasCommittedChanges, setHasCommittedChanges] = useState(false);
  const loadedViewsRef = useRef<Set<string>>(new Set());

  // Track AI command usage for onboarding (CMD+K or / key)
  const markCommandBarUsed = useOnboardingStore(state => state.markCommandBarUsed);
  useEffect(() => {
    if (aiCommandOpen) {
      markCommandBarUsed();
    }
  }, [aiCommandOpen, markCommandBarUsed]);

  // Custom query result state - when user runs a SELECT query via AI
  const [customQueryResult, setCustomQueryResult] = useState<{
    data: Record<string, unknown>[];
    schema: { name: string; type: string }[];
    sql: string;
    isEditable?: boolean; // True if result includes _rowid for editing
  } | null>(null);
  // Cache for query results to support undo/redo without re-executing
  const queryResultCacheRef = useRef<Map<string, {
    data: Record<string, unknown>[];
    schema: { name: string; type: string }[];
    isEditable?: boolean;
  }>>(new Map());

  const activeFile = files.find(f => f.id === activeFileId);
  const config = activeFile ? typeConfigs[activeFile.type] : typeConfigs.unknown;
  const rowsPerPage = 50; // Increased for SQL-level pagination

  // DuckDB hook for powerful data operations
  const {
    viewState,
    data: duckData,
    queryParams,
    pendingChanges,
    hasPendingChanges,
    loadData,
    loadFile,
    refresh,
    addColumn,
    setPage,
    setPageSize,
    setSort,
    toggleSort,
    setSearch,
    editCell,
    deleteRow,
    undo,
    discard,
    commit,
    clearError,
    executeSQL,
    validateSQL: validateSQLWithDuckDB,
    exportData,
    undoCommittedVersion,
    redoCommittedVersion,
    canUndoVersion,
    canRedoVersion,
    versionInfo,
  } = useDuckDBView({ initialPageSize: rowsPerPage });

  // View state history for undo/redo
  const viewHistory = useViewStateHistory();

  // Operation feedback toasts
  const feedback = useOperationFeedback();

  // Reset state when active file changes
  useEffect(() => {
    setSearchQuery('');
    setCurrentPage(0);
    setSortColumn(null);
    setSelectedColumn(null);
    setInspectorOpen(false);
    setHasCommittedChanges(false);
    setCustomQueryResult(null);
    queryResultCacheRef.current.clear();
  }, [activeFileId]);

  // Load data into DuckDB for tabular files
  useEffect(() => {
    const loadIntoDuckDB = async () => {
      console.log('[FocusedFileView] loadIntoDuckDB called:', {
        hasActiveFile: !!activeFile,
        activeFileId: activeFile?.id,
        activeFileType: activeFile?.type,
        hasData: !!activeFile?.data,
        dataLength: Array.isArray(activeFile?.data) ? activeFile.data.length : 0,
        hasColumns: !!activeFile?.columns,
        columnsLength: activeFile?.columns?.length,
        alreadyLoaded: activeFile ? loadedViewsRef.current.has(activeFile.id) : false,
      });

      if (!activeFile) {
        console.log('[FocusedFileView] Skipping: no activeFile');
        return;
      }

      // Only use DuckDB for structured data types
      const structuredTypes = ['csv', 'json', 'xlsx', 'parquet'];
      if (!structuredTypes.includes(activeFile.type)) {
        console.log('[FocusedFileView] Skipping: not a structured type:', activeFile.type);
        return;
      }

      // Check if data is available BEFORE checking "already loaded"
      // Fast path: file is available for native DuckDB parsing
      // Slow path: parsed data is available for JSON serialization
      const fileTypes = ['csv', 'json', 'parquet'];
      const hasDataToLoad = (fileTypes.includes(activeFile.type) && activeFile.file) ||
                            (activeFile.data && activeFile.columns);

      if (!hasDataToLoad) {
        console.log('[FocusedFileView] Waiting for data to load:', {
          hasData: !!activeFile.data,
          hasColumns: !!activeFile.columns,
          hasFile: !!activeFile.file,
        });
        return; // Don't mark as loaded yet - wait for data
      }

      // Now check if already loaded (only after confirming we have data)
      if (loadedViewsRef.current.has(activeFile.id)) {
        console.log('[FocusedFileView] Skipping: already loaded into DuckDB');
        return;
      }

      // Mark as loading to prevent duplicate attempts
      loadedViewsRef.current.add(activeFile.id);

      try {
        const viewName = `view_${activeFile.id.replace(/-/g, '_')}`;
        let result = null;

        console.log('[FocusedFileView] Loading into DuckDB with viewName:', viewName);

        // FAST PATH: Use original file when available (DuckDB parses natively - much faster)
        const fileTypes = ['csv', 'json', 'parquet'];
        if (activeFile.file && fileTypes.includes(activeFile.type)) {
          console.log('[FocusedFileView] Loading file directly (fast path):', activeFile.type);
          result = await loadFile(activeFile.file, viewName);
        } else if (activeFile.data && activeFile.columns) {
          // SLOW PATH: Serialize JS objects to JSON (only when no file available)
          console.log('[FocusedFileView] Loading data array (slow path)...', {
            rowCount: (activeFile.data as unknown[]).length,
            columnCount: activeFile.columns.length,
          });
          result = await loadData(
            viewName,
            activeFile.data as Record<string, unknown>[],
            activeFile.columns
          );
        }

        console.log('[FocusedFileView] loadData result:', result);

        if (result) {
          console.log('[FocusedFileView] Setting useDuckDB to true');
          setUseDuckDB(true);
        } else {
          console.log('[FocusedFileView] Result was falsy, not enabling DuckDB');
          loadedViewsRef.current.delete(activeFile.id); // Allow retry
        }
      } catch (err) {
        console.error('[FocusedFileView] Failed to load into DuckDB:', err);
        loadedViewsRef.current.delete(activeFile.id);
      }
    };

    loadIntoDuckDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Specific properties intentionally used instead of activeFile object
  }, [activeFile?.id, activeFile?.data, activeFile?.columns, activeFile?.file, loadData, loadFile]);

  // Determine if DuckDB mode is active and ready
  const isDuckDBReady = useDuckDB && viewState.isReady && duckData.length > 0;

  // Debug log for DuckDB state
  useEffect(() => {
    console.log('[FocusedFileView] DuckDB state:', {
      useDuckDB,
      viewStateIsReady: viewState.isReady,
      duckDataLength: duckData.length,
      isDuckDBReady,
      viewState: {
        viewName: viewState.viewName,
        totalRows: viewState.totalRows,
        isLoading: viewState.isLoading,
        error: viewState.error,
      },
    });
  }, [useDuckDB, viewState.isReady, duckData.length, isDuckDBReady, viewState]);

  // Get the effective data source
  const effectiveData = isDuckDBReady ? duckData : (activeFile?.data as Record<string, unknown>[]) || [];
  const effectiveTotalRows = isDuckDBReady ? viewState.totalRows : (activeFile?.rowCount ?? effectiveData.length);
  const effectiveColumns = isDuckDBReady ? viewState.schema.map(s => s.name) : (activeFile?.columns || []);

  // Filter and sort data
  const processedData = useMemo(() => {
    if (!activeFile?.data) return [];

    let result = [...activeFile.data] as Record<string, unknown>[];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(v =>
          String(v).toLowerCase().includes(query)
        )
      );
    }

    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [activeFile?.data, searchQuery, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / rowsPerPage);

  const handleColumnClick = useCallback((column: string) => {
    setSelectedColumn(column);
    setInspectorOpen(true);
  }, []);

  const handleInspectorAction = useCallback((
    action: 'sort-asc' | 'sort-desc' | 'filter' | 'group' | 'hide',
    column: string
  ) => {
    if (action === 'sort-asc') {
      if (isDuckDBReady) {
        setSort(column, 'ASC');
      } else {
        setSortColumn(column);
        setSortDirection('asc');
      }
    } else if (action === 'sort-desc') {
      if (isDuckDBReady) {
        setSort(column, 'DESC');
      } else {
        setSortColumn(column);
        setSortDirection('desc');
      }
    } else if (action === 'filter' || action === 'group') {
      onAction?.(action, { column });
    }
    setInspectorOpen(false);
  }, [onAction, isDuckDBReady, setSort]);

  // Cell editing handler (DuckDB mode only)
  const handleCellEdit = useCallback((rowId: number, column: string, value: unknown) => {
    if (isDuckDBReady) {
      editCell(rowId, column, value);
    }
  }, [isDuckDBReady, editCell]);

  // Cell editing handler for query results (uses _rowid from result row)
  // Note: rowId parameter is the actual _rowid value from the data, passed by CanvasDataTable
  const handleQueryResultCellEdit = useCallback((rowId: number, column: string, value: unknown) => {
    if (!isDuckDBReady || !customQueryResult || !customQueryResult.isEditable) return;

    // Find the row index by _rowid
    const rowIndex = customQueryResult.data.findIndex(row => Number(row._rowid) === rowId);
    if (rowIndex === -1) {
      console.warn('[Query Edit] Could not find row with _rowid:', rowId);
      return;
    }

    // Edit the cell in the base table using _rowid
    editCell(rowId, column, value);

    // Also update the local query result for immediate feedback
    setCustomQueryResult(prev => {
      if (!prev) return prev;
      const newData = [...prev.data];
      newData[rowIndex] = { ...newData[rowIndex], [column]: value };
      return { ...prev, data: newData };
    });

    // Update the cache as well
    if (customQueryResult.sql) {
      const cached = queryResultCacheRef.current.get(customQueryResult.sql);
      if (cached) {
        const idx = cached.data.findIndex(row => Number(row._rowid) === rowId);
        if (idx !== -1) {
          const newData = [...cached.data];
          newData[idx] = { ...newData[idx], [column]: value };
          queryResultCacheRef.current.set(customQueryResult.sql, { ...cached, data: newData });
        }
      }
    }
  }, [isDuckDBReady, customQueryResult, editCell]);

  // Row delete handler
  const handleRowDelete = useCallback((rowId: number) => {
    if (isDuckDBReady) {
      deleteRow(rowId);
    }
  }, [isDuckDBReady, deleteRow]);

  // Add column handler
  const handleAddColumn = useCallback(async (columnName: string, columnType: string) => {
    if (!isDuckDBReady) {
      feedback.showError('Not ready', 'Database is not ready');
      return;
    }

    try {
      // Use addColumn which creates a version for undo/redo support
      const success = await addColumn(columnName, columnType);
      if (success) {
        feedback.showSuccess('Column added', `Added column "${columnName}"`);
      } else {
        feedback.showError('Failed to add column', 'Unknown error');
      }
    } catch (err) {
      feedback.showError('Failed to add column', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [isDuckDBReady, addColumn, feedback]);

  // Undo handler
  const handleUndo = useCallback(() => {
    // For now, undo all changes for the row
    undo();
  }, [undo]);

  // Commit changes handler
  const handleCommit = useCallback(async () => {
    if (!isDuckDBReady || !hasPendingChanges) return;

    setIsCommitting(true);
    try {
      const success = await commit();
      if (success) {
        setChangeLogOpen(false);
        setHasCommittedChanges(true);
      }
    } finally {
      setIsCommitting(false);
    }
  }, [isDuckDBReady, hasPendingChanges, commit]);

  // Discard changes handler
  const handleDiscard = useCallback(() => {
    discard();
    setChangeLogOpen(false);
  }, [discard]);

  // View history undo - restores previous view state (sort, filter, search, page)
  const handleViewUndo = useCallback(async () => {
    const previousState = viewHistory.undo();
    if (!previousState) return;

    // Check if the previous state was a custom query result
    if (previousState.queryResult) {
      // Try to restore from cache, or re-execute the query
      const cached = queryResultCacheRef.current.get(previousState.queryResult.sql);
      if (cached) {
        setCustomQueryResult({
          data: cached.data,
          schema: cached.schema,
          sql: previousState.queryResult.sql,
          isEditable: cached.isEditable,
        });
      } else if (isDuckDBReady) {
        // Re-execute the query
        try {
          const result = await executeSQL(previousState.queryResult.sql);
          if (result && result.length > 0) {
            const maxRows = 1000;
            const limitedResult = result.length > maxRows ? result.slice(0, maxRows) : result;
            const hasRowId = '_rowid' in result[0];
            setCustomQueryResult({
              data: limitedResult,
              schema: previousState.queryResult.schema,
              sql: previousState.queryResult.sql,
              isEditable: hasRowId,
            });
            queryResultCacheRef.current.set(previousState.queryResult.sql, {
              data: limitedResult,
              schema: previousState.queryResult.schema,
              isEditable: hasRowId,
            });
          }
        } catch {
          feedback.showError('Failed to restore query', 'Could not re-execute query');
          return;
        }
      }
    } else {
      // Normal state - clear custom query and apply sort/filter/etc
      setCustomQueryResult(null);

      if (isDuckDBReady) {
        if (previousState.sortColumn !== null) {
          setSort(previousState.sortColumn, previousState.sortDirection || 'ASC');
        } else {
          setSort(null);
        }
        setSearch(previousState.search);
        setPage(previousState.page);
        setPageSize(previousState.pageSize);
      } else {
        setSortColumn(previousState.sortColumn);
        setSortDirection(previousState.sortDirection === 'DESC' ? 'desc' : 'asc');
        setSearchQuery(previousState.search);
        setCurrentPage(previousState.page);
      }
    }

    feedback.showInfo('Previous view', viewHistory.getUndoDescription() || 'Restored previous view');
  }, [viewHistory, isDuckDBReady, setSort, setSearch, setPage, setPageSize, feedback, executeSQL]);

  // Data version undo - goes back to previous committed version
  const handleVersionUndo = useCallback(async () => {
    if (!canUndoVersion) return;

    const success = await undoCommittedVersion();
    if (success) {
      feedback.showInfo('Reverted changes', `Undid: ${versionInfo.description || 'previous edit'}`);
    } else {
      feedback.showError('Failed to revert', 'Could not undo changes');
    }
  }, [canUndoVersion, undoCommittedVersion, feedback, versionInfo.description]);

  // Data version redo - re-applies a committed version
  const handleVersionRedo = useCallback(async () => {
    if (!canRedoVersion) return;

    const success = await redoCommittedVersion();
    if (success) {
      feedback.showInfo('Re-applied changes', 'Changes restored');
    } else {
      feedback.showError('Failed to re-apply', 'Could not redo changes');
    }
  }, [canRedoVersion, redoCommittedVersion, feedback]);

  // View history redo - restores next view state
  const handleViewRedo = useCallback(async () => {
    const nextState = viewHistory.redo();
    if (!nextState) return;

    // Check if the next state is a custom query result
    if (nextState.queryResult) {
      // Try to restore from cache, or re-execute the query
      const cached = queryResultCacheRef.current.get(nextState.queryResult.sql);
      if (cached) {
        setCustomQueryResult({
          data: cached.data,
          schema: cached.schema,
          sql: nextState.queryResult.sql,
          isEditable: cached.isEditable,
        });
      } else if (isDuckDBReady) {
        // Re-execute the query
        try {
          const result = await executeSQL(nextState.queryResult.sql);
          if (result && result.length > 0) {
            const maxRows = 1000;
            const limitedResult = result.length > maxRows ? result.slice(0, maxRows) : result;
            const hasRowId = '_rowid' in result[0];
            setCustomQueryResult({
              data: limitedResult,
              schema: nextState.queryResult.schema,
              sql: nextState.queryResult.sql,
              isEditable: hasRowId,
            });
            queryResultCacheRef.current.set(nextState.queryResult.sql, {
              data: limitedResult,
              schema: nextState.queryResult.schema,
              isEditable: hasRowId,
            });
          }
        } catch {
          feedback.showError('Failed to restore query', 'Could not re-execute query');
          return;
        }
      }
    } else {
      // Normal state - clear custom query and apply sort/filter/etc
      setCustomQueryResult(null);

      if (isDuckDBReady) {
        if (nextState.sortColumn !== null) {
          setSort(nextState.sortColumn, nextState.sortDirection || 'ASC');
        } else {
          setSort(null);
        }
        setSearch(nextState.search);
        setPage(nextState.page);
        setPageSize(nextState.pageSize);
      } else {
        setSortColumn(nextState.sortColumn);
        setSortDirection(nextState.sortDirection === 'DESC' ? 'desc' : 'asc');
        setSearchQuery(nextState.search);
        setCurrentPage(nextState.page);
      }
    }

    feedback.showInfo('Next view', viewHistory.getRedoDescription() || 'Restored next view');
  }, [viewHistory, isDuckDBReady, setSort, setSearch, setPage, setPageSize, feedback, executeSQL]);

  // Browser tab close warning - shows native "Leave page?" dialog
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        // Modern browsers require returnValue to be set
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

  // Handle AI command from floating overlay
  const handleAICommandFromOverlay = useCallback(async (cmd: AICommand) => {
    // Add to recent commands
    setRecentCommands(prev => [cmd.naturalLanguage, ...prev.filter(c => c !== cmd.naturalLanguage)].slice(0, 10));

    // ============ READ OPERATIONS ============
    if (cmd.type === 'sort' && cmd.parsed.column) {
      const description = generateChangeDescription('sort', {
        column: cmd.parsed.column,
        direction: cmd.parsed.direction || 'ASC',
      });

      // Track in view history
      viewHistory.pushState({
        sortColumn: cmd.parsed.column,
        sortDirection: cmd.parsed.direction || 'ASC',
      }, 'sort', description);

      if (isDuckDBReady) {
        setSort(cmd.parsed.column, cmd.parsed.direction || 'ASC');
      } else {
        setSortColumn(cmd.parsed.column);
        setSortDirection(cmd.parsed.direction === 'DESC' ? 'desc' : 'asc');
      }

      feedback.showSuccess(description);
    } else if (cmd.type === 'filter' && cmd.parsed.column) {
      const searchValue = String(cmd.parsed.value || '').replace(/%/g, '');
      const description = generateChangeDescription('filter', {
        column: cmd.parsed.column,
        value: searchValue,
      });

      viewHistory.pushState({ search: searchValue }, 'filter', description);

      if (isDuckDBReady && cmd.parsed.value) {
        setSearch(searchValue);
      } else {
        setSearchQuery(searchValue);
      }

      feedback.showSuccess(description);
    } else if (cmd.type === 'search' && cmd.parsed.value) {
      const description = generateChangeDescription('search', { value: cmd.parsed.value });

      viewHistory.pushState({ search: String(cmd.parsed.value) }, 'search', description);

      if (isDuckDBReady) {
        setSearch(String(cmd.parsed.value));
      } else {
        setSearchQuery(String(cmd.parsed.value));
      }

      feedback.showSuccess(description);
    } else if (cmd.type === 'export') {
      const format = cmd.parsed.value as 'csv' | 'json' | 'parquet';
      if (isDuckDBReady) {
        const fileName = activeFile?.name?.replace(/\.[^/.]+$/, '') || 'export';
        const success = await exportData(format, `${fileName}_export.${format}`);
        if (success) {
          feedback.showSuccess(`Exported as ${format.toUpperCase()}`, `${fileName}_export.${format}`);
        } else {
          feedback.showError('Export failed', 'Could not export the data');
        }
      }
    } else if (cmd.type === 'limit' && cmd.parsed.limit !== undefined) {
      const description = generateChangeDescription('limit', { limit: cmd.parsed.limit });

      viewHistory.pushState({
        pageSize: cmd.parsed.limit,
        page: 0,
      }, 'limit', description);

      if (isDuckDBReady) {
        setPage(0);
        setPageSize(cmd.parsed.limit);
      } else {
        setCurrentPage(0);
      }

      feedback.showSuccess(description);
    } else if (cmd.type === 'page' && cmd.parsed.page !== undefined) {
      const targetPage = cmd.parsed.page - 1;
      const description = generateChangeDescription('page', { page: targetPage });

      viewHistory.pushState({ page: Math.max(0, targetPage) }, 'page', description);

      if (isDuckDBReady) {
        setPage(Math.max(0, targetPage));
      } else {
        setCurrentPage(Math.max(0, Math.min(targetPage, totalPages - 1)));
      }

      feedback.showSuccess(description);
    } else if (cmd.type === 'reset') {
      const description = generateChangeDescription('reset');

      viewHistory.pushState({
        sortColumn: null,
        sortDirection: null,
        search: '',
        page: 0,
        filters: [],
      }, 'reset', description);

      if (isDuckDBReady) {
        setPage(0);
        setSort(null);
        setSearch('');
      } else {
        setCurrentPage(0);
        setSortColumn(null);
        setSortDirection('asc');
        setSearchQuery('');
      }

      feedback.showSuccess(description);
    } else if (cmd.type === 'theme') {
      const action = cmd.parsed.action;
      const html = document.documentElement;
      if (action === 'toggle') {
        html.classList.toggle('dark');
      } else if (action === 'dark') {
        html.classList.add('dark');
      } else if (action === 'light') {
        html.classList.remove('dark');
      }
    } else if (cmd.type === 'sql') {
      // ============ DIRECT SQL EXECUTION ============
      const sql = cmd.sql || cmd.parsed.value;
      if (!sql || typeof sql !== 'string') {
        feedback.showError('Invalid SQL', 'No SQL query provided');
        return;
      }

      if (!isDuckDBReady) {
        feedback.showError('Not ready', 'Database is not ready yet');
        return;
      }

      // Validate SQL before execution
      const validation = await validateSQLWithDuckDB(sql);
      if (!validation.valid) {
        feedback.showError(
          'SQL Error',
          validation.suggestion || validation.error || 'Invalid SQL syntax'
        );
        return;
      }

      // Determine if this is a read or write operation
      // CTEs (WITH ... SELECT) are read operations
      const trimmedSQL = sql.trim().toUpperCase();
      const isReadOperation = trimmedSQL.startsWith('SELECT') ||
                               trimmedSQL.startsWith('WITH') ||
                               trimmedSQL.startsWith('EXPLAIN') ||
                               trimmedSQL.startsWith('DESCRIBE') ||
                               trimmedSQL.startsWith('SHOW');

      if (isReadOperation) {
        // Execute SELECT query and display results in the table
        try {
          console.log('[SQL Mode] Executing read query:', sql);

          // Try to modify the query to include _rowid for editability
          // This works for simple SELECT queries from the current view
          let modifiedSQL = sql;
          let attemptedRowIdInjection = false;

          // Check if this is a SELECT that doesn't already have _rowid
          // Only inject _rowid for simple queries - skip for GROUP BY, aggregates, DISTINCT, etc.
          if (trimmedSQL.startsWith('SELECT') && viewState.viewName) {
            const hasRowId = /_rowid/i.test(sql);
            const hasSelectStar = /SELECT\s+\*/i.test(sql);

            // Don't inject _rowid for queries that can't have per-row IDs
            const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
            const hasHaving = /\bHAVING\b/i.test(sql);
            const hasDistinct = /\bSELECT\s+DISTINCT\b/i.test(sql);
            const hasUnion = /\bUNION\b|\bINTERSECT\b|\bEXCEPT\b/i.test(sql);
            // Check for aggregate functions
            const hasAggregate = /\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT|ARRAY_AGG|STRING_AGG|LISTAGG|FIRST|LAST)\s*\(/i.test(sql);

            const canInjectRowId = !hasRowId && !hasSelectStar &&
                                   !hasGroupBy && !hasHaving && !hasDistinct &&
                                   !hasUnion && !hasAggregate;

            if (canInjectRowId) {
              // Try to inject _rowid into the SELECT
              // Replace "SELECT " with "SELECT _rowid, " for simple queries
              const fromMatch = sql.match(/\bFROM\s+["']?(\w+)["']?/i);
              if (fromMatch) {
                const tableName = fromMatch[1];
                // Only inject if querying the current view
                if (tableName.toLowerCase() === viewState.viewName.toLowerCase()) {
                  modifiedSQL = sql.replace(/^SELECT\s+/i, 'SELECT _rowid, ');
                  attemptedRowIdInjection = true;
                  console.log('[SQL Mode] Injected _rowid into query:', modifiedSQL);
                }
              }
            }
          }

          const result = await executeSQL(modifiedSQL);

          if (result && result.length > 0) {
            // Check if result includes _rowid (making it editable)
            const hasRowId = '_rowid' in result[0];

            // Infer schema from the first row (exclude _rowid from visible schema if it was injected)
            const inferredSchema = Object.keys(result[0])
              .filter(key => !(attemptedRowIdInjection && key === '_rowid'))
              .map(key => {
                const value = result[0][key];
                let type = 'VARCHAR';
                if (typeof value === 'number') type = Number.isInteger(value) ? 'BIGINT' : 'DOUBLE';
                else if (typeof value === 'boolean') type = 'BOOLEAN';
                else if (value instanceof Date) type = 'TIMESTAMP';
                return { name: key, type };
              });

            // Limit results for large queries (for performance)
            const maxRows = 1000;
            const limitedResult = result.length > maxRows ? result.slice(0, maxRows) : result;
            const wasLimited = result.length > maxRows;

            // Cache the result for undo/redo
            queryResultCacheRef.current.set(sql, {
              data: limitedResult,
              schema: inferredSchema,
              isEditable: hasRowId,
            });

            // Set custom query result - this will make the table display these results
            setCustomQueryResult({
              data: limitedResult,
              schema: inferredSchema,
              sql,
              isEditable: hasRowId,
            });

            // Push to view history for undo/redo
            const description = generateChangeDescription('query', { rowCount: result.length });
            viewHistory.pushState({
              queryResult: {
                sql,
                schema: inferredSchema,
                rowCount: result.length,
              },
            }, 'query', description);

            // Show feedback
            if (wasLimited) {
              feedback.showSuccess(
                `Query executed`,
                `Showing first ${maxRows.toLocaleString()} of ${result.length.toLocaleString()} rows`
              );
            } else {
              feedback.showSuccess('Query executed', `${result.length.toLocaleString()} rows`);
            }
          } else if (result === null) {
            // Result is null - could be an error or truly empty
            // Check for error in the store (set synchronously by executeSQL)
            const storeError = useDuckDBViewStore.getState().error;
            if (storeError) {
              setCustomQueryResult(null);
              feedback.showError('Query failed', storeError);
              // Clear the error after showing it
              clearError();
            } else {
              // Truly no results
              setCustomQueryResult(null);
              feedback.showInfo('Query executed', 'No rows returned');
            }
          } else {
            // Empty array (result.length === 0) - valid query with no matches
            setCustomQueryResult(null);
            feedback.showInfo('Query executed', 'No rows returned');
          }
        } catch (err) {
          feedback.showError('Query failed', err instanceof Error ? err.message : 'Unknown error');
        }
      } else {
        // Write operation - need to parse affected rows
        if (!viewState.viewName) {
          feedback.showError('No view', 'No active view for write operation');
          return;
        }

        // For UPDATE/DELETE, we need to find affected rows first
        // Extract table name and WHERE clause for pre-query
        console.log('[SQL Mode] Handling write query:', sql);

        if (trimmedSQL.startsWith('UPDATE')) {
          // Parse UPDATE query to find affected rows
          // UPDATE table SET col=val WHERE ...
          const whereMatch = sql.match(/WHERE\s+(.+)$/i);
          const whereClause = whereMatch ? whereMatch[1] : '';

          const preQuery = whereClause
            ? `SELECT _rowid FROM "${viewState.viewName}" WHERE ${whereClause}`
            : `SELECT _rowid FROM "${viewState.viewName}"`;

          const preResult = await executeSQL(preQuery);
          if (preResult && preResult.length > 0) {
            // Parse SET clause to get column and value
            const setMatch = sql.match(/SET\s+["']?(\w+)["']?\s*=\s*['"]?([^'"]+)['"]?/i);
            if (setMatch) {
              const [, column, newValue] = setMatch;
              for (const row of preResult) {
                editCell(row._rowid as number, column, newValue);
              }
              setChangeLogOpen(true);
              feedback.showInfo('Pending changes', `${preResult.length} rows will be updated`);
            }
          } else {
            feedback.showInfo('No rows affected', 'The query would not affect any rows');
          }
        } else if (trimmedSQL.startsWith('DELETE')) {
          // Parse DELETE query to find affected rows
          const whereMatch = sql.match(/WHERE\s+(.+)$/i);
          const whereClause = whereMatch ? whereMatch[1] : '';

          if (!whereClause) {
            feedback.showError('Unsafe delete', 'DELETE without WHERE clause is not allowed');
            return;
          }

          const preQuery = `SELECT _rowid FROM "${viewState.viewName}" WHERE ${whereClause}`;
          const preResult = await executeSQL(preQuery);

          if (preResult && preResult.length > 0) {
            for (const row of preResult) {
              deleteRow(row._rowid as number);
            }
            setChangeLogOpen(true);
            feedback.showInfo('Pending changes', `${preResult.length} rows will be deleted`);
          } else {
            feedback.showInfo('No rows affected', 'The query would not delete any rows');
          }
        } else {
          feedback.showError('Unsupported', 'Only SELECT, UPDATE, and DELETE queries are supported');
        }
      }
    } else if (cmd.isWriteOperation) {
      // ============ WRITE OPERATIONS ============
      // These create pending changes that the user can review and commit
      console.log('[AI Command] Write operation:', {
        type: cmd.type,
        isDuckDBReady,
        viewName: viewState.viewName,
        column: cmd.parsed.column,
        newValue: cmd.parsed.newValue,
      });

      if (!isDuckDBReady) {
        console.warn('[AI Command] DuckDB not ready for write operation');
        return;
      }
      if (!viewState.viewName) {
        console.warn('[AI Command] No view name for write operation');
        return;
      }

      const viewName = viewState.viewName;
      if (cmd.type === 'fill' && cmd.parsed.column && cmd.parsed.newValue !== undefined) {
        // Build query to find rows to fill
        let whereClause = '';
        if (cmd.parsed.condition) {
          const { column, operator, value } = cmd.parsed.condition;
          if (operator === 'IS NULL') {
            whereClause = `WHERE "${column}" IS NULL OR "${column}" = ''`;
          } else {
            const sqlVal = typeof value === 'string' ? `'${value}'` : value;
            whereClause = `WHERE "${column}" ${operator} ${sqlVal}`;
          }
        }

        const sql = `SELECT _rowid, "${cmd.parsed.column}" as oldValue FROM "${viewName}" ${whereClause}`;

        // Validate SQL before execution using DuckDB EXPLAIN
        const validation = await validateSQLWithDuckDB(sql);
        if (!validation.valid) {
          feedback.showError(
            'Invalid query',
            validation.suggestion || validation.error || 'SQL validation failed'
          );
          console.warn('[AI Command] SQL validation failed:', validation);
          return;
        }

        console.log('[AI Command] Executing fill SQL:', sql);
        const result = await executeSQL(sql);
        console.log('[AI Command] Fill result:', result?.length, 'rows');

        if (result && result.length > 0) {
          // Record each change
          for (const row of result) {
            editCell(row._rowid as number, cmd.parsed.column, cmd.parsed.newValue);
          }
          // Open change log to show pending changes
          setChangeLogOpen(true);
        } else {
          feedback.showInfo('No matching rows', 'The query returned no rows to update');
        }
      } else if (cmd.type === 'update' && cmd.parsed.column && cmd.parsed.newValue !== undefined) {
        // Build query to find rows to update
        let whereClause = '';

        if (cmd.parsed.condition) {
          // Conditional update: only update rows matching condition
          const { column: condCol, operator, value } = cmd.parsed.condition;
          const sqlVal = typeof value === 'string' ? `'${value}'` : value;
          whereClause = `WHERE "${condCol}" ${operator} ${sqlVal}`;
        }
        // If no condition and targetRows === 'all', update all rows (no WHERE clause)

        const sql = `SELECT _rowid, "${cmd.parsed.column}" as oldValue FROM "${viewName}" ${whereClause}`;

        // Validate SQL before execution using DuckDB EXPLAIN
        const validation = await validateSQLWithDuckDB(sql);
        if (!validation.valid) {
          feedback.showError(
            'Invalid query',
            validation.suggestion || validation.error || 'SQL validation failed'
          );
          console.warn('[AI Command] SQL validation failed:', validation);
          return;
        }

        console.log('[AI Command] Executing update SQL:', sql);
        const result = await executeSQL(sql);

        if (result && result.length > 0) {
          // Record each change
          for (const row of result) {
            editCell(row._rowid as number, cmd.parsed.column, cmd.parsed.newValue);
          }
          // Open change log to show pending changes
          setChangeLogOpen(true);
        } else {
          feedback.showInfo('No matching rows', 'The query returned no rows to update');
        }
      } else if (cmd.type === 'delete' && cmd.parsed.condition) {
        // Build query to find rows to delete
        const { column, operator, value } = cmd.parsed.condition;
        const sqlVal = typeof value === 'string' ? `'${value}'` : value;
        const whereClause = `WHERE "${column}" ${operator} ${sqlVal}`;

        const sql = `SELECT _rowid FROM "${viewName}" ${whereClause}`;

        // Validate SQL before execution using DuckDB EXPLAIN
        const validation = await validateSQLWithDuckDB(sql);
        if (!validation.valid) {
          feedback.showError(
            'Invalid query',
            validation.suggestion || validation.error || 'SQL validation failed'
          );
          console.warn('[AI Command] SQL validation failed:', validation);
          return;
        }

        console.log('[AI Command] Executing delete SQL:', sql);
        const result = await executeSQL(sql);

        if (result && result.length > 0) {
          // Record each delete
          for (const row of result) {
            deleteRow(row._rowid as number);
          }
          // Open change log to show pending changes
          setChangeLogOpen(true);
        } else {
          feedback.showInfo('No matching rows', 'The query returned no rows to delete');
        }
      }
    } else {
      console.log('[AI Command] Unhandled command type:', cmd.type, cmd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewHistory, clearError, setPage, setPageSize, totalPages intentionally excluded to avoid unnecessary re-renders
  }, [isDuckDBReady, setSort, setSearch, exportData, activeFile?.name, viewState.viewName, executeSQL, validateSQLWithDuckDB, editCell, deleteRow, feedback]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // `/` to open AI command (only when not typing)
      if (e.key === '/' && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAiCommandOpen(true);
        return;
      }

      // Cmd+K also opens AI command (unified with / key)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setAiCommandOpen(prev => !prev);
        return;
      }
      // Cmd+Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // Priority: write changes undo > view history undo
        if (isDuckDBReady && hasPendingChanges) {
          undo();
        } else if (viewHistory.canUndo) {
          handleViewUndo();
        }
        return;
      }
      // Cmd+Shift+Z for redo (view history only - write changes don't have redo)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        if (viewHistory.canRedo) {
          e.preventDefault();
          handleViewRedo();
        }
        return;
      }
      // Cmd+S for commit changes (in DuckDB mode)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (isDuckDBReady && hasPendingChanges) {
          e.preventDefault();
          handleCommit();
          return;
        }
      }
      // Escape to close things in order
      if (e.key === 'Escape') {
        if (aiCommandOpen) {
          setAiCommandOpen(false);
        } else if (changeLogOpen) {
          setChangeLogOpen(false);
        } else if (inspectorOpen) {
          setInspectorOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiCommandOpen, inspectorOpen, changeLogOpen, onClose, isDuckDBReady, hasPendingChanges, undo, handleCommit, viewHistory.canUndo, viewHistory.canRedo, handleViewUndo, handleViewRedo]);

  if (!activeFile) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'var(--surface-primary)' }}
    >
      {/* Minimal Header - single row with essentials */}
      <MinimalHeader
        fileName={activeFile.name}
        fileType={activeFile.type}
        fileId={activeFile.id}
        allFiles={files.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          rowCount: f.rowCount,
          columnCount: f.columnCount,
        }))}
        rowCount={customQueryResult ? customQueryResult.data.length : effectiveTotalRows}
        columnCount={customQueryResult ? customQueryResult.schema.length : effectiveColumns.length}
        hasPendingChanges={hasPendingChanges}
        pendingChangeCount={pendingChanges.length}
        isLoading={viewState.isLoading}
        isDuckDBReady={isDuckDBReady}
        accentColor={config.color}
        onClose={onClose}
        onAIFocus={() => setAiCommandOpen(true)}
        onFileSelect={onFileChange}
        onCommit={hasPendingChanges ? handleCommit : undefined}
        onUndo={hasPendingChanges ? undo : undefined}
        onExport={(format) => {
          const baseName = activeFile?.name?.replace(/\.[^/.]+$/, '') || 'export';
          exportData(format, `${baseName}_export.${format}`);
        }}
        hasCommittedChanges={hasCommittedChanges}
        hasQueryResult={customQueryResult !== null}
        canViewUndo={viewHistory.canUndo || canUndoVersion}
        canViewRedo={viewHistory.canRedo || canRedoVersion}
        onViewUndo={() => {
          // Priority: data versions first (more important), then view history
          // This ensures committed data changes are undone before view changes
          if (canUndoVersion) {
            handleVersionUndo();
          } else if (viewHistory.canUndo) {
            handleViewUndo();
          }
        }}
        onViewRedo={() => {
          // Priority: data versions first, then view history
          if (canRedoVersion) {
            handleVersionRedo();
          } else if (viewHistory.canRedo) {
            handleViewRedo();
          }
        }}
        versionInfo={versionInfo.total > 0 ? versionInfo : undefined}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Data view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Data table - Canvas-based for best performance */}
          {(activeFile.type === 'csv' || activeFile.type === 'json' || activeFile.type === 'xlsx' || activeFile.type === 'parquet') && effectiveColumns.length > 0 && (
            isDuckDBReady ? (
              <>
                {/* Query result indicator */}
                {customQueryResult && (
                  <div
                    className="flex items-center justify-between px-3 py-2 text-xs"
                    style={{
                      backgroundColor: `${config.color}10`,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Query result: {customQueryResult.data.length.toLocaleString()} rows, {customQueryResult.schema.length} columns
                      </span>
                      <code
                        className="px-1.5 py-0.5 rounded text-[10px] max-w-[300px] truncate"
                        style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--text-tertiary)' }}
                        title={customQueryResult.sql}
                      >
                        {customQueryResult.sql}
                      </code>
                    </div>
                    <button
                      onClick={() => {
                        setCustomQueryResult(null);
                        viewHistory.pushState({ queryResult: null }, 'reset', 'Clear query result');
                        feedback.showInfo('Cleared', 'Showing full data');
                      }}
                      className="px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--surface-tertiary)]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Clear
                    </button>
                  </div>
                )}
                <CanvasDataTable
                  data={customQueryResult ? customQueryResult.data : duckData}
                  columns={customQueryResult ? customQueryResult.schema : viewState.schema}
                  totalRows={customQueryResult ? customQueryResult.data.length : viewState.totalRows}
                  currentPage={customQueryResult ? 0 : queryParams.page}
                  pageSize={customQueryResult ? customQueryResult.data.length : queryParams.pageSize}
                  sortColumn={customQueryResult ? undefined : queryParams.sortColumn}
                  sortDirection={customQueryResult ? undefined : queryParams.sortDirection}
                  selectedColumn={selectedColumn ?? undefined}
                  pendingChanges={customQueryResult ? [] : pendingChanges}
                  isLoading={viewState.isLoading}
                  accentColor={config.color}
                  onCellEdit={customQueryResult
                    ? (customQueryResult.isEditable ? handleQueryResultCellEdit : undefined)
                    : handleCellEdit}
                  onRowDelete={customQueryResult ? undefined : handleRowDelete}
                  onPageChange={customQueryResult ? undefined : setPage}
                  onPageSizeChange={customQueryResult ? undefined : setPageSize}
                  onColumnClick={handleColumnClick}
                  onSort={customQueryResult ? undefined : toggleSort}
                  onSortWithDirection={customQueryResult ? undefined : setSort}
                  onFilterByValue={customQueryResult ? undefined : (column, value) => {
                    // Use search to filter by the value
                    if (value !== null && value !== undefined) {
                      setSearchQuery(String(value));
                      setSearch(String(value));
                    }
                  }}
                  onAddColumn={customQueryResult ? undefined : handleAddColumn}
                />
              </>
            ) : (
              /* Skeleton loading state while DuckDB initializes */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header skeleton - table-like with column borders */}
                <div
                  className="flex"
                  style={{ borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--surface-secondary)' }}
                >
                  {Array.from({ length: Math.min(activeFile.columns?.length || 5, 8) }).map((_, i, arr) => (
                    <div
                      key={i}
                      className="flex items-center px-3 py-3"
                      style={{
                        width: 120,
                        borderRight: i < arr.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                      }}
                    >
                      <div
                        className="h-4 rounded animate-pulse w-full"
                        style={{ backgroundColor: 'var(--surface-tertiary)' }}
                      />
                    </div>
                  ))}
                </div>
                {/* Row skeletons - table-like with cell borders */}
                <div className="flex-1 overflow-hidden">
                  {Array.from({ length: 12 }).map((_, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="flex"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      {Array.from({ length: Math.min(activeFile.columns?.length || 5, 8) }).map((_, colIdx, arr) => (
                        <div
                          key={colIdx}
                          className="flex items-center px-3 py-3"
                          style={{
                            width: 120,
                            borderRight: colIdx < arr.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                          }}
                        >
                          <div
                            className="h-3 rounded animate-pulse"
                            style={{
                              width: `${50 + (rowIdx * 7 + colIdx * 13) % 50}%`,
                              backgroundColor: 'var(--surface-tertiary)',
                              opacity: 0.5 + ((rowIdx + colIdx) % 5) * 0.1,
                              animationDelay: `${(rowIdx * 50 + colIdx * 30)}ms`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {/* Loading indicator */}
                <div
                  className="flex items-center justify-center gap-2 px-4 py-3"
                  style={{ borderTop: '1px solid var(--border-default)', backgroundColor: 'var(--surface-secondary)' }}
                >
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--border-default)', borderTopColor: config.color }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Loading data...
                  </span>
                </div>
              </div>
            )
          )}

          {/* Text content */}
          {(activeFile.type === 'txt' || activeFile.type === 'md') && activeFile.rawContent && (
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm whitespace-pre-wrap font-mono" style={{ color: 'var(--text-primary)' }}>
                {activeFile.rawContent}
              </pre>
            </div>
          )}

          {/* Image content */}
          {activeFile.type === 'image' && activeFile.imageUrl && (
            <div
              className="flex-1 overflow-auto flex items-center justify-center p-6"
              style={{ backgroundColor: 'var(--surface-secondary)' }}
            >
              <img
                src={activeFile.imageUrl}
                alt={activeFile.name}
                className="max-w-full max-h-full object-contain rounded-lg"
                style={{ boxShadow: 'var(--shadow-lg)' }}
              />
            </div>
          )}

          {/* Processing state */}
          {activeFile.processing && (
            <div className="flex-1 flex items-center justify-center">
              <div
                className="w-12 h-12 border-3 rounded-full animate-spin"
                style={{ borderColor: `${config.color}30`, borderTopColor: config.color }}
              />
            </div>
          )}

        </div>

        {/* Column Inspector */}
        <AnimatePresence>
          {inspectorOpen && selectedColumn && effectiveData.length > 0 && (
            <ColumnInspector
              isOpen={inspectorOpen}
              column={selectedColumn}
              data={effectiveData}
              onClose={() => {
                setInspectorOpen(false);
                setSelectedColumn(null);
              }}
              onAction={handleInspectorAction}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Floating AI Command - triggered by / */}
      <FloatingAICommand
        isOpen={aiCommandOpen}
        onClose={() => setAiCommandOpen(false)}
        onCommand={handleAICommandFromOverlay}
        validateSQL={validateSQLWithDuckDB}
        schema={viewState.schema}
        totalRows={effectiveTotalRows}
        accentColor={config.color}
        viewName={viewState.viewName || 'data'}
        recentCommands={recentCommands}
        fileId={activeFileId}
      />

      {/* Change Log - only shown in DuckDB mode with pending changes */}
      <AnimatePresence>
        {isDuckDBReady && !changeLogOpen && hasPendingChanges && (
          <ChangeLogTrigger
            changeCount={pendingChanges.length}
            onClick={() => setChangeLogOpen(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDuckDBReady && (
          <ChangeLog
            changes={pendingChanges}
            isOpen={changeLogOpen}
            isCommitting={isCommitting}
            onUndo={handleUndo}
            onUndoAll={() => discard()}
            onCommit={handleCommit}
            onDiscard={handleDiscard}
            onClose={() => setChangeLogOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Operation feedback toasts */}
      <OperationFeedback
        items={feedback.items}
        onDismiss={feedback.dismiss}
        position="bottom-right"
      />
    </div>
  );
}

export default FocusedFileView;
