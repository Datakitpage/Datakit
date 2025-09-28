import React, { useState } from 'react';
import { Play, Copy, Check, Code, PenSquare, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAIOperations } from '@/hooks/ai/useAIOperations';
// Removed useAIVisualization import - will receive functions as props

import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import AuthModal from '@/components/auth/AuthModal';

interface SQLQueryCardWithVizProps {
  query: string;
  index: number;
  responseId: string;
  isPrimary?: boolean;
  onVisualizationOpen?: (queryId: string) => void;
  generateVisualization: (request: any) => Promise<any>;
  isGenerating?: boolean;
  queryRunning?: boolean;
}

const SQLQueryCardWithViz: React.FC<SQLQueryCardWithVizProps> = ({
  query,
  index,
  responseId,
  isPrimary = false,
  onVisualizationOpen,
  generateVisualization,
  isGenerating = false,
  queryRunning,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { setPendingQuery, changeViewMode } = useAppStore();
  const { isAuthenticated } = useAuth();
  const { handleRunSQL } = useAIOperations();

  // Generate unique responseId if not provided
  const uniqueResponseId = responseId || `response-${Date.now()}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRun = () => {
    handleRunSQL(query);
  };

  const handleEdit = () => {
    // Set the pending query first
    setPendingQuery(query);
    
    // Small delay to ensure pending query is set before view change
    setTimeout(() => {
      console.log('[SQLQueryCard] Switching to query mode using store function');
      changeViewMode('query');
    }, 50);
  };

  const handleVisualize = async () => {
    // Check authentication first
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Generate visualization
    const result = await generateVisualization({
      sql: query,
      responseId: uniqueResponseId,
      queryIndex: index,
    });

    if (result.success && onVisualizationOpen) {
      onVisualizationOpen(`${uniqueResponseId}-${index}`);
    }
  };

  // Get syntax highlighted HTML
  const getHighlightedSQL = () => {
    try {
      return Prism.highlight(query, Prism.languages.sql, 'sql');
    } catch {
      return query;
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className={`group relative bg-accent/5 border rounded-lg transition-all hover:bg-accent/10 w-full ${
          isPrimary ? 'border-primary/30' : 'border-border'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Query {index + 1}
              {isPrimary && (
                <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                  Primary
                </span>
              )}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip content="Visualize" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-purple-400 hover:text-purple-300"
                onClick={handleVisualize}
                disabled={isGenerating}
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>

            <Tooltip
              content={copied ? 'Copied!' : 'Copy SQL'}
              placement="bottom"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </Tooltip>

            <Tooltip content="Edit in Query Tab" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleEdit}
              >
                <PenSquare className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>

            <Tooltip content="Run" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                disabled={queryRunning}
                className="h-7 w-7 text-primary hover:text-primary/80"
                onClick={handleRun}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* SQL Content */}
        <div className="p-4 overflow-hidden">
          <pre className="text-sm overflow-x-auto whitespace-pre">
            <code
              className="language-sql text-foreground"
              dangerouslySetInnerHTML={{ __html: getHighlightedSQL() }}
            />
          </pre>
        </div>

        {/* Generating indicator */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformOrigin: 'top' }}
            className="px-4 py-2 border-t border-border bg-accent/10"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-xs text-purple-300">
                Generating visualization...
              </span>
            </div>
          </motion.div>
        )}
        {queryRunning && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformOrigin: 'top' }}
            className="px-4 py-2 border-t border-border bg-primary/10"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
              <span className="text-xs text-primary/80">
                Query is running...
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signup"
        onLoginSuccess={() => {
          setShowAuthModal(false);
          // Retry visualization after login
          handleVisualize();
        }}
      />
    </>
  );
};

export default SQLQueryCardWithViz;
