import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChangeRecord } from '@/store/duckDBViewStore';

interface ChangeLogProps {
  changes: ChangeRecord[];
  isOpen: boolean;
  isCommitting?: boolean;
  onUndo: (changeId: string) => void;
  onUndoAll: () => void;
  onCommit: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

// Format value for display
function formatValue(value: unknown, maxLength = 20): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    if (value.length > maxLength) return `"${value.slice(0, maxLength)}…"`;
    return `"${value}"`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value).slice(0, maxLength) + '…';
  return String(value);
}

// Get change type styling - uses CSS variables for theme consistency
function getChangeStyle(changeType: string): { bg: string; color: string; label: string } {
  switch (changeType) {
    case 'update':
      return { bg: 'var(--warning-subtle)', color: 'var(--warning)', label: 'Modified' };
    case 'delete':
      return { bg: 'var(--error-subtle)', color: 'var(--error)', label: 'Deleted' };
    case 'insert':
      return { bg: 'var(--success-subtle)', color: 'var(--success)', label: 'Added' };
    default:
      return { bg: 'var(--surface-secondary)', color: 'var(--text-tertiary)', label: 'Changed' };
  }
}

export function ChangeLog({
  changes,
  isOpen,
  isCommitting,
  onUndo,
  onUndoAll,
  onCommit,
  onDiscard,
  onClose,
}: ChangeLogProps) {
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  // Success state for auto-hide after commit
  const [showSuccess, setShowSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group changes by row, deduplicating to show only latest change per column
  const groupedChanges = useMemo(() => {
    const groups = new Map<number, ChangeRecord[]>();
    changes.forEach(change => {
      const existing = groups.get(change.rowId) || [];
      groups.set(change.rowId, [...existing, change]);
    });

    // Deduplicate: for each row, keep only the latest change per column
    const dedupedGroups = new Map<number, ChangeRecord[]>();
    groups.forEach((rowChanges, rowId) => {
      const latestByColumn = new Map<string, ChangeRecord>();
      rowChanges.forEach(change => {
        const existing = latestByColumn.get(change.column);
        if (!existing || change.timestamp >= existing.timestamp) {
          latestByColumn.set(change.column, change);
        }
      });
      dedupedGroups.set(rowId, Array.from(latestByColumn.values()));
    });

    return Array.from(dedupedGroups.entries()).sort((a, b) => {
      const aMaxTime = Math.max(...a[1].map(c => c.timestamp));
      const bMaxTime = Math.max(...b[1].map(c => c.timestamp));
      return bMaxTime - aMaxTime;
    });
  }, [changes]);

  // Get unique columns that have changes (for batch undo)
  const changedColumns = useMemo(() => {
    const cols = new Set<string>();
    groupedChanges.forEach(([, rowChanges]) => {
      rowChanges.forEach(c => cols.add(c.column));
    });
    return Array.from(cols);
  }, [groupedChanges]);

  // Count unique changes (deduplicated)
  const uniqueChangeCount = useMemo(() => {
    return groupedChanges.reduce((sum, [, rowChanges]) => sum + rowChanges.length, 0);
  }, [groupedChanges]);

  const hasChanges = uniqueChangeCount > 0;
  const rowCount = groupedChanges.length;

  // Toggle row expansion
  const toggleRowExpansion = useCallback((rowId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  // Batch undo by column
  const undoByColumn = useCallback((column: string) => {
    changes
      .filter(c => c.column === column)
      .forEach(c => onUndo(c.id));
  }, [changes, onUndo]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !hasChanges) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(groupedChanges.length - 1, prev + 1));
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < groupedChanges.length) {
            e.preventDefault();
            const [, rowChanges] = groupedChanges[selectedIndex];
            rowChanges.forEach(c => onUndo(c.id));
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasChanges, groupedChanges, selectedIndex, onUndo]);

  // Reset selection when changes update
  useEffect(() => {
    if (selectedIndex >= groupedChanges.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional index adjustment
      setSelectedIndex(Math.max(-1, groupedChanges.length - 1));
    }
  }, [groupedChanges.length, selectedIndex]);

  // Show success message after commit
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, onClose]);

  // Handle commit with success feedback
  const handleCommit = useCallback(() => {
    onCommit();
    // Note: In real implementation, you'd set showSuccess after commit succeeds
    // For now, we show it optimistically
  }, [onCommit]);


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          className="fixed bottom-4 right-4 w-96 rounded-xl overflow-hidden z-50 flex flex-col"
          style={{
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: 'calc(100vh - 120px)',
          }}
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {/* Success overlay */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                style={{ backgroundColor: 'var(--surface-primary)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: 'var(--success-subtle)' }}
                >
                  <span className="text-3xl">✓</span>
                </motion.div>
                <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                  Changes saved!
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              // backgroundColor: hasChanges ? 'var(--warning-subtle)' : 'transparent',
              backgroundColor: hasChanges ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
           
            }}
          >
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: hasChanges ? 'var(--warning)' : 'var(--text-disabled)' }}
                animate={hasChanges ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {hasChanges ? `${uniqueChangeCount} Change${uniqueChangeCount > 1 ? 's' : ''}` : 'No Changes'}
                </span>
                {hasChanges && (
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    in {rowCount} row{rowCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasChanges && (
                <motion.button
                  className="w-6 h-6 rounded flex items-center justify-center text-xs"
                  style={{ color: 'var(--text-tertiary)' }}
                  onClick={onUndoAll}
                  title="Undo all changes"
                  whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-secondary)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  ↺
                </motion.button>
              )}
              <motion.button
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ color: 'var(--text-tertiary)' }}
                onClick={onClose}
                whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-secondary)' }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            </div>
          </div>

          {/* Batch column undo (when multiple columns have changes) */}
          {changedColumns.length > 1 && (
            <div
              className="px-3 py-2 flex items-center gap-1 flex-wrap flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-secondary)' }}
            >
              <span className="text-[10px] mr-1" style={{ color: 'var(--text-tertiary)' }}>
                Undo by column:
              </span>
              {changedColumns.slice(0, 5).map(col => (
                <motion.button
                  key={col}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--surface-primary)', color: 'var(--text-secondary)' }}
                  onClick={() => undoByColumn(col)}
                  whileHover={{ scale: 1.05, backgroundColor: 'var(--warning-subtle)' }}
                  whileTap={{ scale: 0.95 }}
                >
                  {col}
                </motion.button>
              ))}
              {changedColumns.length > 5 && (
                <span className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                  +{changedColumns.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Changes list - scrollable */}
          {hasChanges && (
            <div className="flex-1 overflow-auto min-h-0">
              {groupedChanges.slice(0, 20).map(([rowId, rowChanges], index) => {
                const firstChange = rowChanges[0];
                const style = getChangeStyle(firstChange.changeType);
                const isExpanded = expandedRows.has(rowId);
                const isSelected = selectedIndex === index;
                const hasMultipleChanges = rowChanges.length > 2;
                const visibleChanges = isExpanded ? rowChanges : rowChanges.slice(0, 2);

                return (
                  <motion.div
                    key={rowId}
                    className="px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--primary-subtle)' : 'transparent',
                    }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => rowChanges.forEach(c => onUndo(c.id))}
                  >
                    {/* Row indicator with cell count */}
                    <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{ backgroundColor: style.bg, color: style.color }}
                      >
                        Row {rowId}
                      </span>
                      {rowChanges.length > 1 && (
                        <span
                          className="text-[9px] px-1 rounded"
                          style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}
                        >
                          {rowChanges.length} cells
                        </span>
                      )}
                      {firstChange.source === 'ai' && (
                        <span
                          className="text-[9px] px-1 rounded"
                          style={{ backgroundColor: 'var(--info-subtle)', color: 'var(--info)' }}
                        >
                          AI
                        </span>
                      )}
                    </div>

                    {/* Changes details */}
                    <div className="flex-1 min-w-0">
                      {firstChange.changeType === 'delete' ? (
                        <div className="text-xs" style={{ color: 'var(--error)' }}>
                          Row marked for deletion
                        </div>
                      ) : (
                        <>
                          {visibleChanges.map(change => (
                            <div
                              key={change.id}
                              className="text-xs mb-1"
                            >
                              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {change.column}:
                              </span>
                              <span
                                className="ml-1 line-through"
                                style={{ color: 'var(--text-disabled)' }}
                              >
                                {formatValue(change.oldValue)}
                              </span>
                              <span className="mx-1" style={{ color: 'var(--text-tertiary)' }}>→</span>
                              <span style={{ color: 'var(--success)' }}>
                                {formatValue(change.newValue)}
                              </span>
                            </div>
                          ))}
                          {/* Expand/collapse for rows with many changes */}
                          {hasMultipleChanges && (
                            <motion.button
                              className="text-[10px] mt-1 flex items-center gap-1"
                              style={{ color: 'var(--text-tertiary)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(rowId);
                              }}
                              whileHover={{ color: 'var(--text-secondary)' }}
                            >
                              {isExpanded ? (
                                <>
                                  <span>▲</span> Show less
                                </>
                              ) : (
                                <>
                                  <span>▼</span> +{rowChanges.length - 2} more
                                </>
                              )}
                            </motion.button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Undo button */}
                    <motion.button
                      className="text-xs px-2 py-1 rounded flex-shrink-0"
                      style={{ color: 'var(--text-tertiary)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        rowChanges.forEach(c => onUndo(c.id));
                      }}
                      whileHover={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Undo
                    </motion.button>
                  </motion.div>
                );
              })}

              {/* Show more indicator */}
              {groupedChanges.length > 20 && (
                <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  +{groupedChanges.length - 20} more rows with changes
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasChanges && (
            <div className="px-4 py-8 text-center flex-shrink-0">
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No pending changes
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>
                Double-click cells to edit
              </div>
            </div>
          )}

          {/* Sticky Actions bar */}
          {hasChanges && (
            <div
              className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface-secondary)',
              }}
            >
              <motion.button
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg"
                style={{
                  backgroundColor: isCommitting ? 'var(--text-disabled)' : 'var(--primary)',
                  color: 'white',
                }}
                disabled={isCommitting}
                onClick={handleCommit}
                whileHover={!isCommitting ? { scale: 1.02 } : {}}
                whileTap={!isCommitting ? { scale: 0.98 } : {}}
              >
                {isCommitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      className="w-3 h-3 border-2 rounded-full"
                      style={{ borderColor: 'transparent', borderTopColor: 'white' }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Saving...
                  </span>
                ) : (
                  <>✓ Commit {uniqueChangeCount} Change{uniqueChangeCount > 1 ? 's' : ''}</>
                )}
              </motion.button>
              <motion.button
                className="px-3 py-2 text-xs rounded-lg"
                style={{ backgroundColor: 'var(--surface-primary)', color: 'var(--text-secondary)' }}
                onClick={onDiscard}
                disabled={isCommitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Discard
              </motion.button>
            </div>
          )}

          {/* Keyboard hints */}
          <div
            className="px-4 py-2 flex items-center gap-4 text-[10px] flex-shrink-0"
            style={{
              backgroundColor: 'var(--surface-tertiary)',
              color: 'var(--text-tertiary)',
            }}
          >
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                ↵
              </kbd>{' '}
              Undo selected
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                ⌘S
              </kbd>{' '}
              Commit
            </span>
          </div>
        </motion.div>
      )}

    </AnimatePresence>
  );
}

// Floating trigger button when changes exist
export function ChangeLogTrigger({
  changeCount,
  onClick,
}: {
  changeCount: number;
  onClick: () => void;
}) {
  if (changeCount === 0) return null;

  return (
    <motion.button
      className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-full z-40"
      style={{
        backgroundColor: 'var(--warning)',
        color: 'white',
        boxShadow: 'var(--shadow-lg)',
      }}
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.span
        className="w-2 h-2 rounded-full bg-white"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-sm font-medium">
        {changeCount} Change{changeCount > 1 ? 's' : ''}
      </span>
       <span className="text-xs opacity-75">
        Click to review
      </span>
    </motion.button>
  );
}

export default ChangeLog;
