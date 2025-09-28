import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';

import { useAIStore } from '@/store/aiStore';
import { useDuckDBStore } from '@/store/duckDBStore';

import { useAIOperations } from '@/hooks/ai/useAIOperations';
import { useTokenUsage } from '@/hooks/ai/useTokenUsage';

import SQLQueryCard from './SQLQueryCard';

interface ResponsePanelProps {
  onVisualizationOpen?: (queryId: string) => void;
  generateVisualization: (request: any) => Promise<any>;
  isGeneratingViz?: boolean;
  hasActiveVisualization?: boolean;
  onShowVisualization?: () => void;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({
  onVisualizationOpen,
  generateVisualization,
  isGeneratingViz,
  hasActiveVisualization,
  onShowVisualization,
}) => {
  const {
    isProcessing,
    currentResponse,
    streamingResponse,
    showCostEstimates,
    conversationId,
    fileResponseStates,
  } = useAIStore();
  const { extractSQLQueries } = useAIOperations();
  const { getCostBreakdown, hasUsage } = useTokenUsage();
  const { isLoading } = useDuckDBStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Get file-specific response state if available
  let effectiveCurrentResponse = currentResponse;
  let effectiveStreamingResponse = streamingResponse;
  
  if (conversationId?.startsWith('file_')) {
    const fileId = conversationId.replace('file_', '');
    const fileResponseState = fileResponseStates?.get?.(fileId);
    if (fileResponseState) {
      effectiveCurrentResponse = fileResponseState.currentResponse;
      effectiveStreamingResponse = fileResponseState.streamingResponse;
    }
  }

  // Use streaming response if available, otherwise use current response
  const displayResponse = effectiveStreamingResponse || effectiveCurrentResponse;

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current && displayResponse) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayResponse]);

  // Extract SQL queries from the response
  const sqlQueries = displayResponse ? extractSQLQueries(displayResponse) : [];

  // Split response into text and SQL blocks using the same logic as extractSQLQueries
  const renderResponse = () => {
    if (!displayResponse) return null;

    const text = displayResponse;
    const parts: Array<{ type: 'text' | 'sql'; content: string }> = [];

    // Use extractSQLQueries to get all SQL queries
    const queries = sqlQueries;

    if (queries.length === 0) {
      // No SQL found, return as text
      return [{ type: 'text', content: text }];
    }

    // Replace each SQL query with a unique placeholder
    let processedText = text;
    const placeholders: string[] = [];

    queries.forEach((query, index) => {
      const placeholder = `__SQL_PLACEHOLDER_${index}__`;
      placeholders.push(placeholder);

      // Normalize whitespace for matching
      const normalizedQuery = query.replace(/\s+/g, ' ').trim();

      // Try to find and replace the query in various formats
      // 1. In code blocks
      const codeBlockPattern = new RegExp(
        `\`\`\`(?:sql)?\\s*\\n([\\s\\S]*?)\\n\\s*\`\`\``,
        'gi'
      );
      processedText = processedText.replace(
        codeBlockPattern,
        (match, content) => {
          const normalizedContent = content.replace(/\s+/g, ' ').trim();
          if (normalizedContent === normalizedQuery) {
            return placeholder;
          }
          return match;
        }
      );

      // 2. As inline SQL - create regex that matches the SQL with flexible whitespace
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexibleQueryPattern = escapedQuery.replace(/\s+/g, '\\s+');
      const queryRegex = new RegExp(flexibleQueryPattern, 'gi');

      if (queryRegex.test(processedText)) {
        processedText = processedText.replace(queryRegex, placeholder);
      }
    });

    // Split by placeholders and build parts array
    const segments = processedText.split(/(__SQL_PLACEHOLDER_\d+__)/);

    segments.forEach((segment) => {
      if (segment.startsWith('__SQL_PLACEHOLDER_')) {
        // Extract the index from placeholder
        const match = segment.match(/__SQL_PLACEHOLDER_(\d+)__/);
        if (match) {
          const index = parseInt(match[1]);
          const query = queries[index];
          if (query) {
            parts.push({ type: 'sql', content: query });
          }
        }
      } else if (segment.trim()) {
        parts.push({ type: 'text', content: segment.trim() });
      }
    });

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  };

  const responseParts = renderResponse();
  const costBreakdown = getCostBreakdown();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground">Response</h3>
          {/* {hasActiveVisualization && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onShowVisualization}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded-md transition-all text-xs group"
            >
              <BarChart3 className="h-3 w-3 text-primary" />
              <span className="text-white/70 group-hover:text-white">Show Chart</span>
              <ChevronRight className="h-3 w-3 text-white/50 group-hover:text-white/70" />
            </motion.button>
          )} */}
        </div>
        {showCostEstimates && hasUsage && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>Tokens:</span>
              <span className="text-foreground font-mono">
                {costBreakdown.total.tokens.toLocaleString()}
              </span>
              {costBreakdown.response.tokens > 0 &&
                costBreakdown.visualization.tokens > 0 && (
                  <span className="text-muted-foreground">
                    ({costBreakdown.response.tokens.toLocaleString()} response +{' '}
                    {costBreakdown.visualization.tokens.toLocaleString()} viz)
                  </span>
                )}
            </div>
            {costBreakdown.total.cost > 0 && (
              <div className="flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span className="text-foreground font-mono">
                  ${(costBreakdown.total.cost * 0.01).toFixed(4)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 w-full max-w-full min-w-0"
      >
        {!displayResponse && !isProcessing ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="mb-3 text-muted-foreground"></div>
              <p className="text-muted-foreground text-md">
                Ask a question to see responses here
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {isProcessing && !displayResponse ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="h-4 bg-accent/5 rounded animate-pulse" />
                <div className="h-4 bg-accent/5 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-accent/5 rounded animate-pulse w-1/2" />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 w-full max-w-full min-w-0"
              >
                {responseParts?.map((part, index) => {
                  if (part.type === 'text') {
                    return (
                      <div
                        key={index}
                        className="prose prose-invert w-full max-w-full min-w-0"
                      >
                        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words w-full max-w-full">
                          {part.content}
                        </p>
                      </div>
                    );
                  } else {
                    // Find the query index
                    const queryIndex = sqlQueries.findIndex(
                      (q) => q.trim() === part.content.trim()
                    );
                    return (
                      <SQLQueryCard
                        key={index}
                        query={part.content}
                        index={queryIndex >= 0 ? queryIndex : 0}
                        responseId={`response-${Date.now()}-${index}`}
                        isPrimary={queryIndex === 0}
                        onVisualizationOpen={onVisualizationOpen}
                        generateVisualization={generateVisualization}
                        isGenerating={isGeneratingViz}
                        queryRunning={isLoading}
                      />
                    );
                  }
                })}

                {/* Show thinking indicator if still processing */}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span>Thinking...</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ResponsePanel;
