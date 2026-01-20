import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentNodeData, ContentType } from '../ContentNode';
import { FileTabs, type FileTab } from './FileTabs';
import { ColumnInspector } from './ColumnInspector';
import { FocusedCommandPalette, type Command } from './FocusedCommandPalette';
import { DataTable } from './DataTable';
import { QuickStats } from './QuickStats';
import { VirtualDataTable } from './VirtualDataTable';
import { ChangeLog, ChangeLogTrigger } from './ChangeLog';
import { AICommandInput } from './AICommandInput';
import { HeaderStatusBar } from './HeaderStatusBar';
import { useDuckDBView } from '@/hooks/useDuckDBView';
import { parseNaturalLanguage, generatePreview, validateSQL, type AIDataCommand, type AICommandContext } from '@/lib/ai/dataCommands';

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

// Column type icons
const columnTypeIcons: Record<string, string> = {
  number: '#',
  string: 'Aa',
  boolean: '◉',
  date: '📅',
  mixed: '?',
};

function inferColumnType(data: Record<string, unknown>[], column: string): string {
  const values = data.slice(0, 100).map(row => row[column]).filter(v => v != null);
  if (values.length === 0) return 'mixed';

  const types = new Set(values.map(v => typeof v));
  if (types.size === 1) {
    if (types.has('number')) return 'number';
    if (types.has('boolean')) return 'boolean';
    if (types.has('string')) return 'string';
  }
  return 'mixed';
}

export function FocusedFileView({
  files,
  activeFileId,
  onClose,
  onFileChange,
  onFileClose,
  onTabReorder,
  onAction,
}: FocusedFileViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [changeLogOpen, setChangeLogOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [useDuckDB, setUseDuckDB] = useState(false);
  const [aiCommandPreview, setAiCommandPreview] = useState<AIDataCommand | null>(null);
  const loadedViewsRef = useRef<Set<string>>(new Set());

  const activeFile = files.find(f => f.id === activeFileId);
  const config = activeFile ? typeConfigs[activeFile.type] : typeConfigs.unknown;
  const rowsPerPage = 50; // Increased for SQL-level pagination

  // DuckDB hook for powerful data operations
  const {
    viewState,
    data: duckData,
    queryParams,
    queryResult,
    pendingChanges,
    hasPendingChanges,
    loadData,
    loadFile,
    refresh,
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
  } = useDuckDBView({ initialPageSize: rowsPerPage });

  // Reset state when active file changes
  useEffect(() => {
    setSearchQuery('');
    setCurrentPage(0);
    setSortColumn(null);
    setSelectedColumn(null);
    setInspectorOpen(false);
    setAiCommandPreview(null);
  }, [activeFileId]);

  // Load data into DuckDB for tabular files
  useEffect(() => {
    const loadIntoDuckDB = async () => {
      if (!activeFile || loadedViewsRef.current.has(activeFile.id)) return;

      // Only use DuckDB for structured data types
      const structuredTypes = ['csv', 'json', 'xlsx', 'parquet'];
      if (!structuredTypes.includes(activeFile.type)) return;

      try {
        loadedViewsRef.current.add(activeFile.id);
        const viewName = `view_${activeFile.id.replace(/-/g, '_')}`;
        let result = null;

        // Parquet files use loadFile (they have file reference, not parsed data)
        if (activeFile.type === 'parquet' && activeFile.file) {
          result = await loadFile(activeFile.file, viewName);
        } else if (activeFile.data && activeFile.columns) {
          // Other formats use loadData (they have parsed data)
          result = await loadData(
            viewName,
            activeFile.data as Record<string, unknown>[],
            activeFile.columns
          );
        }

        if (result) {
          setUseDuckDB(true);
        }
      } catch (err) {
        console.error('[FocusedFileView] Failed to load into DuckDB:', err);
        loadedViewsRef.current.delete(activeFile.id);
      }
    };

    loadIntoDuckDB();
  }, [activeFile?.id, activeFile?.data, activeFile?.columns, activeFile?.file, loadData, loadFile]);

  // Determine if DuckDB mode is active and ready
  const isDuckDBReady = useDuckDB && viewState.isReady && duckData.length > 0;

  // Get the effective data source
  const effectiveData = isDuckDBReady ? duckData : (activeFile?.data as Record<string, unknown>[]) || [];
  const effectiveTotalRows = isDuckDBReady ? viewState.totalRows : (activeFile?.rowCount ?? effectiveData.length);
  const effectiveColumns = isDuckDBReady ? viewState.schema.map(s => s.name) : (activeFile?.columns || []);

  // Column types cache
  const columnTypes = useMemo(() => {
    if (!activeFile?.data || !activeFile?.columns) return {};
    const types: Record<string, string> = {};
    activeFile.columns.forEach(col => {
      types[col] = inferColumnType(activeFile.data as Record<string, unknown>[], col);
    });
    return types;
  }, [activeFile?.data, activeFile?.columns]);

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
  const paginatedData = processedData.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

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

  // Row delete handler
  const handleRowDelete = useCallback((rowId: number) => {
    if (isDuckDBReady) {
      deleteRow(rowId);
    }
  }, [isDuckDBReady, deleteRow]);

  // Undo handler
  const handleUndo = useCallback((changeId: string) => {
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

  // AI command context for natural language parsing
  const aiCommandContext: AICommandContext | null = useMemo(() => {
    if (!isDuckDBReady || !viewState.viewName) return null;
    return {
      viewName: viewState.viewName,
      schema: viewState.schema,
      sampleRows: duckData.slice(0, 10),
      totalRows: viewState.totalRows,
    };
  }, [isDuckDBReady, viewState, duckData]);

  // Parse and preview AI command
  const handleAICommand = useCallback((input: string) => {
    if (!aiCommandContext) return null;

    const command = parseNaturalLanguage(input, aiCommandContext);
    if (command) {
      // Validate for safety
      const validation = validateSQL(command.generatedSQL, aiCommandContext.viewName);
      if (!validation.valid) {
        return { ...command, warnings: [...command.warnings, validation.error!] };
      }
      setAiCommandPreview(command);
    }
    return command;
  }, [aiCommandContext]);

  const handleCommand = useCallback((command: Command) => {
    switch (command.type) {
      case 'sort':
        if (command.params.column) {
          if (isDuckDBReady) {
            const dir = (command.params.direction as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            setSort(command.params.column as string, dir as 'ASC' | 'DESC');
          } else {
            setSortColumn(command.params.column as string);
            setSortDirection((command.params.direction as 'asc' | 'desc') || 'asc');
          }
        }
        break;
      case 'select':
        if (command.params.column) {
          setSelectedColumn(command.params.column as string);
          setInspectorOpen(true);
        }
        break;
      case 'filter':
        if (isDuckDBReady && command.params.column && command.params.value) {
          // Could add filter through DuckDB here
        }
        onAction?.(command.type, command.params);
        break;
      case 'ai':
        // Handle AI commands through natural language parser
        if (command.params.input && typeof command.params.input === 'string') {
          handleAICommand(command.params.input);
        }
        onAction?.(command.type, command.params);
        break;
      case 'group':
      case 'export':
        onAction?.(command.type, command.params);
        break;
    }
  }, [onAction, isDuckDBReady, setSort, handleAICommand]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }
      // Cmd+Z for undo (in DuckDB mode)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (isDuckDBReady && hasPendingChanges) {
          e.preventDefault();
          undo();
          return;
        }
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
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
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
  }, [commandPaletteOpen, inspectorOpen, changeLogOpen, onClose, isDuckDBReady, hasPendingChanges, undo, handleCommit]);

  // Convert files to tabs
  const tabs: FileTab[] = files.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    rowCount: f.rowCount,
    columnCount: f.columnCount,
  }));

  if (!activeFile) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'var(--surface-primary)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* File Tabs */}
      <FileTabs
        files={tabs}
        activeFileId={activeFileId}
        onTabClick={onFileChange}
        onTabClose={onFileClose}
        onTabReorder={onTabReorder}
        onExit={onClose}
      />

      {/* Header Status Bar - shows DuckDB status, pending changes, quick actions */}
      <HeaderStatusBar
        isDuckDBReady={isDuckDBReady}
        isLoading={viewState.isLoading}
        pendingChanges={pendingChanges}
        onCommit={handleCommit}
        onUndo={undo}
        onDiscard={handleDiscard}
        isCommitting={isCommitting}
        accentColor={config.color}
        error={viewState.error}
        onClearError={clearError}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Data view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* AI-First Toolbar */}
          <div
            className="relative px-6 py-4"
            style={{
              borderBottom: '1px solid var(--border-default)',
              backgroundColor: 'var(--surface-primary)',
            }}
          >
            <div className="flex items-center gap-6">
              {/* File info - compact */}
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                  style={{ backgroundColor: `${config.color}15`, color: config.color }}
                >
                  {config.icon}
                </div>
                <div>
                  <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {activeFile.name}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {effectiveTotalRows.toLocaleString()} rows · {effectiveColumns.length} cols
                    {isDuckDBReady && queryParams.sortColumn && (
                      <span style={{ color: config.color }}> · ↕ {queryParams.sortColumn}</span>
                    )}
                    {!isDuckDBReady && sortColumn && (
                      <span style={{ color: config.color }}> · ↕ {sortColumn}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* AI Command Input - takes most space */}
              <div className="flex-1 max-w-2xl">
                <AICommandInput
                  aiContext={aiCommandContext}
                  isDuckDBReady={isDuckDBReady}
                  value={searchQuery}
                  onChange={(value) => {
                    setSearchQuery(value);
                    if (isDuckDBReady) {
                      setSearch(value);
                    } else {
                      setCurrentPage(0);
                    }
                  }}
                  onAICommand={(command) => {
                    setAiCommandPreview(command);
                  }}
                  onApplyCommand={(command) => {
                    // Apply the AI command
                    if (command.type === 'sort') {
                      const match = command.generatedSQL.match(/ORDER BY "([^"]+)" (ASC|DESC)/i);
                      if (match) {
                        if (isDuckDBReady) {
                          setSort(match[1], match[2] as 'ASC' | 'DESC');
                        } else {
                          setSortColumn(match[1]);
                          setSortDirection(match[2].toLowerCase() as 'asc' | 'desc');
                        }
                      }
                    } else if (command.type === 'filter') {
                      // For now, use the search functionality
                      const match = command.generatedSQL.match(/WHERE "([^"]+)" .+? '([^']+)'/i);
                      if (match && isDuckDBReady) {
                        setSearch(match[2]);
                      }
                    }
                    // Clear the preview
                    setAiCommandPreview(null);
                  }}
                  placeholder={isDuckDBReady ? "Search or ask: 'sort by revenue desc', 'show price > 100'..." : "Search data..."}
                  accentColor={config.color}
                />
              </div>

              {/* Command palette trigger - secondary now */}
              <motion.button
                className="flex items-center gap-2 h-9 px-3 rounded-lg text-sm transition-colors shrink-0"
                style={{
                  backgroundColor: 'var(--surface-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-tertiary)',
                }}
                onClick={() => setCommandPaletteOpen(true)}
                whileHover={{ scale: 1.02, borderColor: 'var(--border-default)' }}
                whileTap={{ scale: 0.98 }}
              >
                <span>More</span>
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--text-tertiary)' }}
                >
                  ⌘K
                </kbd>
              </motion.button>
            </div>
          </div>

          {/* Quick stats bar */}
          {(activeFile.type === 'csv' || activeFile.type === 'json' || activeFile.type === 'xlsx') && activeFile.columns && activeFile.data && (
            <QuickStats
              data={effectiveData}
              columns={effectiveColumns}
              filteredCount={effectiveTotalRows}
              color={config.color}
            />
          )}

          {/* Data table - DuckDB-powered with in-place editing when available */}
          {(activeFile.type === 'csv' || activeFile.type === 'json' || activeFile.type === 'xlsx') && effectiveColumns.length > 0 && (
            isDuckDBReady ? (
              <VirtualDataTable
                data={duckData}
                columns={viewState.schema}
                totalRows={viewState.totalRows}
                currentPage={queryParams.page}
                pageSize={queryParams.pageSize}
                sortColumn={queryParams.sortColumn}
                sortDirection={queryParams.sortDirection}
                selectedColumn={selectedColumn ?? undefined}
                pendingChanges={pendingChanges}
                isLoading={viewState.isLoading}
                onCellEdit={handleCellEdit}
                onRowDelete={handleRowDelete}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onColumnClick={handleColumnClick}
                onSort={toggleSort}
              />
            ) : (
              <DataTable
                data={paginatedData}
                columns={activeFile.columns!}
                currentPage={currentPage}
                rowsPerPage={rowsPerPage}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                selectedColumn={selectedColumn}
                onColumnClick={handleColumnClick}
                onColumnDoubleClick={handleSort}
              />
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
              <motion.div
                className="w-12 h-12 border-3 rounded-full"
                style={{ borderColor: `${config.color}30`, borderTopColor: config.color }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}

          {/* Footer with pagination - DuckDB mode handles its own pagination in VirtualDataTable */}
          {!isDuckDBReady && totalPages > 0 && (
            <div
              className="flex items-center justify-between px-6 py-3"
              style={{
                borderTop: '1px solid var(--border-default)',
                backgroundColor: 'var(--surface-secondary)',
              }}
            >
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Showing {currentPage * rowsPerPage + 1}-{Math.min((currentPage + 1) * rowsPerPage, processedData.length)} of {processedData.length.toLocaleString()} rows
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <motion.button
                    className="px-3 py-1.5 text-sm rounded-md disabled:opacity-30 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                  >
                    ← Previous
                  </motion.button>

                  <span className="text-sm px-4 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    Page {currentPage + 1} of {totalPages}
                  </span>

                  <motion.button
                    className="px-3 py-1.5 text-sm rounded-md disabled:opacity-30 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage(p => p + 1)}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                  >
                    Next →
                  </motion.button>
                </div>
              )}

              {/* Keyboard hints */}
              <div className="text-[10px] flex items-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>⌘K</kbd> commands
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>ESC</kbd> exit
                </span>
              </div>
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

      {/* Command Palette */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <FocusedCommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            activeFile={activeFile}
            selectedColumn={selectedColumn || undefined}
            currentSort={
              isDuckDBReady
                ? queryParams.sortColumn
                  ? { column: queryParams.sortColumn, direction: queryParams.sortDirection === 'DESC' ? 'desc' : 'asc' }
                  : undefined
                : sortColumn
                  ? { column: sortColumn, direction: sortDirection }
                  : undefined
            }
            onCommand={handleCommand}
          />
        )}
      </AnimatePresence>

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
    </motion.div>
  );
}

export default FocusedFileView;
