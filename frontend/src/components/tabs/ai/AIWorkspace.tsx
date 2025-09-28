import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { useAppStore } from "@/store/appStore";
import { selectActiveFile } from "@/store/selectors/appSelectors";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAIVisualization } from "@/hooks/ai/useAIVisualization";

import SchemaBrowser from "@/components/tabs/query/SchemaBrowser";
import AuthModal from "@/components/auth/AuthModal";
import ContextBar from "./ContextBar";
import PromptPanel from "./PromptPanel";
import ResponsePanel from "./ResponsePanel";
import ResultsPanel from "./ResultsPanel";
import ApiKeyModal from "./ApiKeyModal";
import AIVisualizationPanel from "./AIVisualizationPanel";
import VisualizationExportModal from "./VisualizationExportModal";
import VisualizationSideTab from "./VisualizationSideTab";
import ResultsExpandButton from "./ResultsExpandButton";
import VisualizationCustomizePanel from "./VisualizationCustomizePanel";
import SplitResizeHandle from "./SplitResizeHandle";


const AIWorkspace: React.FC = () => {
  const [schemaBrowserOpen, setSchemaBrowserOpen] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [resultsPanelHeight, setResultsPanelHeight] = useState(300);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("signup");
  
  // Visualization state
  const [activeVizId, setActiveVizId] = useState<string | null>(null);
  const [vizExpanded, setVizExpanded] = useState(true);
  const [vizCustomizeMode, setVizCustomizeMode] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [splitViewRatio, setSplitViewRatio] = useState(50);
  
  // Live chart configuration state
  const [liveConfig, setLiveConfig] = useState<any>(null);

  const { activeProvider, setActiveProvider, apiKeys, queryResults } = useAIStore();
  const activeFile = useAppStore(selectActiveFile);
  const { isAuthenticated } = useAuth();
  const { getVisualization, clearVisualization, exportVisualization, generateVisualization, isGenerating } = useAIVisualization();

  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const resultsResizeRef = useRef<HTMLDivElement>(null);

  // Get active visualization data
  const activeViz = activeVizId ? getVisualization(activeVizId) : null;

  // Auto-expand results when query executes
  useEffect(() => {
    if (queryResults && !resultsExpanded) {
      setResultsExpanded(true);
    }
  }, [queryResults]);

  // Hide results panel when changing file
  useEffect(() => {
      setResultsExpanded(false);
  }, [activeFile?.id]); 

  // Focus prompt on mount
  useEffect(() => {
    promptInputRef.current?.focus();
  }, []);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        promptInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle results panel resize
  const handleResultsResize = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startHeight = resultsPanelHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
      setResultsPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ns-resize";
  };

  // Handle split view resize
  const handleSplitResize = (e: React.MouseEvent) => {
    const container = e.currentTarget.parentElement;
    if (!container) return;

    const startX = e.clientX;
    const containerWidth = container.offsetWidth;
    const startRatio = splitViewRatio;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaRatio = (deltaX / containerWidth) * 100;
      const newRatio = Math.max(30, Math.min(70, startRatio + deltaRatio));
      setSplitViewRatio(newRatio);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ew-resize";
  };

  const handleOpenAuthModal = (mode: "login" | "signup") => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const handleOpenSettings = () => {
    if (!isAuthenticated) {
      handleOpenAuthModal("login");
      return;
    }
    setShowApiKeyModal(true);
  };

  const handleVisualizationOpen = (vizId: string) => {
    setActiveVizId(vizId);
    setVizExpanded(true);
  };

  const handleVisualizationToggle = () => {
    setVizExpanded(!vizExpanded);
  };

  const handleVisualizationExpand = () => {
    setVizCustomizeMode(true);
    // Initialize live config with current visualization config
    if (activeViz) {
      setLiveConfig({
        ...activeViz.config,
        title: 'AI Generated Visualization'
      });
    }
  };

  const handleVisualizationExitCustomize = () => {
    setVizCustomizeMode(false);
    setLiveConfig(null);
  };

  // Update live configuration
  const updateLiveConfig = (updates: any) => {
    setLiveConfig(prev => ({ ...prev, ...updates }));
  };

  const handleVisualizationExport = () => {
    setShowExportModal(true);
  };

  // Check if current provider is ready to use
  const isProviderReady = () => {
    // All AI functionality now requires authentication
    if (!isAuthenticated) {
      return false;
    }
    
    if (activeProvider === 'datakit') {
      return isAuthenticated; // DataKit requires authentication
    }
    if (activeProvider === 'local') {
      return isAuthenticated; // Local models
    }
    if (activeProvider === 'ollama') {
      return isAuthenticated; // Ollama
    }
    // Other providers need both authentication and API keys
    return isAuthenticated && apiKeys.has(activeProvider) && !!apiKeys.get(activeProvider);
  };

  const showSetupPrompt = !isProviderReady();
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Context Bar */}
      <ContextBar onOpenApiKeyModal={() => setShowApiKeyModal(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Schema Browser - Collapsible */}
        <AnimatePresence>
          {schemaBrowserOpen && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 250 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-border overflow-hidden"
            >
              <SchemaBrowser onInsertQuery={() => {}} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat/Response Area with Split View */}
        <div className="flex-1 flex min-w-0">
          {/* Left: Prompt Panel */}
          <div 
            className="border-r border-border min-w-0 flex-shrink-0"
            style={{ 
              width: vizCustomizeMode ? '20%' : (activeViz ? '30%' : '40%'),
              display: vizCustomizeMode ? 'none' : 'block'
            }}
          >
            <PromptPanel
              inputRef={promptInputRef}
              showSetupPrompt={showSetupPrompt}
              onSignUpClick={() => handleOpenAuthModal("signup")}
              onConfigureClick={handleOpenSettings}
              onToggleSchema={() => setSchemaBrowserOpen(!schemaBrowserOpen)}
              schemaBrowserOpen={schemaBrowserOpen}
            />
          </div>

          {/* Middle: Response Panel or Customization Panel */}
          <div 
            className={`min-w-0 overflow-hidden relative ${
              activeViz && vizExpanded ? 'border-r border-border' : ''
            }`}
            style={{ 
              width: vizCustomizeMode 
                ? '25%' 
                : (activeViz && vizExpanded ? `${splitViewRatio}%` : '60%'),
              flex: activeViz && !vizExpanded ? '1' : undefined
            }}
          >
            {vizCustomizeMode ? (
              /* Customization Panel */
              <VisualizationCustomizePanel
                liveConfig={liveConfig}
                onConfigUpdate={updateLiveConfig}
              />
            ) : (
              /* Normal Response Panel */
              <>
                <ResponsePanel 
                  onVisualizationOpen={handleVisualizationOpen}
                  generateVisualization={generateVisualization}
                  isGeneratingViz={isGenerating}
                  hasActiveVisualization={!!activeViz && !vizExpanded}
                  onShowVisualization={handleVisualizationToggle}
                />
                
                {/* Visualization Indicator (when collapsed) */}
                <VisualizationSideTab
                  isVisible={!vizExpanded && !!activeViz}
                  onToggle={handleVisualizationToggle}
                />
                
                {/* Split Resize Handle */}
                <SplitResizeHandle
                  isVisible={activeViz && vizExpanded}
                  onResize={handleSplitResize}
                />
              </>
            )}
          </div>

          {/* Right: Visualization Panel (conditional) */}
          <AnimatePresence>
            {activeViz && vizExpanded && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ 
                  width: vizCustomizeMode ? '75%' : `${100 - splitViewRatio}%`, 
                  opacity: 1 
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="min-w-0 overflow-hidden bg-background"
              >
                <AIVisualizationPanel
                  data={activeViz.data}
                  config={vizCustomizeMode && liveConfig ? liveConfig : activeViz.config}
                  chartType={activeViz.chartType}
                  sql={activeViz.sql}
                  insights={activeViz.insights}
                  title={vizCustomizeMode ? liveConfig?.title : undefined}
                  onExpand={handleVisualizationExpand}
                  onExport={handleVisualizationExport}
                  onToggle={vizCustomizeMode ? handleVisualizationExitCustomize : handleVisualizationToggle}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: Results Panel - Collapsible */}
      <AnimatePresence>
        {resultsExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: resultsPanelHeight }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border bg-popover relative"
          >
            {/* Resize Handle */}
            <div
              ref={resultsResizeRef}
              onMouseDown={handleResultsResize}
              className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/20 transition-colors"
            />

            {/* Collapse Button - Centered */}
            <button
              onClick={() => setResultsExpanded(false)}
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-full p-2 hover:border-primary/50 transition-colors shadow-lg"
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            <ResultsPanel height={resultsPanelHeight} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Expand Button (when collapsed) */}
      <ResultsExpandButton
        isVisible={!resultsExpanded && !!queryResults}
        onExpand={() => setResultsExpanded(true)}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authModalMode}
        onLoginSuccess={() => setActiveProvider('datakit')}
      />

      {/* Fullscreen Export Modal */}
      {activeViz && (
        <VisualizationExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          vizId="current-viz"
          title="Visualization"
          data={activeViz.data}
        />
      )}
    </div>
  );
};

export default AIWorkspace;
