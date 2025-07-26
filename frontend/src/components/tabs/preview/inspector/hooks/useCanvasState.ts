import { useState, useCallback, useEffect } from 'react';
import { Block, BlockType } from '../components/ResearchView';

interface CanvasState {
  blocks: Block[];
  activeBlockId: string | null;
  aiContext: {
    recentQueries: string[];
    conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
    }>;
  };
}

const STORAGE_KEY = 'datakit-research-canvas';

export const useCanvasState = (fileId?: string) => {
  // Initialize state with persisted data or default
  const [state, setState] = useState<CanvasState>(() => {
    if (fileId) {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${fileId}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // Invalid stored data
        }
      }
    }
    
    return {
      blocks: [{
        id: 'welcome',
        type: 'text' as BlockType,
        content: '# Research Canvas\n\nStart exploring your data by typing below. Use **@AI** to ask questions or **/query** to run SQL.',
        position: 0,
      }],
      activeBlockId: null,
      aiContext: {
        recentQueries: [],
        conversationHistory: [],
      }
    };
  });
  
  // Persist state changes
  useEffect(() => {
    if (fileId) {
      localStorage.setItem(`${STORAGE_KEY}-${fileId}`, JSON.stringify(state));
    }
  }, [state, fileId]);
  
  // Block management functions
  const createBlock = useCallback((type: BlockType, afterBlockId?: string): string => {
    const newBlock: Block = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content: '',
      position: state.blocks.length,
      metadata: {
        createdAt: new Date(),
      }
    };
    
    setState(prev => {
      let blocks = [...prev.blocks];
      
      if (afterBlockId) {
        const afterIndex = blocks.findIndex(b => b.id === afterBlockId);
        if (afterIndex !== -1) {
          newBlock.position = afterIndex + 1;
          // Update positions of subsequent blocks
          blocks = blocks.map(b => ({
            ...b,
            position: b.position > afterIndex ? b.position + 1 : b.position
          }));
        }
      }
      
      blocks.push(newBlock);
      blocks.sort((a, b) => a.position - b.position);
      
      return {
        ...prev,
        blocks,
        activeBlockId: newBlock.id,
      };
    });
    
    return newBlock.id;
  }, [state.blocks]);
  
  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    setState(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === blockId 
          ? { 
              ...block, 
              ...updates, 
              metadata: { 
                ...block.metadata, 
                ...updates.metadata,
                updatedAt: new Date(),
              } 
            }
          : block
      ),
    }));
  }, []);
  
  const deleteBlock = useCallback((blockId: string) => {
    setState(prev => {
      const filtered = prev.blocks.filter(b => b.id !== blockId);
      // Reorder positions
      const reordered = filtered.map((b, idx) => ({ ...b, position: idx }));
      
      return {
        ...prev,
        blocks: reordered,
        activeBlockId: prev.activeBlockId === blockId ? null : prev.activeBlockId,
      };
    });
  }, []);
  
  const reorderBlocks = useCallback((blockId: string, newPosition: number) => {
    setState(prev => {
      const blocks = [...prev.blocks];
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      if (blockIndex === -1) return prev;
      
      const [movedBlock] = blocks.splice(blockIndex, 1);
      blocks.splice(newPosition, 0, movedBlock);
      
      // Update all positions
      const reordered = blocks.map((b, idx) => ({ ...b, position: idx }));
      
      return {
        ...prev,
        blocks: reordered,
      };
    });
  }, []);
  
  const setActiveBlock = useCallback((blockId: string | null) => {
    setState(prev => ({
      ...prev,
      activeBlockId: blockId,
    }));
  }, []);
  
  // AI context management
  const addToConversation = useCallback((role: 'user' | 'assistant', content: string) => {
    setState(prev => ({
      ...prev,
      aiContext: {
        ...prev.aiContext,
        conversationHistory: [
          ...prev.aiContext.conversationHistory,
          { role, content, timestamp: new Date() }
        ].slice(-20), // Keep last 20 messages
      }
    }));
  }, []);
  
  const addRecentQuery = useCallback((query: string) => {
    setState(prev => ({
      ...prev,
      aiContext: {
        ...prev.aiContext,
        recentQueries: [
          query,
          ...prev.aiContext.recentQueries.filter(q => q !== query)
        ].slice(0, 10), // Keep last 10 unique queries
      }
    }));
  }, []);
  
  // Clear canvas
  const clearCanvas = useCallback(() => {
    setState({
      blocks: [{
        id: 'welcome-new',
        type: 'text' as BlockType,
        content: '# New Research Session\n\nCanvas cleared. Start fresh!',
        position: 0,
      }],
      activeBlockId: null,
      aiContext: {
        recentQueries: [],
        conversationHistory: [],
      }
    });
  }, []);
  
  return {
    // State
    blocks: state.blocks,
    activeBlockId: state.activeBlockId,
    aiContext: state.aiContext,
    
    // Actions
    createBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    setActiveBlock,
    addToConversation,
    addRecentQuery,
    clearCanvas,
    
    // Computed
    blockCount: state.blocks.length,
    hasUnsavedChanges: state.blocks.some(b => 
      b.metadata?.updatedAt && 
      new Date().getTime() - new Date(b.metadata.updatedAt).getTime() < 5000
    ),
  };
};