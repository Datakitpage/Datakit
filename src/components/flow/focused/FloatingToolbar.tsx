import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ColumnSchema } from '@/store/duckDBViewStore';

interface FloatingToolbarProps {
  /** Whether the toolbar is visible */
  isVisible: boolean;
  /** Position in screen coordinates (fixed positioning) */
  position: { x: number; y: number };
  /** The selected cell info */
  selectedCell: {
    rowIdx: number;
    column: string;
    value: unknown;
    rowId: number;
  } | null;
  /** Column schema for the selected column */
  columnSchema: ColumnSchema | null;
  /** Callbacks */
  onCopy: () => void;
  onEdit?: (value: unknown) => void;
  onClear?: () => void;
  onFilter?: (column: string, value: unknown) => void;
  onSort?: (column: string, direction: 'ASC' | 'DESC') => void;
  onClose: () => void;
  /** Accent color for theming */
  accentColor?: string;
}

// Type configuration for display
const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
  BIGINT: { icon: '#', label: 'Integer', color: '#3B82F6' },
  INTEGER: { icon: '#', label: 'Integer', color: '#3B82F6' },
  DOUBLE: { icon: '#.#', label: 'Decimal', color: '#3B82F6' },
  FLOAT: { icon: '#.#', label: 'Decimal', color: '#3B82F6' },
  VARCHAR: { icon: 'Aa', label: 'Text', color: '#6B7280' },
  TEXT: { icon: 'Aa', label: 'Text', color: '#6B7280' },
  BOOLEAN: { icon: '◉', label: 'Boolean', color: '#8B5CF6' },
  DATE: { icon: '📅', label: 'Date', color: '#F59E0B' },
  TIMESTAMP: { icon: '🕐', label: 'Timestamp', color: '#F59E0B' },
  JSON: { icon: '{}', label: 'JSON', color: '#10B981' },
};

export function FloatingToolbar({
  isVisible,
  position,
  selectedCell,
  columnSchema,
  onCopy,
  onEdit,
  onClear,
  onFilter,
  onSort,
  onClose,
  accentColor = '#8B5CF6',
}: FloatingToolbarProps) {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Get type config for the column
  const typeInfo = columnSchema
    ? typeConfig[columnSchema.type.toUpperCase()] || { icon: '?', label: columnSchema.type, color: '#9CA3AF' }
    : null;

  // Reset edit mode when cell changes
  useEffect(() => {
    setEditMode(false);
    setEditValue(selectedCell?.value !== null && selectedCell?.value !== undefined
      ? String(selectedCell.value)
      : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedCell.value intentionally excluded
  }, [selectedCell?.rowId, selectedCell?.column]);

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editMode) {
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 50);
    }
  }, [editMode]);

  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    if (selectedCell?.value !== null && selectedCell?.value !== undefined) {
      navigator.clipboard.writeText(String(selectedCell.value));
      onCopy();
      onClose();
    }
  }, [selectedCell, onCopy, onClose]);

  // Handle edit submit
  const handleEditSubmit = useCallback(() => {
    if (!onEdit || !columnSchema) return;

    // Parse value based on type
    let parsedValue: unknown = editValue;
    const normalizedType = columnSchema.type.toUpperCase();

    if (editValue === '' || editValue.toLowerCase() === 'null') {
      parsedValue = null;
    } else if (['BIGINT', 'INTEGER'].some(t => normalizedType.includes(t))) {
      parsedValue = parseInt(editValue, 10);
      if (isNaN(parsedValue as number)) parsedValue = null;
    } else if (['DOUBLE', 'FLOAT', 'DECIMAL'].some(t => normalizedType.includes(t))) {
      parsedValue = parseFloat(editValue);
      if (isNaN(parsedValue as number)) parsedValue = null;
    } else if (normalizedType === 'BOOLEAN') {
      parsedValue = editValue.toLowerCase() === 'true';
    }

    onEdit(parsedValue);
    setEditMode(false);
    onClose();
  }, [editValue, columnSchema, onEdit, onClose]);

  // Format value for display
  const formatDisplayValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'object') {
      return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? Number(v) : v).slice(0, 40);
    }
    const str = String(value);
    return str.length > 40 ? str.slice(0, 40) + '...' : str;
  };

  if (!selectedCell) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className="fixed z-[100] rounded-lg overflow-hidden"
          style={{
            left: position.x,
            top: position.y,
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            minWidth: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Edit Section */}
          {onEdit && (
            <div className="p-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {editMode ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleEditSubmit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditMode(false);
                      }
                    }}
                    onBlur={() => {
                      // Small delay to allow button click
                      setTimeout(() => setEditMode(false), 150);
                    }}
                    className="flex-1 px-2 py-1.5 text-xs rounded outline-none font-mono"
                    style={{
                      backgroundColor: 'var(--surface-secondary)',
                      border: `2px solid ${accentColor}`,
                      color: 'var(--text-primary)',
                      minWidth: 0,
                    }}
                  />
                  <motion.button
                    className="px-2 py-1.5 rounded text-xs font-medium shrink-0"
                    style={{ backgroundColor: accentColor, color: 'white' }}
                    onClick={handleEditSubmit}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Save
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left"
                  style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                  onClick={() => setEditMode(true)}
                  whileHover={{ backgroundColor: 'var(--surface-tertiary)' }}
                >
                  {typeInfo && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                      style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color }}
                    >
                      {typeInfo.icon}
                    </span>
                  )}
                  <span className="flex-1 truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {formatDisplayValue(selectedCell.value)}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    click to edit
                  </span>
                </motion.button>
              )}
            </div>
          )}

          {/* Action buttons - horizontal row */}
          <div className="flex items-center gap-0.5 p-1">
            {/* Copy */}
            <motion.button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
              style={{ color: 'var(--text-secondary)' }}
              onClick={handleCopy}
              whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
              whileTap={{ scale: 0.97 }}
              title="Copy value"
            >
              <span>📋</span>
              <span>Copy</span>
            </motion.button>

            {/* Filter by this value */}
            {onFilter && selectedCell.value !== null && (
              <motion.button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => {
                  onFilter(selectedCell.column, selectedCell.value);
                  onClose();
                }}
                whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                whileTap={{ scale: 0.97 }}
                title="Filter by this value"
              >
                <span>🔍</span>
                <span>Filter</span>
              </motion.button>
            )}

            {/* Sort buttons */}
            {onSort && (
              <>
                <motion.button
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={() => {
                    onSort(selectedCell.column, 'ASC');
                    onClose();
                  }}
                  whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                  whileTap={{ scale: 0.97 }}
                  title="Sort ascending"
                >
                  <span>↑</span>
                </motion.button>
                <motion.button
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={() => {
                    onSort(selectedCell.column, 'DESC');
                    onClose();
                  }}
                  whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                  whileTap={{ scale: 0.97 }}
                  title="Sort descending"
                >
                  <span>↓</span>
                </motion.button>
              </>
            )}

            {/* Clear/Delete */}
            {onClear && (
              <motion.button
                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs"
                style={{ color: '#EF4444' }}
                onClick={() => {
                  onClear();
                  onClose();
                }}
                whileHover={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                whileTap={{ scale: 0.97 }}
                title="Clear cell"
              >
                <span>✕</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FloatingToolbar;
