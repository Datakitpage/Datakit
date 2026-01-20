import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DataTableProps {
  data: Record<string, unknown>[];
  columns: string[];
  currentPage: number;
  rowsPerPage: number;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  selectedColumn: string | null;
  onColumnClick: (column: string) => void;
  onColumnDoubleClick: (column: string) => void;
}

// Detect column type from values
function inferColumnType(values: unknown[]): 'number' | 'string' | 'boolean' | 'date' | 'currency' | 'percent' | 'mixed' {
  const nonNull = values.filter(v => v != null).slice(0, 100);
  if (nonNull.length === 0) return 'mixed';

  // Check for currency patterns
  const currencyPattern = /^\$[\d,]+(\.\d{2})?$|^[\d,]+(\.\d{2})?\s*(USD|EUR|GBP)$/;
  if (nonNull.every(v => typeof v === 'string' && currencyPattern.test(v as string))) {
    return 'currency';
  }

  // Check for percent patterns
  const percentPattern = /^[\d.]+%$/;
  if (nonNull.every(v => typeof v === 'string' && percentPattern.test(v as string))) {
    return 'percent';
  }

  const types = new Set(nonNull.map(v => typeof v));

  if (types.size === 1) {
    if (types.has('number')) return 'number';
    if (types.has('boolean')) return 'boolean';
    if (types.has('string')) {
      // Check for date patterns
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}|^\w{3}\s+\d{1,2},?\s+\d{4}/;
      if (nonNull.every(v => datePattern.test(String(v)))) return 'date';
      return 'string';
    }
  }

  return 'mixed';
}

// Column type icons and colors
const typeConfig: Record<string, { icon: string; color: string }> = {
  number: { icon: '#', color: '#3B82F6' },
  string: { icon: 'Aa', color: '#6B7280' },
  boolean: { icon: '◉', color: '#8B5CF6' },
  date: { icon: '◷', color: '#F59E0B' },
  currency: { icon: '$', color: '#10B981' },
  percent: { icon: '%', color: '#EC4899' },
  mixed: { icon: '?', color: '#9CA3AF' },
};

// Format cell value based on type - returns style object for dark mode support
function formatValue(value: unknown, type: string): { display: string; style: React.CSSProperties; className?: string } {
  if (value === null || value === undefined) {
    return { display: 'null', style: { color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: '0.75rem' } };
  }

  switch (type) {
    case 'number':
      if (typeof value === 'number') {
        return {
          display: value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          style: { color: '#3B82F6' },
          className: 'font-mono tabular-nums',
        };
      }
      break;

    case 'currency':
      return {
        display: String(value),
        style: { color: '#10B981' },
        className: 'font-mono tabular-nums',
      };

    case 'percent':
      return {
        display: String(value),
        style: { color: '#EC4899' },
        className: 'font-mono tabular-nums',
      };

    case 'boolean':
      const boolVal = Boolean(value);
      return {
        display: boolVal ? '✓ true' : '✗ false',
        style: { color: boolVal ? '#10B981' : '#EF4444' },
      };

    case 'date':
      try {
        const date = new Date(String(value));
        if (!isNaN(date.getTime())) {
          return {
            display: date.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            style: { color: '#F59E0B' },
          };
        }
      } catch {
        // Fall through to default
      }
      break;
  }

  // Default string handling
  const str = String(value);
  return {
    display: str.length > 50 ? str.slice(0, 50) + '…' : str,
    style: { color: 'var(--text-primary)' },
  };
}

// Expandable cell component
function ExpandableCell({
  value,
  type,
  isExpanded,
  onToggle
}: {
  value: unknown;
  type: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { display, style, className } = formatValue(value, type);
  const fullValue = String(value ?? '');
  const isTruncated = fullValue.length > 50;

  return (
    <div className="relative group">
      <span className={className} style={style}>
        {isExpanded && isTruncated ? fullValue : display}
      </span>

      {isTruncated && !isExpanded && (
        <motion.button
          className="ml-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-tertiary)' }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          whileHover={{ scale: 1.1 }}
        >
          ⋯
        </motion.button>
      )}
    </div>
  );
}

const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 500;

export function DataTable({
  data,
  columns,
  currentPage,
  rowsPerPage,
  sortColumn,
  sortDirection,
  selectedColumn,
  onColumnClick,
  onColumnDoubleClick,
}: DataTableProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get column width
  const getColumnWidth = useCallback((col: string) => {
    return columnWidths[col] || DEFAULT_COLUMN_WIDTH;
  }, [columnWidths]);

  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(col);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = getColumnWidth(col);
  }, [getColumnWidth]);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, resizeStartWidth.current + delta)
      );
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn]);

  // Infer column types
  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    columns.forEach(col => {
      const values = data.map(row => row[col]);
      types[col] = inferColumnType(values);
    });
    return types;
  }, [data, columns]);

  // Toggle cell expansion
  const toggleCellExpand = useCallback((rowIdx: number, col: string) => {
    const key = `${rowIdx}-${col}`;
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Scroll to row helper
  const scrollToRow = useCallback((rowIdx: number) => {
    if (!containerRef.current) return;
    const rowHeight = 40;
    const targetScrollTop = rowIdx * rowHeight;
    containerRef.current.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedCell) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedCell(prev => prev ? {
            ...prev,
            col: Math.min(prev.col + 1, columns.length - 1)
          } : null);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedCell(prev => prev ? {
            ...prev,
            col: Math.max(prev.col - 1, 0)
          } : null);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedCell(prev => {
            if (!prev) return null;
            const newRow = Math.min(prev.row + 1, data.length - 1);
            scrollToRow(newRow);
            return { ...prev, row: newRow };
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedCell(prev => {
            if (!prev) return null;
            const newRow = Math.max(prev.row - 1, 0);
            scrollToRow(newRow);
            return { ...prev, row: newRow };
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedCell) {
            onColumnClick(columns[focusedCell.col]);
          }
          break;
        case 'Escape':
          setFocusedCell(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, columns, data.length, onColumnClick, scrollToRow]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 overflow-auto scrollbar-thin ${resizingColumn ? 'select-none cursor-col-resize' : ''}`}
      style={{ scrollbarColor: 'var(--border-default) transparent' }}
    >
      <table className="text-sm border-collapse" style={{ minWidth: '100%' }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {/* Row number header */}
            <th
              className="px-4 py-3 text-left text-xs font-medium backdrop-blur-sm"
              style={{
                width: 56,
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--surface-secondary)',
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              #
            </th>

            {/* Column headers */}
            {columns.map((col, colIdx) => {
              const colType = columnTypes[col] || 'mixed';
              const config = typeConfig[colType];
              const isSelected = selectedColumn === col;
              const isSorted = sortColumn === col;
              const isHovered = hoveredColumn === col;
              const isResizing = resizingColumn === col;
              const width = getColumnWidth(col);

              return (
                <th
                  key={colIdx}
                  className="relative px-4 py-3 text-left font-medium cursor-pointer backdrop-blur-sm transition-all duration-150"
                  style={{
                    width,
                    minWidth: MIN_COLUMN_WIDTH,
                    maxWidth: MAX_COLUMN_WIDTH,
                    backgroundColor: isSelected
                      ? 'var(--surface-tertiary)'
                      : isHovered
                        ? 'var(--surface-secondary)'
                        : 'var(--surface-secondary)',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                  onClick={() => onColumnClick(col)}
                  onDoubleClick={() => onColumnDoubleClick(col)}
                  onMouseEnter={() => setHoveredColumn(col)}
                  onMouseLeave={() => setHoveredColumn(null)}
                >
                  <div className="flex items-center gap-2">
                    {/* Type badge */}
                    <motion.span
                      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono flex-shrink-0"
                      style={{
                        backgroundColor: `${config.color}15`,
                        color: config.color,
                      }}
                      whileHover={{ scale: 1.1 }}
                    >
                      {config.icon}
                    </motion.span>

                    {/* Column name */}
                    <span
                      className="truncate"
                      style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                      {col}
                    </span>

                    {/* Sort indicator */}
                    <AnimatePresence>
                      {isSorted && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex-shrink-0"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          <motion.span
                            animate={{ y: sortDirection === 'asc' ? [0, -2, 0] : [0, 2, 0] }}
                            transition={{ duration: 0.3 }}
                          >
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </motion.span>
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Click hint on hover */}
                    {isHovered && !isSelected && !isResizing && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[9px] ml-auto"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        click
                      </motion.span>
                    )}
                  </div>

                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors"
                    style={{ backgroundColor: isResizing ? 'var(--primary)' : 'transparent' }}
                    onMouseDown={(e) => handleResizeStart(e, col)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => {
                      if (!isResizing) e.currentTarget.style.backgroundColor = 'var(--primary-muted)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Visual indicator on hover */}
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                      style={{
                        backgroundColor: isResizing ? 'var(--primary)' : 'var(--border-default)',
                        opacity: isResizing ? 1 : 0,
                      }}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {data.map((row, rowIdx) => {
            const absoluteRowIdx = currentPage * rowsPerPage + rowIdx;
            const isHovered = hoveredRow === rowIdx;

            return (
              <motion.tr
                key={rowIdx}
                className="transition-colors"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: isHovered ? 'var(--surface-secondary)' : 'transparent',
                }}
                onMouseEnter={() => setHoveredRow(rowIdx)}
                onMouseLeave={() => setHoveredRow(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(rowIdx * 0.005, 0.15) }}
              >
                {/* Row number */}
                <td
                  className="px-4 py-2.5 text-xs font-mono transition-colors"
                  style={{
                    width: 56,
                    color: isHovered ? 'var(--text-secondary)' : 'var(--text-disabled)',
                    backgroundColor: isHovered ? 'var(--surface-tertiary)' : 'transparent',
                  }}
                >
                  {absoluteRowIdx + 1}
                </td>

                {/* Data cells */}
                {columns.map((col, colIdx) => {
                  const value = row[col];
                  const colType = columnTypes[col] || 'mixed';
                  const isColSelected = selectedColumn === col;
                  const isColHovered = hoveredColumn === col;
                  const isCellFocused = focusedCell?.row === rowIdx && focusedCell?.col === colIdx;
                  const cellKey = `${rowIdx}-${col}`;
                  const isExpanded = expandedCells.has(cellKey);
                  const width = getColumnWidth(col);

                  return (
                    <td
                      key={colIdx}
                      className="px-4 py-2.5 transition-all duration-150 overflow-hidden"
                      style={{
                        width,
                        minWidth: MIN_COLUMN_WIDTH,
                        maxWidth: MAX_COLUMN_WIDTH,
                        backgroundColor: isColSelected
                          ? 'var(--surface-secondary)'
                          : isColHovered
                            ? 'var(--surface-secondary)'
                            : 'transparent',
                        boxShadow: isCellFocused ? 'inset 0 0 0 2px var(--primary)' : 'none',
                      }}
                      onClick={() => setFocusedCell({ row: rowIdx, col: colIdx })}
                    >
                      <ExpandableCell
                        value={value}
                        type={colType}
                        isExpanded={isExpanded}
                        onToggle={() => toggleCellExpand(rowIdx, col)}
                      />
                    </td>
                  );
                })}
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-tertiary)' }}>
          No data to display
        </div>
      )}
    </div>
  );
}

export default DataTable;
