import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import type { Folder } from '@/store/boardStore';
import type { ContentType } from './ContentNode';
import { FolderContextMenu } from './FolderContextMenu';

// ============================================================================
// Props
// ============================================================================

interface DesktopFolderIconProps {
  folder: Folder;
  fileTypes: ContentType[];
  zoom?: number;
  onSelect?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  onDrag?: (id: string, position: { x: number; y: number }) => void;
  onFileDrop?: (folderId: string, fileId: string) => void;
  onRename?: (folderId: string, newName: string) => void;
  onRenameStart?: (folderId: string) => void;
  onRenameCancel?: (folderId: string) => void;
  onChangeColor?: (folderId: string, color: string) => void;
  onDelete?: (folderId: string) => void;
  isDragTarget?: boolean; // True when a file is being dragged over this folder
}

// ============================================================================
// Type color mapping for file previews
// ============================================================================

const typeColors: Record<ContentType, string> = {
  csv: '#10B981',
  json: '#F59E0B',
  xlsx: '#059669',
  parquet: '#8B5CF6',
  txt: '#6B7280',
  md: '#6366F1',
  image: '#EC4899',
  pdf: '#EF4444',
  unknown: '#9CA3AF',
};

// ============================================================================
// Main Component
// ============================================================================

export function DesktopFolderIcon({
  folder,
  fileTypes,
  zoom = 1,
  onSelect,
  onDoubleClick,
  onDrag,
  onFileDrop,
  onRename,
  onRenameStart,
  onRenameCancel,
  onChangeColor,
  onDelete,
  isDragTarget = false,
}: DesktopFolderIconProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(folder.name);
  const nodeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastClickTime = useRef(0);
  const clickCount = useRef(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const isRenaming = folder.isRenaming;

  // Combined drag target state (from props or HTML5 drag)
  const isFileDragTarget = isDragTarget || isDragOver;

  // Motion values for smooth visual position
  const x = useMotionValue(folder.position.x);
  const y = useMotionValue(folder.position.y);

  // Sync motion values when position changes from store
  useEffect(() => {
    if (!isDragging) {
      x.set(folder.position.x);
      y.set(folder.position.y);
    }
  }, [folder.position.x, folder.position.y, x, y, isDragging]);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state sync for rename mode
      setEditingName(folder.name);
    }
  }, [isRenaming, folder.name]);

  // Manual drag handling with zoom awareness
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isRenaming) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: folder.position.x,
      startPosY: folder.position.y,
    };
  };

  useEffect(() => {
    if (!isDragging || !dragState.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;

      const dx = (e.clientX - dragState.current.startMouseX) / zoom;
      const dy = (e.clientY - dragState.current.startMouseY) / zoom;

      const newX = dragState.current.startPosX + dx;
      const newY = dragState.current.startPosY + dy;

      x.set(newX);
      y.set(newY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState.current) return;

      const dx = (e.clientX - dragState.current.startMouseX) / zoom;
      const dy = (e.clientY - dragState.current.startMouseY) / zoom;

      const newX = dragState.current.startPosX + dx;
      const newY = dragState.current.startPosY + dy;

      dragState.current = null;
      setIsDragging(false);
      onDrag?.(folder.id, { x: newX, y: newY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoom, folder.id, onDrag, x, y]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRenaming) return;

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime.current;

    // Fast double-click -> open folder
    if (timeSinceLastClick < 300 && clickCount.current === 1) {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      clickCount.current = 0;
      onDoubleClick?.(folder.id);
    } else {
      // First click
      clickCount.current = 1;
      onSelect?.(folder.id);

      // Slow second click on selected folder -> rename (macOS style)
      if (folder.selected && timeSinceLastClick > 500 && timeSinceLastClick < 2000) {
        clickTimer.current = setTimeout(() => {
          onRenameStart?.(folder.id);
          clickCount.current = 0;
        }, 100);
      } else {
        // Reset after timeout
        clickTimer.current = setTimeout(() => {
          clickCount.current = 0;
        }, 2000);
      }
    }
    lastClickTime.current = now;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const handleRenameSubmit = () => {
    if (editingName.trim() && editingName !== folder.name) {
      onRename?.(folder.id, editingName.trim());
    } else {
      onRenameCancel?.(folder.id);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onRenameCancel?.(folder.id);
    }
  };

  // Handle files being dropped on this folder
  const handleDragOverInternal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const fileId = e.dataTransfer.getData('fileId');
    if (fileId && onFileDrop) {
      onFileDrop(folder.id, fileId);
    }
  };

  // Truncate folder name (only when not editing)
  const truncatedName = folder.name.length > 14
    ? folder.name.slice(0, 12) + '…'
    : folder.name;

  // Unique colors for the stacked preview (up to 3)
  const previewColors = [...new Set(fileTypes.slice(0, 3).map(t => typeColors[t]))];
  const fileCount = folder.fileIds.length;

  return (
    <>
      <motion.div
        ref={nodeRef}
        className="absolute cursor-grab active:cursor-grabbing"
        style={{ x, y, zIndex: isDragging ? 100 : 1 }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOverInternal}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <motion.div
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer select-none"
          style={{ width: 88 }}
          animate={{
            scale: isDragging ? 1.1 : isFileDragTarget ? 1.15 : isHovered ? 1.05 : 1,
            y: isDragging ? -8 : 0,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          {/* Selection/hover background */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              background: folder.selected
                ? `${folder.color || '#6366F1'}15`
                : isFileDragTarget
                  ? 'rgba(99, 102, 241, 0.15)'
                  : isHovered
                    ? 'rgba(0,0,0,0.03)'
                    : 'transparent',
            }}
            animate={{ opacity: folder.selected || isHovered || isFileDragTarget ? 1 : 0 }}
          />

          {/* Folder icon */}
          <motion.div
            className="relative w-16 h-14 flex items-center justify-center"
            animate={{
              rotate: isDragging ? [-1, 1, -1] : 0,
            }}
            transition={{
              rotate: { repeat: isDragging ? Infinity : 0, duration: 0.15 },
            }}
          >
            {/* Folder back */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background: `linear-gradient(145deg, ${folder.color || '#6366F1'}40 0%, ${folder.color || '#6366F1'}25 100%)`,
                transform: 'translateY(2px)',
              }}
            />

            {/* Folder tab */}
            <div
              className="absolute top-0 left-2 w-6 h-2.5 rounded-t-md"
              style={{
                background: folder.color || '#6366F1',
              }}
            />

            {/* Folder front */}
            <div
              className="absolute left-0 right-0 top-2 bottom-0 rounded-lg"
              style={{
                background: `linear-gradient(165deg, ${folder.color || '#6366F1'} 0%, ${folder.color || '#6366F1'}CC 100%)`,
                boxShadow: isDragging
                  ? `0 12px 24px ${folder.color || '#6366F1'}40, 0 0 0 2px ${folder.color || '#6366F1'}60`
                  : folder.selected
                    ? `0 4px 12px ${folder.color || '#6366F1'}30, 0 0 0 2px ${folder.color || '#6366F1'}`
                    : `0 2px 8px ${folder.color || '#6366F1'}20`,
              }}
            >
              {/* File type previews (stacked papers) */}
              <div className="absolute inset-x-2 top-1 bottom-2 flex items-center justify-center">
                {previewColors.length > 0 ? (
                  <div className="relative w-full h-full">
                    {previewColors.map((color, i) => (
                      <motion.div
                        key={i}
                        className="absolute rounded-sm bg-white"
                        style={{
                          width: 20,
                          height: 24,
                          left: `calc(50% - 10px + ${(i - 1) * 4}px)`,
                          top: `calc(50% - 12px + ${(previewColors.length - 1 - i) * 2}px)`,
                          borderLeft: `3px solid ${color}`,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          zIndex: i,
                        }}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-white/60 text-lg">📁</span>
                )}
              </div>
            </div>

            {/* File count badge */}
            {fileCount > 0 && (
              <motion.div
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  background: folder.color || '#6366F1',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                {fileCount}
              </motion.div>
            )}

            {/* Drag over indicator */}
            {isFileDragTarget && (
              <motion.div
                className="absolute inset-0 rounded-lg border-2 border-dashed"
                style={{ borderColor: folder.color || '#6366F1' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
          </motion.div>

          {/* Folder name - editable or static */}
          <motion.div
            className="text-center w-full"
            animate={{ y: isDragging ? 4 : 0 }}
          >
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                className="w-full text-xs font-medium text-center bg-white border border-indigo-400 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-indigo-300"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className={`
                  text-xs font-medium truncate px-1.5 py-0.5 rounded
                  ${folder.selected ? 'text-white' : 'text-stone-700'}
                `}
                style={{
                  backgroundColor: folder.selected ? (folder.color || '#6366F1') : 'transparent',
                }}
                title={folder.name}
              >
                {truncatedName}
              </div>
            )}
          </motion.div>

          {/* Hover hint */}
          <motion.div
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-stone-400 whitespace-nowrap"
            initial={{ opacity: 0, y: -4 }}
            animate={{
              opacity: isHovered && !isDragging && !isRenaming && !isFileDragTarget ? 1 : 0,
              y: isHovered && !isDragging ? 0 : -4,
            }}
          >
            {folder.selected ? 'click again to rename' : 'double-click to open'}
          </motion.div>

          {/* Drop to add hint */}
          <motion.div
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-indigo-500 font-medium whitespace-nowrap"
            initial={{ opacity: 0, y: -4 }}
            animate={{
              opacity: isFileDragTarget ? 1 : 0,
              y: isFileDragTarget ? 0 : -4,
            }}
          >
            drop to add to folder
          </motion.div>

        </motion.div>
      </motion.div>

      {/* Context menu */}
      {contextMenuPosition && (
        <FolderContextMenu
          isOpen={contextMenuOpen}
          onClose={() => setContextMenuOpen(false)}
          position={contextMenuPosition}
          folder={folder}
          fileCount={folder.fileIds.length}
          onOpen={() => onDoubleClick?.(folder.id)}
          onRename={(newName) => onRename?.(folder.id, newName)}
          onChangeColor={(color) => onChangeColor?.(folder.id, color)}
          onDelete={() => onDelete?.(folder.id)}
        />
      )}
    </>
  );
}

export default DesktopFolderIcon;
