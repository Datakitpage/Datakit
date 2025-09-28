import React, { useState, useEffect } from 'react';
import { X, Plus, Check, FileText, Table2, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/Button';

import { useDuckDBStore } from '@/store/duckDBStore';
import { useAIStore } from '@/store/aiStore';
import { useAppStore } from '@/store/appStore';

import PostgreSQLIcon from '@/assets/postgres.png';

interface MultiTableSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onTablesSelected?: (tables: string[]) => void;
}

const MultiTableSelector: React.FC<MultiTableSelectorProps> = ({
  isOpen,
  onClose,
  onTablesSelected,
}) => {
  const { getTableSchema, getAllAvailableTablesWithPostgreSQL } = useDuckDBStore();
  const { files } = useAppStore();
  const {
    multiTableContexts,
    addTableContext,
    removeTableContext,
    toggleTableContext,
    clearTableContexts,
  } = useAIStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize selected tables from store
      const selected = new Set(
        multiTableContexts
          .filter((ctx) => ctx.isSelected)
          .map((ctx) => ctx.tableName)
      );
      setSelectedTables(selected);
    }
  }, [isOpen, multiTableContexts]);

  const handleToggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);

    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }

    setSelectedTables(newSelected);
  };

  const handleApply = async () => {
    setIsApplying(true);

    try {
      // Get currently selected tables from store
      const currentlySelected = new Set(
        multiTableContexts
          .filter((ctx) => ctx.isSelected)
          .map((ctx) => ctx.tableName)
      );

      // Remove tables that are no longer selected
      for (const tableName of currentlySelected) {
        if (!selectedTables.has(tableName)) {
          removeTableContext(tableName);
        }
      }

      // Add newly selected tables
      const tablesToAdd = Array.from(selectedTables).filter(
        (tableName) => !currentlySelected.has(tableName)
      );

      for (const tableName of tablesToAdd) {
        // Check if table already exists in context (but not selected)
        const existingContext = multiTableContexts.find(
          (ctx) => ctx.tableName === tableName
        );

        if (existingContext) {
          // Just toggle it to selected
          toggleTableContext(tableName);
        } else {
          try {
            const schema = await getTableSchema(tableName);
            if (schema) {
              // Get file info for additional metadata
              const file = files.find((f) => f.tableName === tableName);

              addTableContext({
                tableName,
                schema,
                rowCount: file?.rowCount,
                description: file?.fileName || tableName,
              });
            }
          } catch (error) {
            console.error(`Failed to load schema for ${tableName}:`, error);
          }
        }
      }

      if (onTablesSelected) {
        onTablesSelected(Array.from(selectedTables));
      }
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearAll = () => {
    // Clear all tables from context store
    clearTableContexts();
    // Close the modal
    onClose();
  };

  // Get all available tables (including PostgreSQL)
  const allAvailableTables = getAllAvailableTablesWithPostgreSQL();
  
  // Filter tables based on search
  const filteredTables = allAvailableTables.filter(
    (table) => table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get icon for table based on source
  const getTableIcon = (table: typeof allAvailableTables[0]) => {
    if (table.source === 'postgresql') {
      return <Link2 className="h-4 w-4" />;
    } else if (table.source === 'motherduck') {
      return <Link2 className="h-4 w-4" />;
    }
    // For local tables, check file source
    const file = files.find((f) => f.tableName === table.name);
    if (file?.source === 'remote') {
      return <Link2 className="h-4 w-4" />;
    } else if (file?.source === 'file') {
      return <FileText className="h-4 w-4" />;
    }
    return <Table2 className="h-4 w-4" />;
  };

  // Get source label
  const getSourceLabel = (table: typeof allAvailableTables[0]) => {
    if (table.source === 'postgresql') {
      return <div className="flex flex-row gap-2" ><span>PostgreSQL</span>  <img src={PostgreSQLIcon} className="h-5 w-5" alt="PostgreSQL" /> </div>;
    } else if (table.source === 'motherduck') {
      return 'MotherDuck';
    }
    // For local tables, check file source
    const file = files.find((f) => f.tableName === table.name);
    if (file?.source === 'remote') {
      return file.remoteSource?.type || 'Remote';
    } else if (file?.source === 'file') {
      return 'Local File';
    }
    return 'Local Table';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-background/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="w-full max-w-3xl max-h-[70vh] bg-background border border-border rounded-lg shadow-xl shadow-background/30 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  Select Tables for AI Context
                </h2>
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">
                  {selectedTables.size} selected
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-border">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tables..."
                className="w-full px-4 py-2 bg-background/30 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Table List */}
            <div className="flex-1 overflow-auto p-4">
              {filteredTables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? 'No tables found matching your search'
                    : 'No tables available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTables.map((table) => {
                    const isSelected = selectedTables.has(table.name);
                    const file = files.find((f) => f.tableName === table.name);

                    return (
                      <motion.div
                        key={table.name}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-accent/5 border-border hover:bg-accent/10'
                        }`}
                        onClick={() => handleToggleTable(table.name)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-1">
                              {isSelected ? (
                                <div className="h-4 w-4 bg-primary rounded flex items-center justify-center">
                                  <Check className="h-3 w-3 text-foreground" />
                                </div>
                              ) : (
                                <div className="h-4 w-4 border-2 border-border rounded" />
                              )}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-muted-foreground">
                                  {getTableIcon(table)}
                                </div>
                                <span className="font-medium text-foreground">
                                  {table.name}
                                </span>
                                <span className="px-2 py-0.5 bg-accent/10 text-muted-foreground text-xs rounded">
                                  {getSourceLabel(table)}
                                </span>
                              </div>

                              {file && (
                                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                                  {/* TODO: Do we need to have row count on this iteration? */}
                                  {/* {file.rowCount && (
                                    <span>
                                      {file.rowCount.toLocaleString()} rows
                                    </span>
                                  )} */}
                                  {file.columnCount && (
                                    <span>{file.columnCount} columns</span>
                                  )}
                                  {file.fileName && (
                                    <span className="truncate">
                                      {file.fileName}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-popover/30">
              <div className="flex justify-between items-center">
                <button
                  onClick={handleClearAll}
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  disabled={
                    multiTableContexts.filter((ctx) => ctx.isSelected)
                      .length === 0
                  }
                >
                  Clear all
                </button>

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleApply}
                    disabled={selectedTables.size === 0 || isApplying}
                  >
                    {isApplying ? (
                      <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isApplying
                      ? 'Applying...'
                      : `Add to Context (${selectedTables.size})`}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MultiTableSelector;
