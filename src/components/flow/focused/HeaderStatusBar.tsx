import { motion, AnimatePresence } from 'framer-motion';

// PendingChange matches the ChangeRecord structure from duckDBViewStore
interface PendingChange {
  id: string;
  rowId: number;
  column: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'update' | 'delete' | 'insert'; // matches store ChangeRecord
  timestamp: number;
  source?: 'user' | 'ai';
}

interface HeaderStatusBarProps {
  /** Whether DuckDB is initialized and ready */
  isDuckDBReady: boolean;
  /** Whether DuckDB is currently loading/querying */
  isLoading: boolean;
  /** List of pending uncommitted changes */
  pendingChanges: PendingChange[];
  /** Called when user clicks save/commit */
  onCommit: () => void;
  /** Called when user clicks undo */
  onUndo: () => void;
  /** Called when user clicks discard all */
  onDiscard: () => void;
  /** Whether currently committing changes */
  isCommitting: boolean;
  /** File type accent color */
  accentColor?: string;
  /** Optional error message */
  error?: string | null;
  /** Called to clear error */
  onClearError?: () => void;
}

export function HeaderStatusBar({
  isDuckDBReady,
  isLoading,
  pendingChanges,
  onCommit,
  onUndo,
  onDiscard,
  isCommitting,
  accentColor = '#8B5CF6',
  error,
  onClearError,
}: HeaderStatusBarProps) {
  const hasPendingChanges = pendingChanges.length > 0;

  // Group changes by type for summary
  const changeSummary = pendingChanges.reduce(
    (acc, change) => {
      acc[change.changeType] = (acc[change.changeType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <motion.div
      className="flex items-center justify-between px-4 py-2"
      style={{
        backgroundColor: hasPendingChanges
          ? 'rgba(245, 158, 11, 0.08)'
          : error
          ? 'rgba(239, 68, 68, 0.08)'
          : 'var(--surface-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
      initial={false}
      animate={{
        backgroundColor: hasPendingChanges
          ? 'rgba(245, 158, 11, 0.08)'
          : error
          ? 'rgba(239, 68, 68, 0.08)'
          : 'var(--surface-secondary)',
      }}
    >
      {/* Left side: Status indicators */}
      <div className="flex items-center gap-4">
        {/* DuckDB Status */}
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: error
                ? '#EF4444'
                : isDuckDBReady
                ? '#10B981'
                : '#F59E0B',
            }}
            animate={
              isLoading
                ? {
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.6, 1],
                  }
                : {}
            }
            transition={{
              duration: 0.8,
              repeat: isLoading ? Infinity : 0,
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {error
              ? 'Error'
              : isLoading
              ? 'Processing...'
              : isDuckDBReady
              ? '🦆 DuckDB Ready'
              : 'Initializing...'}
          </span>
        </div>

        {/* Separator */}
        {(hasPendingChanges || error) && (
          <div className="w-px h-4" style={{ backgroundColor: 'var(--border-subtle)' }} />
        )}

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              <span className="text-xs" style={{ color: '#EF4444' }}>
                {error.length > 50 ? `${error.slice(0, 50)}...` : error}
              </span>
              {onClearError && (
                <button
                  onClick={onClearError}
                  className="text-[10px] px-1.5 py-0.5 rounded hover:bg-red-500/20 transition-colors"
                  style={{ color: '#EF4444' }}
                >
                  Dismiss
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending changes indicator */}
        <AnimatePresence>
          {hasPendingChanges && !error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-3"
            >
              {/* Change count */}
              <div className="flex items-center gap-1.5">
                <motion.span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#F59E0B' }}
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
                  {pendingChanges.length} unsaved change{pendingChanges.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Change type breakdown */}
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {changeSummary.update && (
                  <span className="flex items-center gap-1">
                    <span style={{ color: '#3B82F6' }}>●</span>
                    {changeSummary.update} edit{changeSummary.update !== 1 ? 's' : ''}
                  </span>
                )}
                {changeSummary.delete && (
                  <span className="flex items-center gap-1">
                    <span style={{ color: '#EF4444' }}>●</span>
                    {changeSummary.delete} delete{changeSummary.delete !== 1 ? 's' : ''}
                  </span>
                )}
                {changeSummary.insert && (
                  <span className="flex items-center gap-1">
                    <span style={{ color: '#10B981' }}>●</span>
                    {changeSummary.insert} insert{changeSummary.insert !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        <AnimatePresence>
          {hasPendingChanges && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2"
            >
              {/* Undo button */}
              <motion.button
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onClick={onUndo}
                whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                whileTap={{ scale: 0.97 }}
              >
                <span>↩</span>
                <span>Undo</span>
                <kbd
                  className="px-1 py-0.5 rounded text-[9px] font-mono ml-1"
                  style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--text-tertiary)' }}
                >
                  ⌘Z
                </kbd>
              </motion.button>

              {/* Discard button */}
              <motion.button
                className="text-xs px-2 py-1 rounded-md transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onClick={onDiscard}
                whileHover={{ backgroundColor: 'var(--surface-tertiary)', color: '#EF4444' }}
                whileTap={{ scale: 0.97 }}
              >
                Discard
              </motion.button>

              {/* Save/Commit button */}
              <motion.button
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md font-medium transition-colors"
                style={{
                  backgroundColor: '#F59E0B',
                  color: 'white',
                  opacity: isCommitting ? 0.7 : 1,
                }}
                onClick={onCommit}
                disabled={isCommitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isCommitting ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      ◌
                    </motion.span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save</span>
                    <kbd
                      className="px-1 py-0.5 rounded text-[9px] font-mono"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    >
                      ⌘S
                    </kbd>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI status when no changes */}
        {!hasPendingChanges && !error && isDuckDBReady && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: accentColor }}>
            <motion.span
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              ✦
            </motion.span>
            <span>AI-powered editing enabled</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default HeaderStatusBar;
