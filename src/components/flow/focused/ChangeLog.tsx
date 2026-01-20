import { useMemo } from 'react';
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
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    if (value.length > 20) return `"${value.slice(0, 20)}…"`;
    return `"${value}"`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 20) + '…';
  return String(value);
}

// Get change type styling
function getChangeStyle(changeType: string): { bg: string; color: string; label: string } {
  switch (changeType) {
    case 'update':
      return { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', label: 'Modified' };
    case 'delete':
      return { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', label: 'Deleted' };
    case 'insert':
      return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981', label: 'Added' };
    default:
      return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6B7280', label: 'Changed' };
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
  // Group changes by row
  const groupedChanges = useMemo(() => {
    const groups = new Map<number, ChangeRecord[]>();
    changes.forEach(change => {
      const existing = groups.get(change.rowId) || [];
      groups.set(change.rowId, [...existing, change]);
    });
    return Array.from(groups.entries()).sort((a, b) => b[1][0].timestamp - a[1][0].timestamp);
  }, [changes]);

  const hasChanges = changes.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed bottom-4 right-4 w-80 rounded-xl overflow-hidden z-50"
          style={{
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xl)',
          }}
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: hasChanges ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
            }}
          >
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: hasChanges ? '#F59E0B' : 'var(--text-disabled)' }}
                animate={hasChanges ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {hasChanges ? `${changes.length} Pending Change${changes.length > 1 ? 's' : ''}` : 'No Changes'}
              </span>
            </div>
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

          {/* Changes list */}
          {hasChanges && (
            <div className="max-h-64 overflow-auto">
              {groupedChanges.slice(0, 10).map(([rowId, rowChanges]) => {
                const firstChange = rowChanges[0];
                const style = getChangeStyle(firstChange.changeType);

                return (
                  <motion.div
                    key={rowId}
                    className="px-4 py-3 flex items-start gap-3"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    {/* Row indicator */}
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: style.bg, color: style.color }}
                      >
                        Row {rowId}
                      </span>
                      {firstChange.source === 'ai' && (
                        <span
                          className="text-[9px] px-1 rounded"
                          style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}
                        >
                          AI
                        </span>
                      )}
                    </div>

                    {/* Changes details */}
                    <div className="flex-1 min-w-0">
                      {firstChange.changeType === 'delete' ? (
                        <div className="text-xs" style={{ color: '#EF4444' }}>
                          Row marked for deletion
                        </div>
                      ) : (
                        rowChanges.map(change => (
                          <div key={change.id} className="text-xs mb-1">
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {change.column}:
                            </span>
                            <span
                              className="ml-1 line-through"
                              style={{ color: 'var(--text-disabled)' }}
                            >
                              {formatValue(change.oldValue)}
                            </span>
                            <span className="mx-1" style={{ color: 'var(--text-tertiary)' }}>→</span>
                            <span style={{ color: '#10B981' }}>
                              {formatValue(change.newValue)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Undo button */}
                    <motion.button
                      className="text-xs px-2 py-1 rounded flex-shrink-0"
                      style={{ color: 'var(--text-tertiary)' }}
                      onClick={() => rowChanges.forEach(c => onUndo(c.id))}
                      whileHover={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Undo
                    </motion.button>
                  </motion.div>
                );
              })}

              {/* Show more indicator */}
              {groupedChanges.length > 10 && (
                <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  +{groupedChanges.length - 10} more rows with changes
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasChanges && (
            <div className="px-4 py-8 text-center">
              <div className="text-2xl mb-2">✨</div>
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No pending changes
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>
                Double-click cells to edit
              </div>
            </div>
          )}

          {/* Actions */}
          {hasChanges && (
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-secondary)' }}
            >
              <motion.button
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg"
                style={{
                  backgroundColor: isCommitting ? 'var(--text-disabled)' : 'var(--primary)',
                  color: 'white',
                }}
                disabled={isCommitting}
                onClick={onCommit}
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
                  <>✓ Commit Changes</>
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
            className="px-4 py-2 flex items-center gap-4 text-[10px]"
            style={{
              backgroundColor: 'var(--surface-tertiary)',
              color: 'var(--text-tertiary)',
            }}
          >
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                ⌘Z
              </kbd>{' '}
              Undo
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
      className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full z-40"
      style={{
        backgroundColor: 'var(--primary)',
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
      <span className="text-sm font-medium">{changeCount} Change{changeCount > 1 ? 's' : ''}</span>
    </motion.button>
  );
}

export default ChangeLog;
