import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import type { ContentType } from './ContentNode';

// ============================================================================
// Types
// ============================================================================

export interface DesktopFileIconData {
  id: string;
  name: string;
  type: ContentType;
  size: number;
  position: { x: number; y: number };
  rowCount?: number;
  columnCount?: number;
  processing?: boolean;
  error?: string;
  selected?: boolean;
}

interface DesktopFileIconProps {
  node: DesktopFileIconData;
  zoom?: number; // Canvas zoom level for drag calculations
  onSelect?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  onDrag?: (id: string, position: { x: number; y: number }) => void;
  onDragMove?: (id: string, position: { x: number; y: number }) => void;
  onDragEnd?: (id: string, position: { x: number; y: number }) => void;
  isDragTarget?: boolean; // True when another file is being dragged over this one
}

// ============================================================================
// Type Configurations - macOS-inspired icons
// ============================================================================

interface TypeConfig {
  icon: string;
  label: string;
  color: string;
  bgGradient: string;
  shadowColor: string;
}

const typeConfigs: Record<ContentType, TypeConfig> = {
  csv: {
    icon: '⊞',
    label: 'CSV',
    color: '#10B981',
    bgGradient: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
    shadowColor: 'rgba(16, 185, 129, 0.3)',
  },
  json: {
    icon: '{ }',
    label: 'JSON',
    color: '#F59E0B',
    bgGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
    shadowColor: 'rgba(245, 158, 11, 0.3)',
  },
  xlsx: {
    icon: '▦',
    label: 'Excel',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #D1FAE5 0%, #6EE7B7 100%)',
    shadowColor: 'rgba(5, 150, 105, 0.3)',
  },
  parquet: {
    icon: '⬡',
    label: 'Parquet',
    color: '#8B5CF6',
    bgGradient: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
    shadowColor: 'rgba(139, 92, 246, 0.3)',
  },
  txt: {
    icon: '≡',
    label: 'Text',
    color: '#6B7280',
    bgGradient: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
    shadowColor: 'rgba(107, 114, 128, 0.2)',
  },
  md: {
    icon: 'M↓',
    label: 'Markdown',
    color: '#6366F1',
    bgGradient: 'linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)',
    shadowColor: 'rgba(99, 102, 241, 0.3)',
  },
  image: {
    icon: '◐',
    label: 'Image',
    color: '#EC4899',
    bgGradient: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)',
    shadowColor: 'rgba(236, 72, 153, 0.3)',
  },
  pdf: {
    icon: '▤',
    label: 'PDF',
    color: '#EF4444',
    bgGradient: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
    shadowColor: 'rgba(239, 68, 68, 0.3)',
  },
  unknown: {
    icon: '?',
    label: 'File',
    color: '#9CA3AF',
    bgGradient: 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)',
    shadowColor: 'rgba(156, 163, 175, 0.2)',
  },
};

// ============================================================================
// Format file size helper
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Main DesktopFileIcon Component
// ============================================================================

export function DesktopFileIcon({
  node,
  zoom = 1,
  onSelect,
  onDoubleClick,
  onDrag,
  onDragMove,
  onDragEnd,
  isDragTarget = false,
}: DesktopFileIconProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef(0);
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const config = typeConfigs[node.type];

  // Motion values for smooth visual position
  const x = useMotionValue(node.position.x);
  const y = useMotionValue(node.position.y);

  // Sync motion values when position changes from store
  useEffect(() => {
    if (!isDragging) {
      x.set(node.position.x);
      y.set(node.position.y);
    }
  }, [node.position.x, node.position.y, x, y, isDragging]);

  // Manual drag handling with zoom awareness
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag on left click
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: node.position.x,
      startPosY: node.position.y,
    };
  };

  useEffect(() => {
    if (!isDragging || !dragState.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;

      // Account for zoom when calculating delta
      const dx = (e.clientX - dragState.current.startMouseX) / zoom;
      const dy = (e.clientY - dragState.current.startMouseY) / zoom;

      const newX = dragState.current.startPosX + dx;
      const newY = dragState.current.startPosY + dy;

      x.set(newX);
      y.set(newY);
      onDragMove?.(node.id, { x: newX, y: newY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState.current) return;

      const dx = (e.clientX - dragState.current.startMouseX) / zoom;
      const dy = (e.clientY - dragState.current.startMouseY) / zoom;

      const newX = dragState.current.startPosX + dx;
      const newY = dragState.current.startPosY + dy;

      dragState.current = null;
      setIsDragging(false);

      onDragEnd?.(node.id, { x: newX, y: newY });
      onDrag?.(node.id, { x: newX, y: newY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoom, node.id, onDrag, onDragMove, onDragEnd, x, y]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime.current;

    if (timeSinceLastClick < 300) {
      // Double click - open file
      onDoubleClick?.(node.id);
    } else {
      // Single click - select
      onSelect?.(node.id);
    }
    lastClickTime.current = now;
  };

  // File name without extension
  const displayName = node.name.replace(/\.[^.]+$/, '');
  const truncatedName = displayName.length > 12
    ? displayName.slice(0, 10) + '…'
    : displayName;

  return (
    <motion.div
      ref={nodeRef}
      className="absolute cursor-grab active:cursor-grabbing"
      style={{ x, y, zIndex: isDragging ? 100 : 1 }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >

      <motion.div
        className="flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer select-none"
        style={{
          width: 88,
        }}
        animate={{
          scale: isDragging ? 1.1 : isDragTarget ? 1.15 : isHovered ? 1.05 : 1,
          y: isDragging ? -8 : 0,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {/* Selection/drag target background */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: isDragTarget
              ? 'rgba(99, 102, 241, 0.2)'
              : node.selected
                ? `${config.color}15`
                : isHovered
                  ? 'rgba(0,0,0,0.03)'
                  : 'transparent',
            border: isDragTarget ? '2px dashed #6366F1' : 'none',
          }}
          animate={{
            opacity: node.selected || isHovered || isDragTarget ? 1 : 0,
          }}
        />

        {/* Icon container */}
        <motion.div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
          style={{
            background: config.bgGradient,
            boxShadow: isDragging
              ? `0 12px 24px ${config.shadowColor}, 0 0 0 2px ${config.color}40`
              : node.selected
                ? `0 4px 12px ${config.shadowColor}, 0 0 0 2px ${config.color}`
                : `0 2px 8px ${config.shadowColor}`,
          }}
          animate={{
            rotate: isDragging ? [-1, 1, -1] : 0,
          }}
          transition={{
            rotate: { repeat: isDragging ? Infinity : 0, duration: 0.15 },
          }}
        >
          {/* Processing spinner */}
          {node.processing ? (
            <motion.div
              className="w-8 h-8 border-3 rounded-full"
              style={{
                borderColor: `${config.color}30`,
                borderTopColor: config.color,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <>
              {/* File type icon */}
              <span
                className="text-2xl font-medium"
                style={{ color: config.color }}
              >
                {config.icon}
              </span>

              {/* Type badge */}
              <div
                className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[8px] font-bold tracking-wide"
                style={{
                  backgroundColor: config.color,
                  color: 'white',
                }}
              >
                {config.label}
              </div>
            </>
          )}

          {/* Error indicator */}
          {node.error && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <span className="text-white text-[10px]">!</span>
            </motion.div>
          )}
        </motion.div>

        {/* File name */}
        <motion.div
          className="text-center w-full"
          animate={{
            y: isDragging ? 4 : 0,
          }}
        >
          <div
            className={`
              text-xs font-medium truncate px-1 py-0.5 rounded
              ${node.selected ? 'text-white' : 'text-stone-700'}
            `}
            style={{
              backgroundColor: node.selected ? config.color : 'transparent',
            }}
            title={node.name}
          >
            {truncatedName}
          </div>

          {/* File meta */}
          <div className="text-[10px] text-stone-400 mt-0.5">
            {node.rowCount ? (
              <span>{node.rowCount.toLocaleString()} rows</span>
            ) : (
              <span>{formatFileSize(node.size)}</span>
            )}
          </div>
        </motion.div>

        {/* Hover hint */}
        <motion.div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-stone-400 whitespace-nowrap"
          initial={{ opacity: 0, y: -4 }}
          animate={{
            opacity: isHovered && !isDragging && !isDragTarget ? 1 : 0,
            y: isHovered && !isDragging ? 0 : -4,
          }}
        >
          double-click to open
        </motion.div>

        {/* Drop to create folder hint */}
        <motion.div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-indigo-500 font-medium whitespace-nowrap"
          initial={{ opacity: 0, y: -4 }}
          animate={{
            opacity: isDragTarget ? 1 : 0,
            y: isDragTarget ? 0 : -4,
          }}
        >
          drop to create folder
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default DesktopFileIcon;
