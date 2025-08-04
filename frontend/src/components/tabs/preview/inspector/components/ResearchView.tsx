import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Type, 
  Code, 
  BarChart, 
  MessageSquare,
  Trash2,
  GripVertical,
  Play,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';
import { selectActiveFile } from '@/store/selectors/appSelectors';
import { useCanvasState } from '../hooks/useCanvasState';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { useSmartAnalysis } from '../hooks/useSmartAnalysis';
import SmartSuggestions from './SmartSuggestions';
import { SmartSuggestion } from '../utils/smartSuggestions';

// Block types
export type BlockType = 'text' | 'query' | 'viz' | 'ai-response' | 'ai-query';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  metadata?: {
    // For query blocks
    sql?: string;
    results?: any[];
    error?: string;
    isExecuting?: boolean;
    
    // For viz blocks
    chartType?: 'bar' | 'line' | 'scatter' | 'pie';
    chartConfig?: any;
    sourceBlockId?: string;
    
    // For AI blocks
    userPrompt?: string;
    aiModel?: string;
    context?: string[];
    isLoading?: boolean;
    
    // Common
    createdAt?: Date;
    updatedAt?: Date;
  };
  position: number;
}

interface ResearchViewProps {
  className?: string;
}

const ResearchView: React.FC<ResearchViewProps> = ({ className }) => {
  const activeFile = useAppStore(selectActiveFile);
  const { executeQuery: duckDBExecuteQuery } = useDuckDBStore();
  
  // Canvas state management
  const {
    blocks,
    activeBlockId,
    createBlock,
    updateBlock,
    deleteBlock,
    setActiveBlock,
    addToConversation,
    addRecentQuery,
  } = useCanvasState(activeFile?.id);
  
  // AI assistant
  const {
    isLoading: isAILoading,
    getAIResponse,
    buildContext,
  } = useAIAssistant();

  // Smart analysis
  const {
    suggestions,
    isAnalyzing: isAnalyzingPatterns,
    error: analysisError,
    columnAnalysis,
    reanalyze,
  } = useSmartAnalysis();
  
  const [isAIMenuOpen, setIsAIMenuOpen] = useState(false);
  const [aiMenuPosition, setAIMenuPosition] = useState({ top: 0, left: 0 });
  
  // Execute query block
  const executeQuery = useCallback(async (blockId: string, sql: string) => {
    if (!activeFile?.tableName) return;
    
    updateBlock(blockId, {
      metadata: { isExecuting: true, error: undefined }
    });
    
    try {
      const result = await duckDBExecuteQuery(sql);
      
      // Convert DuckDB result to array format
      const data = result ? result.toArray().map(row => Object.fromEntries(row)) : [];
      
      updateBlock(blockId, {
        metadata: {
          isExecuting: false,
          results: data,
          sql,
        }
      });
    } catch (error) {
      updateBlock(blockId, {
        metadata: {
          isExecuting: false,
          error: error instanceof Error ? error.message : 'Query failed',
          sql,
        }
      });
    }
  }, [activeFile, duckDBExecuteQuery, updateBlock]);
  
  // Handle AI mention
  const handleAIMention = useCallback(async (prompt: string, blockId: string) => {
    // Create AI response block
    const aiBlockId = createBlock('ai-response', blockId);
    
    updateBlock(aiBlockId, {
      content: 'Thinking...',
      metadata: {
        userPrompt: prompt,
        isLoading: true,
      }
    });
    
    // Add to conversation history
    addToConversation('user', prompt);
    
    try {
      const context = await buildContext();
      const response = await getAIResponse(prompt, context);
      
      let content = response.content;
      
      // If AI suggested a SQL query, format it nicely
      if (response.sqlQuery) {
        content += `\n\n**Try this query:**\n\`/query ${response.sqlQuery}\``;
      }
      
      // Add suggestions if any
      if (response.suggestions && response.suggestions.length > 0) {
        content += `\n\n**Suggestions:**\n${response.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
      }
      
      updateBlock(aiBlockId, {
        content,
        metadata: {
          isLoading: false,
          userPrompt: prompt,
          sqlQuery: response.sqlQuery,
          suggestions: response.suggestions,
        }
      });
      
      // Add to conversation history
      addToConversation('assistant', content);
      
    } catch (error) {
      updateBlock(aiBlockId, {
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          isLoading: false,
          userPrompt: prompt,
        }
      });
    }
  }, [createBlock, updateBlock, addToConversation, buildContext, getAIResponse]);
  
  // Handle text input changes
  const handleTextChange = useCallback((blockId: string, content: string) => {
    updateBlock(blockId, { content });
    
    // Check for @AI mention with Enter
    const aiMatch = content.match(/@AI\s+(.+)$/m);
    if (aiMatch) {
      const prompt = aiMatch[1].trim();
      if (prompt) {
        handleAIMention(prompt, blockId);
        // Clear the @AI mention from the text block
        updateBlock(blockId, { 
          content: content.replace(/@AI\s+.+$/m, '').trim() 
        });
      }
    }
    
    // Check for /query command
    const queryMatch = content.match(/^\/query\s+(.+)$/m);
    if (queryMatch) {
      const sql = queryMatch[1].trim();
      if (sql) {
        // Convert to query block
        updateBlock(blockId, { 
          type: 'query',
          content: sql,
          metadata: { sql }
        });
        executeQuery(blockId, sql);
        // Add query to recent queries
        addRecentQuery(sql);
      }
    }
  }, [updateBlock, executeQuery, handleAIMention, addRecentQuery]);

  // Handle running smart suggestions
  const handleRunSuggestion = useCallback(async (suggestion: SmartSuggestion) => {
    // Create a query block for the suggestion
    const queryBlockId = createBlock('query');
    
    updateBlock(queryBlockId, {
      type: 'query',
      content: suggestion.query,
      metadata: {
        sql: suggestion.query,
        suggestionId: suggestion.id,
        suggestionTitle: suggestion.title,
      }
    });
    
    // Execute the query
    executeQuery(queryBlockId, suggestion.query);
    addRecentQuery(suggestion.query);
  }, [createBlock, updateBlock, executeQuery, addRecentQuery]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex-1 overflow-y-auto", className)}
    >
      {/* Smart Suggestions - Show if we have suggestions and no content yet */}
      {blocks.length <= 1 && (
        <SmartSuggestions
          suggestions={suggestions}
          isLoading={isAnalyzingPatterns}
          onRunSuggestion={handleRunSuggestion}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-4 p-6">
        {blocks.map((block, index) => (
          <BlockRenderer
            key={block.id}
            block={block}
            isActive={activeBlockId === block.id}
            onActivate={() => setActiveBlock(block.id)}
            onChange={(content) => handleTextChange(block.id, content)}
            onDelete={() => deleteBlock(block.id)}
            onExecuteQuery={(sql) => executeQuery(block.id, sql)}
            onCreateBlock={(type) => createBlock(type, block.id)}
          />
        ))}
        
        {/* Add new block button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => createBlock('text')}
          className="w-full p-4 border-2 border-dashed border-white/20 rounded-lg hover:border-white/40 hover:bg-white/5 transition-colors group"
        >
          <div className="flex items-center justify-center gap-2 text-white/60 group-hover:text-white/80">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add block</span>
          </div>
        </motion.button>
      </div>
      
      {/* AI suggestion menu */}
      <AnimatePresence>
        {isAIMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: aiMenuPosition.top, left: aiMenuPosition.left }}
            className="absolute z-50 bg-card border border-white/20 rounded-lg shadow-xl p-2 min-w-[200px]"
          >
            <div className="text-sm text-white/80 p-2">
              Press Enter to ask AI
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Block renderer component
interface BlockRendererProps {
  block: Block;
  isActive: boolean;
  onActivate: () => void;
  onChange: (content: string) => void;
  onDelete: () => void;
  onExecuteQuery: (sql: string) => void;
  onCreateBlock: (type: BlockType) => void;
}

const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isActive,
  onActivate,
  onChange,
  onDelete,
  onExecuteQuery,
  onCreateBlock,
}) => {
  const blockRef = useRef<HTMLDivElement>(null);
  
  const getBlockIcon = () => {
    switch (block.type) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'query': return <Code className="h-4 w-4" />;
      case 'viz': return <BarChart className="h-4 w-4" />;
      case 'ai-response': return <Sparkles className="h-4 w-4" />;
      case 'ai-query': return <MessageSquare className="h-4 w-4" />;
    }
  };
  
  return (
    <motion.div
      ref={blockRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "group relative bg-card/20 rounded-lg border transition-all",
        isActive ? "border-primary/50 shadow-lg" : "border-white/10 hover:border-white/20"
      )}
      onClick={onActivate}
    >
      {/* Block header */}
      <div className="flex items-center gap-2 p-2 border-b border-white/10">
        <GripVertical className="h-4 w-4 text-white/30 cursor-move" />
        <div className="flex items-center gap-2 flex-1">
          {getBlockIcon()}
          <span className="text-xs text-white/60 capitalize">{block.type}</span>
        </div>
        
        {/* Block actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {block.type === 'query' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExecuteQuery(block.metadata?.sql || block.content);
              }}
              className="p-1 hover:bg-white/10 rounded"
            >
              <Play className="h-3 w-3 text-primary" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-white/10 rounded"
          >
            <Trash2 className="h-3 w-3 text-red-400" />
          </button>
        </div>
      </div>
      
      {/* Block content */}
      <div className="p-4">
        {block.type === 'text' && (
          <textarea
            value={block.content}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Start typing... Use @AI to ask questions or /query for SQL"
            className="w-full bg-transparent text-white placeholder-white/40 outline-none resize-none"
            style={{ minHeight: '80px' }}
          />
        )}
        
        {block.type === 'query' && (
          <div className="space-y-3">
            <pre className="text-sm text-white/90 font-mono bg-black/20 p-3 rounded">
              {block.content}
            </pre>
            
            {block.metadata?.isExecuting && (
              <div className="text-sm text-primary animate-pulse">
                Executing query...
              </div>
            )}
            
            {block.metadata?.error && (
              <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded">
                {block.metadata.error}
              </div>
            )}
            
            {block.metadata?.results && (
              <div className="bg-black/20 rounded p-3 max-h-[300px] overflow-auto">
                <div className="text-xs text-white/60 mb-2">
                  {block.metadata.results.length} rows
                </div>
                <pre className="text-xs text-white/80">
                  {JSON.stringify(block.metadata.results.slice(0, 5), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
        
        {block.type === 'ai-response' && (
          <div className="space-y-3">
            {block.metadata?.userPrompt && (
              <div className="text-sm text-white/60 italic">
                "{block.metadata.userPrompt}"
              </div>
            )}
            <div className="text-white/90 whitespace-pre-wrap">
              {block.metadata?.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-white/60">{block.content}</span>
                </div>
              ) : (
                block.content
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ResearchView;