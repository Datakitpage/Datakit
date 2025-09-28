import { motion, AnimatePresence } from "framer-motion";
import { useCallback, } from "react";
import { Search, BarChart3 } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import DataPreviewTab from "@/components/tabs/DataPreviewTab";
import QueryTab from "@/components/tabs/QueryTab";
import VisualizationTab from "@/components/tabs/VisualizationTab";
import AITab from "@/components/tabs/AITab";
import NotebooksTab from "@/components/tabs/NotebooksTab";
import { SEO } from "@/components/common/SEO";
import FileTabs from "@/components/data-grid/FileTabs";
import ViewModeSelector, { ViewMode } from "@/components/navigation/ViewModeSelector";
import ActionButtons from "@/components/common/ActionButtons";
import EmptyDataState from "@/components/data-grid/EmptyDataState";


import { DataSourceType } from "@/types/json";
import { useHomePageLogic } from "@/hooks/useHomePageLogic";
import { useAppStore } from "@/store/appStore";
import { useInspectorStore } from "@/store/inspectorStore";
import { useColumnStats } from "@/hooks/useColumnStats";
import { selectActiveFile, selectFileTabs, selectHasFiles } from "@/store/selectors/appSelectors";
import { ImportProvider } from "@/types/remoteImport";

/**
 * Main application home page component with file-centric navigation
 */
const Home = () => {
  const {
    // Store data
    sourceType,
    jsonSchema,
    jsonViewMode,
    
    // Store actions
    setJsonViewMode,
    
    // Computed values
    feedbackContext,
    
    // Handlers
    handleDataLoad,
  } = useHomePageLogic();

  // File management from store
  const hasFiles = useAppStore(selectHasFiles);
  const activeFile = useAppStore(selectActiveFile);
  const fileTabs = useAppStore(selectFileTabs);
  const { setActiveFile, removeFile, closeAllFiles, closeOthersFiles, setIsRemoteModalOpen, setActiveProviderRemoteModal, showColumnStats, setShowColumnStats, changeViewMode, emptyStateViewMode } = useAppStore();
  
  // Inspector store
  const { openPanel, analyzeFile } = useInspectorStore();

  // Column stats hook
  const { columnStats, isLoading: isLoadingStats, triggerAnalysis } = useColumnStats({
    fileId: activeFile?.id,
    enabled: true,
    manualTrigger: true
  });

  
  // Get current view mode - use file's mode if available, otherwise use empty state mode
  const currentViewMode: ViewMode = activeFile?.viewMode || emptyStateViewMode;
  
  // Handle tab switching and mode changes
  const handleTabClick = (fileId: string) => {
    setActiveFile(fileId);
    // No need to reset view mode - each file maintains its own
  };

  const handleTabClose = (fileId: string) => {
    removeFile(fileId);
  };

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    changeViewMode(mode);
  }, [changeViewMode]);

  const handleImportOptionClick = (val: ImportProvider) => {
    setIsRemoteModalOpen(true);
    setActiveProviderRemoteModal(val);
  };


  // Inspector handler
  const handleInspectorClick = useCallback(() => {
    if (!activeFile) return;
    const tableName = activeFile.tableName;
    openPanel();
    analyzeFile(activeFile.id, tableName);
  }, [activeFile, openPanel, analyzeFile]);
  
  // Column stats handler
  const handleColumnStatsToggle = useCallback(() => {
    if (columnStats.length > 0) {
      // Toggle visibility if we already have data
      setShowColumnStats(!showColumnStats);
    } else {
      // Load stats for first time
      setShowColumnStats(true);
      triggerAnalysis();
    }
  }, [columnStats.length, showColumnStats, setShowColumnStats, triggerAnalysis]);

  // Animation variants for content
  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  // Render the appropriate content based on view mode
  const renderContent = () => {
    // Show different empty states or actual content based on mode
    switch (currentViewMode) {
      case 'preview':
        return hasFiles ? <DataPreviewTab /> : <EmptyDataState onImportOptionClick={handleImportOptionClick} />;
      case 'query':
        return <QueryTab />;
      case 'notebook':
        return <NotebooksTab />;
      case 'visualization':
        return <VisualizationTab />;
      case 'ai':
        return <AITab />;
      default:
        return hasFiles ? <DataPreviewTab /> : <EmptyDataState onImportOptionClick={handleImportOptionClick} />;
    }
  };

  return (
    <>
      <SEO 
        title="DataKit"
        description="Your data, your choice. Process locally for complete privacy or leverage cloud when you need to collaborate. The modern data analysis platform that adapts to you."
        keywords="data analysis, privacy-first analytics, local data processing, WebAssembly, DuckDB, data visualization, SQL queries, CSV analysis, Excel processing, data science, business intelligence, secure analytics, DataKit"
        url="/"
      />
      <MainLayout 
        onDataLoad={handleDataLoad}
        feedbackContext={feedbackContext}
        showTabs={false} // We're handling navigation ourselves now
      >
        <div className="h-full flex flex-col bg-background relative">
          {/* Action Buttons - Fixed in top right corner */}
          <div className="absolute right-6 top-4 z-50">
            <ActionButtons 
              feedbackContext={feedbackContext} 
              minimal={hasFiles}
            />
          </div>

          {/* File Tabs - Primary Navigation */}
          {hasFiles && (
            <div className="pt-3 px-4">
              <FileTabs
                tabs={fileTabs}
                onTabClick={handleTabClick}
                onTabClose={handleTabClose}
                onCloseAll={closeAllFiles}
                onCloseOthers={closeOthersFiles}
                className="bg-transparent"
              />
            </div>
          )}

          {/* View Mode Selector - Always on the left */}
          <motion.div 
            className="flex items-center justify-between px-6 py-2 min-h-[60px]"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* ViewModeSelector - always on left */}
            <ViewModeSelector
              currentMode={currentViewMode}
              onModeChange={handleViewModeChange}
            />
            
            {/* Action buttons - on the right side */}
            {hasFiles && activeFile && currentViewMode === 'preview' && !activeFile.isRemote && (
              <motion.div 
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                
                {/* Column Stats Button - Aligned with navigation style */}
                <motion.button
                  onClick={handleColumnStatsToggle}
                  className="relative group flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-popover backdrop-blur-sm border border-border transition-all duration-200 hover:border-border cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {showColumnStats && columnStats.length > 0 && (
                    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/25 via-primary/20 to-primary/15 border border-primary/30" />
                  )}
                  {isLoadingStats ? (
                    <svg 
                      className="w-4 h-4 text-primary animate-spin relative z-10" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <BarChart3 className={`h-4 w-4 relative z-10 ${
                      showColumnStats && columnStats.length > 0 ? 'text-foreground' : 'text-muted-foreground'
                    }`} />
                  )}
                  <span className={`relative z-10 font-medium ${
                    showColumnStats && columnStats.length > 0 ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {columnStats.length > 0 
                      ? (showColumnStats ? 'Hide Stats' : 'Show Stats')
                      : 'Column Stats'
                    }
                  </span>
                </motion.button>
                
                {/* Inspector Button - Aligned with navigation style */}
                <motion.button
                  onClick={handleInspectorClick}
                  className="relative group flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-popover backdrop-blur-sm border border-border transition-all duration-200 hover:border-border cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Search className="h-4 w-4 text-muted-foreground hover:text-foreground relative z-10" />
                  <span className="text-muted-foreground hover:text-foreground relative z-10 font-medium">Inspector</span>
                </motion.button>
              </motion.div>
            )}
          </motion.div>

          {/* JSON View Mode Toggle (contextual, only for JSON files) */}
          {sourceType === DataSourceType.JSON && jsonSchema?.isNested && currentViewMode === 'preview' && (
            <div className="flex justify-center pb-2">
              <div className="border border-border rounded-lg overflow-hidden bg-popover backdrop-blur-sm">
                <button
                  className={`px-3 py-1 text-xs ${
                    jsonViewMode === "table"
                      ? "bg-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  } transition-colors`}
                  onClick={() => setJsonViewMode("table")}
                >
                  Table
                </button>
                <button
                  className={`px-3 py-1 text-xs ${
                    jsonViewMode === "tree"
                      ? "bg-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  } transition-colors`}
                  onClick={() => setJsonViewMode("tree")}
                >
                  Tree
                </button>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden relative px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentViewMode}-${activeFile?.id || 'empty'}`}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="absolute inset-0 px-6 pb-6"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </MainLayout>
    </>
  );
};

export default Home;