import { useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

export type FileType = 'csv' | 'json' | 'xlsx' | 'txt' | 'md' | 'image' | 'pdf' | 'unknown';

export interface FileNodeData {
  id: string;
  name: string;
  type: FileType;
  size: number;
  position: { x: number; y: number };
  data?: unknown[];
  rawContent?: string;
  imageUrl?: string;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
  processing?: boolean;
  error?: string;
  selected?: boolean;
}

interface FileNodeProps {
  file: FileNodeData;
  onSelect?: (id: string) => void;
  onDrag?: (id: string, position: { x: number; y: number }) => void;
  onStartConnection?: (id: string) => void;
  onCompleteConnection?: (id: string) => void;
  isConnecting?: boolean;
}

// ============================================================================
// File Type Configurations
// ============================================================================

interface FileTypeConfig {
  icon: string;
  label: string;
  color: string;
  bgGradient: string;
  description: string;
}

const fileTypeConfigs: Record<FileType, FileTypeConfig> = {
  csv: {
    icon: '⊞',
    label: 'CSV',
    color: '#10B981',
    bgGradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
    description: 'Tabular data',
  },
  json: {
    icon: '{ }',
    label: 'JSON',
    color: '#F59E0B',
    bgGradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
    description: 'Structured data',
  },
  xlsx: {
    icon: '▦',
    label: 'Excel',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 100%)',
    description: 'Spreadsheet',
  },
  txt: {
    icon: '≡',
    label: 'Text',
    color: '#6B7280',
    bgGradient: 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)',
    description: 'Plain text',
  },
  md: {
    icon: 'M↓',
    label: 'Markdown',
    color: '#6366F1',
    bgGradient: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
    description: 'Formatted text',
  },
  image: {
    icon: '◐',
    label: 'Image',
    color: '#EC4899',
    bgGradient: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)',
    description: 'Visual',
  },
  pdf: {
    icon: '▤',
    label: 'PDF',
    color: '#EF4444',
    bgGradient: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)',
    description: 'Document',
  },
  unknown: {
    icon: '?',
    label: 'File',
    color: '#9CA3AF',
    bgGradient: 'linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%)',
    description: 'Unknown type',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ============================================================================
// Preview Components
// ============================================================================

function CSVPreview({ data, columns }: { data?: unknown[]; columns?: string[] }) {
  if (!data || data.length === 0 || !columns) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xs text-stone-300">No preview</div>
      </div>
    );
  }

  const previewRows = data.slice(0, 3) as Record<string, unknown>[];
  const previewCols = columns.slice(0, 3);

  return (
    <div className="h-full overflow-hidden">
      {/* Mini table */}
      <div className="text-[9px] font-mono leading-tight">
        {/* Header row */}
        <div className="flex gap-px mb-px">
          {previewCols.map((col, i) => (
            <div
              key={i}
              className="flex-1 px-1 py-0.5 bg-emerald-100/50 rounded-sm truncate text-emerald-700 font-medium"
              style={{ maxWidth: 50 }}
            >
              {col}
            </div>
          ))}
          {columns.length > 3 && (
            <div className="px-1 py-0.5 text-emerald-400">+{columns.length - 3}</div>
          )}
        </div>
        {/* Data rows */}
        {previewRows.map((row, i) => (
          <div key={i} className="flex gap-px mb-px opacity-60">
            {previewCols.map((col, j) => (
              <div
                key={j}
                className="flex-1 px-1 py-0.5 bg-white/50 rounded-sm truncate text-stone-500"
                style={{ maxWidth: 50 }}
              >
                {row[col] === null || row[col] === undefined ? '—' : String(row[col]).slice(0, 8)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function JSONPreview({ data }: { data?: unknown[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xs text-stone-300">No preview</div>
      </div>
    );
  }

  const sample = data[0] as Record<string, unknown>;
  const keys = Object.keys(sample).slice(0, 4);

  return (
    <div className="h-full overflow-hidden font-mono text-[9px] leading-tight text-amber-700">
      <div className="text-amber-400">{'{'}</div>
      {keys.map((key, i) => (
        <div key={i} className="pl-2 truncate">
          <span className="text-amber-600">"{key}"</span>
          <span className="text-amber-400">: </span>
          <span className="text-stone-500">
            {typeof sample[key] === 'string' ? `"${String(sample[key]).slice(0, 6)}..."` : String(sample[key]).slice(0, 8)}
          </span>
        </div>
      ))}
      {Object.keys(sample).length > 4 && (
        <div className="pl-2 text-amber-300">... +{Object.keys(sample).length - 4}</div>
      )}
      <div className="text-amber-400">{'}'}</div>
    </div>
  );
}

function TextPreview({ content }: { content?: string }) {
  if (!content) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xs text-stone-300">Empty</div>
      </div>
    );
  }

  const lines = content.split('\n').slice(0, 4);

  return (
    <div className="h-full overflow-hidden font-mono text-[9px] leading-tight text-stone-500">
      {lines.map((line, i) => (
        <div key={i} className="truncate opacity-70">
          {line || ' '}
        </div>
      ))}
      {content.split('\n').length > 4 && (
        <div className="text-stone-300">...</div>
      )}
    </div>
  );
}

function ImagePreview({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100 rounded">
        <span className="text-pink-300 text-2xl">◐</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded overflow-hidden">
      <img src={url} alt="Preview" className="w-full h-full object-cover" />
    </div>
  );
}

// ============================================================================
// Main FileNode Component
// ============================================================================

export function FileNode({
  file,
  onSelect,
  onDrag,
  onStartConnection,
  onCompleteConnection,
  isConnecting,
}: FileNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const config = fileTypeConfigs[file.type] || fileTypeConfigs.unknown;

  // Physics springs
  const springConfig = { stiffness: 400, damping: 35 };
  const x = useSpring(file.position.x, springConfig);
  const y = useSpring(file.position.y, springConfig);

  // Dynamic shadow based on state
  const baseShadowDepth = Math.min(16, 6 + Math.log10(file.size + 1) * 2);
  const shadowDepth = useSpring(baseShadowDepth, springConfig);
  const shadowY = useSpring(baseShadowDepth / 3, springConfig);

  // Breathing animation for processing
  const [breathScale, setBreatheScale] = useState(1);
  useEffect(() => {
    if (file.processing) {
      const interval = setInterval(() => {
        setBreatheScale(prev => (prev === 1 ? 1.015 : 1));
      }, 600);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when not processing
    setBreatheScale(1);
  }, [file.processing]);

  // Update position springs
  useEffect(() => {
    x.set(file.position.x);
    y.set(file.position.y);
  }, [file.position.x, file.position.y, x, y]);

  // Drag handlers
  const handleDragStart = () => {
    setIsDragging(true);
    shadowDepth.set(baseShadowDepth * 2);
    shadowY.set(baseShadowDepth);
  };

  const handleDragEnd = (_: unknown, info: { point: { x: number; y: number } }) => {
    setIsDragging(false);
    shadowDepth.set(baseShadowDepth);
    shadowY.set(baseShadowDepth / 3);

    const rect = nodeRef.current?.parentElement?.getBoundingClientRect();
    if (rect) {
      onDrag?.(file.id, {
        x: info.point.x - rect.left - 90,
        y: info.point.y - rect.top - 60,
      });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      onCompleteConnection?.(file.id);
    } else {
      onSelect?.(file.id);
    }
  };

  const handleConnectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConnecting) {
      onStartConnection?.(file.id);
    }
  };

  // Render type-specific preview
  const renderPreview = () => {
    switch (file.type) {
      case 'csv':
      case 'xlsx':
        return <CSVPreview data={file.data} columns={file.columns} />;
      case 'json':
        return <JSONPreview data={file.data} />;
      case 'txt':
      case 'md':
        return <TextPreview content={file.rawContent} />;
      case 'image':
        return <ImagePreview url={file.imageUrl} />;
      default:
        return (
          <div className="h-full flex items-center justify-center">
            <span className="text-3xl opacity-20">{config.icon}</span>
          </div>
        );
    }
  };

  return (
    <motion.div
      ref={nodeRef}
      className="absolute"
      style={{ x, y }}
      drag
      dragMomentum
      dragElastic={0.05}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => {
        setIsHovered(true);
        setShowActions(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setTimeout(() => setShowActions(false), 200);
      }}
      onClick={handleClick}
      whileTap={{ scale: 0.98 }}
    >
      {/* Shadow layer */}
      <motion.div
        className="absolute rounded-2xl pointer-events-none"
        style={{
          inset: -4,
          backgroundColor: 'rgba(0, 0, 0, 0.06)',
          filter: useTransform(shadowDepth, v => `blur(${v}px)`),
          y: shadowY,
        }}
      />

      {/* Main card */}
      <motion.div
        className="relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          width: 180,
          height: 120,
          background: config.bgGradient,
          border: file.selected
            ? `2px solid ${config.color}`
            : '1px solid rgba(255,255,255,0.8)',
          boxShadow: file.selected
            ? `0 0 0 3px ${config.color}20, inset 0 1px 0 rgba(255,255,255,0.5)`
            : 'inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
        animate={{
          scale: breathScale,
          y: isDragging ? -6 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: config.color }}
        />

        {/* Content area */}
        <div className="p-3 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            {/* File icon and type badge */}
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm leading-none"
                style={{ color: config.color }}
              >
                {config.icon}
              </span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${config.color}15`,
                  color: config.color,
                }}
              >
                {config.label}
              </span>
            </div>

            {/* Size badge */}
            <span className="text-[10px] text-stone-400">
              {formatSize(file.size)}
            </span>
          </div>

          {/* File name */}
          <p
            className="text-sm font-medium text-stone-800 truncate mb-2"
            title={file.name}
          >
            {file.name}
          </p>

          {/* Preview area */}
          <div className="flex-1 min-h-0 rounded-lg bg-white/40 p-1.5 overflow-hidden">
            {file.processing ? (
              <div className="h-full flex items-center justify-center">
                <motion.div
                  className="w-4 h-4 rounded-full border-2"
                  style={{ borderColor: config.color, borderTopColor: 'transparent' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            ) : (
              renderPreview()
            )}
          </div>

          {/* Metadata row */}
          {(file.rowCount || file.columnCount) && (
            <div className="flex gap-2 mt-1.5 text-[10px] text-stone-500">
              {file.rowCount && <span>{formatNumber(file.rowCount)} rows</span>}
              {file.columnCount && <span>{file.columnCount} cols</span>}
            </div>
          )}
        </div>

        {/* Error overlay */}
        <AnimatePresence>
          {file.error && (
            <motion.div
              className="absolute inset-0 bg-red-500/10 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-white rounded-lg px-3 py-2 shadow-lg">
                <p className="text-xs text-red-600">{file.error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing bar */}
        {file.processing && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <motion.div
              className="h-full w-1/3"
              style={{ backgroundColor: config.color }}
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </motion.div>

      {/* Connection point (right side) */}
      <motion.button
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white flex items-center justify-center"
        style={{
          border: `2px solid ${config.color}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
        animate={{
          scale: isHovered || isConnecting ? 1.15 : 0.9,
          opacity: isHovered || isConnecting ? 1 : 0.6,
        }}
        whileHover={{ scale: 1.25 }}
        whileTap={{ scale: 1.1 }}
        onClick={handleConnectionClick}
      >
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: config.color }}
          animate={{
            scale: isConnecting ? [1, 1.3, 1] : 1,
          }}
          transition={{
            duration: 0.8,
            repeat: isConnecting ? Infinity : 0,
          }}
        />
      </motion.button>

      {/* Input connection point (left side) - only show when connecting */}
      <AnimatePresence>
        {isConnecting && (
          <motion.div
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white flex items-center justify-center"
            style={{
              border: `2px solid ${config.color}`,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: `${config.color}40` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover actions */}
      <AnimatePresence>
        {showActions && !isDragging && !isConnecting && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-lg shadow-lg px-2 py-1"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
          >
            <button
              className="text-xs px-2 py-0.5 rounded hover:bg-stone-100 text-stone-600"
              onClick={(e) => {
                e.stopPropagation();
                // Preview action
              }}
            >
              Preview
            </button>
            <button
              className="text-xs px-2 py-0.5 rounded hover:bg-stone-100 text-stone-600"
              onClick={(e) => {
                e.stopPropagation();
                onStartConnection?.(file.id);
              }}
            >
              Connect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
