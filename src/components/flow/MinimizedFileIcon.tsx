import { motion } from 'framer-motion';
import type { ContentNodeData, ContentType } from './ContentNode';

interface MinimizedFileIconProps {
  file: ContentNodeData;
  onClick: () => void;
  hasConnections?: boolean;
  index?: number;
}

// Type configurations
const typeConfigs: Record<ContentType, { icon: string; color: string; bg: string }> = {
  csv: { icon: '⊞', color: '#10B981', bg: '#ECFDF5' },
  json: { icon: '{ }', color: '#F59E0B', bg: '#FFFBEB' },
  xlsx: { icon: '▦', color: '#059669', bg: '#ECFDF5' },
  parquet: { icon: '⬡', color: '#8B5CF6', bg: '#F5F3FF' },
  txt: { icon: '≡', color: '#6B7280', bg: '#F9FAFB' },
  md: { icon: 'M↓', color: '#6366F1', bg: '#EEF2FF' },
  image: { icon: '◐', color: '#EC4899', bg: '#FDF2F8' },
  pdf: { icon: '▤', color: '#EF4444', bg: '#FEF2F2' },
  gsheet: { icon: '⊞', color: '#0F9D58', bg: '#E8F5E9' },
  unknown: { icon: '?', color: '#9CA3AF', bg: '#F9FAFB' },
};

/**
 * MinimizedFileIcon - Compact representation of a non-focused file
 *
 * Shown in the left rail when another file is focused.
 * Click to switch focus to this file.
 */
export function MinimizedFileIcon({
  file,
  onClick,
  hasConnections,
  index = 0,
}: MinimizedFileIconProps) {
  const config = typeConfigs[file.type];

  // Format row count
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <motion.button
      className="relative flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors group"
      style={{ backgroundColor: 'transparent' }}
      onClick={onClick}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.8 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ backgroundColor: config.bg, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Icon container */}
      <div
        className="relative w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm"
        style={{
          backgroundColor: config.bg,
          color: config.color,
          border: `1px solid ${config.color}20`,
        }}
      >
        {config.icon}

        {/* Processing indicator */}
        {file.processing && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{ border: `2px solid ${config.color}` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* Connection indicator */}
        {hasConnections && (
          <div
            className="absolute -right-1 -top-1 w-3 h-3 rounded-full border-2 border-white"
            style={{ backgroundColor: config.color }}
          />
        )}
      </div>

      {/* File name */}
      <span
        className="text-[10px] font-medium text-stone-600 max-w-[56px] truncate text-center leading-tight"
        title={file.name}
      >
        {file.name.replace(/\.[^.]+$/, '')}
      </span>

      {/* Row count badge (for data files) */}
      {file.rowCount && file.rowCount > 0 && (
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `${config.color}15`,
            color: config.color,
          }}
        >
          {formatCount(file.rowCount)}
        </span>
      )}

      {/* Hover tooltip */}
      <motion.div
        className="absolute left-full ml-2 px-2 py-1 bg-stone-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none z-50"
        initial={false}
        animate={{ opacity: 0, x: -5 }}
        whileHover={{ opacity: 1, x: 0 }}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        {file.name}
        {file.rowCount && ` · ${file.rowCount.toLocaleString()} rows`}
      </motion.div>
    </motion.button>
  );
}

/**
 * FileIconRail - Container for minimized file icons
 */
interface FileIconRailProps {
  files: ContentNodeData[];
  focusedFileId: string | null;
  onFileClick: (id: string) => void;
  connections?: { fromId: string; toId: string }[];
}

export function FileIconRail({
  files,
  focusedFileId,
  onFileClick,
  connections = [],
}: FileIconRailProps) {
  // Filter out the focused file
  const minimizedFiles = files.filter(f => f.id !== focusedFileId);

  if (minimizedFiles.length === 0) return null;

  // Check which files have connections
  const filesWithConnections = new Set(
    connections.flatMap(c => [c.fromId, c.toId])
  );

  return (
    <motion.div
      className="fixed left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 p-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-stone-100"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Rail header */}
      <div className="px-2 py-1 text-[10px] font-medium text-stone-400 uppercase tracking-wider text-center">
        Files
      </div>

      {/* Minimized files */}
      {minimizedFiles.map((file, index) => (
        <MinimizedFileIcon
          key={file.id}
          file={file}
          onClick={() => onFileClick(file.id)}
          hasConnections={filesWithConnections.has(file.id)}
          index={index}
        />
      ))}

      {/* Keyboard hint */}
      <div className="px-2 py-1 text-[9px] text-stone-300 text-center">
        Click to open
      </div>
    </motion.div>
  );
}

export default MinimizedFileIcon;
