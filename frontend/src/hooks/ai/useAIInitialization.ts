// hooks/useAIInitialization.ts
import { useEffect } from 'react';
import { useAIAssistantStore } from '@/store/aiAssistantStore';
import { useAppStore } from '@/store/appStore';

/**
 * Hook to initialize AI Assistant and handle reactive data updates
 */
export const useAIInitialization = () => {
  const { 
    loadFromStorage, 
    setActiveFiles, 
    analyzeActiveFiles,
    updateDiscoveryStep 
  } = useAIAssistantStore();
  
  const { files, activeFileId } = useAppStore();

  // Initialize AI Assistant on app start
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Update active files when app state changes
  useEffect(() => {
    if (activeFileId && files.length > 0) {
      const currentFile = files.find(f => f.id === activeFileId);
      if (currentFile) {
        setActiveFiles([activeFileId]);
        
        // Update discovery step when data is loaded
        setTimeout(() => {
          updateDiscoveryStep('analysis-ready');
        }, 500);
      }
    }
  }, [activeFileId, files, setActiveFiles, updateDiscoveryStep]);

  // Auto-analyze when new files are added (debounced)
  useEffect(() => {
    if (files.length > 0) {
      const timer = setTimeout(() => {
        const aiState = useAIAssistantStore.getState();
        if (aiState.activeFileIds.length > 0 && !aiState.isAnalyzing) {
          // Check if we have fresh analysis for current files
          const hasValidAnalysis = aiState.activeFileIds.every(fileId => {
            const analysis = aiState.analysisResults.get(fileId);
            if (!analysis) return false;
            
            // Check if analysis is recent (less than 10 minutes old)
            const isRecent = (Date.now() - analysis.analysisTimestamp) < 10 * 60 * 1000;
            return isRecent;
          });
          
          if (!hasValidAnalysis) {
            analyzeActiveFiles();
          }
        }
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(timer);
    }
  }, [files, analyzeActiveFiles]);
};
