import { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export interface FileObjectData {
  id: string;
  name: string;
  type: 'csv' | 'json' | 'xlsx' | 'txt' | 'unknown';
  size: number; // bytes
  position: { x: number; y: number };
  data?: unknown[];
  rowCount?: number;
  columnCount?: number;
  processing?: boolean;
  selected?: boolean;
}

interface FileObjectProps {
  file: FileObjectData;
  onSelect?: (id: string) => void;
  onDrag?: (id: string, position: { x: number; y: number }) => void;
  onConnect?: (id: string) => void;
  isConnecting?: boolean;
}

const fileTypeColors: Record<string, { bg: string; accent: string; icon: string }> = {
  csv: { bg: '#F0FDF4', accent: '#22C55E', icon: '⊞' },
  json: { bg: '#FFF7ED', accent: '#F97316', icon: '{ }' },
  xlsx: { bg: '#EFF6FF', accent: '#3B82F6', icon: '▦' },
  txt: { bg: '#F5F5F4', accent: '#78716C', icon: '≡' },
  unknown: { bg: '#FAFAFA', accent: '#A1A1AA', icon: '?' },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileObject({ file, onSelect, onDrag, onConnect, isConnecting }: FileObjectProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const colors = fileTypeColors[file.type] || fileTypeColors.unknown;

  // Physics-based spring for position
  const springConfig = { stiffness: 300, damping: 30 };
  const x = useSpring(file.position.x, springConfig);
  const y = useSpring(file.position.y, springConfig);

  // Shadow depth based on file size (bigger files cast bigger shadows)
  const shadowDepth = Math.min(20, 8 + Math.log10(file.size + 1) * 2);
  const shadowBlur = useSpring(shadowDepth, springConfig);
  const shadowY = useSpring(shadowDepth / 2, springConfig);

  // Breathing animation for processing files
  const [breathe, setBreathe] = useState(1);
  useEffect(() => {
    if (file.processing) {
      const interval = setInterval(() => {
        setBreathe(prev => (prev === 1 ? 1.02 : 1));
      }, 800);
      return () => clearInterval(interval);
    }
    setBreathe(1);
  }, [file.processing]);

  // Update position when file position changes
  useEffect(() => {
    x.set(file.position.x);
    y.set(file.position.y);
  }, [file.position.x, file.position.y, x, y]);

  const handleDragStart = () => {
    setIsDragging(true);
    shadowBlur.set(shadowDepth * 1.5);
    shadowY.set(shadowDepth);
  };

  const handleDragEnd = (_: never, info: { point: { x: number; y: number } }) => {
    setIsDragging(false);
    shadowBlur.set(shadowDepth);
    shadowY.set(shadowDepth / 2);
    onDrag?.(file.id, { x: info.point.x - 80, y: info.point.y - 40 });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      onConnect?.(file.id);
    } else {
      onSelect?.(file.id);
    }
  };

  return (
    <motion.div
      className="absolute cursor-grab active:cursor-grabbing"
      style={{ x, y }}
      drag
      dragMomentum
      dragElastic={0.1}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      whileTap={{ scale: 0.98 }}
    >
      {/* Shadow layer */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
          filter: useTransform(shadowBlur, v => `blur(${v}px)`),
          y: shadowY,
          scale: 1.02,
        }}
      />

      {/* Main card */}
      <motion.div
        className="relative rounded-xl overflow-hidden"
        style={{
          width: 160,
          minHeight: 80,
          backgroundColor: colors.bg,
          border: file.selected ? `2px solid ${colors.accent}` : '1px solid rgba(0,0,0,0.06)',
        }}
        animate={{
          scale: breathe,
          y: isDragging ? -4 : 0,
        }}
        transition={{ duration: 0.4 }}
      >
        {/* Accent bar */}
        <div
          className="h-1"
          style={{ backgroundColor: colors.accent }}
        />

        {/* Content */}
        <div className="p-3">
          {/* File icon and name */}
          <div className="flex items-start gap-2">
            <span
              className="text-sm font-mono leading-none"
              style={{ color: colors.accent }}
            >
              {colors.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: '#1A1A1A' }}
                title={file.name}
              >
                {file.name}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                {formatSize(file.size)}
              </p>
            </div>
          </div>

          {/* Data preview info */}
          {(file.rowCount || file.columnCount) && (
            <div className="flex gap-3 mt-2 text-xs text-stone-500">
              {file.rowCount && (
                <span>{file.rowCount.toLocaleString()} rows</span>
              )}
              {file.columnCount && (
                <span>{file.columnCount} cols</span>
              )}
            </div>
          )}

          {/* Processing indicator */}
          {file.processing && (
            <motion.div
              className="mt-2 h-0.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: colors.accent }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </div>

        {/* Connection point */}
        <motion.div
          className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white"
          style={{ borderColor: colors.accent }}
          animate={{
            scale: isHovered || isConnecting ? 1.2 : 1,
            opacity: isHovered || isConnecting ? 1 : 0.5,
          }}
        />
      </motion.div>
    </motion.div>
  );
}
