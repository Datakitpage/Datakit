import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Minimize,
  Database,
  FileText,
  AlertTriangle,
  Package,
  Plus,
  Command,
  Download,
  Notebook,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { usePythonStore } from '@/store/pythonStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useResizablePanels } from '@/hooks/useResizablePanels';
import { useWorkspaceShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePanelNavigation } from '@/hooks/notebooks/usePanelNavigation';
import { useNotebooksActions } from '@/hooks/notebooks/useNotebooksActions';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { SaveDialog } from '@/components/ui/SaveDialog';
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog';
import { NotebookEditor } from '@/components/ui/NotebookEditor';
import {
  exportAsJupyterNotebook,
  exportNotebookAsPDF,
} from '@/utils/notebookExport';

import PythonCell from './PythonCell';
import PromptCell from './PromptCell';
import CellDivider from './CellDivider';
import ScriptHistory from './ScriptHistory';
import PackageManager from './PackageManager';
import ScriptTemplates from './ScriptTemplates';
import VariableInspector from './VariableInspector';
import SchemaBrowser from '../query/SchemaBrowser';
import NotebookErrorBoundary from './NotebookErrorBoundary';
import { createWelcomeCells } from '@/lib/python/welcomeCells';

// Constants for panel dimensions
const DEFAULT_PANEL_WIDTH = 260;
const MIN_PANEL_WIDTH = 50;
const MAX_PANEL_WIDTH = 400;

/**
 * Main container for the Python scripts workspace with resizable panels
 */
const NotebooksWorkspace: React.FC = () => {
  const {
    pyodide,
    cells,
    activeCellId,
    isExecuting,
    currentScript,
    savedScripts,
    showScriptHistory,
    showPackageManager,
    showVariableInspector,
    showTemplates,
    initializePython,
    createCell,
    executeCell,
    executeAllCells,
    setActiveCellId,
    toggleScriptHistory,
    togglePackageManager,
    toggleTemplates,
    createNewScript,
    toggleVariableInspector,
    clearAllCells,
    clearPythonNamespace,
  } = usePythonStore();

  const { isInitialized: isDuckDBInitialized } = useDuckDBStore();

  // UI State
  const [showSchemaBrowser, setShowSchemaBrowser] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState<
    'none' | 'editor' | 'results'
  >('none');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showNotebookSelector, setShowNotebookSelector] = useState(false);
  const [showNotebookEditor, setShowNotebookEditor] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const notebookSelectorRef = useRef<HTMLDivElement>(null);
  const notebookEditorRef = useRef<HTMLDivElement>(null);

  // Element refs
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Use resizable panels hook
  const {
    containerRef,
    leftPanelWidth,
    rightPanelWidth,
    isResizingLeft,
    isResizingRight,
    startLeftPanelResize,
    startRightPanelResize,
  } = useResizablePanels({
    leftPanel: {
      storageKey: 'datakit-scripts-left-panel-width',
      defaultWidth: DEFAULT_PANEL_WIDTH,
      minWidth: MIN_PANEL_WIDTH,
      maxWidth: MAX_PANEL_WIDTH,
    },
    rightPanel: {
      storageKey: 'datakit-scripts-right-panel-width',
      defaultWidth: DEFAULT_PANEL_WIDTH,
      minWidth: MIN_PANEL_WIDTH,
      maxWidth: MAX_PANEL_WIDTH,
    },
  });

  // Use notebook actions hook
  const {
    showSaveDialog,
    showSaveConfirm,
    hasUnsavedChanges,
    saveStatus,
    handleSaveScript,
    handleCreateNewNotebook,
    handleNotebookSwitch,
    handleSaveAndContinue,
    handleDiscardAndContinue,
    handleSaveDialogComplete,
    handleCloseSaveDialog,
    handleCloseSaveConfirm,
    handleUpdateNotebook,
  } = useNotebooksActions({
    closeMenus: () => {
      setShowNotebookSelector(false);
      setShowNotebookEditor(false);
    },
  });

  // Initialize Python on mount (only once)
  useEffect(() => {
    if (!pyodide.isInitialized && !pyodide.isInitializing && !pyodide.error) {
      initializePython();
    }
    // Only run on mount, not on state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize with welcome notebook when app opens
  useEffect(() => {
    if (cells.length === 0 && !currentScript) {
      // Create a proper initial notebook instead of just setting cells
      createNewScript('Untitled Notebook');
      // Then add welcome cells after the script is created
      setTimeout(() => {
        const welcomeCells = createWelcomeCells();
        usePythonStore.setState({ cells: welcomeCells });
        // Update the last saved state to include the welcome cells
        usePythonStore.getState().updateLastSavedState();
      }, 50);
    }
  }, [createNewScript, cells.length, currentScript]);

  // Use panel navigation hook for exclusive panel behavior
  const { handlePanelToggle } = usePanelNavigation({
    panelStates: {
      notebooks: showScriptHistory,
      schema: showSchemaBrowser,
      templates: showTemplates,
      packages: showPackageManager,
      variables: showVariableInspector,
    },
    panelToggles: {
      notebooks: toggleScriptHistory,
      schema: () => setShowSchemaBrowser(!showSchemaBrowser),
      templates: toggleTemplates,
      packages: togglePackageManager,
      variables: toggleVariableInspector,
    },
  });

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target as Node)
      ) {
        setShowDownloadMenu(false);
      }

      if (
        notebookSelectorRef.current &&
        !notebookSelectorRef.current.contains(event.target as Node)
      ) {
        setShowNotebookSelector(false);
      }

      if (
        notebookEditorRef.current &&
        !notebookEditorRef.current.contains(event.target as Node)
      ) {
        setShowNotebookEditor(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render save status indicator
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <Clock size={12} className="animate-spin" />
            <span>Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <span>Saved</span>
          </div>
        );
      case 'unsaved':
        return (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <AlertCircle size={12} />
            <span>Unsaved</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Use workspace shortcuts hook
  useWorkspaceShortcuts({
    onExecuteCell: () => activeCellId && executeCell(activeCellId),
    onExecuteAll: executeAllCells,
    onSave: handleSaveScript,
    onEscape: () => fullScreenMode !== 'none' && setFullScreenMode('none'),
    canExecuteCell: !!activeCellId,
    canSave: true,
  });

  // Download functions
  const handleDownloadJupyter = async () => {
    try {
      const notebookName = currentScript?.name || 'DataKit_Notebook';
      await exportAsJupyterNotebook(cells, notebookName);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setShowDownloadMenu(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const notebookName = currentScript?.name || 'DataKit_Notebook';
      await exportNotebookAsPDF(cells, notebookName);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setShowDownloadMenu(false);
    }
  };

  // Restart notebook function
  const handleRestartNotebook = async () => {
    if (confirm('Are you sure you want to restart the notebook? This will clear all variables and outputs.')) {
      // Clear all cell outputs
      clearAllCells();
      // Clear Python namespace (variables)
      await clearPythonNamespace();
    }
  };

  // Show initialization state
  if (!pyodide.isInitialized) {
    if (pyodide.error) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-heading font-medium text-white mb-2">
              Python Initialization Failed
            </h3>
            <p className="text-white/70 mb-4">{pyodide.error}</p>
            <Button onClick={initializePython} variant="primary">
              Retry Initialization
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h3 className="text-lg font-heading font-medium text-white mb-2">
            {pyodide.isInitializing
              ? 'Initializing Python'
              : 'Python Not Ready'}
          </h3>
          <p className="text-white/70 mb-4">
            {pyodide.isInitializing
              ? ''
              : 'Preparing your Python data analysis environment'}
          </p>
          <div className="text-sm text-white/60">
            <div className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4 text-secondary" />
              <span>Loading pandas, plotly, matplotlib, transformers...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show left panel content based on active view
  const renderLeftPanel = () => {
    if (showTemplates) {
      return <ScriptTemplates />;
    }
    if (showPackageManager) {
      return <PackageManager />;
    }
    if (showScriptHistory) {
      return <ScriptHistory />;
    }
    if (showSchemaBrowser && isDuckDBInitialized) {
      return <SchemaBrowser onInsertQuery={() => {}} />;
    }
    return <VariableInspector />;
  };

  // Show right panel
  const renderRightPanel = () => {
    return <VariableInspector />;
  };

  const showLeftPanel =
    showTemplates ||
    showPackageManager ||
    showScriptHistory ||
    showSchemaBrowser ||
    showVariableInspector;
  const showRightPanel = showVariableInspector;

  // Full screen mode
  if (fullScreenMode !== 'none') {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
          <h3 className="text-sm font-medium">
            {fullScreenMode === 'editor'
              ? 'Python Editor (Fullscreen)'
              : 'Results (Fullscreen)'}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setFullScreenMode('none')}
            title="Exit Full Screen"
          >
            <Minimize size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {/* Full screen content would go here */}
        </div>
      </div>
    );
  }

  // Regular layout with panels
  return (
    <NotebookErrorBoundary>
      <div
        ref={containerRef}
        className="h-full w-full flex overflow-hidden relative"
      >
      {/* Resize Overlays */}
      {(isResizingLeft || isResizingRight) && (
        <div
          className="absolute inset-0 z-50"
          style={{ cursor: 'col-resize' }}
        />
      )}

      {/* Left Panel */}
      <div
        ref={leftPanelRef}
        className={`flex-shrink-0 overflow-hidden bg-darkNav border-r border-white/10 relative ${
          isResizingLeft ? '' : 'transition-all duration-200'
        }`}
        style={{
          width: showLeftPanel ? `${leftPanelWidth}px` : '0px',
        }}
      >
        <div className="h-full w-full">{renderLeftPanel()}</div>

        {/* Left Resize Handle */}
        {showLeftPanel && (
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent ${
              isResizingLeft
                ? 'bg-primary/50'
                : 'hover:bg-primary/30 transition-colors'
            }`}
            onMouseDown={startLeftPanelResize}
            style={{
              width: '5px',
              right: '-2px',
            }}
          >
            {isResizingLeft && (
              <div className="absolute inset-0 bg-primary/50" />
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 bg-darkNav border-b border-white/10">
          <div className="flex items-center space-x-2">
            {/* Left panel toggles */}

            <Tooltip content="Notebooks" placement="right">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${
                  showScriptHistory ? 'bg-primary/20 text-primary' : ''
                }`}
                onClick={() => handlePanelToggle('notebooks')}
              >
                <Notebook size={16} />
              </Button>
            </Tooltip>

            <Tooltip content="Templates" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${
                  showTemplates ? 'bg-primary/20 text-primary' : ''
                }`}
                onClick={() => handlePanelToggle('templates')}
              >
                <FileText size={16} />
              </Button>
            </Tooltip>

            <Tooltip content="Schema Browser" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${
                  showSchemaBrowser ? 'bg-primary/20 text-primary' : ''
                }`}
                onClick={() => handlePanelToggle('schema')}
              >
                <Database size={16} />
              </Button>
            </Tooltip>

            <Tooltip content="Package Manager" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${
                  showPackageManager ? 'bg-primary/20 text-primary' : ''
                }`}
                onClick={() => handlePanelToggle('packages')}
              >
                <Package size={16} />
              </Button>
            </Tooltip>

            <div className="w-px h-6 bg-white/10" />

            {/* Notebook Selector */}
            <div className="relative" ref={notebookSelectorRef}>
              <div className="flex items-center gap-2 px-2 py-1">
                <button
                  className="text-sm font-medium text-white max-w-42 truncate hover:bg-white/10 rounded px-2 py-1 transition-colors cursor-pointer"
                  onClick={() => setShowNotebookEditor(!showNotebookEditor)}
                  title="Edit notebook details"
                >
                  {currentScript?.name || 'Untitled Notebook'}
                </button>
                
                {/* Save Status Indicator with Save Button */}
                <div className="ml-1 flex items-center gap-1">
                  {renderSaveStatus()}
                  
                  {/* Subtle Save Button */}
                  <button
                    className="opacity-50 hover:opacity-100 transition-opacity p-1.5 hover:bg-white/10 rounded"
                    onClick={handleSaveScript}
                    disabled={saveStatus === 'saving'}
                    title="Save notebook"
                  >
                    <Check size={14} />
                  </button>
                </div>
                
                <button
                  className="flex flex-col items-center hover:bg-white/10 rounded p-1 transition-colors cursor-pointer"
                  onClick={() => setShowNotebookSelector(!showNotebookSelector)}
                  title="Notebook selector"
                >
                  <ChevronUp className="w-4 h-3 text-white/50 -mb-0.5" />
                  <ChevronDown className="w-4 h-3 text-white/50" />
                </button>
              </div>

              {/* Notebook Dropdown */}
              {showNotebookSelector && (
                <div className="absolute left-0 top-full mt-1 bg-black border border-white/10 rounded shadow-xl z-50 min-w-64 max-h-80 overflow-y-auto">
                  {/* New Notebook Option */}
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2 border-b border-white/10"
                    onClick={handleCreateNewNotebook}
                  >
                    <Plus className="w-4 h-4" />
                    New Notebook
                  </button>

                  {/* Saved Notebooks */}
                  {savedScripts.length > 0 ? (
                    savedScripts.map((script) => (
                      <button
                        key={script.id}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between ${
                          currentScript?.id === script.id
                            ? 'bg-primary/20 text-primary'
                            : 'text-white/80'
                        }`}
                        onClick={() => handleNotebookSwitch(script.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{script.name}</span>
                        </div>
                        {currentScript?.id === script.id && (
                          <span className="text-xs bg-primary/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            Current
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-sm text-white/50">
                      No saved notebooks
                    </div>
                  )}
                </div>
              )}

              {/* Notebook Editor Details */}
              {showNotebookEditor && (
                <div
                  ref={notebookEditorRef}
                  className="absolute left-0 top-full mt-1 z-50"
                >
                  <NotebookEditor
                    isOpen={showNotebookEditor}
                    onClose={() => setShowNotebookEditor(false)}
                    script={currentScript}
                    onUpdate={handleUpdateNotebook}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Tooltip content="Add New Code Cell" placement="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createCell('code')}
                className="h-8"
              >
                <Plus size={14} className="mr-1" />
                <span>Code</span>
              </Button>
            </Tooltip>

            <Tooltip content="Add New Text Cell" placement="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createCell('markdown')}
                className="h-8"
              >
                <Plus size={14} className="mr-1" />
                <span>Text</span>
              </Button>
            </Tooltip>

            <Tooltip content="Add New AI Prompt Cell" placement="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createCell('prompt')}
                className="h-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/20"
              >
                <Sparkles size={14} className="mr-1 text-purple-400" />
                <span>Prompt</span>
              </Button>
            </Tooltip>

            <Tooltip
              content="Execute All Cells (⌘+Shift+Enter)"
              placement="bottom"
            >
              <Button
                variant="primary"
                size="sm"
                onClick={executeAllCells}
                disabled={isExecuting || cells.length === 0}
                className="h-8 gap-2"
              >
                <div className="flex items-center">
                  <Play size={14} className="mr-1" />
                  <span>Run All</span>
                </div>
                <div className="flex items-center text-[11px] opacity-60 bg-white/10 px-1.5 py-0.5 rounded">
                  <Command size={11} className="mr-0.5" />
                  <span className="leading-none">⇧↵</span>
                </div>
              </Button>
            </Tooltip>

            {/* TODO: To make it work */}
            {/* <Tooltip
              content="Clear all variables and outputs"
              placement="bottom-left"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRestartNotebook}
                disabled={isExecuting}
                className="h-8"
              >
                <RefreshCw size={14} className="mr-1" />
              </Button>
            </Tooltip> */}

            {/* Download Button */}
            <div className="relative" ref={downloadMenuRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDownloadMenu(!showDownloadMenu);
                  }}
                >
                  <Download size={16} />
                </Button>
  

              {/* Download Dropdown Menu */}
              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-1 bg-black border border-white/10 rounded shadow-xl z-50 min-w-48">
                  <button
                    className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 flex items-center gap-2 rounded-t"
                    onClick={handleDownloadPDF}
                  >
                    Download as PDF
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 flex items-center gap-2 rounded-b"
                    onClick={handleDownloadJupyter}
                  >
                    Download as Jupyter Notebook
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cells Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-visible p-8 space-y-0">
            {cells.map((cell, index) => (
              <React.Fragment key={cell.id}>
                {cell.type === 'prompt' ? (
                  <PromptCell
                    cell={cell}
                    isActive={cell.id === activeCellId}
                    onActivate={() => setActiveCellId(cell.id)}
                    cellNumber={index + 1}
                  />
                ) : (
                  <PythonCell
                    cell={cell}
                    isActive={cell.id === activeCellId}
                    onActivate={() => setActiveCellId(cell.id)}
                    cellNumber={index + 1}
                  />
                )}
                {/* Cell Divider - always show after each cell */}
                <CellDivider
                  insertIndex={index + 1}
                  isLastCell={index === cells.length - 1}
                />
              </React.Fragment>
            ))}
            {/* If no cells, show empty state message */}
            {cells.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-2">
                    Empty Notebook
                  </h3>
                  <p className="text-white/60 max-w-md leading-relaxed">
                    Start by creating your first cell. You can add code cells to
                    run Python code or text cells for documentation.
                  </p>
                </div>

                <CellDivider insertIndex={0} isLastCell={true} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div
        ref={rightPanelRef}
        className={`flex-shrink-0 overflow-hidden bg-darkNav border-l border-white/10 relative ${
          isResizingRight ? '' : 'transition-all duration-200'
        }`}
        style={{
          width: showRightPanel ? `${rightPanelWidth}px` : '0px',
        }}
      >
        <div className="h-full w-full">{renderRightPanel()}</div>

        {/* Right Resize Handle */}
        {showRightPanel && (
          <div
            className={`absolute top-0 left-0 w-1 h-full cursor-col-resize bg-transparent ${
              isResizingRight
                ? 'bg-primary/50'
                : 'hover:bg-primary/30 transition-colors'
            }`}
            onMouseDown={startRightPanelResize}
            style={{
              width: '5px',
              left: '-2px',
            }}
          >
            {isResizingRight && (
              <div className="absolute inset-0 bg-primary/50" />
            )}
          </div>
        )}
      </div>

      {/* Save Script Dialog */}
      <SaveDialog
        isOpen={showSaveDialog}
        title="Save Notebook"
        placeholder="Enter Notebook name"
        initialValue={currentScript?.name || ''}
        onSave={handleSaveDialogComplete}
        onClose={handleCloseSaveDialog}
      />

      {/* Save Confirmation Dialog */}
      <UnsavedChangesDialog
        isOpen={showSaveConfirm}
        onClose={handleCloseSaveConfirm}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscardAndContinue}
        saveButtonText="Save and Switch"
      />
      </div>
    </NotebookErrorBoundary>
  );
};

export default NotebooksWorkspace;
