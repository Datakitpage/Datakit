import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ColumnSchema, ChangeRecord } from '@/store/duckDBViewStore';

// Type configuration for column display
const typeConfig: Record<string, { icon: string; color: string }> = {
  BIGINT: { icon: '#', color: '#3B82F6' },
  INTEGER: { icon: '#', color: '#3B82F6' },
  DOUBLE: { icon: '#', color: '#3B82F6' },
  FLOAT: { icon: '#', color: '#3B82F6' },
  VARCHAR: { icon: 'Aa', color: '#6B7280' },
  TEXT: { icon: 'Aa', color: '#6B7280' },
  BOOLEAN: { icon: '◉', color: '#8B5CF6' },
  DATE: { icon: '◷', color: '#F59E0B' },
  TIMESTAMP: { icon: '◷', color: '#F59E0B' },
  JSON: { icon: '{}', color: '#10B981' },
};

interface VirtualDataTableProps {
  data: Record<string, unknown>[];
  columns: ColumnSchema[];
  totalRows: number;
  currentPage: number;
  pageSize: number;
  totalPages?: number; // Optional - can be calculated from totalRows/pageSize
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  selectedColumn?: string;
  pendingChanges?: ChangeRecord[];
  isLoading?: boolean;

  // Callbacks
  onColumnClick?: (column: string) => void;
  onColumnDoubleClick?: (column: string) => void;
  onCellEdit?: (rowId: number, column: string, value: unknown) => void;
  onCellClick?: (rowId: number, column: string, value: unknown) => void;
  onRowDelete?: (rowId: number) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSort?: (column: string) => void;
}

// Format cell value for display
function formatValue(value: unknown, type: string): { display: string; style: React.CSSProperties } {
  if (value === null || value === undefined) {
    return {
      display: 'null',
      style: { color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: '0.75rem' },
    };
  }

  const normalizedType = type.toUpperCase();

  // Numbers
  if (['BIGINT', 'INTEGER', 'DOUBLE', 'FLOAT', 'DECIMAL'].some(t => normalizedType.includes(t))) {
    const num = Number(value);
    if (!isNaN(num)) {
      return {
        display: num.toLocaleString(undefined, { maximumFractionDigits: 4 }),
        style: { color: '#3B82F6', fontFamily: 'monospace' },
      };
    }
  }

  // Booleans
  if (normalizedType === 'BOOLEAN' || typeof value === 'boolean') {
    const bool = Boolean(value);
    return {
      display: bool ? '✓ true' : '✗ false',
      style: { color: bool ? '#10B981' : '#EF4444' },
    };
  }

  // Dates
  if (normalizedType.includes('DATE') || normalizedType.includes('TIMESTAMP')) {
    try {
      const date = new Date(String(value));
      if (!isNaN(date.getTime())) {
        return {
          display: date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: normalizedType.includes('TIMESTAMP') ? '2-digit' : undefined,
            minute: normalizedType.includes('TIMESTAMP') ? '2-digit' : undefined,
          }),
          style: { color: '#F59E0B' },
        };
      }
    } catch {
      // Fall through
    }
  }

  // JSON
  if (normalizedType === 'JSON' || typeof value === 'object') {
    return {
      display: JSON.stringify(value).slice(0, 50) + (JSON.stringify(value).length > 50 ? '…' : ''),
      style: { color: '#10B981', fontFamily: 'monospace', fontSize: '0.75rem' },
    };
  }

  // Default string
  const str = String(value);
  return {
    display: str.length > 50 ? str.slice(0, 50) + '…' : str,
    style: { color: 'var(--text-primary)' },
  };
}

// Editable cell component
function EditableCell({
  value,
  type,
  isEditing,
  hasChange,
  onStartEdit,
  onFinishEdit,
  onCancel,
}: {
  value: unknown;
  type: string;
  isEditing: boolean;
  hasChange: boolean;
  onStartEdit: () => void;
  onFinishEdit: (value: unknown) => void;
  onCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(String(value ?? ''));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Parse value based on type
      let parsedValue: unknown = editValue;
      const normalizedType = type.toUpperCase();

      if (['BIGINT', 'INTEGER'].some(t => normalizedType.includes(t))) {
        parsedValue = parseInt(editValue, 10);
        if (isNaN(parsedValue as number)) parsedValue = null;
      } else if (['DOUBLE', 'FLOAT', 'DECIMAL'].some(t => normalizedType.includes(t))) {
        parsedValue = parseFloat(editValue);
        if (isNaN(parsedValue as number)) parsedValue = null;
      } else if (normalizedType === 'BOOLEAN') {
        parsedValue = editValue.toLowerCase() === 'true';
      }

      onFinishEdit(parsedValue);
    } else if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onFinishEdit(editValue);
    }
  };

  const { display, style } = formatValue(value, type);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          // Save on blur instead of cancel (more intuitive UX)
          // Parse value based on type
          let parsedValue: unknown = editValue;
          const normalizedType = type.toUpperCase();

          if (['BIGINT', 'INTEGER'].some(t => normalizedType.includes(t))) {
            parsedValue = parseInt(editValue, 10);
            if (isNaN(parsedValue as number)) parsedValue = null;
          } else if (['DOUBLE', 'FLOAT', 'DECIMAL'].some(t => normalizedType.includes(t))) {
            parsedValue = parseFloat(editValue);
            if (isNaN(parsedValue as number)) parsedValue = null;
          } else if (normalizedType === 'BOOLEAN') {
            parsedValue = editValue.toLowerCase() === 'true';
          }

          onFinishEdit(parsedValue);
        }}
        className="w-full px-2 py-1 text-sm rounded focus:outline-none"
        style={{
          backgroundColor: 'var(--surface-primary)',
          border: '2px solid var(--primary)',
          color: 'var(--text-primary)',
        }}
      />
    );
  }

  return (
    <div
      className="relative truncate cursor-text group"
      onDoubleClick={onStartEdit}
    >
      {hasChange && (
        <span
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#F59E0B' }}
        />
      )}
      <span style={style}>{display}</span>
      <span
        className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(to right, transparent, var(--surface-secondary))' }}
      >
        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>✎</span>
      </span>
    </div>
  );
}

export function VirtualDataTable({
  data,
  columns,
  totalRows,
  currentPage,
  pageSize,
  totalPages: totalPagesOverride,
  sortColumn,
  sortDirection,
  selectedColumn,
  pendingChanges = [],
  isLoading,
  onColumnClick,
  onColumnDoubleClick,
  onCellEdit,
  onCellClick,
  onRowDelete,
  onPageChange,
  onPageSizeChange,
  onSort,
}: VirtualDataTableProps) {
  // Calculate total pages if not provided
  const totalPages = totalPagesOverride ?? Math.ceil(totalRows / pageSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; column: string } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; column: string } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Map<string, number>>(new Map());
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // Filter out _rowid from display columns
  const displayColumns = useMemo(() =>
    columns.filter(c => c.name !== '_rowid'),
    [columns]
  );

  // Get column width
  const getColumnWidth = useCallback((column: string) => {
    return columnWidths.get(column) || 150;
  }, [columnWidths]);

  // Column resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);

    const startX = e.clientX;
    const startWidth = getColumnWidth(column);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(80, Math.min(500, startWidth + delta));
      setColumnWidths(prev => new Map(prev).set(column, newWidth));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [getColumnWidth]);

  // Check if cell has pending change
  const cellHasChange = useCallback((rowId: number, column: string) => {
    return pendingChanges.some(c => c.rowId === rowId && c.column === column);
  }, [pendingChanges]);

  // Handle cell edit
  const handleCellEdit = useCallback((rowIdx: number, column: string, value: unknown) => {
    const row = data[rowIdx];
    if (!row || !onCellEdit) return;

    const rowId = row._rowid as number;
    onCellEdit(rowId, column, value);
    setEditingCell(null);
    setSelectedCell(null);
  }, [data, onCellEdit]);

  // Handle cell click - single click selects, click on selected enters edit
  const handleCellClick = useCallback((rowIdx: number, column: string, value: unknown) => {
    // If clicking on already selected cell, enter edit mode
    if (selectedCell?.rowIdx === rowIdx && selectedCell?.column === column) {
      setEditingCell({ rowIdx, column });
    } else {
      // Select the cell
      setSelectedCell({ rowIdx, column });
      onCellClick?.(data[rowIdx]?._rowid as number, column, value);
    }
  }, [selectedCell, data, onCellClick]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Escape to close editing or deselect
      if (e.key === 'Escape') {
        if (editingCell) {
          setEditingCell(null);
        } else if (selectedCell) {
          setSelectedCell(null);
        }
        return;
      }

      // Enter on selected cell starts editing
      if (e.key === 'Enter' && selectedCell && !editingCell) {
        e.preventDefault();
        setEditingCell(selectedCell);
        return;
      }

      // Arrow key navigation when cell is selected (not editing)
      if (selectedCell && !editingCell) {
        const colIndex = displayColumns.findIndex(c => c.name === selectedCell.column);

        if (e.key === 'ArrowRight' && colIndex < displayColumns.length - 1) {
          e.preventDefault();
          setSelectedCell({ ...selectedCell, column: displayColumns[colIndex + 1].name });
        } else if (e.key === 'ArrowLeft' && colIndex > 0) {
          e.preventDefault();
          setSelectedCell({ ...selectedCell, column: displayColumns[colIndex - 1].name });
        } else if (e.key === 'ArrowDown' && selectedCell.rowIdx < data.length - 1) {
          e.preventDefault();
          setSelectedCell({ ...selectedCell, rowIdx: selectedCell.rowIdx + 1 });
        } else if (e.key === 'ArrowUp' && selectedCell.rowIdx > 0) {
          e.preventDefault();
          setSelectedCell({ ...selectedCell, rowIdx: selectedCell.rowIdx - 1 });
        }
      }

      // Start typing to edit (if a cell is selected)
      if (selectedCell && !editingCell && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        setEditingCell(selectedCell);
        // The typed character will be caught by the input
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingCell, selectedCell, displayColumns, data.length]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Table container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto scrollbar-thin ${resizingColumn ? 'select-none cursor-col-resize' : ''}`}
        style={{ scrollbarColor: 'var(--border-default) transparent' }}
      >
        <table className="text-sm border-collapse" style={{ minWidth: '100%' }}>
          {/* Header */}
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Row number header */}
              <th
                className="px-3 py-3 text-left text-xs font-medium"
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
              {displayColumns.map(col => {
                const config = typeConfig[col.type.toUpperCase()] || { icon: '?', color: '#9CA3AF' };
                const isSelected = selectedColumn === col.name;
                const isSorted = sortColumn === col.name;
                const isHovered = hoveredColumn === col.name;
                const width = getColumnWidth(col.name);

                return (
                  <th
                    key={col.name}
                    className="relative px-4 py-3 text-left font-medium cursor-pointer transition-colors"
                    style={{
                      width,
                      minWidth: 80,
                      maxWidth: 500,
                      backgroundColor: isSelected
                        ? 'var(--surface-tertiary)'
                        : 'var(--surface-secondary)',
                      borderBottom: '1px solid var(--border-default)',
                    }}
                    onClick={() => onColumnClick?.(col.name)}
                    onDoubleClick={() => {
                      onSort?.(col.name);
                      onColumnDoubleClick?.(col.name);
                    }}
                    onMouseEnter={() => setHoveredColumn(col.name)}
                    onMouseLeave={() => setHoveredColumn(null)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Type badge */}
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] flex-shrink-0"
                        style={{ backgroundColor: `${config.color}15`, color: config.color }}
                      >
                        {config.icon}
                      </span>

                      {/* Column name */}
                      <span
                        className="truncate"
                        style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {col.name}
                      </span>

                      {/* Sort indicator */}
                      {isSorted && (
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          {sortDirection === 'ASC' ? '↑' : '↓'}
                        </span>
                      )}

                      {/* Click hint */}
                      {isHovered && !isSelected && (
                        <span className="text-[9px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                          click
                        </span>
                      )}
                    </div>

                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--primary)]"
                      style={{ backgroundColor: resizingColumn === col.name ? 'var(--primary)' : 'transparent' }}
                      onMouseDown={e => handleResizeStart(e, col.name)}
                      onClick={e => e.stopPropagation()}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            <AnimatePresence mode="popLayout">
              {data.map((row, rowIdx) => {
                const rowId = row._rowid as number;
                const absoluteRowNum = currentPage * pageSize + rowIdx + 1;
                const isHovered = hoveredRow === rowIdx;
                const hasRowChanges = Boolean(row._hasChanges);

                return (
                  <motion.tr
                    key={rowId}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: hasRowChanges
                        ? 'rgba(245, 158, 11, 0.05)'
                        : isHovered
                          ? 'var(--surface-secondary)'
                          : 'transparent',
                    }}
                    onMouseEnter={() => setHoveredRow(rowIdx)}
                    onMouseLeave={() => setHoveredRow(null)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    {/* Row number */}
                    <td
                      className="px-3 py-2.5 text-xs font-mono"
                      style={{
                        width: 56,
                        color: isHovered ? 'var(--text-secondary)' : 'var(--text-disabled)',
                        backgroundColor: isHovered ? 'var(--surface-tertiary)' : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="tabular-nums">{absoluteRowNum}</span>
                        {hasRowChanges && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: '#F59E0B' }}
                          />
                        )}
                      </div>
                    </td>

                    {/* Data cells */}
                    {displayColumns.map(col => {
                      const value = row[col.name];
                      const isColSelected = selectedColumn === col.name;
                      const isColHovered = hoveredColumn === col.name;
                      const isCellSelected = selectedCell?.rowIdx === rowIdx && selectedCell?.column === col.name;
                      const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.column === col.name;
                      const hasChange = cellHasChange(rowId, col.name);
                      const width = getColumnWidth(col.name);

                      return (
                        <td
                          key={col.name}
                          className="px-4 py-2.5 transition-colors cursor-cell"
                          style={{
                            width,
                            minWidth: 80,
                            maxWidth: 500,
                            backgroundColor: isCellSelected
                              ? 'rgba(139, 92, 246, 0.15)'
                              : isColSelected
                                ? 'var(--surface-secondary)'
                                : isColHovered
                                  ? 'var(--surface-secondary)'
                                  : 'transparent',
                            outline: isCellSelected ? '2px solid var(--primary)' : 'none',
                            outlineOffset: '-2px',
                          }}
                          onClick={() => handleCellClick(rowIdx, col.name, value)}
                        >
                          <EditableCell
                            value={value}
                            type={col.type}
                            isEditing={isEditing}
                            hasChange={hasChange}
                            onStartEdit={() => setEditingCell({ rowIdx, column: col.name })}
                            onFinishEdit={newValue => handleCellEdit(rowIdx, col.name, newValue)}
                            onCancel={() => setEditingCell(null)}
                          />
                        </td>
                      );
                    })}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {/* Loading overlay */}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'var(--surface-primary)', opacity: 0.8 }}
          >
            <motion.div
              className="w-8 h-8 border-2 rounded-full"
              style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--primary)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data.length === 0 && (
          <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-tertiary)' }}>
            No data to display
          </div>
        )}
      </div>

      {/* Footer with pagination */}
      {totalPages > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--surface-secondary)',
          }}
        >
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {totalRows > 0 && (
              <span>
                Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalRows)} of {totalRows.toLocaleString()} rows
              </span>
            )}
            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: 'var(--surface-primary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={250}>250 / page</option>
              </select>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <motion.button
                className="px-2 py-1 text-xs rounded disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage === 0}
                onClick={() => onPageChange?.(0)}
                whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                whileTap={{ scale: 0.95 }}
              >
                ⟨⟨
              </motion.button>
              <motion.button
                className="px-2 py-1 text-xs rounded disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage === 0}
                onClick={() => onPageChange?.(currentPage - 1)}
                whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                whileTap={{ scale: 0.95 }}
              >
                ← Prev
              </motion.button>

              <span className="px-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {currentPage + 1} / {totalPages}
              </span>

              <motion.button
                className="px-2 py-1 text-xs rounded disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage >= totalPages - 1}
                onClick={() => onPageChange?.(currentPage + 1)}
                whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                whileTap={{ scale: 0.95 }}
              >
                Next →
              </motion.button>
              <motion.button
                className="px-2 py-1 text-xs rounded disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage >= totalPages - 1}
                onClick={() => onPageChange?.(totalPages - 1)}
                whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                whileTap={{ scale: 0.95 }}
              >
                ⟩⟩
              </motion.button>
            </div>
          )}

          {/* Keyboard hints */}
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                click
              </kbd> select
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                ↵
              </kbd> edit
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                ←↑↓→
              </kbd> navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                type
              </kbd> quick edit
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default VirtualDataTable;
