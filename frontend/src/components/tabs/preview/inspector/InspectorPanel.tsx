import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

import PostgreSQLIcon from '@/assets/postgres.png';
import { exportHTMLReport } from './utils/htmlReportUtils';
import { handleProblemExport, ProblemType } from './utils/problemExportUtils';
import { exportPDFReport } from './utils/reportExportUtils';
import {
  exportCSVFromDuckDB,
  exportJSONFromResults,
  exportParquetCompatible,
  exportColumnData,
} from './utils/dataExportUtils';
import { exportChart } from './utils/chartExportUtils';

import { useInspectorStore } from '@/store/inspectorStore';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import {
  selectFileTabs,
  selectActiveFile,
} from '@/store/selectors/appSelectors';
import { useAuth } from '@/hooks/auth/useAuth';

import { useAutoAnalysis, QuickPreviewCard } from './hooks/useAutoAnalysis';
import { LoadingState } from './components/LoadingStates';
import { NoColumnsEmptyState, ErrorEmptyState } from './components/EmptyStates';
import { ColumnSearch, FilterType } from './components/ColumnSearch';
import { useColumnFilter } from './hooks/useColumnFilter';

import QuickActionsBar from './components/QuickActionsBar';
import ViewSwitcher, { ViewType } from './components/ViewSwitcher';
import Overview from './components/Overview';
import ColumnRow from './components/ColumnRow';
import ProblemsView from './components/ProblemsView';
import ExportPanel from './components/ExportPanel';
import RowDetailsModal from './components/RowDetailsModal';
import AuthModal from '@/components/auth/AuthModal';

interface InspectorPanelProps {
  className?: string;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ className }) => {
  // Store states
  const {
    isOpen,
    width,
    setWidth,
    closePanel,
    activeFileId,
    activeTableName,
    results,
    error,
    switchAnalysisTarget,
    exportResults,
    resetError,
    fetchDuplicateRows,
    fetchNullRows,
    fetchOutlierRows,
    fetchTypeIssueRows,
  } = useInspectorStore();

  const activeFile = useAppStore(selectActiveFile);
  const fileTabs = useAppStore(selectFileTabs);

  const { isAuthenticated } = useAuth();

  // UI state
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [analysisStartTime] = useState(Date.now());

  // New state for enhanced UI
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [rowDetailsModal, setRowDetailsModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'duplicates' | 'nulls' | 'outliers' | 'type_issues';
    columnName?: string;
    data: unknown[];
  }>({
    isOpen: false,
    title: '',
    type: 'nulls',
    data: [],
  });

  const {
    quickPreview,
    isGettingPreview,
    shouldShowPreview,
    isAnalyzing,
    analysisProgress,
    analysisStatus,
    manualTrigger,
  } = useAutoAnalysis({
    autoAnalysisDelay: 1000,
    autoOpenPanel: false,
    showQuickPreview: true,
  });

  // Get current analysis results
  const currentResults = activeFileId ? results.get(activeFileId) : null;

  // Filter columns
  const filteredColumns = useColumnFilter(
    currentResults?.columnMetrics || [],
    searchTerm,
    filterType
  );

  // Calculate problem count
  const problemCount = currentResults
    ? (currentResults.duplicateRows > 0 ? 1 : 0) +
      currentResults.columnMetrics.filter((col) => col.nullCount > 0).length +
      currentResults.typeIssues.length
    : 0;

  // Handlers
  const toggleColumn = (columnName: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(columnName)) {
      newExpanded.delete(columnName);
    } else {
      newExpanded.add(columnName);
    }
    setExpandedColumns(newExpanded);
  };

  const handleFileChange = (fileId: string) => {
    const file = fileTabs.find((tab) => tab.id === fileId);
    if (file && file.fileName) {
      const appFile = useAppStore.getState().files.find((f) => f.id === fileId);
      const tableName = appFile?.tableName;
      if (tableName) {
        switchAnalysisTarget(fileId, tableName);
      }
    }
  };

  const handleExport = async (format: string, options?: any) => {
    if (
      !isAuthenticated &&
      ['pdf', 'html', 'excel', 'parquet'].includes(format)
    ) {
      setShowAuthModal(true);
      return;
    }

    if (!activeFileId || !currentResults) return;

    try {
      // If this is a problem-specific export, handle it specially
      if (['duplicates', 'nulls', 'type_issues'].includes(format)) {
        await handleProblemExportLocal(format, options?.columnName);
        return;
      }

      // Handle different export formats
      switch (format.toLowerCase()) {
        case 'csv':
          await handleCSVExport();
          break;
        case 'json':
          await handleJSONExport();
          break;
        case 'excel':
          await handleExcelExport();
          break;
        case 'pdf':
          await handlePDFExport();
          break;
        case 'html':
          await handleHTMLExport();
          break;
        case 'parquet':
          await handleParquetExport();
          break;
        default:
          // Default export for general analysis results
          await exportResults(activeFileId);
      }
    } catch (err) {
      console.error('Export failed:', err);
      throw err;
    }
  };

  const handleCSVExport = async () => {
    if (!activeTableName) throw new Error('No active table');

    const duckDBStore = useDuckDBStore.getState();
    const escapedTableName = duckDBStore.registeredTables.get(activeTableName);
    if (!escapedTableName) throw new Error('Table not found');

    await exportCSVFromDuckDB(
      duckDBStore,
      escapedTableName,
      activeFile?.fileName || 'data'
    );
  };

  const handleJSONExport = async () => {
    if (!currentResults) throw new Error('No analysis results available');

    exportJSONFromResults(currentResults, activeFile);
  };

  const handleHTMLExport = async () => {
    if (!currentResults) return;
    exportHTMLReport(currentResults, activeFile);
  };

  const handleExcelExport = async () => {
    // For now, export as CSV (would need xlsx library for real Excel export)
    await handleCSVExport();
  };

  const handlePDFExport = async () => {
    if (!currentResults) throw new Error('No analysis results available');

    await exportPDFReport(currentResults, activeFile);
  };

  const handleParquetExport = async () => {
    if (!activeTableName) throw new Error('No active table');

    const duckDBStore = useDuckDBStore.getState();
    const escapedTableName = duckDBStore.registeredTables.get(activeTableName);
    if (!escapedTableName) throw new Error('Table not found');

    await exportParquetCompatible(duckDBStore, escapedTableName, activeFile);
  };

  const handleProblemExportLocal = async (
    problemType: string,
    columnName?: string
  ) => {
    if (!activeFileId || !activeTableName) {
      throw new Error('No active file or table');
    }

    try {
      await handleProblemExport(
        problemType as ProblemType,
        activeFileId,
        activeFile?.fileName,
        columnName,
        {
          fetchDuplicateRows,
          fetchNullRows,
          fetchTypeIssueRows,
        }
      );
    } catch (error) {
      console.error('Problem export failed:', error);
      throw error;
    }
  };

  const handleExportColumn = async (format: string, columnName: string) => {
    if (!isAuthenticated && ['excel', 'chart'].includes(format)) {
      setShowAuthModal(true);
      return;
    }

    if (!activeFileId || !currentResults) {
      throw new Error('No active file or analysis results');
    }

    try {
      const duckDBStore = useDuckDBStore.getState();
      const escapedTableName = duckDBStore.registeredTables.get(
        activeTableName || ''
      );

      if (!escapedTableName) {
        throw new Error('Table not found');
      }

      if (format === 'chart') {
        const columnMetrics = currentResults.columnMetrics.find(
          (col) => col.name === columnName
        );
        if (!columnMetrics) {
          throw new Error('Column metrics not found');
        }
        await exportChart(
          columnMetrics,
          'svg',
          `${
            activeFile?.fileName || 'data'
          }_${columnName}_chart_${Date.now()}.svg`
        );
      } else {
        await exportColumnData(
          duckDBStore,
          escapedTableName,
          columnName,
          format,
          activeFile
        );
      }
    } catch (error) {
      console.error('Column export failed:', error);
      throw error;
    }
  };

  const handleViewDetails = async (
    columnName: string,
    type: 'nulls' | 'outliers' | 'duplicates'
  ) => {
    if (!activeFileId) return;

    try {
      let data: any[] = [];

      // Fetch actual row data based on type
      switch (type) {
        case 'duplicates':
          data = await fetchDuplicateRows(activeFileId, 100);
          break;
        case 'nulls':
          data = await fetchNullRows(activeFileId, columnName, 100);
          break;
        case 'outliers':
          data = await fetchOutlierRows(activeFileId, columnName, 100);
          break;
      }

      setRowDetailsModal({
        isOpen: true,
        title: `${columnName} - ${type}`,
        type:
          type === 'duplicates'
            ? 'duplicates'
            : type === 'outliers'
            ? 'outliers'
            : 'nulls',
        columnName,
        data,
      });
    } catch (error) {
      console.error('Error fetching row details:', error);

      // Fall back to empty data on error
      setRowDetailsModal({
        isOpen: true,
        title: `${columnName} - ${type}`,
        type:
          type === 'duplicates'
            ? 'duplicates'
            : type === 'outliers'
            ? 'outliers'
            : 'nulls',
        columnName,
        data: [],
      });
    }
  };

  const handleRetry = () => {
    if (!activeFile || !activeFileId) return;
    resetError();
    manualTrigger();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  // Reset search when results change
  useEffect(() => {
    setSearchTerm('');
    setFilterType('all');
    setExpandedColumns(new Set());
    setCurrentView('overview');
  }, [activeFileId]);

  // Resize handling
  useEffect(() => {
    let startX = 0;
    let startWidth = 0;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startX = e.clientX;
      startWidth = width;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = startWidth + deltaX;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const resizeHandle = resizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
      return () => {
        resizeHandle.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [width, setWidth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  if (!isOpen) return null;

  // PostgreSQL Coming Soon - Early return
  if (activeFile?.isRemote && activeFile?.remoteProvider === 'postgresql') {
    return (
      <div className={cn('fixed inset-y-0 right-0 z-50', className)}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          className="relative h-full bg-background/95 backdrop-blur-md border-l border-border shadow-2xl flex"
          style={{ width: `${Math.max(600, width)}px` }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Panel Content */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 border-b border-border"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Data Inspector
                </h2>
              </div>
              <button
                onClick={closePanel}
                className="p-2 hover:bg-accent/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>

            {/* PostgreSQL Coming Soon Content */}
            <div className="flex-1 flex items-center justify-center">
              <div className="p-6 text-center">
                <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                  <img src={PostgreSQLIcon} className="h-10 w-10 mb-4" alt="PostgreSQL" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    PostgreSQL Inspector
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Coming soon! We're working on data inspection for PostgreSQL tables.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const FileSelector: React.FC<{
    currentFileId: string | null;
    onFileChange: (fileId: string) => void;
  }> = ({ currentFileId, onFileChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentFile = fileTabs.find((tab) => tab.id === currentFileId);

    if (fileTabs.length <= 1) return null;

    return (
      <div className="relative p-4 border-b border-border">
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-card/30 hover:bg-card/50 rounded-lg border border-border transition-colors"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground truncate">
              {currentFile?.fileName || 'Select file...'}
            </span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-4 right-4 mt-1 bg-card backdrop-blur-sm border border-border rounded-lg shadow-xl z-51 max-h-48 overflow-y-auto"
            >
              {fileTabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  onClick={() => {
                    onFileChange(tab.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 p-3 text-left transition-colors cursor-pointer',
                    tab.id === currentFileId && 'bg-primary/20 text-primary'
                  )}
                >
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="text-sm truncate">{tab.fileName}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={cn('fixed inset-y-0 right-0 z-50', className)}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        className="relative h-full bg-background/95 backdrop-blur-md border-l border-border shadow-2xl flex"
        style={{ width: `${Math.max(600, width)}px` }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {/* Resize Handle */}
        <div
          ref={resizeHandleRef}
          className="absolute left-0 top-0 bottom-0 w-1 hover:bg-primary/50 cursor-col-resize transition-colors"
          style={{
            opacity: isResizing ? 1 : 0,
            transition: isResizing ? 'none' : 'opacity 0.2s ease',
          }}
        />

        {/* Panel Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 border-b border-border"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Data Inspector
              </h2>
            </div>
            <button
              onClick={closePanel}
              className="p-2 hover:bg-accent/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>

          {/* TODO: There's an issue here with file change */}
          {/* File Selector */}
          {fileTabs.length > 1 && (
            <FileSelector
              currentFileId={activeFileId}
              onFileChange={handleFileChange}
            />
          )}

          {/* Quick Actions Bar */}
          {currentResults && !isAnalyzing && !error && (
            <QuickActionsBar
              fileName={activeFile?.fileName || 'Unknown'}
              lastAnalyzed={new Date(currentResults.analysisTimestamp)}
            />
          )}

          {/* View Switcher */}
          {currentResults && !isAnalyzing && !error && (
            <div className="p-4 border-b border-border">
              <ViewSwitcher
                currentView={currentView}
                onViewChange={setCurrentView}
                problemCount={problemCount}
                columnCount={currentResults.columnMetrics.length}
                rowCount={currentResults.totalRows}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Error State */}
            {error && !isAnalyzing && (
              <ErrorEmptyState
                error={error}
                onRetry={handleRetry}
                onReset={resetError}
              />
            )}

            {/* Loading State */}
            {isAnalyzing && (
              <LoadingState
                progress={analysisProgress}
                status={analysisStatus}
                startTime={analysisStartTime}
                preview={quickPreview}
                estimatedTimeLeft={0}
              />
            )}

            {/* Quick Preview */}
            {shouldShowPreview && quickPreview && !currentResults && !error && (
              <div className="p-4">
                <QuickPreviewCard
                  preview={quickPreview}
                  isAnalyzing={isAnalyzing || isGettingPreview}
                />
              </div>
            )}

            {/* Main Content - Analysis Results */}
            {currentResults && !isAnalyzing && !error && (
              <>
                {/* Overview */}
                {currentView === 'overview' && (
                  <Overview metrics={currentResults} />
                )}

                {/* Columns View */}
                {currentView === 'columns' && (
                  <>
                    <ColumnSearch
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      filterType={filterType}
                      onFilterChange={setFilterType}
                      totalColumns={currentResults.columnMetrics.length}
                      filteredCount={filteredColumns.length}
                    />

                    <div className="flex-1">
                      {filteredColumns.length > 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {filteredColumns.map((column, index) => (
                            <motion.div
                              key={column.name}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <ColumnRow
                                column={column}
                                metrics={currentResults}
                                isExpanded={expandedColumns.has(column.name)}
                                onToggle={() => toggleColumn(column.name)}
                                onViewDetails={handleViewDetails}
                                onExportColumn={handleExportColumn}
                                onAuthRequired={() => setShowAuthModal(true)}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      ) : (
                        <NoColumnsEmptyState
                          searchTerm={searchTerm}
                          filterType={filterType}
                          onClearFilters={handleClearFilters}
                          totalColumns={currentResults.columnMetrics.length}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Problems View */}
                {currentView === 'problems' && (
                  <ProblemsView
                    metrics={currentResults}
                    onViewDuplicates={() => handleViewDetails('', 'duplicates')}
                    onViewNulls={(columnName) =>
                      handleViewDetails(columnName, 'nulls')
                    }
                    onViewIssues={(columnName) =>
                      handleViewDetails(columnName, 'nulls')
                    }
                    onExportProblems={(type, columnName) =>
                      handleExport(
                        type,
                        columnName ? { columnName } : undefined
                      )
                    }
                    onAuthRequired={() => setShowAuthModal(true)}
                  />
                )}

                {/* Export Panel */}
                {currentView === 'export' && (
                  <ExportPanel
                    fileName={activeFile?.fileName || 'Unknown'}
                    onExport={handleExport}
                    onAuthRequired={() => setShowAuthModal(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Row Details Modal */}
      <RowDetailsModal
        isOpen={rowDetailsModal.isOpen}
        onClose={() =>
          setRowDetailsModal({ ...rowDetailsModal, isOpen: false })
        }
        title={rowDetailsModal.title}
        type={rowDetailsModal.type}
        columnName={rowDetailsModal.columnName}
        data={rowDetailsModal.data}
        onExport={handleExport}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
        onLoginSuccess={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default InspectorPanel;
