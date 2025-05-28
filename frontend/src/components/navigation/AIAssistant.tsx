// components/navigation/AIAssistant.tsx
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  MessageCircle, 
  Plus, 
  X, 
  Play,
  BarChart3,
  PieChart,
  TrendingDown,
  Zap,
  Database,
  Clock,
  AlertTriangle,
  Check,
  Lightbulb,
  FileText,
  Shield
} from 'lucide-react';

import { useAIAssistantStore } from '@/store/aiAssistantStore';
import { useAppStore } from '@/store/appStore';
import { useChartsStore } from '@/store/chartsStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import EnhancedChatInterface from './ChatInterface';

interface AIAssistantProps {
  className?: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ className }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const {
    isExpanded,
    activeMode,
    activeFileIds,
    analysisResults,
    isAnalyzing,
    analysisProgress,
    chatHistory,
    showDiscoveryBadge,
    hasSeenOnboarding,
    discoveryStep,
    toggleExpanded,
    setActiveMode,
    setActiveFiles,
    addFileToAnalysis,
    removeFileFromAnalysis,
    analyzeActiveFiles,
    getAnalysisForFile,
    addChatMessage,
    markOnboardingSeen,
    hideDiscoveryBadge,
    loadFromStorage
  } = useAIAssistantStore();
  
  const { files, activeFileId, setActiveTab } = useAppStore();
  const { createNewChart } = useChartsStore();
  const { executeQuery } = useDuckDBStore();
  
  // Load store data on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);
  
  // Auto-set active file when it changes
  useEffect(() => {
    if (activeFileId && !activeFileIds.includes(activeFileId)) {
      setActiveFiles([activeFileId]);
    }
  }, [activeFileId, activeFileIds, setActiveFiles]);
  
  // Show discovery badge when data is loaded
  useEffect(() => {
    if (files.length > 0 && discoveryStep === 'file-loaded') {
      hideDiscoveryBadge();
      setTimeout(() => {
        useAIAssistantStore.getState().updateDiscoveryStep('analysis-ready');
      }, 1000);
    }
  }, [files.length, discoveryStep]);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isExpanded) {
          toggleExpanded();
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, toggleExpanded]);
  
  const handleButtonClick = () => {
    if (!hasSeenOnboarding && !isExpanded) {
      setShowOnboarding(true);
      markOnboardingSeen();
    }
    toggleExpanded();
    hideDiscoveryBadge();
    
    // Auto-analyze if files are loaded but no analysis exists
    if (activeFileIds.length > 0) {
      const hasAnalysis = activeFileIds.some(id => getAnalysisForFile(id));
      if (!hasAnalysis && !isAnalyzing) {
        setTimeout(() => analyzeActiveFiles(), 300);
      }
    }
  };
  
  const handleChartSuggestionClick = async (suggestion: any) => {
    try {
      // Execute the sample query to get fresh data
      let chartData = [];
      
      if (suggestion.sampleQuery) {
        const result = await executeQuery(suggestion.sampleQuery);
        if (result) {
          chartData = result.toArray();
        }
      } else {
        // Fallback to file data
        const file = files.find(f => f.id === suggestion.fileId);
        chartData = file?.data?.slice(0, 100) || [];
      }
      
      // Create chart using the charts store
      createNewChart(suggestion.type, chartData, suggestion.sampleQuery);
      
      // Switch to visualization tab
      setActiveTab('visualization');
      
      // Add to chat history
      addChatMessage(
        `Created ${suggestion.title} chart from your data`,
        'assistant',
        { fileId: suggestion.fileId, chart: suggestion }
      );
      
      // Close the AI panel
      toggleExpanded();
      
    } catch (error) {
      console.error('Failed to create chart:', error);
      addChatMessage(
        'Sorry, I encountered an error creating that chart. Please try again.',
        'assistant'
      );
    }
  };
  
  const handleSqlSuggestionClick = (suggestion: any) => {
    // Switch to query tab and populate the editor
    setActiveTab('query');
    
    // Add query to Monaco editor (you'll need to expose this from QueryWorkspace)
    // For now, add to chat
    addChatMessage(
      `Here's a suggested query: ${suggestion.query}`,
      'assistant',
      { fileId: suggestion.fileId, query: suggestion.query }
    );
    
    toggleExpanded();
  };
  
  // Get current analysis data
  const getCurrentAnalysis = () => {
    if (activeFileIds.length === 0) return null;
    
    // For single file, return its analysis
    if (activeFileIds.length === 1) {
      return getAnalysisForFile(activeFileIds[0]);
    }
    
    // For multiple files, combine insights
    const allAnalyses = activeFileIds.map(id => getAnalysisForFile(id)).filter(Boolean);
    if (allAnalyses.length === 0) return null;
    
    return {
      insights: allAnalyses.flatMap(a => a.insights),
      chartSuggestions: allAnalyses.flatMap(a => a.chartSuggestions),
      sqlSuggestions: allAnalyses.flatMap(a => a.sqlSuggestions)
    };
  };
  
  const currentAnalysis = getCurrentAnalysis();
  const hasData = files.length > 0;
  const hasSuggestions = currentAnalysis && (
    currentAnalysis.chartSuggestions.length > 0 || 
    currentAnalysis.insights.length > 0 ||
    currentAnalysis.sqlSuggestions.length > 0
  );
  
  // Calculate suggestion count for badge
  const suggestionCount = currentAnalysis ? 
    currentAnalysis.chartSuggestions.length + currentAnalysis.insights.length + currentAnalysis.sqlSuggestions.length : 0;
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* AI Assistant Button */}
      <button
        onClick={handleButtonClick}
        disabled={!hasData}
        className={`
          relative px-4 py-2 text-sm rounded-t-md transition-all duration-200 flex items-center cursor-pointer
          ${isExpanded 
            ? "text-white font-medium bg-gradient-to-r from-primary to-blue-800" 
            : hasData 
              ? "text-white/70 hover:text-white/90 hover:bg-white/5" 
              : "text-white/30 cursor-not-allowed"
          }
        `}
        title={hasData ? "AI Assistant (Local)" : "Upload data to use AI Assistant"}
      >
        Assistant
        
        {/* Local Badge */}
        <div className="ml-2 flex items-center bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs">
          <Shield size={10} className="mr-1" />
          Local
        </div>
        
        {/* Discovery Badge */}
        {showDiscoveryBadge && suggestionCount > 0 && !isExpanded && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-800 to-sky-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium"
          >
            {suggestionCount}
          </motion.div>
        )}
        
        {/* Analyzing Indicator */}
        {isAnalyzing && (
          <div className="ml-2 flex items-center">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          </div>
        )}
      </button>

      {/* Onboarding Tooltip */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg shadow-xl z-50 w-80"
          >
            <div className="flex items-start">
              <Lightbulb className="w-5 h-5 text-yellow-300 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium mb-1">Welcome to AI Assistant!</h4>
                <p className="text-sm text-white/90 mb-3">
                  I analyze your data locally in your browser and suggest charts, insights, and SQL queries. Your data never leaves your device.
                </p>
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded AI Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 bg-gray-950 border border-gray-800 rounded-lg shadow-2xl z-50 mt-2 max-w-5xl min-w-[800px]"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Brain className="w-5 h-5 text-purple-400 mr-2" />
                  <h3 className="text-lg font-heading font-medium text-white">AI Assistant</h3>
                  <div className="ml-3 flex items-center bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs border border-green-500/20">
                    <Shield size={12} className="mr-1" />
                    100% Local
                  </div>
                </div>
                
                <button
                  onClick={toggleExpanded}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* File Selection Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center">
                    <FileText size={14} className="mr-2" />
                    Analyzing Files ({activeFileIds.length} selected)
                  </h4>
                  
                  {files.length > 1 && (
                    <button
                      onClick={() => setActiveMode('multi-file')}
                      className={`text-xs px-3 py-1 rounded transition-colors ${
                        activeMode === 'multi-file' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      <Plus size={12} className="mr-1 inline" />
                      Add Files
                    </button>
                  )}
                </div>

                {/* Selected Files */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {activeFileIds.map(fileId => {
                    const file = files.find(f => f.id === fileId);
                    if (!file) return null;
                    
                    return (
                      <div key={fileId} className="flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
                        <FileText size={12} className="text-primary mr-2" />
                        <span className="text-sm text-gray-300">{file.fileName}</span>
                        {activeFileIds.length > 1 && (
                          <button
                            onClick={() => removeFileFromAnalysis(fileId)}
                            className="ml-2 text-gray-500 hover:text-gray-300"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Multi-file Selection */}
                {activeMode === 'multi-file' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-3"
                  >
                    <h5 className="text-sm font-medium text-gray-300 mb-2">Available Files</h5>
                    <div className="space-y-1">
                      {files.filter(f => !activeFileIds.includes(f.id)).map(file => (
                        <button
                          key={file.id}
                          onClick={() => addFileToAnalysis(file.id)}
                          className="w-full flex items-center text-left p-2 rounded hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700"
                        >
                          <FileText size={12} className="text-gray-500 mr-2" />
                          <span className="text-sm text-gray-300">{file.fileName}</span>
                          <span className="text-xs text-gray-600 ml-auto">
                            {file.rowCount} rows
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveMode('suggestions')}
                    className={`px-4 py-2 text-sm rounded-md transition-colors ${
                      activeMode === 'suggestions' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Sparkles size={14} className="inline mr-2" />
                    Suggestions ({suggestionCount})
                  </button>
                  <button
                    onClick={() => setActiveMode('chat')}
                    className={`px-4 py-2 text-sm rounded-md transition-colors ${
                      activeMode === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <MessageCircle size={14} className="inline mr-2" />
                    Chat
                  </button>
                </div>

                {/* Analysis Status */}
                <div className="flex items-center text-sm">
                  {isAnalyzing ? (
                    <div className="flex items-center text-blue-400">
                      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                      Analyzing... {Math.round(analysisProgress * 100)}%
                    </div>
                  ) : hasSuggestions ? (
                    <div className="flex items-center text-green-400">
                      <Check size={14} className="mr-2" />
                      Analysis complete
                    </div>
                  ) : activeFileIds.length > 0 ? (
                    <button
                      onClick={analyzeActiveFiles}
                      className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Play size={14} className="mr-2" />
                      Start Analysis
                    </button>
                  ) : (
                    <span className="text-gray-600">Select files to analyze</span>
                  )}
                </div>
              </div>

              {/* Content Based on Mode */}
              {activeMode === 'suggestions' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {isAnalyzing && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3" />
                        <span className="text-blue-400 font-medium">Analyzing Your Data</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${analysisProgress * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-blue-300">
                        Running heuristic analysis on {activeFileIds.length} file{activeFileIds.length !== 1 ? 's' : ''}...
                      </p>
                    </div>
                  )}

                  {!isAnalyzing && currentAnalysis && (
                    <>
                      {/* Chart Suggestions */}
                      {currentAnalysis.chartSuggestions.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-200 mb-3 flex items-center">
                            <BarChart3 size={18} className="mr-2 text-purple-400" />
                            Recommended Charts ({currentAnalysis.chartSuggestions.length})
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentAnalysis.chartSuggestions.slice(0, 4).map((suggestion) => (
                              <motion.div
                                key={suggestion.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-800 hover:border-gray-700 transition-all hover:scale-[1.02] group"
                                onClick={() => handleChartSuggestionClick(suggestion)}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center">
                                    {suggestion.type === 'bar' && <BarChart3 size={16} className="text-blue-400 mr-2" />}
                                    {suggestion.type === 'line' && <TrendingUp size={16} className="text-green-400 mr-2" />}
                                    {suggestion.type === 'pie' && <PieChart size={16} className="text-purple-400 mr-2" />}
                                    {suggestion.type === 'scatter' && <TrendingDown size={16} className="text-orange-400 mr-2" />}
                                    <h5 className="font-medium text-gray-200">{suggestion.title}</h5>
                                  </div>
                                  <div className="flex items-center bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs border border-green-500/20">
                                    <Zap size={10} className="mr-1" />
                                    {Math.round(suggestion.confidence * 100)}%
                                  </div>
                                </div>
                                
                                <p className="text-gray-400 text-sm mb-2">{suggestion.description}</p>
                                <p className="text-gray-600 text-xs italic mb-3">{suggestion.reasoning}</p>
                                
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-500">
                                    X: {suggestion.xAxis} • Y: {suggestion.yAxis}
                                  </div>
                                  <button className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
                                    Create Chart
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Data Insights */}
                      {currentAnalysis.insights.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-200 mb-3 flex items-center">
                            <TrendingUp size={18} className="mr-2 text-green-400" />
                            Data Insights ({currentAnalysis.insights.length})
                          </h4>
                          
                          <div className="space-y-3">
                            {currentAnalysis.insights.slice(0, 5).map((insight, index) => (
                              <motion.div
                                key={insight.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`bg-gray-900 border rounded-lg p-4 border-l-4 ${
                                  insight.severity === 'warning' ? 'border-l-yellow-500 border-gray-800' :
                                  insight.severity === 'critical' ? 'border-l-red-500 border-gray-800' :
                                  'border-l-blue-500 border-gray-800'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center mb-2">
                                      {insight.severity === 'warning' && <AlertTriangle size={16} className="text-yellow-500 mr-2" />}
                                      {insight.severity === 'critical' && <AlertTriangle size={16} className="text-red-500 mr-2" />}
                                      {insight.severity === 'info' && <Database size={16} className="text-blue-500 mr-2" />}
                                      <h5 className="font-medium text-gray-200 text-sm">{insight.title}</h5>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-2">{insight.description}</p>
                                    {insight.suggestedAction && (
                                      <p className="text-blue-400 text-sm flex items-center">
                                        <Lightbulb size={12} className="mr-1" />
                                        {insight.suggestedAction}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-600 ml-4">
                                    {Math.round(insight.confidence * 100)}%
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SQL Suggestions */}
                      {currentAnalysis.sqlSuggestions.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-200 mb-3 flex items-center">
                            <Database size={18} className="mr-2 text-blue-400" />
                            SQL Suggestions ({currentAnalysis.sqlSuggestions.length})
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-3">
                            {currentAnalysis.sqlSuggestions.slice(0, 3).map((suggestion) => (
                              <motion.div
                                key={suggestion.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-800 hover:border-gray-700 transition-all group"
                                onClick={() => handleSqlSuggestionClick(suggestion)}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-gray-200 text-sm">{suggestion.title}</h5>
                                  <button className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
                                    Run Query
                                  </button>
                                </div>
                                <p className="text-gray-500 text-xs mb-3">{suggestion.description}</p>
                                <div className="bg-black/40 border border-gray-800 rounded p-2 font-mono text-xs text-gray-300 overflow-x-auto">
                                  {suggestion.query}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!isAnalyzing && !hasSuggestions && activeFileIds.length > 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Brain className="w-8 h-8 text-gray-600" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">Ready to Analyze</h4>
                      <p className="text-gray-500 mb-4">Click "Start Analysis" to get AI-powered insights about your data</p>
                      <button
                        onClick={analyzeActiveFiles}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                      >
                        <Play size={16} className="mr-2 inline" />
                        Start Analysis
                      </button>
                    </div>
                  )}

                  {activeFileIds.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-600" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">No Files Selected</h4>
                      <p className="text-gray-500">Upload or select a file to get started with AI analysis</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Chat Mode */}
              {activeMode === 'chat' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <EnhancedChatInterface />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAssistant;