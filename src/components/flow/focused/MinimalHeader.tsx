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
  unknown: { icon: '?', label: 'File', color: '#9CA3AF' },
};

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
      <button
        onClick={onClose}
        className="relative flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-[var(--surface-tertiary)] active:scale-95"
        style={{ color: 'var(--text-secondary)' }}
        title={hasPendingChanges ? `${pendingChangeCount} unsaved changes - ESC to exit` : 'Close (ESC)'}
      >
        <span className="text-lg">×</span>
        {/* Pending changes dot */}
        {hasPendingChanges && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: '#F59E0B' }}
          />
        )}
      </button>

      {/* File selector dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 min-w-0 px-2 py-1 -mx-2 rounded-md transition-colors hover:bg-[var(--surface-secondary)]"
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
          <span
            className="text-[10px] transition-transform"
            style={{
              color: 'var(--text-tertiary)',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
        </button>

        {/* Dropdown menu */}
        <AnimatePresence>
          {dropdownOpen && allFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.1 }}
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

      {/* AI Command Input - clickable area (unified / and ⌘K) */}
      <button
        onClick={onAIFocus}
        className="flex-1 flex items-center gap-2 h-7 px-3 mx-2 rounded-md transition-all cursor-text hover:bg-[var(--surface-secondary)]"
        style={{
          border: '1px solid var(--border-subtle)',
          maxWidth: '400px',
        }}
      >
        <span style={{ color: accentColor }}>/</span>
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
      </button>

      {/* View history undo/redo - for navigating sort/filter/search/version history */}
      {(canViewUndo || canViewRedo || (versionInfo && versionInfo.total > 0)) && (
        <div
          className="flex items-center gap-0.5 rounded-md p-0.5"
          style={{ backgroundColor: 'var(--surface-secondary)' }}
        >
          <button
            onClick={onViewUndo}
            disabled={!canViewUndo}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{
              color: canViewUndo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              opacity: canViewUndo ? 1 : 0.4,
              cursor: canViewUndo ? 'pointer' : 'not-allowed',
            }}
            title="Previous state (⌘Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>

          {/* Version indicator - shows when there are committed versions */}
          {versionInfo && versionInfo.total > 0 && (
            <span
              className="px-1.5 text-[10px] font-medium tabular-nums"
              style={{ color: 'var(--text-tertiary)' }}
              title={versionInfo.description || `Version ${versionInfo.current} of ${versionInfo.total}`}
            >
              v{versionInfo.current}/{versionInfo.total}
            </span>
          )}

          <button
            onClick={onViewRedo}
            disabled={!canViewRedo}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{
              color: canViewRedo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              opacity: canViewRedo ? 1 : 0.4,
              cursor: canViewRedo ? 'pointer' : 'not-allowed',
            }}
            title="Next state (⌘⇧Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick actions on hover/pending changes */}
      {hasPendingChanges && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1"
        >
          {onUndo && (
            <button
              onClick={onUndo}
              className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--surface-tertiary)]"
              style={{ color: 'var(--text-secondary)' }}
              title="Undo (⌘Z)"
            >
              Undo
            </button>
          )}
          {onCommit && (
            <button
              onClick={onCommit}
              className="px-2 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
              }}
              title="Commit changes (⌘S)"
            >
              Commit {pendingChangeCount}
            </button>
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
        {isLoading && (
          <div
            className="w-3 h-3 border border-current rounded-full animate-spin"
            style={{ borderTopColor: accentColor }}
          />
        )}

        {/* Row/column count */}
        <span className="tabular-nums">
          {rowCount.toLocaleString()} rows
        </span>
        <span className="tabular-nums">
          {columnCount} cols
        </span>
      </div>
    </div>
  );
}

export default MinimalHeader;
