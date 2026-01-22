import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import type { ContentType } from '../ContentNode';

export interface FileTab {
  id: string;
  name: string;
  type: ContentType;
  rowCount?: number;
  columnCount?: number;
}

interface FileTabsProps {
  files: FileTab[];
  activeFileId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder: (newOrder: string[]) => void;
  onExit: () => void;
}

// Type configurations
const typeConfigs: Record<ContentType, { icon: string; color: string }> = {
  csv: { icon: '⊞', color: '#10B981' },
  json: { icon: '{ }', color: '#F59E0B' },
  xlsx: { icon: '▦', color: '#059669' },
  parquet: { icon: '⬡', color: '#8B5CF6' },
  txt: { icon: '≡', color: '#6B7280' },
  md: { icon: 'M↓', color: '#6366F1' },
  image: { icon: '◐', color: '#EC4899' },
  pdf: { icon: '▤', color: '#EF4444' },
  unknown: { icon: '?', color: '#9CA3AF' },
};

export function FileTabs({
  files,
  activeFileId,
  onTabClick,
  onTabClose,
  onTabReorder,
  onExit,
}: FileTabsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileId: string } | null>(null);

  const handleReorder = (newFiles: FileTab[]) => {
    onTabReorder(newFiles.map(f => f.id));
  };

  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCloseOthers = (fileId: string) => {
    files.forEach(f => {
      if (f.id !== fileId) onTabClose(f.id);
    });
    closeContextMenu();
  };

  const handleCloseAll = () => {
    files.forEach(f => onTabClose(f.id));
    closeContextMenu();
  };

  return (
    <>
      <div
        className="flex items-center justify-between h-9 px-2"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Tabs - Reorderable */}
        <Reorder.Group
          axis="x"
          values={files}
          onReorder={handleReorder}
          className="flex items-center gap-1 overflow-x-auto"
        >
          {files.map((file) => {
            const config = typeConfigs[file.type];
            const isActive = file.id === activeFileId;

            return (
              <Reorder.Item
                key={file.id}
                value={file}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={() => setIsDragging(false)}
                whileDrag={{
                  scale: 1.02,
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50,
                }}
                transition={{ type: 'tween', duration: 0.15 }}
                  className="group relative flex items-center gap-1.5 h-7 px-2.5 rounded transition-colors select-none"
                  style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    backgroundColor: isActive ? 'var(--surface-secondary)' : 'transparent',
                  }}
                  onClick={() => !isDragging && onTabClick(file.id)}
                  onContextMenu={(e) => handleContextMenu(e, file.id)}
                >
                  {/* Active indicator - subtle underline */}
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                  )}

                  {/* File icon */}
                  <span
                    className="text-xs"
                    style={{ color: config.color }}
                  >
                    {config.icon}
                  </span>

                  {/* File name */}
                  <span
                    className="text-xs font-medium truncate max-w-[120px]"
                    style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {file.name.replace(/\.[^.]+$/, '')}
                  </span>

                  {/* Row count badge */}
                  {file.rowCount && (
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                      {file.rowCount >= 1000
                        ? `${(file.rowCount / 1000).toFixed(1)}K`
                        : file.rowCount
                      }
                    </span>
                  )}

                  {/* Close button - only visible on hover or when active */}
                  <button
                    className="w-4 h-4 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-tertiary)]"
                    style={{
                      color: 'var(--text-tertiary)',
                      opacity: isActive ? 0.7 : undefined,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(file.id);
                    }}
                  >
                    <span className="text-[10px]">✕</span>
                  </button>
                </Reorder.Item>
            );
          })}
        </Reorder.Group>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Tab count */}
          {files.length > 1 && (
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              {files.length} files
            </span>
          )}

          {/* Exit button - minimal */}
          <button
            className="flex items-center gap-1.5 h-6 px-2 rounded text-xs transition-colors hover:bg-[var(--surface-secondary)]"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={onExit}
          >
            <span>←</span>
            <kbd
              className="px-1 py-0.5 rounded text-[9px] font-mono"
              style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-disabled)' }}
            >
              esc
            </kbd>
          </button>
        </div>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[100]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeContextMenu}
            />

            {/* Menu */}
            <motion.div
              className="fixed z-[101] rounded-lg py-1 min-w-[160px]"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              }}
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <ContextMenuItem
                onClick={() => {
                  onTabClose(contextMenu.fileId);
                  closeContextMenu();
                }}
              >
                Close
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleCloseOthers(contextMenu.fileId)}
                disabled={files.length <= 1}
              >
                Close Others
              </ContextMenuItem>
              <ContextMenuItem
                onClick={handleCloseAll}
              >
                Close All
              </ContextMenuItem>
              <div className="h-px my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
              <ContextMenuItem
                onClick={() => {
                  // Copy file name to clipboard
                  const file = files.find(f => f.id === contextMenu.fileId);
                  if (file) navigator.clipboard.writeText(file.name);
                  closeContextMenu();
                }}
              >
                Copy Name
              </ContextMenuItem>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ContextMenuItem({
  children,
  onClick,
  disabled = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="w-full px-3 py-1.5 text-left text-xs transition-colors"
      style={{
        color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'var(--surface-secondary)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = disabled ? 'var(--text-disabled)' : 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
  );
}

export default FileTabs;
