import { useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import { ConnectionPort } from './ConnectionPort';

export type TransformType =
  | 'filter'
  | 'map'
  | 'aggregate'
  | 'sort'
  | 'join'
  | 'prompt'
  | 'sql'
  | 'chart';

export interface TransformNodeData {
  id: string;
  type: TransformType;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
  inputIds: string[];
  outputData?: unknown[];
  processing?: boolean;
  error?: string;
}

interface TransformNodeProps {
  node: TransformNodeData;
  onSelect?: (id: string) => void;
  onDrag?: (id: string, position: { x: number; y: number }) => void;
  onConfigure?: (id: string) => void;
  onConnectionComplete?: (fromId: string, toId: string) => void;
  isSelected?: boolean;
}

const nodeStyles: Record<TransformType, {
  icon: string;
  label: string;
  color: string;
  description: string;
}> = {
  filter: {
    icon: '⊘',
    label: 'Filter',
    color: '#8B5CF6',
    description: 'Keep matching rows',
  },
  map: {
    icon: '↦',
    label: 'Transform',
    color: '#EC4899',
    description: 'Modify each row',
  },
  aggregate: {
    icon: 'Σ',
    label: 'Aggregate',
    color: '#06B6D4',
    description: 'Sum, count, average',
  },
  sort: {
    icon: '↕',
    label: 'Sort',
    color: '#10B981',
    description: 'Order by column',
  },
  join: {
    icon: '⋈',
    label: 'Join',
    color: '#F59E0B',
    description: 'Combine datasets',
  },
  prompt: {
    icon: '✦',
    label: 'AI',
    color: '#6366F1',
    description: 'Ask Claude',
  },
  sql: {
    icon: '◇',
    label: 'SQL',
    color: '#0EA5E9',
    description: 'Query with SQL',
  },
  chart: {
    icon: '◔',
    label: 'Visualize',
    color: '#F97316',
    description: 'Create a chart',
  },
};

export function TransformNode({
  node,
  onSelect,
  onDrag,
  onConfigure,
  onConnectionComplete,
  isSelected,
}: TransformNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const style = nodeStyles[node.type];
  const springConfig = { stiffness: 300, damping: 30 };
  const x = useSpring(node.position.x, springConfig);
  const y = useSpring(node.position.y, springConfig);

  const handleDragEnd = (_: never, info: { point: { x: number; y: number } }) => {
    setIsDragging(false);
    onDrag?.(node.id, { x: info.point.x - 60, y: info.point.y - 30 });
  };

  return (
    <motion.div
      className="absolute cursor-grab active:cursor-grabbing"
      style={{ x, y }}
      drag
      dragMomentum
      dragElastic={0.1}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onConfigure?.(node.id);
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Shadow */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.06)' }}
        animate={{
          filter: `blur(${isDragging ? 12 : 8}px)`,
          y: isDragging ? 8 : 4,
          scale: 1.02,
        }}
      />

      {/* Main card */}
      <motion.div
        className="relative rounded-xl overflow-hidden bg-white"
        style={{
          width: 120,
          minHeight: 60,
          border: isSelected ? `2px solid ${style.color}` : '1px solid rgba(0,0,0,0.06)',
        }}
        animate={{
          y: isDragging ? -4 : 0,
          boxShadow: isSelected
            ? `0 0 0 3px ${style.color}20`
            : 'none',
        }}
      >
        {/* Accent line */}
        <div className="h-0.5" style={{ backgroundColor: style.color }} />

        {/* Content */}
        <div className="p-3 flex items-center gap-2">
          {/* Icon */}
          <motion.div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{
              backgroundColor: `${style.color}10`,
              color: style.color,
            }}
            animate={{
              scale: node.processing ? [1, 1.1, 1] : 1,
            }}
            transition={{
              duration: 0.8,
              repeat: node.processing ? Infinity : 0,
            }}
          >
            {style.icon}
          </motion.div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800">{style.label}</p>
            <p className="text-xs text-stone-400 truncate">{style.description}</p>
          </div>
        </div>

        {/* Error indicator */}
        {node.error && (
          <div className="px-3 pb-2">
            <p className="text-xs text-red-500 truncate">{node.error}</p>
          </div>
        )}

        {/* Processing bar */}
        {node.processing && (
          <div className="h-0.5 bg-stone-100 overflow-hidden">
            <motion.div
              className="h-full"
              style={{ backgroundColor: style.color }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}

        {/* Input port (left side) */}
        <ConnectionPort
          nodeId={node.id}
          type="input"
          color={style.color}
          position="left"
          onConnectionComplete={onConnectionComplete}
          isNodeHovered={isHovered}
          isNodeSelected={isSelected}
        />

        {/* Output port (right side) */}
        <ConnectionPort
          nodeId={node.id}
          type="output"
          color={style.color}
          position="right"
          onConnectionComplete={onConnectionComplete}
          isNodeHovered={isHovered}
          isNodeSelected={isSelected}
        />
      </motion.div>
    </motion.div>
  );
}

// Quick add palette for transform nodes
interface TransformPaletteProps {
  position: { x: number; y: number };
  onSelect: (type: TransformType) => void;
  onClose: () => void;
}

export function TransformPalette({ position, onSelect, onClose }: TransformPaletteProps) {
  const transforms: TransformType[] = ['filter', 'map', 'aggregate', 'sort', 'join', 'prompt', 'sql', 'chart'];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Palette */}
      <motion.div
        className="absolute z-50 bg-white rounded-xl shadow-xl overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          border: '1px solid rgba(0,0,0,0.06)',
        }}
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="p-2 grid grid-cols-4 gap-1">
          {transforms.map(type => {
            const style = nodeStyles[type];
            return (
              <motion.button
                key={type}
                className="flex flex-col items-center gap-1 p-2 rounded-lg"
                style={{ backgroundColor: 'transparent' }}
                whileHover={{ backgroundColor: `${style.color}10` }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(type)}
              >
                <span
                  className="text-lg"
                  style={{ color: style.color }}
                >
                  {style.icon}
                </span>
                <span className="text-xs text-stone-600">{style.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
