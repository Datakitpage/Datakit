import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Save,
  Database,
  Clock,
  AlertTriangle,
  Zap,
  Command,
} from "lucide-react";
import { useTranslation } from 'react-i18next';

import {
  useFileAwareQueryOrchestrator,
  useDuckDBInitialization,
  usePendingQuery
} from "@/hooks/query/useQueryInitialization";

import SchemaBrowser from "./SchemaBrowser";
import MonacoEditor from "./MonacoEditor";
import QueryHistory from "./QueryHistory";
import QueryResults from "./query-results/QueryResults";
import ExportResultsModal from "./query-results/ExportResultsModal";
import { DraftBadge } from "@/components/tabs/query/DraftBadge";
import { Button } from "@/components/ui/Button";

import { useResizable } from "@/hooks/useResizable";
import { useQueryExecution } from "@/hooks/query/useQueryExecution";
import { useQueryHistory } from "@/hooks/query/useQueryHistory";
import { useQueryOptimization } from "@/hooks/query/useQueryOptimization";
import { useQueryResultsImport } from "@/hooks/query/useQueryResultsImport";
import { useExportProvider } from "@/hooks/query/useExportProvider";
import { useWorkspaceUIState } from "./useWorkspaceUIState";

// Constants for panel dimensions
const DEFAULT_PANEL_WIDTH = 260;
const MIN_PANEL_WIDTH = 50;
const MAX_PANEL_WIDTH = 400;

/**
 * Main container for the enhanced query tab with resizable panels
 */
const QueryWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const {
    isInitialized,
    isInitializing,
    error: initError,
    retry,
  } = useDuckDBInitialization();

  // Get file-aware query state with imperative API
  const { 
    query, 
    setQuery, 
    hasUnsavedChanges,
    isDirty,
    saveCurrentQuery,
    canExecuteQueries, 
    hasUserTables, 
    addToHistory,
    markAsClean,
    setQueryAndMarkDirty,
    activeFile 
  } = useFileAwareQueryOrchestrator();
  
  // Handle pending queries from AI tab with high priority
  usePendingQuery(setQuery);
  
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges) {
        console.log('[QueryWorkspace] Saving query before unmount');
        saveCurrentQuery();
      }
    };
  }, [hasUnsavedChanges, saveCurrentQuery]);

  const {
    showSchemaBrowser,
    showQueryHistory,
    showOptimizationTips,
    fullScreenMode,
    queryInputHeight,
    saveDialogOpen,
    queryName,
    setShowOptimizationTips,
    setSaveDialogOpen,
    setQueryName,
    toggleSchemaBrowser,
    toggleQueryHistory,
    toggleFullScreenMode,
  } = useWorkspaceUIState();

  const [showSaveAsTableModal, setShowSaveAsTableModal] = useState(false);

  const {
    results,
    columns,
    error,
    executionTime,
    totalRows,
    currentPage,
    totalPages,
    rowsPerPage,
    isLoading,
    isChangingPage,
    showLargeDataWarning,
    executeQuery,
    changePage,
    changeRowsPerPage,
    optimizeQuery: applyLimitOptimization,
    dismissWarning,
    clearResults,
  } = useQueryExecution(query, setQuery, activeFile);

  // Clear results when switching files to prevent showing stale data
  useEffect(() => {
    clearResults();
  }, [activeFile?.id, clearResults]);

  const { selectQuery, saveQuery, isLoadingQueries } = useQueryHistory(
    (selectedQuery) => setQuery(selectedQuery)
  );

  const { suggestions, hasWarnings, analyzeQuery, optimizeQuery } =
    useQueryOptimization();

  // Hook for importing query results as table
  const { isImporting: isImportingAsTable } = useQueryResultsImport();

  // Hook for export functionality
  const { handleExportWithProvider } = useExportProvider(
    {
      results,
      columns,
      query,
      sourceFileName: activeFile?.fileName || activeFile?.tableName
    },
    activeFile,
    () => setShowSaveAsTableModal(false)
  );

  // Schema browser width state
  const [schemaBrowserWidth, setSchemaBrowserWidth] = useState(() => {
    const saved = localStorage.getItem("datakit-schema-browser-width");
    return saved ? parseInt(saved, 10) : DEFAULT_PANEL_WIDTH;
  });

  // Resizing state
  const [isResizingSchema, setIsResizingSchema] = useState(false);

  // Element refs for resizing
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  // Setup resizable editor
  const { startResize: startEditorResize } = useResizable(editorRef, {
    direction: "vertical",
    initialSize: queryInputHeight,
    minSize: 100,
    maxSize: 800,
    storageKey: "datakit-query-editor-height",
  });

  // Handle schema browser resize
  const handleSchemaResize = useCallback((e: MouseEvent) => {
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        Math.max(e.clientX - containerRect.left, MIN_PANEL_WIDTH),
        MAX_PANEL_WIDTH
      );

      setSchemaBrowserWidth(newWidth);
    });
  }, []);

  const startSchemaResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSchema(true);
  }, []);

  const stopSchemaResize = useCallback(() => {
    if (isResizingSchema) {
      setIsResizingSchema(false);
      // Save the width to localStorage
      localStorage.setItem(
        "datakit-schema-browser-width",
        schemaBrowserWidth.toString()
      );
    }
  }, [isResizingSchema, schemaBrowserWidth]);

  // Handle mouse events for schema browser resizing
  useEffect(() => {
    if (isResizingSchema) {
      document.addEventListener("mousemove", handleSchemaResize);
      document.addEventListener("mouseup", stopSchemaResize);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleSchemaResize);
        document.removeEventListener("mouseup", stopSchemaResize);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizingSchema, handleSchemaResize, stopSchemaResize]);

  // Run query analysis whenever the query changes
  useEffect(() => {
    if (canExecuteQueries && query.trim()) {
      analyzeQuery(query);
    }
  }, [query, analyzeQuery, canExecuteQueries]);

  // Handle saving query
  const handleSaveQuery = () => {
    if (!query.trim()) return;

    if (!queryName.trim()) {
      setSaveDialogOpen(true);
    } else {
      saveQuery(query, queryName);
      setSaveDialogOpen(false);
      setQueryName("");
    }
  };

  // Apply query optimizations
  const handleOptimizeQuery = () => {
    const optimizedQuery = optimizeQuery(query);
    setQuery(optimizedQuery);
    setShowOptimizationTips(false);
  };

  // Handle importing query results as a new table
  const handleImportAsTable = useCallback(() => {
    setShowSaveAsTableModal(true);
  }, []);


  // Memoized event handlers to prevent unnecessary re-renders
  const handleExecuteQuery = useCallback(async () => {
    if (canExecuteQueries && query.trim()) {
      try {
        await executeQuery();
        
        // After successful execution, mark query as clean (not dirty)
        markAsClean();
        
        // Add to history without modifying the current query
        addToHistory(query, executionTime);
        
        console.log('[QueryWorkspace] Query executed successfully, marked as clean');
      } catch (error) {
        console.error('[QueryWorkspace] Query execution failed:', error);
      }
    }
  }, [canExecuteQueries, query, executeQuery, addToHistory, executionTime, markAsClean]);

  const keyboardHandlers = useMemo(
    () => ({
      executeQuery: handleExecuteQuery,
      saveQuery: handleSaveQuery,
      exitFullScreen: () => setFullScreenMode("none"),
    }),
    [handleExecuteQuery, handleSaveQuery]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute query (fallback if Monaco doesn't catch it)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const target = e.target as HTMLElement;
        const isInMonacoEditor = target.closest('.monaco-editor');
        
        // Only handle if we're in the Monaco editor but the event bubbled up
        if (isInMonacoEditor) {
          e.preventDefault();
          keyboardHandlers.executeQuery();
        }
      }
      
      // Ctrl/Cmd + S to save query
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        keyboardHandlers.saveQuery();
      }

      // Escape to exit full screen
      if (e.key === "Escape" && fullScreenMode !== "none") {
        e.preventDefault();
        keyboardHandlers.exitFullScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [keyboardHandlers, fullScreenMode]);

  // Show getting started state
  if (!isInitialized) {
    if (initError) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-heading font-medium text-white mb-2">
              {t('query.workspace.errors.initFailed')}
            </h3>
            <p className="text-white/70 mb-4">{initError}</p>
            <Button onClick={retry} variant="primary">
              {t('query.workspace.actions.retryInit')}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="mb-6 flex justify-center">
          </div>
          <h3 className="text-lg font-heading font-medium text-white mb-2">
            {isInitializing ? t('query.workspace.status.initializing') : t('query.workspace.status.notReady')}
          </h3>
          <p className="text-white/70 mb-4">
            {isInitializing
              ? t('query.workspace.status.settingUp')
              : t('query.workspace.status.preparing')}
          </p>
        </div>
      </div>
    );
  }

  const ResultsToolbar = () => (
    <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
      <div className="flex items-center space-x-3">
        <h3 className="text-sm font-medium">Query Results</h3>

        {!!executionTime && (
          <div className="flex items-center text-xs text-white/60">
            <Clock size={12} className="mr-1" />
            <span>{executionTime.toFixed(0)}ms</span>
          </div>
        )}

        {totalRows > 0 && (
          <div className="text-xs text-white/60">
            {totalRows.toLocaleString()} rows
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleFullScreenMode("results")}
          title="Full Screen Results"
        >
          <Maximize size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleQueryHistory}
          title={showQueryHistory ? "Hide Query History" : "Show Query History"}
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${
              showQueryHistory ? "" : "rotate-180"
            }`}
          />
        </Button>
      </div>
    </div>
  );

  // Return the appropriate layout based on fullscreen mode
  if (fullScreenMode !== "none") {
    return (
      <div className="w-full h-full flex flex-col">
        {fullScreenMode === "editor" ? (
          <>
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <h3 className="text-sm font-medium">SQL Editor (Fullscreen)</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFullScreenMode("editor")}
                title="Exit Full Screen"
              >
                <Minimize size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                value={query}
                onChange={setQueryAndMarkDirty}
                onExecute={keyboardHandlers.executeQuery}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
              <div className="flex items-center space-x-3">
                <h3 className="text-sm font-medium">
                  Query Results (Fullscreen)
                </h3>
                {executionTime !== null && (
                  <div className="flex items-center text-xs text-white/60">
                    <Clock size={12} className="mr-1" />
                    <span>{executionTime.toFixed(0)}ms</span>
                  </div>
                )}
                {totalRows > 0 && (
                  <div className="text-xs text-white/60">
                    {totalRows.toLocaleString()} rows
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFullScreenMode("results")}
                title="Exit Full Screen"
              >
                <Minimize size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <QueryResults
                results={results}
                columns={columns}
                isLoading={isLoading || isChangingPage || isLoadingQueries}
                error={error}
                totalRows={totalRows}
                currentPage={currentPage}
                totalPages={totalPages}
                rowsPerPage={rowsPerPage}
                onPageChange={changePage}
                onRowsPerPageChange={changeRowsPerPage}
                onImportAsTable={handleImportAsTable}
                isImporting={isImportingAsTable}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // Regular layout with panels
  return (
    <div
      ref={containerRef}
      className="h-full w-full flex overflow-hidden relative"
    >
      {/* Resize Overlay - prevents interference from iframes/content during resize */}
      {isResizingSchema && (
        <div
          className="absolute inset-0 z-50"
          style={{ cursor: "col-resize" }}
        />
      )}

      {/* Schema Browser Panel */}
      <div
        className={`flex-shrink-0 overflow-hidden bg-darkNav border-r border-white/10 relative ${
          isResizingSchema ? "" : "transition-all duration-200"
        }`}
        style={{
          width: showSchemaBrowser ? `${schemaBrowserWidth}px` : "0px",
        }}
      >
        <div className="h-full w-full">
          <SchemaBrowser onInsertQuery={(text) => setQuery(query + text)} />
        </div>

        {/* Resize Handle */}
        {showSchemaBrowser && (
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent ${
              isResizingSchema
                ? "bg-primary/50"
                : "hover:bg-primary/30 transition-colors"
            }`}
            onMouseDown={startSchemaResize}
            style={{
              // Make the hit area wider for easier grabbing
              width: "5px",
              right: "-2px",
            }}
          >
            {/* Visual indicator during resize */}
            {isResizingSchema && (
              <div className="absolute inset-0 bg-primary/50" />
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        {/* Editor Area */}
        <div
          ref={editorRef}
          className="flex flex-col relative"
          style={{ height: `${queryInputHeight}px` }}
        >
          <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSchemaBrowser}
                title={
                  showSchemaBrowser
                    ? "Hide Schema Browser"
                    : "Show Schema Browser"
                }
              >
                <ChevronLeft
                  size={16}
                  className={`transition-transform ${
                    showSchemaBrowser ? "" : "rotate-180"
                  }`}
                />
              </Button>

              <h3 className="text-sm font-medium">SQL Editor</h3>


              {hasWarnings && (
                <button
                  className="flex items-center text-xs px-2 py-0.5 bg-warning/20 text-warning rounded cursor-pointer"
                  onClick={() => setShowOptimizationTips(!showOptimizationTips)}
                  title="Query optimization suggestions available"
                >
                  <Zap size={12} className="mr-1" />
                  <span>Optimize</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Draft badge - shows when query has been modified */}
              <DraftBadge isDirty={isDirty} />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveQuery}
                className="h-8"
                disabled={!query.trim()}
              >
                <Save size={14} className="mr-1" />
                <span>Save</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={keyboardHandlers.executeQuery}
                disabled={
                  isLoading ||
                  isChangingPage ||
                  !query.trim() ||
                  !canExecuteQueries
                }
                className="h-8 gap-2"
                title="Execute query (⌘+Enter)"
              >
                <div className="flex items-center">
                  <Play size={14} className="mr-1" />
                  <span>Execute</span>
                </div>
                <div className="flex items-center text-[11px] opacity-60 bg-white/10 px-1.5 py-0.5 rounded">
                  <Command size={11} className="mr-0.5" />
                  <span className="leading-none">↵</span>
                </div>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFullScreenMode("editor")}
                title="Full Screen Editor"
              >
                <Maximize size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              value={query}
              onChange={setQueryAndMarkDirty}
              onExecute={keyboardHandlers.executeQuery}
            />
          </div>

          {/* Optimization Tips Panel */}
          {showOptimizationTips && suggestions.length > 0 && (
            <div className="absolute top-12 right-0 w-80 bg-background border border-white/10 rounded-md shadow-lg z-10 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium flex items-center">
                  <Zap size={14} className="mr-1 text-warning" />
                  Query Optimization Tips
                </h3>
                <button
                  className="text-white/50 hover:text-white"
                  onClick={() => setShowOptimizationTips(false)}
                >
                  ×
                </button>
              </div>

              <div className="space-y-2 mb-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`p-2 text-xs rounded ${
                      suggestion.severity === "warning"
                        ? "bg-warning/10 border border-warning/30"
                        : suggestion.severity === "critical"
                        ? "bg-destructive/10 border border-destructive/30"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    <div className="mb-1">{suggestion.message}</div>
                    {suggestion.fix && (
                      <button
                        className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded"
                        onClick={() => {
                          setQuery(suggestion.fix!());
                          setShowOptimizationTips(false);
                        }}
                      >
                        Apply Fix
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  className="text-xs px-3 py-1 rounded bg-primary text-white"
                  onClick={handleOptimizeQuery}
                >
                  Optimize Query
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Resizer Handle */}
        <div
          ref={dividerRef}
          className="h-2 bg-darkNav/50 cursor-row-resize hover:bg-primary/30 transition-colors flex items-center justify-center"
          onMouseDown={startEditorResize}
        >
          <div className="w-8 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Results Area */}
        <div
          ref={resultsRef}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {ResultsToolbar()}

          {/* Large Dataset Warning */}
          {showLargeDataWarning && (
            <div className="bg-primary/10 border border-primary/30 rounded p-3 m-3 text-white text-sm">
              <div className="flex items-start">
                <AlertTriangle
                  size={18}
                  className="text-primary mt-0.5 mr-2 flex-shrink-0"
                />
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">
                    Large Result Set ({totalRows.toLocaleString()} rows)
                  </h4>
                  <p className="text-xs text-white/80 mb-2">
                    This query is returning a large dataset which may affect
                    performance. Consider adding filters or LIMIT clause with
                    lower value to reduce the result size.
                  </p>
                  <div className="flex justify-end space-x-2 mt-2">
                    <button
                      className="text-xs px-3 py-1 rounded bg-primary text-white"
                      onClick={applyLimitOptimization}
                    >
                      Add LIMIT Clause
                    </button>
                    <button
                      className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                      onClick={dismissWarning}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Getting Started Help Panel */}
          {!canExecuteQueries && (
            <div className="bg-secondary/10 border border-secondary/30 rounded p-3 m-3 text-white text-sm">
              <div className="flex items-start">
                <Database
                  size={18}
                  className="text-secondary mt-0.5 mr-2 flex-shrink-0"
                />
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">
                    Ready to Query Sample Data!
                  </h4>
                  <p className="text-xs text-white/80 mb-2">
                    {hasUserTables
                      ? "You have uploaded data ready to query. Try the sample query above or write your own SQL."
                      : "A sample employees table is available for testing. Import your own CSV, JSON, or Parquet files to query your data."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            <QueryResults
              results={results}
              columns={columns}
              isLoading={isLoading || isChangingPage || isLoadingQueries}
              error={error}
              totalRows={totalRows}
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              onPageChange={changePage}
              onRowsPerPageChange={changeRowsPerPage}
              onImportAsTable={handleImportAsTable}
              isImporting={isImportingAsTable}
            />
          </div>
        </div>
      </div>

      {/* Query History Panel */}
      <div
        className="flex-shrink-0 transition-all duration-200 overflow-hidden"
        style={{
          width: showQueryHistory ? `${DEFAULT_PANEL_WIDTH}px` : "0px",
          opacity: showQueryHistory ? 1 : 0,
        }}
      >
        {showQueryHistory && (
          <div className="h-full border-l border-white/10 bg-darkNav overflow-hidden">
            <QueryHistory onSelectQuery={selectQuery} />
          </div>
        )}
      </div>

      {/* Save Query Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
          <div className="bg-darkNav p-4 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Save Query</h3>
            <input
              type="text"
              className="w-full p-2 bg-background border border-white/10 rounded mb-4"
              placeholder="Enter query name"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSaveDialogOpen(false);
                  setQueryName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (queryName.trim()) {
                    saveQuery(query, queryName);
                    setSaveDialogOpen(false);
                    setQueryName("");
                  }
                }}
                disabled={!queryName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportResultsModal
        isOpen={showSaveAsTableModal}
        onClose={() => setShowSaveAsTableModal(false)}
        onConfirm={handleExportWithProvider}
        isExporting={isImportingAsTable}
        results={results}
        columns={columns}
        query={query}
        rowCount={totalRows}
        columnCount={columns?.length || 0}
        sourceFileName={activeFile?.fileName || activeFile?.tableName}
      />
    </div>
  );
};

export default QueryWorkspace;
