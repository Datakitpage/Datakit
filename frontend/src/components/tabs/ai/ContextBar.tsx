import React, { useState, useEffect } from 'react';
import { Database, Zap, Settings, Plus, X } from 'lucide-react';

import { useAIStore } from '@/store/aiStore';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { selectActiveFile, selectTableName } from '@/store/selectors/appSelectors';

import { useAuth } from '@/hooks/auth/useAuth';

import MultiTableSelector from './MultiTableSelector';

interface ContextBarProps {
  onOpenApiKeyModal?: () => void;
}

/**
 * Multi-table context display
 */
const MultiTableContextDisplay: React.FC<{
  onOpenSelector: () => void;
}> = ({ onOpenSelector }) => {
  const { multiTableContexts, removeTableContext } = useAIStore();

  const selectedTables = multiTableContexts.filter((ctx) => ctx.isSelected);

  return (
    <div className="flex items-center gap-2">
      {selectedTables.length > 0 ? (
        <>
          <span className="text-xs text-muted-foreground">Context:</span>
          <div className="flex items-center gap-1">
            {selectedTables.slice(0, 3).map((ctx) => (
              <div
                key={ctx.tableName}
                className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 border border-primary/30 rounded text-xs text-primary"
              >
                <Database className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{ctx.tableName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTableContext(ctx.tableName);
                  }}
                  className="ml-1 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {selectedTables.length > 3 && (
              <span className="px-2 py-0.5 bg-accent/10 rounded text-xs text-muted-foreground">
                +{selectedTables.length - 3} more
              </span>
            )}
          </div>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">No tables in context</span>
      )}

      <button
        onClick={onOpenSelector}
        className="flex items-center gap-1 px-2 py-0.5 bg-accent/5 border border-border rounded text-xs text-muted-foreground hover:bg-accent/10 hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add Tables
      </button>
    </div>
  );
};

const ContextBar: React.FC<ContextBarProps> = ({ onOpenApiKeyModal }) => {
  const { autoExecuteSQL, updateSettings, addTableContext, clearTableContexts } = useAIStore();
  const activeFile = useAppStore(selectActiveFile);
  const activeTableName = useAppStore(selectTableName);
  const { getTableSchema } = useDuckDBStore();
  const { isAuthenticated } = useAuth();

  const [showMultiTableSelector, setShowMultiTableSelector] = useState(false);

  // Each file has its table automatically selected
  // When switching files, clear previous and add only the current file's table
  useEffect(() => {
    const setActiveTableContext = async () => {
      if (!activeTableName || !activeFile) return;
      
      // Clear all previous table contexts
      clearTableContexts();
      
      // Add only the active file's table
      try {
        const schema = await getTableSchema(activeTableName);
        if (schema) {
          addTableContext({
            tableName: activeTableName,
            schema,
            rowCount: activeFile.rowCount,
            description: activeFile.fileName || activeTableName,
          });
        }
      } catch (error) {
        console.error(`Failed to set table ${activeTableName} in context:`, error);
      }
    };
    
    setActiveTableContext();
  }, [activeTableName, activeFile, getTableSchema, addTableContext, clearTableContexts]);

  return (
    <>
      <div className="h-10 bg-popover border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-sm">
          {/* Multi-table Context Display */}
          <MultiTableContextDisplay
            onOpenSelector={() => setShowMultiTableSelector(true)}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Model Settings Button */}
          {onOpenApiKeyModal && isAuthenticated && (
            <button
              onClick={onOpenApiKeyModal}
              className="flex items-center gap-2 px-3 py-1 rounded-md text-sm bg-accent/5 text-muted-foreground border border-border hover:bg-accent/10 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Models</span>
            </button>
          )}

          {/* Auto-execute Toggle */}
          {isAuthenticated && (
            <button
              onClick={() =>
                updateSettings({ autoExecuteSQL: !autoExecuteSQL })
              }
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors cursor-pointer ${
                autoExecuteSQL
                  ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/25'
                  : 'bg-accent/5 text-muted-foreground border border-border hover:bg-accent/10'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Auto-execute: {autoExecuteSQL ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <MultiTableSelector
        isOpen={showMultiTableSelector}
        onClose={() => setShowMultiTableSelector(false)}
      />
    </>
  );
};

export default ContextBar;
