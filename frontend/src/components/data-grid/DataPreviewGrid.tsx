import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useInspectorStore } from '@/store/inspectorStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { selectActiveFile } from '@/store/selectors/appSelectors';
import { useDataPreview } from '@/hooks/useDataPreview';

import UnifiedGrid, { UnifiedGridRef } from './UnifiedGrid';
import InspectorPanel from '@/components/tabs/preview/inspector/InspectorPanel';
import DataPreviewPagination from './DataPreviewPagination';

import { useCellFormatting } from './hooks/useCellFormatting';
import { useColumnSorting } from './hooks/useColumnSorting';
import { useCellInteraction } from './hooks/useCellInteraction';
import CellContextMenu from './CellContextMenu';

interface DataPreviewGridProps {
  fileId?: string;
  hideHeader?: boolean;
}

const DataPreviewGrid: React.FC<DataPreviewGridProps> = ({ fileId, hideHeader = false }) => {
  const activeFile = useAppStore(selectActiveFile);
  const { showColumnStats, setShowColumnStats } = useAppStore();
  const { openPanel, analyzeFile } = useInspectorStore();
  const { getObjectType, executeQuery } = useDuckDBStore();
  
  // Ref to UnifiedGrid for accessing stats functionality
  const gridRef = useRef<UnifiedGridRef>(null);
  const [isView, setIsView] = useState(false);

  // Use provided fileId or fall back to active file
  const targetFileId = fileId || activeFile?.id;
  
  // Get target file for proper column types and other checks
  const targetFile = targetFileId 
    ? useAppStore.getState().files.find(f => f.id === targetFileId)
    : activeFile;

  const {
    results: gridData,
    columns,
    error,
    totalRows,
    currentPage,
    totalPages,
    rowsPerPage,
    isLoading,
    isChangingPage,
    isCountLoading,
    loadInitialData,
    changePage,
    changeRowsPerPage,
  } = useDataPreview(targetFileId);

  // Load initial data when component mounts or target file changes
  useEffect(() => {
    if (targetFileId) {
      loadInitialData();
    }
  }, [targetFileId, loadInitialData]);

  // Check if the table is a view when file changes
  useEffect(() => {
    const checkIfView = async () => {
      if (targetFile?.tableName) {
        try {
          const objectType = await getObjectType(targetFile.tableName);
          setIsView(objectType === 'view');
        } catch (error) {
          console.error('Error checking object type:', error);
          setIsView(false);
        }
      } else {
        // Reset to false if no table name (e.g., remote files)
        setIsView(false);
      }
    };
    
    checkIfView();
  }, [targetFile?.tableName, getObjectType]);

  // Column sorting functionality
  const { sortedData, sortState, sortData, clearSort } = useColumnSorting(
    gridData || []
  );

  // Clear sort state when switching between files to prevent column highlighting issues
  useEffect(() => {
    clearSort();
  }, [targetFileId, clearSort]);

  // Cell interaction functionality
  const {
    contextMenu,
    handleCellClick: handleCellContextMenu,
    handleCopyCell,
    closeContextMenu,
  } = useCellInteraction();


  // Cell formatting with skeleton support
  const { formatCellValue: originalFormatCellValue, getCellClass } =
    useCellFormatting(targetFile?.columnTypes || [], true, {
      animationActive: false,
      gridData: sortedData,
      animationMessage: [],
      activeWordIndex: -1,
    });

  // Enhanced format cell value with skeleton loading
  const formatCellValue = (value: string, rowIndex: number, colIndex: number): React.ReactNode => {
    const originalValue = originalFormatCellValue(value, rowIndex, colIndex);

    // Show skeleton during any loading state (initial load or page changes)
    if ((isLoading || isChangingPage) && rowIndex > 0 && colIndex > 0) {
      // Create consistent but varied skeleton widths based on row/col position
      const seedValue = (rowIndex * 31 + colIndex * 17) % 100;
      let widthClass = 'w-3/4';

      if (seedValue < 25) widthClass = 'w-1/2';
      else if (seedValue < 50) widthClass = 'w-2/3';
      else if (seedValue < 75) widthClass = 'w-3/4';
      else widthClass = 'w-5/6';

      return (
        <div
          className={`h-3 bg-accent/10 rounded animate-pulse ${widthClass}`}
        />
      );
    }

    return originalValue;
  };

  // Handle context menu - removed setActiveTab reference
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Could add other context menu actions here
    },
    []
  );

  const handleInspectorClick = useCallback(() => {
    if (!activeFile) return;

    const tableName = activeFile.tableName;
    openPanel();
    analyzeFile(activeFile.id, tableName);
  }, [activeFile, openPanel, analyzeFile]);
  
  const handleColumnAnalysisToggle = useCallback(() => {
    if (!gridRef.current) return;
    
    const { columnStats, triggerAnalysis } = gridRef.current;
    
    if (columnStats.length > 0) {
      // Toggle visibility if we already have data
      setShowColumnStats(!showColumnStats);
    } else {
      // Load stats for first time
      setShowColumnStats(true);
      triggerAnalysis();
    }
  }, [showColumnStats, setShowColumnStats]);

  // Handle SQL execution for column actions
  const handleExecuteSQL = useCallback(async (sql: string) => {
    try {
      const result = await executeQuery(sql);
      return result;
    } catch (error) {
      console.error('SQL execution failed:', error);
      throw error;
    }
  }, [executeQuery]);

  // Handle new table creation
  const handleTableCreate = useCallback(async (tableName: string) => {
    console.log('New table created:', tableName);
    
    try {
      // First, verify the table exists and get its structure
      const checkResult = await executeQuery(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`);
      const exists = checkResult && checkResult.numRows > 0;
      
      if (exists) {
        // Get column info for the new table
        const columnsResult = await executeQuery(`DESCRIBE ${tableName}`);
        const columnsArray = columnsResult?.toArray() || [];
        
        const columnTypes = columnsArray.map((col: any) => ({
          name: col.column_name,
          type: col.column_type,
        }));
        
        // Get row count
        const countResult = await executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
        const rowCount = countResult?.toArray()?.[0]?.count || 0;
        
        // Register the table in DuckDB store so it appears in SchemaBrowser
        const duckDBState = useDuckDBStore.getState();
        const newTables = new Map(duckDBState.registeredTables);
        const escapedTableName = `"${tableName}"`; // Escape table name for SQL queries
        newTables.set(tableName, escapedTableName);
        
        // Update DuckDB store with new table
        useDuckDBStore.setState({ 
          registeredTables: newTables,
          lastTableRefresh: Date.now() // Trigger refresh in SchemaBrowser
        });
        
        // Add to app store as a new file
        const { addFile, setActiveFileId } = useAppStore.getState();
        
        const newFileData = {
          data: [], // Empty data array since we'll load it via preview
          totalRows: rowCount,
          columnTypes,
          tableName,
          fileName: `${tableName}.sql`, // Virtual filename
          fileSize: 0,
          loadTime: Date.now(),
        };
        
        const newFileId = addFile(newFileData);
        
        // Switch to the new table
        setActiveFileId(newFileId);
        
        console.log(`Successfully added table ${tableName} to workspace with ${rowCount} rows`);
      } else {
        console.error(`Table ${tableName} was not found after creation`);
      }
    } catch (error) {
      console.error('Error adding new table to workspace:', error);
    }
  }, [executeQuery]);

  // Handle data refresh after column actions
  const handleDataRefresh = useCallback(() => {
    loadInitialData();
  }, [loadInitialData]);


  // Generate loading skeleton data
  const getLoadingData = () => {
    const columnCount = columns?.length || 10;
    const headers = [
      ' ',
      ...Array.from({ length: columnCount }, (_, i) =>
        String.fromCharCode(65 + i)
      ),
    ];
    const rows = [headers];

    for (let i = 1; i <= 25; i++) {
      const row = [i.toString()];
      for (let j = 1; j < headers.length; j++) {
        row.push(''); // Empty cells will show skeleton
      }
      rows.push(row);
    }

    return rows;
  };

  // Show error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2 text-destructive">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Show skeleton data during page changes, otherwise show real data
  const displayData =
    isChangingPage || isLoading
      ? getLoadingData()
      : sortedData.length > 0
      ? sortedData
      : getLoadingData();

  return (
    <>
      <div className="csv-grid-container relative h-full flex flex-col">
        {/* Header is now handled by the main layout, so we hide it by default */}

        <div className="flex-1 overflow-hidden">
          <div
            className={`h-full transition-opacity duration-300 ${
              isLoading || isChangingPage ? 'opacity-90' : 'opacity-100'
            }`}
          >
            <UnifiedGrid
              ref={gridRef}
              data={displayData}
              fileId={targetFileId}
              isRemoteSource={targetFile?.isRemote || false}
              showStats={showColumnStats}
              onStatsToggle={() => setShowColumnStats(!showColumnStats)}
              currentPage={currentPage}
              rowsPerPage={rowsPerPage}
              columnTypes={targetFile?.columnTypes || []}
              isDataMode={
                !isLoading && !isChangingPage && displayData.length > 0
              }
              onContextMenu={handleContextMenu}
              rowHeight={32}
              estimatedColumnWidth={120}
              editingCell={null}
              editValue=""
              onCellClick={() => {}}
              onCellEditChange={() => {}}
              onCellBlur={() => {}}
              onKeyDown={() => {}}
              formatCellValue={formatCellValue}
              getCellClass={(row, col) => {
                const baseClass = getCellClass(row, col);
                if ((isLoading || isChangingPage) && row > 0 && col > 0) {
                  return `${baseClass} bg-accent/5`;
                }
                return baseClass;
              }}
              onCellContextMenu={handleCellContextMenu}
              onSort={sortData}
              sortState={sortState}
              tableName={targetFile?.tableName}
              isView={isView}
              onExecuteSQL={handleExecuteSQL}
              onTableCreate={handleTableCreate}
              onDataRefresh={handleDataRefresh}
            />
          </div>
        </div>

        {/* Pagination footer - show when we have an active file */}
        {activeFile && (
          <DataPreviewPagination
            columnCount={columns?.length}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            rowsPerPage={rowsPerPage}
            isCountLoading={isCountLoading}
            onPageChange={changePage}
            onRowsPerPageChange={changeRowsPerPage}
            disabled={isLoading || isChangingPage}
            compact={hideHeader}
          />
        )}
      </div>

      {/* Cell Context Menu */}
      <CellContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        onCopy={handleCopyCell}
        isHeader={contextMenu.isHeader}
        onSort={(direction) => {
          if (contextMenu.columnIndex > 0) {
            sortData(contextMenu.columnIndex, direction);
          }
        }}
        cellValue={contextMenu.cellValue}
      />

      {/* Inspector Panel */}
      <InspectorPanel />
    </>
  );
};

export default DataPreviewGrid;
