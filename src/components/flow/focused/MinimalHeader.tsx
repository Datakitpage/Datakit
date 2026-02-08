import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentType } from '../ContentNode';
import { ShareMenu } from './ShareMenu';

interface FileInfo {
  id: string;
  name: string;
  type: ContentType;
  rowCount?: number;
  columnCount?: number;
}

interface MinimalHeaderProps {
  fileName: string;
  fileType: ContentType;
  fileId: string;
  allFiles: FileInfo[];
  rowCount: number;
  columnCount: number;
  hasPendingChanges: boolean;
  pendingChangeCount: number;
  isLoading: boolean;
  isDuckDBReady: boolean;
  accentColor: string;
  onClose: () => void;
  onAIFocus: () => void;
  onFileSelect: (fileId: string) => void;
  onCommit?: () => void;
  onUndo?: () => void;
  onExport?: (format: 'csv' | 'json' | 'parquet' | 'xlsx') => void;
  hasCommittedChanges?: boolean;
  // Whether there's a custom query result (AI query) that can be exported
  hasQueryResult?: boolean;
  // View history undo/redo
  canViewUndo?: boolean;
  canViewRedo?: boolean;
  onViewUndo?: () => void;
  onViewRedo?: () => void;
  // Version info (committed data versions)
  versionInfo?: { current: number; total: number; description: string | null };
  // Folder context - when viewing files from a folder
  currentFolderId?: string | null;
  folderFileIds?: string[];
  onRemoveFromFolder?: (fileId: string) => void;
  // Google Sheet sync
  onSync?: () => void;
  isSyncing?: boolean;
  lastSynced?: number | null;
  syncStatus?: 'synced' | 'local_changes' | 'remote_changes' | 'conflict';
  localChangeCount?: number;
  syncError?: string | null;
  // Legacy compat
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// Type configurations
const typeConfigs: Record<ContentType, { icon: string; label: string; color: string }> = {
  csv: { icon: '⊞', label: 'CSV', color: '#10B981' },
  json: { icon: '{ }', label: 'JSON', color: '#F59E0B' },
  xlsx: { icon: '▦', label: 'Excel', color: '#059669' },
  parquet: { icon: '⬡', label: 'Parquet', color: '#8B5CF6' },
  txt: { icon: '≡', label: 'Text', color: '#6B7280' },
  md: { icon: 'M↓', label: 'Markdown', color: '#6366F1' },
  image: { icon: '◐', label: 'Image', color: '#EC4899' },
  pdf: { icon: '▤', label: 'PDF', color: '#EF4444' },
  gsheet: { icon: '◧', label: 'Google Sheet', color: '#0F9D58' },
  unknown: { icon: '?', label: 'File', color: '#9CA3AF' },
};

// Spring animation presets (consistent with FloatingToolbar + ColumnTypePopover)
const springTransition = { type: 'spring' as const, stiffness: 500, damping: 35 };
const gentleSpring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export function MinimalHeader({
  fileName,
  fileType,
  fileId,
  allFiles,
  rowCount,
  columnCount,
  hasPendingChanges,
  pendingChangeCount,
  isLoading,
  isDuckDBReady,
  accentColor,
  onClose,
  onAIFocus,
  onFileSelect,
  onCommit,
  onUndo,
  onExport,
  hasCommittedChanges,
  hasQueryResult,
  canViewUndo,
  canViewRedo,
  onViewUndo,
  onViewRedo,
  versionInfo,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Available for folder-aware navigation
  currentFolderId: _currentFolderId,
  folderFileIds,
  onRemoveFromFolder,
  onSync,
  isSyncing,
  lastSynced,
  syncStatus,
  localChangeCount: syncChangeCount,
  syncError,
  onRefresh,
  isRefreshing,
}: MinimalHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const config = typeConfigs[fileType] || typeConfigs.unknown;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  // Close dropdown on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dropdownOpen) {
        e.stopPropagation();
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [dropdownOpen]);

  const handleFileSelect = (id: string) => {
    if (id !== fileId) {
      onFileSelect(id);
    }
    setDropdownOpen(false);
  };

  return (
    <div
      className="flex items-center h-11 px-3 gap-3 select-none"
      style={{
        backgroundColor: 'var(--surface-primary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {/* Close button with pending changes indicator */}
      <motion.button
        onClick={onClose}
        className="relative flex items-center justify-center w-7 h-7 rounded-md"
        style={{ color: 'var(--text-secondary)' }}
        whileHover={{ backgroundColor: 'var(--surface-tertiary)', scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        transition={springTransition}
        title={hasPendingChanges ? `${pendingChangeCount} unsaved changes - ESC to exit` : 'Close (ESC)'}
      >
        <span className="text-lg">×</span>
        {/* Pending changes dot */}
        <AnimatePresence>
          {hasPendingChanges && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={springTransition}
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: '#F59E0B' }}
            >
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: '#F59E0B' }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* File selector dropdown */}
      <div className="relative" ref={dropdownRef}>
        <motion.button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 min-w-0 px-2 py-1 -mx-2 rounded-md"
          whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
          whileTap={{ scale: 0.98 }}
          transition={springTransition}
        >
          <span
            className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs"
            style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
          >
            {config.icon}
          </span>
          <span
            className="text-sm font-medium truncate max-w-[180px]"
            style={{ color: 'var(--text-primary)' }}
          >
            {fileName}
          </span>
          {/* Dropdown indicator */}
          <motion.span
            className="text-[10px]"
            style={{ color: 'var(--text-tertiary)' }}
            animate={{ rotate: dropdownOpen ? 180 : 0 }}
            transition={gentleSpring}
          >
            ▼
          </motion.span>
        </motion.button>

        {/* Dropdown menu */}
        <AnimatePresence>
          {dropdownOpen && allFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={springTransition}
              className="absolute left-0 top-full mt-1 min-w-[240px] max-w-[320px] rounded-lg overflow-hidden z-50"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="py-1 max-h-[300px] overflow-y-auto">
                <div
                  className="px-3 py-1.5 text-[10px] uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Open files ({allFiles.length})
                </div>
                {allFiles.map((file) => {
                  const fileConfig = typeConfigs[file.type] || typeConfigs.unknown;
                  const isActive = file.id === fileId;
                  const isInFolder = folderFileIds?.includes(file.id);

                  return (
                    <div key={file.id} className="group/file">
                      <button
                        onClick={() => handleFileSelect(file.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-secondary)]"
                        style={{
                          backgroundColor: isActive ? 'var(--surface-secondary)' : 'transparent',
                        }}
                      >
                        <span
                          className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px]"
                          style={{
                            backgroundColor: `${fileConfig.color}15`,
                            color: fileConfig.color,
                          }}
                        >
                          {fileConfig.icon}
                        </span>
                        <div className="flex-1 min-w-0 max-w-[200px]">
                          <div
                            className="text-sm truncate"
                            style={{
                              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                              fontWeight: isActive ? 500 : 400,
                            }}
                            title={file.name}
                          >
                            {file.name}
                          </div>
                          {file.rowCount !== undefined && (
                            <div
                              className="text-[10px]"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              {file.rowCount.toLocaleString()} rows
                              {file.columnCount !== undefined && ` · ${file.columnCount} cols`}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <span
                            className="text-xs"
                            style={{ color: accentColor }}
                          >
                            ●
                          </span>
                        )}
                        {/* Remove from folder button - shown on hover when file is in folder */}
                        {isInFolder && onRemoveFromFolder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveFromFolder(file.id);
                              setDropdownOpen(false);
                            }}
                            className="opacity-0 group-hover/file:opacity-100 p-1 rounded transition-all hover:bg-red-100"
                            style={{ color: '#EF4444' }}
                            title="Remove from folder"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section divider */}
      <div className="w-px h-5" style={{ backgroundColor: 'var(--border-default)' }} />

      {/* AI Command Input - clickable area (unified / and ⌘K) */}
      <motion.button
        onClick={onAIFocus}
        className="flex-1 flex items-center gap-2 h-7 px-3 mx-2 rounded-md cursor-text"
        style={{
          border: '1px solid var(--border-subtle)',
          maxWidth: '480px',
        }}
        whileHover={{
          borderColor: `${accentColor}40`,
          boxShadow: `0 0 0 3px ${accentColor}10`,
        }}
        whileTap={{ scale: 0.998 }}
        transition={gentleSpring}
      >
        <motion.span
          style={{ color: accentColor }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        >
          /
        </motion.span>
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Sort, filter, or ask anything...
        </span>
        <span className="ml-auto text-[10px] font-mono px-1 rounded flex items-center gap-1" style={{
          backgroundColor: 'var(--surface-tertiary)',
          color: 'var(--text-tertiary)',
        }}>
          <span>/</span>
          <span style={{ opacity: 0.5 }}>or</span>
          <span>⌘K</span>
        </span>
      </motion.button>

      {/* View history undo/redo - for navigating sort/filter/search/version history */}
      {(canViewUndo || canViewRedo || (versionInfo && versionInfo.total > 0)) && (
        <div
          className="flex items-center gap-0.5 rounded-md p-0.5"
          style={{ backgroundColor: 'var(--surface-secondary)', boxShadow: 'var(--shadow-sm)' }}
        >
          <motion.button
            onClick={onViewUndo}
            disabled={!canViewUndo}
            className="flex items-center justify-center w-6 h-6 rounded"
            style={{
              color: canViewUndo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              opacity: canViewUndo ? 1 : 0.4,
              cursor: canViewUndo ? 'pointer' : 'not-allowed',
            }}
            whileHover={canViewUndo ? { backgroundColor: 'var(--surface-tertiary)', scale: 1.1 } : {}}
            whileTap={canViewUndo ? { scale: 0.88 } : {}}
            transition={springTransition}
            title="Previous state (⌘Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </motion.button>

          {/* Version indicator - shows when there are committed versions */}
          {versionInfo && versionInfo.total > 0 && (
            <motion.span
              key={`v${versionInfo.current}/${versionInfo.total}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springTransition}
              className="px-1.5 text-[10px] font-medium tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
              title={versionInfo.description || `Version ${versionInfo.current} of ${versionInfo.total}`}
            >
              v{versionInfo.current}/{versionInfo.total}
            </motion.span>
          )}

          <motion.button
            onClick={onViewRedo}
            disabled={!canViewRedo}
            className="flex items-center justify-center w-6 h-6 rounded"
            style={{
              color: canViewRedo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              opacity: canViewRedo ? 1 : 0.4,
              cursor: canViewRedo ? 'pointer' : 'not-allowed',
            }}
            whileHover={canViewRedo ? { backgroundColor: 'var(--surface-tertiary)', scale: 1.1 } : {}}
            whileTap={canViewRedo ? { scale: 0.88 } : {}}
            transition={springTransition}
            title="Next state (⌘⇧Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </motion.button>
        </div>
      )}

      {/* Section divider */}
      {(canViewUndo || canViewRedo || (versionInfo && versionInfo.total > 0)) && (
        <div className="w-px h-5" style={{ backgroundColor: 'var(--border-default)' }} />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Google Sheet sync section */}
      {(onSync || onRefresh) && (
        <motion.div
          className="flex items-center gap-2 px-2 py-0.5 rounded-md"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            border: '1px solid var(--border-default)',
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springTransition}
        >
          {/* Sync status badges (animated transitions between states) */}
          <AnimatePresence mode="wait">
            {syncError && (
              <motion.span
                key="sync-error"
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                transition={springTransition}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: '#EF4444', backgroundColor: '#FEF2F2' }}
              >
                {syncError.length > 30 ? syncError.slice(0, 30) + '...' : syncError}
              </motion.span>
            )}
            {!syncError && syncStatus === 'local_changes' && syncChangeCount && syncChangeCount > 0 && (
              <motion.span
                key="sync-local"
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                transition={springTransition}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums"
                style={{ color: '#D97706', backgroundColor: '#FFFBEB' }}
              >
                {syncChangeCount} local {syncChangeCount === 1 ? 'change' : 'changes'}
              </motion.span>
            )}
            {!syncError && syncStatus === 'remote_changes' && (
              <motion.span
                key="sync-remote"
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                transition={springTransition}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: '#2563EB', backgroundColor: '#EFF6FF' }}
              >
                Remote updated
              </motion.span>
            )}
            {!syncError && syncStatus === 'conflict' && (
              <motion.span
                key="sync-conflict"
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                transition={springTransition}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}
              >
                Conflict
              </motion.span>
            )}
          </AnimatePresence>

          {/* Last synced time */}
          {lastSynced && !syncError && syncStatus !== 'conflict' && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] tabular-nums"
              style={{ color: 'var(--text-disabled)' }}
            >
              {(() => {
                const mins = Math.floor((Date.now() - lastSynced) / 60000);
                if (mins < 1) return 'Synced just now';
                if (mins < 60) return `Synced ${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                return `Synced ${hrs}h ago`;
              })()}
            </motion.span>
          )}

          {/* Sync button */}
          <motion.button
            onClick={onSync || onRefresh}
            disabled={isSyncing || isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md"
            style={{
              color: (isSyncing || isRefreshing) ? 'var(--text-disabled)' : syncStatus === 'local_changes' ? '#D97706' : 'var(--text-secondary)',
              border: syncStatus === 'local_changes' ? '1px solid #FCD34D' : '1px solid var(--border-subtle)',
            }}
            whileHover={!(isSyncing || isRefreshing) ? {
              backgroundColor: syncStatus === 'local_changes' ? '#FFFBEB' : 'var(--surface-tertiary)',
              scale: 1.02,
              boxShadow: 'var(--shadow-sm)',
            } : {}}
            whileTap={!(isSyncing || isRefreshing) ? { scale: 0.96 } : {}}
            transition={springTransition}
            title={syncStatus === 'local_changes' ? 'Push local changes to Google Sheets' : 'Sync with Google Sheets'}
          >
            {/* Sync icon (two circular arrows) */}
            <motion.svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              animate={(isSyncing || isRefreshing) ? { rotate: 360 } : { rotate: 0 }}
              transition={(isSyncing || isRefreshing)
                ? { duration: 1, repeat: Infinity, ease: 'linear' }
                : springTransition
              }
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </motion.svg>
            {(isSyncing || isRefreshing)
              ? 'Syncing...'
              : syncStatus === 'local_changes'
                ? 'Push'
                : 'Sync'}
          </motion.button>
        </motion.div>
      )}

      {/* Quick actions on hover/pending changes */}
      {hasPendingChanges && (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springTransition}
          className="flex items-center gap-1"
        >
          {onUndo && (
            <motion.button
              onClick={onUndo}
              className="px-2 py-1 text-xs rounded"
              style={{ color: 'var(--text-secondary)' }}
              whileHover={{ backgroundColor: 'var(--surface-tertiary)', scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={springTransition}
              title="Undo (⌘Z)"
            >
              Undo
            </motion.button>
          )}
          {onCommit && (
            <motion.button
              onClick={onCommit}
              className="px-2.5 py-1 text-xs font-medium rounded"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
              }}
              whileHover={{
                backgroundColor: `${accentColor}25`,
                scale: 1.03,
                boxShadow: `0 0 0 2px ${accentColor}20`,
              }}
              whileTap={{ scale: 0.95 }}
              transition={springTransition}
              title="Commit changes (⌘S)"
            >
              Commit {pendingChangeCount}
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Share menu - shown for query results, after changes have been committed, or when versions exist */}
      <AnimatePresence>
        {onExport && isDuckDBReady && (hasQueryResult || hasCommittedChanges || (versionInfo && versionInfo.total > 0)) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ShareMenu
              fileName={fileName}
              onExport={onExport}
              accentColor={accentColor}
              disabled={hasPendingChanges}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status indicators */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {/* Loading indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={springTransition}
            >
              <motion.div
                className="w-3 h-3 border border-current rounded-full"
                style={{ borderTopColor: accentColor }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row/column count */}
        <motion.span
          key={rowCount}
          className="tabular-nums"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {rowCount.toLocaleString()} rows
        </motion.span>
        <span className="tabular-nums">
          {columnCount} cols
        </span>
      </div>
    </div>
  );
}

export default MinimalHeader;
