// Simplified - removed framer-motion animations to eliminate flashing

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Available for future theming
  accentColor: _accentColor = '#8B5CF6',
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
    <div
      className="flex items-center justify-between px-4 py-2 transition-colors"
      style={{
        backgroundColor: hasPendingChanges
          ? 'rgba(245, 158, 11, 0.08)'
          : error
          ? 'rgba(239, 68, 68, 0.08)'
          : 'var(--surface-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left side: Status indicators */}
      <div className="flex items-center gap-4">
        {/* DuckDB Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isLoading ? 'animate-pulse' : ''}`}
            style={{
              backgroundColor: error
                ? '#EF4444'
                : isDuckDBReady
                ? '#10B981'
                : '#F59E0B',
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
        {error && (
          <div className="flex items-center gap-2">
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
          </div>
        )}

        {/* Pending changes indicator */}
        {hasPendingChanges && !error && (
          <div className="flex items-center gap-3">
            {/* Change count */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#F59E0B' }}
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
          </div>
        )}
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        {hasPendingChanges && (
          <div className="flex items-center gap-2">
            {/* Undo button */}
            <button
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors hover:bg-[var(--surface-tertiary)]"
              style={{ color: 'var(--text-secondary)' }}
              onClick={onUndo}
            >
              <span>↩</span>
              <span>Undo</span>
              <kbd
                className="px-1 py-0.5 rounded text-[9px] font-mono ml-1"
                style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--text-tertiary)' }}
              >
                ⌘Z
              </kbd>
            </button>

            {/* Discard button */}
            <button
              className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-[var(--surface-tertiary)] hover:text-red-500"
              style={{ color: 'var(--text-tertiary)' }}
              onClick={onDiscard}
            >
              Discard
            </button>

            {/* Save/Commit button */}
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md font-medium transition-colors hover:opacity-90 active:scale-98"
              style={{
                backgroundColor: '#F59E0B',
                color: 'white',
                opacity: isCommitting ? 0.7 : 1,
              }}
              onClick={onCommit}
              disabled={isCommitting}
            >
              {isCommitting ? (
                <>
                  <span className="animate-spin">◌</span>
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
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default HeaderStatusBar;
