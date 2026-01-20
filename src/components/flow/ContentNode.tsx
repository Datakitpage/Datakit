import { useState, useEffect, useRef } from 'react';
import { motion, useSpring, AnimatePresence } from 'framer-motion';
import { ConnectionPort } from './ConnectionPort';

// ============================================================================
// Types
// ============================================================================

export type ContentType = 'csv' | 'json' | 'xlsx' | 'parquet' | 'txt' | 'md' | 'image' | 'pdf' | 'unknown';

export interface ContentNodeData {
  id: string;
  name: string;
  type: ContentType;
  size: number;
  position: { x: number; y: number };
  dimensions?: { width: number; height: number };
  data?: unknown[];
  rawContent?: string;
  imageUrl?: string;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
  processing?: boolean;
  error?: string;
  selected?: boolean;
  collapsed?: boolean;
  file?: File; // Original file for binary formats like parquet that need DuckDB
}

interface ContentNodeProps {
  node: ContentNodeData;
  onSelect?: (id: string) => void;
  onDrag?: (id: string, position: { x: number; y: number }) => void;
  onResize?: (id: string, dimensions: { width: number; height: number }) => void;
  onToggleCollapse?: (id: string) => void;
  onConnectionComplete?: (fromId: string, toId: string) => void;
}

// ============================================================================
// Type Configurations
// ============================================================================

interface TypeConfig {
  icon: string;
  label: string;
  color: string;
  headerBg: string;
}

const typeConfigs: Record<ContentType, TypeConfig> = {
  csv: { icon: '⊞', label: 'CSV', color: '#10B981', headerBg: 'rgba(16, 185, 129, 0.08)' },
  json: { icon: '{ }', label: 'JSON', color: '#F59E0B', headerBg: 'rgba(245, 158, 11, 0.08)' },
  xlsx: { icon: '▦', label: 'Excel', color: '#059669', headerBg: 'rgba(5, 150, 105, 0.08)' },
  parquet: { icon: '⬡', label: 'Parquet', color: '#8B5CF6', headerBg: 'rgba(139, 92, 246, 0.08)' },
  txt: { icon: '≡', label: 'Text', color: '#6B7280', headerBg: 'rgba(107, 114, 128, 0.08)' },
  md: { icon: 'M↓', label: 'Markdown', color: '#6366F1', headerBg: 'rgba(99, 102, 241, 0.08)' },
  image: { icon: '◐', label: 'Image', color: '#EC4899', headerBg: 'rgba(236, 72, 153, 0.08)' },
  pdf: { icon: '▤', label: 'PDF', color: '#EF4444', headerBg: 'rgba(239, 68, 68, 0.08)' },
  unknown: { icon: '?', label: 'File', color: '#9CA3AF', headerBg: 'rgba(156, 163, 175, 0.08)' },
};

// ============================================================================
// Table View Component (for CSV/JSON)
// ============================================================================

function TableView({
  data,
  columns,
  maxRows = 10,
}: {
  data: Record<string, unknown>[];
  columns: string[];
  maxRows?: number;
}) {
  const displayData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  return (
    <div className="w-full overflow-hidden">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-medium text-stone-600 bg-stone-50/80 border-b border-stone-100 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, rowIdx) => (
            <motion.tr
              key={rowIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: rowIdx * 0.02 }}
              className="hover:bg-stone-50/50 transition-colors"
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className="px-3 py-1.5 text-stone-700 border-b border-stone-50 whitespace-nowrap"
                >
                  {row[col] === null || row[col] === undefined ? (
                    <span className="text-stone-300 italic">null</span>
                  ) : typeof row[col] === 'number' ? (
                    <span className="font-mono text-blue-600">
                      {(row[col] as number).toLocaleString()}
                    </span>
                  ) : (
                    String(row[col]).slice(0, 50)
                  )}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>

      {hasMore && (
        <div className="px-3 py-2 text-xs text-stone-400 bg-stone-50/50 border-t border-stone-100">
          +{(data.length - maxRows).toLocaleString()} more rows
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Image View Component
// ============================================================================

function ImageView({ url, name }: { url: string; name: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full h-full min-h-[120px] bg-stone-50 flex items-center justify-center">
      {!loaded && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-6 h-6 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
        </motion.div>
      )}
      <motion.img
        src={url}
        alt={name}
        className="max-w-full max-h-[300px] object-contain rounded"
        onLoad={() => setLoaded(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

// ============================================================================
// Text View Component
// ============================================================================

function TextView({ content, maxLines = 10 }: { content: string; maxLines?: number }) {
  const lines = content.split('\n');
  const displayLines = lines.slice(0, maxLines);
  const hasMore = lines.length > maxLines;

  return (
    <div className="w-full font-mono text-xs">
      <pre className="p-3 text-stone-600 whitespace-pre-wrap overflow-x-auto">
        {displayLines.join('\n')}
        {hasMore && (
          <span className="text-stone-300">
            {'\n'}... +{lines.length - maxLines} more lines
          </span>
        )}
      </pre>
    </div>
  );
}

// ============================================================================
// JSON View Component
// ============================================================================

function JSONView({ data }: { data: unknown[] }) {
  const sample = data.slice(0, 2);

  return (
    <div className="w-full font-mono text-xs p-3">
      <pre className="text-stone-600 overflow-x-auto">
        <span className="text-amber-600">[</span>
        {sample.map((item, i) => (
          <div key={i} className="pl-2">
            {JSON.stringify(item, null, 2)
              .split('\n')
              .map((line, j) => (
                <div key={j} className="whitespace-pre">
                  {line
                    .replace(/"([^"]+)":/g, '<key>"$1"</key>:')
                    .replace(/"([^"]+)"/g, '<str>"$1"</str>')
                    .replace(/(\d+)/g, '<num>$1</num>')
                    .split(/(<[^>]+>[^<]*<\/[^>]+>)/)
                    .map((part, k) => {
                      if (part.startsWith('<key>')) {
                        return <span key={k} className="text-purple-600">{part.replace(/<\/?key>/g, '')}</span>;
                      } else if (part.startsWith('<str>')) {
                        return <span key={k} className="text-green-600">{part.replace(/<\/?str>/g, '')}</span>;
                      } else if (part.startsWith('<num>')) {
                        return <span key={k} className="text-blue-600">{part.replace(/<\/?num>/g, '')}</span>;
                      }
                      return part;
                    })}
                </div>
              ))}
            {i < sample.length - 1 && <span className="text-stone-400">,</span>}
          </div>
        ))}
        {data.length > 2 && (
          <div className="text-stone-400 pl-2">... +{data.length - 2} more items</div>
        )}
        <span className="text-amber-600">]</span>
      </pre>
    </div>
  );
}

// ============================================================================
// Main ContentNode Component
// ============================================================================

export function ContentNode({
  node,
  onSelect,
  onDrag,
  onToggleCollapse,
  onConnectionComplete,
}: ContentNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const config = typeConfigs[node.type];

  // Physics
  const springConfig = { stiffness: 400, damping: 35 };
  const x = useSpring(node.position.x, springConfig);
  const y = useSpring(node.position.y, springConfig);

  useEffect(() => {
    x.set(node.position.x);
    y.set(node.position.y);
  }, [node.position.x, node.position.y, x, y]);

  const handleDragEnd = (_: unknown, info: { point: { x: number; y: number } }) => {
    setIsDragging(false);
    const rect = nodeRef.current?.parentElement?.getBoundingClientRect();
    if (rect) {
      onDrag?.(node.id, {
        x: info.point.x - rect.left - 20,
        y: info.point.y - rect.top - 20,
      });
    }
  };

  // Default dimensions based on content type
  const getDefaultWidth = () => {
    if (node.dimensions?.width) return node.dimensions.width;
    switch (node.type) {
      case 'csv':
      case 'xlsx':
      case 'json':
        return Math.min(600, Math.max(300, (node.columns?.length || 3) * 100));
      case 'image':
        return 320;
      default:
        return 300;
    }
  };

  const width = getDefaultWidth();

  // Render content based on type
  const renderContent = () => {
    if (node.processing) {
      return (
        <div className="flex items-center justify-center py-8">
          <motion.div
            className="w-6 h-6 border-2 rounded-full"
            style={{ borderColor: config.color, borderTopColor: 'transparent' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      );
    }

    if (node.collapsed) {
      return (
        <div className="px-4 py-3 text-xs text-stone-400">
          {node.rowCount && `${node.rowCount.toLocaleString()} rows`}
          {node.columnCount && ` · ${node.columnCount} columns`}
          {node.type === 'image' && 'Image collapsed'}
          {node.type === 'txt' && 'Text collapsed'}
        </div>
      );
    }

    switch (node.type) {
      case 'csv':
      case 'xlsx':
        if (node.data && node.columns) {
          return (
            <TableView
              data={node.data as Record<string, unknown>[]}
              columns={node.columns}
            />
          );
        }
        break;
      case 'json':
        if (node.data) {
          // If it's array of objects with consistent keys, show as table
          const firstItem = node.data[0];
          if (firstItem && typeof firstItem === 'object' && node.columns?.length) {
            return (
              <TableView
                data={node.data as Record<string, unknown>[]}
                columns={node.columns}
              />
            );
          }
          return <JSONView data={node.data} />;
        }
        break;
      case 'image':
        if (node.imageUrl) {
          return <ImageView url={node.imageUrl} name={node.name} />;
        }
        break;
      case 'txt':
      case 'md':
        if (node.rawContent) {
          return <TextView content={node.rawContent} />;
        }
        break;
    }

    return (
      <div className="flex items-center justify-center py-8 text-stone-300">
        <span className="text-3xl">{config.icon}</span>
      </div>
    );
  };

  return (
    <motion.div
      ref={nodeRef}
      className="absolute"
      style={{ x, y }}
      drag
      dragMomentum
      dragElastic={0.05}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(node.id);
      }}
    >
      {/* Shadow */}
      <motion.div
        className="absolute rounded-xl pointer-events-none"
        style={{
          inset: -6,
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          filter: 'blur(12px)',
        }}
        animate={{
          y: isDragging ? 12 : 6,
          opacity: isDragging ? 0.12 : 0.08,
        }}
      />

      {/* Main container */}
      <motion.div
        className="relative rounded-xl overflow-hidden bg-white cursor-grab active:cursor-grabbing"
        style={{
          width,
          maxHeight: node.collapsed ? 'auto' : 400,
          border: node.selected
            ? `2px solid ${config.color}`
            : '1px solid rgba(0,0,0,0.08)',
          boxShadow: node.selected
            ? `0 0 0 3px ${config.color}20`
            : '0 1px 3px rgba(0,0,0,0.05)',
        }}
        animate={{
          y: isDragging ? -4 : 0,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-stone-100"
          style={{ backgroundColor: config.headerBg }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ color: config.color }}>{config.icon}</span>
            <span className="text-sm font-medium text-stone-700 truncate">
              {node.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Collapse button */}
            <motion.button
              className="w-6 h-6 rounded flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse?.(node.id);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {node.collapsed ? '◇' : '◆'}
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={node.collapsed ? 'collapsed' : 'expanded'}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-auto"
            style={{ maxHeight: node.collapsed ? 'auto' : 350 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        {/* Error state */}
        {node.error && (
          <div className="px-3 py-2 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-600">{node.error}</p>
          </div>
        )}

        {/* Output port (right side) - drag from here to connect */}
        <ConnectionPort
          nodeId={node.id}
          type="output"
          color={config.color}
          position="right"
          onConnectionComplete={onConnectionComplete}
          isNodeHovered={isHovered}
          isNodeSelected={node.selected}
        />

        {/* Input port (left side) - drop connections here */}
        <ConnectionPort
          nodeId={node.id}
          type="input"
          color={config.color}
          position="left"
          onConnectionComplete={onConnectionComplete}
          isNodeHovered={isHovered}
          isNodeSelected={node.selected}
        />
      </motion.div>
    </motion.div>
  );
}
