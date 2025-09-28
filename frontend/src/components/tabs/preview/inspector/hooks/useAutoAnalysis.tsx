import { useEffect, useState, useCallback } from 'react';
import { useInspectorStore } from '@/store/inspectorStore';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';

interface QuickPreview {
  rowCount: number;
  columnCount: number;
  tableName: string;
  fileSize?: number;
  loadTime: number;
}

interface AutoAnalysisOptions {
  /** Delay before auto-triggering analysis (ms) */
  autoAnalysisDelay?: number;
  /** Whether to auto-open inspector panel */
  autoOpenPanel?: boolean;
  /** Whether to show quick preview while analyzing */
  showQuickPreview?: boolean;
}

/**
 * Hook that manages automatic analysis triggering and quick previews
 */
export const useAutoAnalysis = (options: AutoAnalysisOptions = {}) => {
  const {
    autoAnalysisDelay = 1000, // 1 second delay feels responsive
    autoOpenPanel = false,
    showQuickPreview = true
  } = options;

  // Store states
  const { 
    analyzeFile, 
    isAnalyzing, 
    results, 
    openPanel,
    activeFileId 
  } = useInspectorStore();
  
  const { activeFile } = useAppStore();
  const { isInitialized, connection } = useDuckDBStore();

  // Quick preview state
  const [quickPreview, setQuickPreview] = useState<QuickPreview | null>(null);
  const [isGettingPreview, setIsGettingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  /**
   * Gets instant preview data (row count, columns) without full analysis
   */
  const getQuickPreview = useCallback(async (fileId: string, tableName: string): Promise<QuickPreview | null> => {
    if (!connection || !isInitialized) {
      return null;
    }

    const startTime = Date.now();
    setIsGettingPreview(true);
    setPreviewError(null);

    try {
      console.log(`[AutoAnalysis] Getting quick preview for ${tableName}`);

      // Get the escaped table name
      const duckDBStore = useDuckDBStore.getState();
      const escapedTableName = duckDBStore.registeredTables.get(tableName);
      
      if (!escapedTableName) {
        throw new Error(`Table "${tableName}" not found`);
      }

      // Quick queries for basic info
      const [rowCountResult, schemaResult] = await Promise.all([
        connection.query(`SELECT COUNT(*) as row_count FROM ${escapedTableName}`),
        duckDBStore.getTableSchema(tableName)
      ]);

      const rowCount = Number(rowCountResult.toArray()[0].row_count);
      const columnCount = schemaResult?.length || 0;
      const loadTime = Date.now() - startTime;

      const preview: QuickPreview = {
        rowCount,
        columnCount,
        tableName,
        loadTime
      };

      console.log(`[AutoAnalysis] Quick preview completed in ${loadTime}ms:`, preview);
      return preview;

    } catch (error) {
      console.error(`[AutoAnalysis] Quick preview failed:`, error);
      setPreviewError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setIsGettingPreview(false);
    }
  }, [connection, isInitialized]);

  /**
   * Triggers analysis with smart timing
   */
  const triggerAnalysis = useCallback(async (fileId: string, tableName: string) => {
    // Skip if already analyzing or results exist
    if (isAnalyzing || results.has(fileId)) {
      return;
    }

    console.log(`[AutoAnalysis] Triggering analysis for ${fileId}/${tableName}`);
    
    try {
      // Get quick preview first if requested
      if (showQuickPreview) {
        const preview = await getQuickPreview(fileId, tableName);
        setQuickPreview(preview);
      }

      // Small delay to let UI update with preview
      await new Promise(resolve => setTimeout(resolve, 200));

      // Start full analysis
      await analyzeFile(fileId, tableName);

      // Auto-open panel if requested and analysis succeeds
      if (autoOpenPanel && !useInspectorStore.getState().isOpen) {
        openPanel();
      }

    } catch (error) {
      console.error(`[AutoAnalysis] Auto-analysis failed:`, error);
      setPreviewError(error instanceof Error ? error.message : String(error));
    }
  }, [analyzeFile, isAnalyzing, results, showQuickPreview, getQuickPreview, autoOpenPanel, openPanel]);

  /**
   * Main effect: Watch for active file changes and trigger analysis
   */
  useEffect(() => {
    if (!activeFile || !activeFile.tableName || !isInitialized) {
      setQuickPreview(null);
      setPreviewError(null);
      return;
    }

    const fileId = activeFile.id;
    const tableName = activeFile.tableName;

    // Clear previous preview when file changes
    if (activeFileId !== fileId) {
      setQuickPreview(null);
      setPreviewError(null);
    }

    // Skip if we already have results for this file
    if (results.has(fileId)) {
      console.log(`[AutoAnalysis] Results already exist for ${fileId}`);
      return;
    }

    // Skip if currently analyzing this file
    if (isAnalyzing && activeFileId === fileId) {
      console.log(`[AutoAnalysis] Already analyzing ${fileId}`);
      return;
    }

    console.log(`[AutoAnalysis] Scheduling analysis for ${fileId} in ${autoAnalysisDelay}ms`);

    // Trigger analysis after delay
    const timer = setTimeout(() => {
      triggerAnalysis(fileId, tableName);
    }, autoAnalysisDelay);

    return () => {
      clearTimeout(timer);
    };
  }, [activeFile, isInitialized, results, isAnalyzing, activeFileId, autoAnalysisDelay, triggerAnalysis]);

  /**
   * Manual trigger function for user-initiated analysis
   */
  const manualTrigger = useCallback(() => {
    if (activeFile && activeFile.tableName) {
      triggerAnalysis(activeFile.id, activeFile.tableName);
    }
  }, [activeFile, triggerAnalysis]);

  /**
   * Clear preview data
   */
  const clearPreview = useCallback(() => {
    setQuickPreview(null);
    setPreviewError(null);
  }, []);

  return {
    // Preview data
    quickPreview,
    isGettingPreview,
    previewError,
    
    // Control functions
    manualTrigger,
    clearPreview,
    
    // Computed states
    hasPreview: !!quickPreview,
    hasResults: activeFile ? results.has(activeFile.id) : false,
    shouldShowPreview: showQuickPreview && (isGettingPreview || !!quickPreview),
    
    // Analysis state
    isAnalyzing,
    analysisProgress: useInspectorStore(state => state.analysisProgress),
    analysisStatus: useInspectorStore(state => state.analysisStatus),
  };
};

/**
 * Higher-order component that provides auto-analysis functionality
 */
export const withAutoAnalysis = <P extends object>(
  Component: React.ComponentType<P>,
  options?: AutoAnalysisOptions
) => {
  return function WithAutoAnalysisComponent(props: P) {
    const autoAnalysis = useAutoAnalysis(options);
    
    return <Component {...props} autoAnalysis={autoAnalysis} />;
  };
};

/**
 * Quick preview component for instant feedback
 */
interface QuickPreviewProps {
  preview: QuickPreview;
  isAnalyzing?: boolean;
  className?: string;
}

export const QuickPreviewCard: React.FC<QuickPreviewProps> = ({ 
  preview, 
  isAnalyzing = false,
  className 
}) => {
  return (
    <div className={`p-4 bg-card/20 rounded-lg border border-border ${className || ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Quick Preview</h3>
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Analyzing...
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">
            {preview.rowCount.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Rows</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">
            {preview.columnCount}
          </div>
          <div className="text-xs text-muted-foreground">Columns</div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          Loaded in {preview.loadTime}ms
          {isAnalyzing && " • Full analysis in progress..."}
        </div>
      </div>
    </div>
  );
};

/**
 * Loading state with better UX
 */
interface AnalysisLoadingProps {
  progress: number;
  status: string;
  preview?: QuickPreview | null;
  estimatedTimeLeft?: number;
}

export const AnalysisLoadingState: React.FC<AnalysisLoadingProps> = ({
  progress,
  status,
  preview,
  estimatedTimeLeft
}) => {
  return (
    <div className="space-y-4">
      {/* Show preview while analyzing */}
      {preview && (
        <QuickPreviewCard preview={preview} isAnalyzing={true} />
      )}
      
      {/* Progress indicator */}
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-border rounded-full">
            <div 
              className="w-12 h-12 border-4 border-primary rounded-full border-t-transparent animate-spin"
              style={{
                animationDuration: '1s'
              }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono text-primary">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <div className="text-sm font-medium text-foreground">{status}</div>
          <div className="w-64 bg-accent/10 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {estimatedTimeLeft 
              ? `~${estimatedTimeLeft}s remaining`
              : `${progress.toFixed(0)}% complete`
            }
          </div>
        </div>
      </div>
    </div>
  );
};