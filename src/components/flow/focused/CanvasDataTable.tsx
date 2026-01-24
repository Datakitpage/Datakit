import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import DataEditor, {
  GridCellKind,
  GridColumn,
  EditableGridCell,
  GridCell,
  Item,
  GridSelection,
  CompactSelection,
  DataEditorRef,
  Theme,
} from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import type { ColumnSchema, ChangeRecord } from '@/store/duckDBViewStore';
import { FloatingToolbar } from './FloatingToolbar';
import { FormulaBar } from './FormulaBar';

// Type configuration for column display - matches original DataTable
const typeConfig: Record<string, { icon: string; color: string }> = {
  BIGINT: { icon: '#', color: '#3B82F6' },
  INTEGER: { icon: '#', color: '#3B82F6' },
  DOUBLE: { icon: '#', color: '#3B82F6' },
  FLOAT: { icon: '#', color: '#3B82F6' },
  DECIMAL: { icon: '#', color: '#3B82F6' },
  VARCHAR: { icon: 'Aa', color: '#6B7280' },
  TEXT: { icon: 'Aa', color: '#6B7280' },
  BOOLEAN: { icon: '◉', color: '#8B5CF6' },
  DATE: { icon: '◷', color: '#F59E0B' },
  TIMESTAMP: { icon: '◷', color: '#F59E0B' },
  JSON: { icon: '{}', color: '#10B981' },
};

// Theme colors - resolved values instead of CSS variables (glide-data-grid doesn't parse CSS vars)
const lightTheme = {
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textDisabled: '#D1D5DB',
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#F9FAFB',
  surfaceTertiary: '#F3F4F6',
  borderDefault: 'rgba(0, 0, 0, 0.08)',
  borderSubtle: 'rgba(0, 0, 0, 0.05)',
};

const darkTheme = {
  textPrimary: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textTertiary: '#6B7280',
  textDisabled: '#4B5563',
  surfacePrimary: 'hsl(220, 13%, 8%)',
  surfaceSecondary: 'hsl(220, 13%, 10%)',
  surfaceTertiary: 'hsl(220, 13%, 13%)',
  borderDefault: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.05)',
};

// Detect dark mode
function useThemeColors() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark ? darkTheme : lightTheme;
}

interface CanvasDataTableProps {
  data: Record<string, unknown>[];
  columns: ColumnSchema[];
  totalRows: number;
  currentPage: number;
  pageSize: number;
  totalPages?: number;
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  selectedColumn?: string;
  pendingChanges?: ChangeRecord[];
  isLoading?: boolean;
  accentColor?: string;

  // Callbacks
  onColumnClick?: (column: string) => void;
  onCellEdit?: (rowId: number, column: string, value: unknown) => void;
  onCellEditError?: (message: string, details?: string) => void;
  onCellClick?: (rowId: number, column: string, value: unknown) => void;
  onRowDelete?: (rowId: number) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSort?: (column: string) => void;
  onSortWithDirection?: (column: string, direction: 'ASC' | 'DESC') => void;
  onFilterByValue?: (column: string, value: unknown) => void;
  onAddColumn?: (columnName: string, columnType: string) => void;

  // Formula support
  onFormulaSubmit?: (rowId: number, column: string, formula: string) => Promise<void>;
  formulaError?: string | null;
  isFormulaLoading?: boolean;
  pendingFormulas?: Map<string, string>;
}

// Convert DuckDB type to GridCellKind
function getGridCellKind(type: string): GridCellKind {
  const normalizedType = type.toUpperCase();
  if (['BIGINT', 'INTEGER', 'DOUBLE', 'FLOAT', 'DECIMAL'].some(t => normalizedType.includes(t))) {
    return GridCellKind.Number;
  }
  if (normalizedType === 'BOOLEAN') {
    return GridCellKind.Boolean;
  }
  return GridCellKind.Text;
}

// Format value for display - returns display string and optional color
function formatCellValue(value: unknown, type: string): { display: string; color?: string } {
  if (value === null || value === undefined) {
    return { display: 'null', color: '#9CA3AF' }; // textTertiary - italic null like original
  }

  const normalizedType = type.toUpperCase();

  // Numbers - blue like original DataTable
  if (['BIGINT', 'INTEGER', 'DOUBLE', 'FLOAT', 'DECIMAL'].some(t => normalizedType.includes(t))) {
    const num = Number(value);
    if (!isNaN(num)) {
      return {
        display: num.toLocaleString(undefined, { maximumFractionDigits: 4 }),
        color: '#3B82F6', // Blue for numbers
      };
    }
  }

  // Booleans - green/red like original
  if (normalizedType === 'BOOLEAN') {
    const boolVal = Boolean(value);
    return {
      display: boolVal ? '✓ true' : '✗ false',
      color: boolVal ? '#10B981' : '#EF4444',
    };
  }

  // Dates - amber like original
  if (normalizedType.includes('DATE') || normalizedType.includes('TIMESTAMP')) {
    try {
      let date: Date;

      // Handle numeric timestamps (DuckDB returns dates as milliseconds since epoch)
      if (typeof value === 'number' || typeof value === 'bigint') {
        date = new Date(Number(value));
      } else if (value instanceof Date) {
        date = value;
      } else {
        // Try parsing as string
        date = new Date(String(value));
      }

      if (!isNaN(date.getTime())) {
        return {
          display: date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: normalizedType.includes('TIMESTAMP') ? '2-digit' : undefined,
            minute: normalizedType.includes('TIMESTAMP') ? '2-digit' : undefined,
          }),
          color: '#F59E0B', // Amber for dates
        };
      }
    } catch {
      // Fall through
    }
  }

  // JSON objects - green
  if (typeof value === 'object') {
    return { display: JSON.stringify(value), color: '#10B981' };
  }

  // Default strings - use theme primary text color (undefined means use default)
  const str = String(value);
  return { display: str.length > 100 ? str.slice(0, 100) + '…' : str };
}

export function CanvasDataTable({
  data,
  columns,
  totalRows,
  currentPage,
  pageSize,
  totalPages: totalPagesOverride,
  sortColumn,
  sortDirection,
  pendingChanges = [],
  isLoading,
  accentColor = '#8B5CF6',
  onColumnClick,
  onCellEdit,
  onCellEditError,
  onCellClick,
  onPageChange,
  onPageSizeChange,
  onSort,
  onSortWithDirection,
  onFilterByValue,
  onRowDelete,
  onAddColumn,
  onFormulaSubmit,
  formulaError,
  isFormulaLoading,
  pendingFormulas,
}: CanvasDataTableProps) {
  const totalPages = totalPagesOverride ?? Math.ceil(totalRows / pageSize);
  const gridRef = useRef<DataEditorRef>(null);
  const themeColors = useThemeColors();

  // Floating toolbar state
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [selectedCell, setSelectedCell] = useState<{
    rowIdx: number;
    column: string;
    value: unknown;
    rowId: number;
  } | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Selection state
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Column widths state (persisted per column name)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Add column popover state
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const addColumnRef = useRef<HTMLDivElement>(null);

  // Column order state (for drag reordering)
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Filter out _rowid from display columns
  const displayColumns = useMemo(() =>
    columns.filter(c => c.name !== '_rowid'),
    [columns]
  );

  // Initialize column order when columns change
  useEffect(() => {
    const colNames = displayColumns.map(c => c.name);
    // Only reset if columns actually changed (new columns added/removed)
    if (columnOrder.length === 0 || !colNames.every(n => columnOrder.includes(n))) {
      setColumnOrder(colNames);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columnOrder intentionally excluded to prevent loop
  }, [displayColumns]);

  // Get ordered columns based on user's drag order
  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return displayColumns;
    return columnOrder
      .map(name => displayColumns.find(c => c.name === name))
      .filter((c): c is ColumnSchema => c !== undefined);
  }, [displayColumns, columnOrder]);

  // Convert columns to glide-data-grid format with type indicators
  const gridColumns: GridColumn[] = useMemo(() => {
    return orderedColumns.map(col => {
      const config = typeConfig[col.type.toUpperCase()] || { icon: '?', color: '#9CA3AF' };
      const isSorted = sortColumn === col.name;
      const sortIndicator = isSorted ? (sortDirection === 'ASC' ? ' ↑' : ' ↓') : '';
      // Use stored width or calculate default
      const defaultWidth = Math.max(150, col.name.length * 10 + 60);
      const width = columnWidths[col.name] ?? defaultWidth;

      return {
        id: col.name,
        // Include type icon in title like original DataTable's type badge
        title: `${config.icon} ${col.name}${sortIndicator}`,
        width,
        themeOverride: {
          textHeader: isSorted ? accentColor : themeColors.textSecondary,
          // Subtle colored background behind the icon area
          bgIconHeader: `${config.color}20`,
          fgIconHeader: config.color,
        },
      };
    });
  }, [orderedColumns, sortColumn, sortDirection, accentColor, themeColors, columnWidths]);

  // Handle column resize
  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id) {
      setColumnWidths(prev => ({
        ...prev,
        [column.id as string]: newSize,
      }));
    }
  }, []);

  // Handle column drag/move
  const onColumnMoved = useCallback((startIndex: number, endIndex: number) => {
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const [moved] = newOrder.splice(startIndex, 1);
      newOrder.splice(endIndex, 0, moved);
      return newOrder;
    });
  }, []);

  // Get the LATEST pending change for a cell (if any)
  // Uses findLast to get the most recent change when a cell is edited multiple times
  const getPendingChange = useCallback((rowId: number, column: string) => {
    // findLast returns the last matching element (most recent change)
    // Fall back to filter + pop for older browsers
    const matches = pendingChanges.filter(c => c.rowId === rowId && c.column === column);
    return matches.length > 0 ? matches[matches.length - 1] : undefined;
  }, [pendingChanges]);

  // Get cell content with color-coded values
  const getCellContent = useCallback((cell: Item): GridCell => {
    const [colIdx, rowIdx] = cell;
    const col = orderedColumns[colIdx];
    if (!col || rowIdx >= data.length) {
      return {
        kind: GridCellKind.Text,
        data: '',
        displayData: '',
        allowOverlay: false,
        readonly: true,
      };
    }

    const row = data[rowIdx];
    const rowId = row._rowid as number;

    // Check for pending change and use new value if available
    const pendingChange = getPendingChange(rowId, col.name);
    const hasChange = !!pendingChange;
    const value = hasChange ? pendingChange.newValue : row[col.name];

    const kind = getGridCellKind(col.type);
    const formatted = formatCellValue(value, col.type);

    // Build theme override with optional text color and change highlight
    const buildThemeOverride = (textColor?: string) => {
      if (!hasChange && !textColor) return undefined;
      return {
        ...(hasChange ? { bgCell: 'rgba(245, 158, 11, 0.1)' } : {}),
        ...(textColor ? { textDark: textColor, textMedium: textColor } : {}),
      };
    };

    if (kind === GridCellKind.Number) {
      return {
        kind: GridCellKind.Number,
        data: value === null || value === undefined ? undefined : Number(value),
        displayData: formatted.display,
        allowOverlay: true,
        readonly: false,
        themeOverride: buildThemeOverride(formatted.color),
      };
    }

    if (kind === GridCellKind.Boolean) {
      // Use native checkbox for boolean - single-click toggle
      const boolValue = value === true || value === 'true' || value === 1;
      return {
        kind: GridCellKind.Boolean,
        data: value === null || value === undefined ? null : boolValue,
        allowOverlay: false,
        readonly: false,
        themeOverride: hasChange ? { bgCell: 'rgba(245, 158, 11, 0.1)' } : undefined,
      };
    }

    // Special handling for date/timestamp columns - show editable ISO format in editor
    const normalizedType = col.type.toUpperCase();
    if (normalizedType.includes('DATE') || normalizedType.includes('TIMESTAMP')) {
      let editableDate = '';
      if (value !== null && value !== undefined) {
        try {
          let date: Date;
          if (typeof value === 'number' || typeof value === 'bigint') {
            date = new Date(Number(value));
          } else if (value instanceof Date) {
            date = value;
          } else {
            date = new Date(String(value));
          }
          if (!isNaN(date.getTime())) {
            // Use ISO format for editing (YYYY-MM-DD or YYYY-MM-DDTHH:MM for timestamps)
            editableDate = normalizedType.includes('TIMESTAMP')
              ? date.toISOString().slice(0, 16) // "2022-01-01T00:00"
              : date.toISOString().slice(0, 10); // "2022-01-01"
          }
        } catch {
          editableDate = String(value);
        }
      }
      return {
        kind: GridCellKind.Text,
        data: editableDate,
        displayData: formatted.display,
        allowOverlay: true,
        readonly: false,
        themeOverride: buildThemeOverride(formatted.color),
      };
    }

    return {
      kind: GridCellKind.Text,
      data: value === null || value === undefined ? '' : String(value),
      displayData: formatted.display,
      allowOverlay: true,
      readonly: false,
      themeOverride: buildThemeOverride(formatted.color),
    };
  }, [data, orderedColumns, getPendingChange]);

  // Validate a date string and return parsed date or null
  const validateDateString = useCallback((dateStr: string): Date | null => {
    if (!dateStr || !dateStr.trim()) return null;

    const trimmed = dateStr.trim();

    // Try parsing as ISO format first (YYYY-MM-DD or full ISO)
    let date = new Date(trimmed);

    // Check if the date is valid
    if (!isNaN(date.getTime())) {
      // Additional check: the parsed date should produce a reasonable result
      // This catches cases like "asdf" which might parse to Invalid Date on some browsers
      const year = date.getFullYear();
      if (year >= 1000 && year <= 9999) {
        return date;
      }
    }

    // Try parsing common date formats
    // MM/DD/YYYY
    const usFormat = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usFormat) {
      const [, month, day, year] = usFormat;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }

    // DD/MM/YYYY (European format)
    const euFormat = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (euFormat) {
      const [, day, month, year] = euFormat;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }

    return null;
  }, []);

  // Handle cell edit
  const onCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [colIdx, rowIdx] = cell;
    const col = orderedColumns[colIdx];
    if (!col || rowIdx >= data.length || !onCellEdit) return;

    const row = data[rowIdx];
    const rowId = row._rowid as number;

    let parsedValue: unknown;
    if (newValue.kind === GridCellKind.Number) {
      parsedValue = newValue.data;
    } else if (newValue.kind === GridCellKind.Boolean) {
      parsedValue = newValue.data;
    } else if (newValue.kind === GridCellKind.Text) {
      // Special handling for date/timestamp columns - parse ISO format back to date string for DuckDB
      const normalizedType = col.type.toUpperCase();
      if (normalizedType.includes('DATE') || normalizedType.includes('TIMESTAMP')) {
        const dateStr = newValue.data;
        if (dateStr && dateStr.trim()) {
          // Validate and parse the date
          const validDate = validateDateString(dateStr);
          if (validDate) {
            // DuckDB expects dates in YYYY-MM-DD format
            parsedValue = validDate.toISOString().slice(0, 10);
          } else {
            // Invalid date - show error and reject the edit
            onCellEditError?.(
              'Invalid date format',
              `"${dateStr}" is not a valid date. Use formats like YYYY-MM-DD, MM/DD/YYYY, or DD.MM.YYYY`
            );
            return; // Don't proceed with the edit
          }
        } else {
          parsedValue = null;
        }
      } else {
        parsedValue = newValue.data;
      }
    }

    onCellEdit(rowId, col.name, parsedValue);

    // Exit focus mode after edit: clear selection and blur
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [data, orderedColumns, onCellEdit, onCellEditError, validateDateString]);

  // Handle cell click for toolbar
  const onCellActivated = useCallback((cell: Item) => {
    const [colIdx, rowIdx] = cell;
    const col = orderedColumns[colIdx];
    if (!col || rowIdx >= data.length) return;

    const row = data[rowIdx];
    const value = row[col.name];
    const rowId = row._rowid as number;

    setSelectedCell({ rowIdx, column: col.name, value, rowId });
    onCellClick?.(rowId, col.name, value);

    // Position toolbar based on approximate cell position
    // Calculate based on column index and row index with estimated widths
    const estimatedX = 56 + colIdx * 150 + 75; // row marker width + columns + half column
    const estimatedY = 36 + (rowIdx + 1) * 36; // header height + rows
    setToolbarPosition({
      x: Math.min(Math.max(estimatedX, 8), window.innerWidth - 300),
      y: Math.min(estimatedY, window.innerHeight - 200),
    });
    setShowToolbar(true);
  }, [data, orderedColumns, onCellClick]);

  // Handle header click for sorting
  const onHeaderClicked = useCallback((colIdx: number) => {
    const col = orderedColumns[colIdx];
    if (!col) return;

    onColumnClick?.(col.name);

    // Toggle sort
    if (sortColumn === col.name) {
      if (sortDirection === 'ASC') {
        onSortWithDirection?.(col.name, 'DESC');
      } else {
        onSort?.(col.name); // This will clear sort
      }
    } else {
      onSortWithDirection?.(col.name, 'ASC');
    }
  }, [orderedColumns, sortColumn, sortDirection, onColumnClick, onSort, onSortWithDirection]);

  // Handle selection change
  const onSelectionChanged = useCallback((newSelection: GridSelection) => {
    setSelection(newSelection);

    // If a single cell is selected, update selectedCell for toolbar
    if (newSelection.current?.cell) {
      const [colIdx, rowIdx] = newSelection.current.cell;
      const col = orderedColumns[colIdx];
      if (col && rowIdx < data.length) {
        const row = data[rowIdx];
        const value = row[col.name];
        const rowId = row._rowid as number;
        setSelectedCell({ rowIdx, column: col.name, value, rowId });
      }
    } else {
      setSelectedCell(null);
      setShowToolbar(false);
    }
  }, [data, orderedColumns]);

  // Get selected row IDs from CompactSelection
  const selectedRowIds = useMemo(() => {
    const ids: number[] = [];
    const rows = selection.rows;
    for (let i = 0; i < data.length; i++) {
      if (rows.hasIndex(i)) {
        const rowId = data[i]._rowid as number;
        if (rowId !== undefined) {
          ids.push(rowId);
        }
      }
    }
    return ids;
  }, [selection.rows, data]);

  // Handle adding a new column
  const handleAddColumn = useCallback(() => {
    if (!onAddColumn || !newColumnName.trim()) return;

    // Clean the column name (remove spaces, special chars)
    const cleanName = newColumnName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (!cleanName) return;

    // Call the callback with VARCHAR as default type
    onAddColumn(cleanName, 'VARCHAR');

    // Reset state
    setNewColumnName('');
    setShowAddColumn(false);
  }, [newColumnName, onAddColumn]);

  // Handle bulk delete of selected rows
  const handleDeleteSelected = useCallback(() => {
    if (!onRowDelete || selectedRowIds.length === 0) return;

    // Delete each selected row
    selectedRowIds.forEach(rowId => {
      onRowDelete(rowId);
    });

    // Clear selection after delete
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
  }, [selectedRowIds, onRowDelete]);

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Check if click is outside toolbar
      const target = e.target as HTMLElement;
      if (!target.closest('[data-floating-toolbar]')) {
        setShowToolbar(false);
      }
    };

    if (showToolbar) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showToolbar]);

  // Custom theme with resolved colors (glide-data-grid doesn't parse CSS variables)
  const theme: Partial<Theme> = useMemo(() => ({
    accentColor,
    accentLight: `${accentColor}20`,
    textDark: themeColors.textPrimary,
    textMedium: themeColors.textSecondary,
    textLight: themeColors.textTertiary,
    textBubble: themeColors.textPrimary,
    bgIconHeader: themeColors.surfaceSecondary,
    fgIconHeader: themeColors.textSecondary,
    textHeader: themeColors.textSecondary,
    textHeaderSelected: themeColors.textPrimary,
    bgCell: themeColors.surfacePrimary,
    bgCellMedium: themeColors.surfaceSecondary,
    bgHeader: themeColors.surfaceSecondary,
    bgHeaderHasFocus: themeColors.surfaceTertiary,
    bgHeaderHovered: themeColors.surfaceTertiary,
    bgBubble: themeColors.surfaceSecondary,
    bgBubbleSelected: accentColor,
    bgSearchResult: `${accentColor}30`,
    borderColor: themeColors.borderSubtle,
    drilldownBorder: themeColors.borderDefault,
    linkColor: accentColor,
    cellHorizontalPadding: 16, // Matches original DataTable px-4
    cellVerticalPadding: 10, // Matches original DataTable py-2.5
    headerFontStyle: '500 12px',
    baseFontStyle: '13px',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    editorFontSize: '13px',
    lineHeight: 1.5,
    headerIconSize: 16,
    markerFontStyle: '11px',
  }), [accentColor, themeColors]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Selection action bar - minimal inline */}
      {selectedRowIds.length > 0 && onRowDelete && (
        <div
          className="flex items-center gap-3 px-3 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            borderTop: '1px solid var(--border-default)',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            {selectedRowIds.length} selected
          </span>
          <button
            onClick={handleDeleteSelected}
            className="hover:underline transition-colors"
            style={{ color: '#EF4444' }}
          >
            Delete
          </button>
          <button
            onClick={() => setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() })}
            className="hover:underline transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Formula bar */}
      {onFormulaSubmit && (
        <FormulaBar
          selectedCell={selectedCell}
          schema={columns}
          onFormulaSubmit={onFormulaSubmit}
          onValueSubmit={onCellEdit}
          accentColor={accentColor}
          isLoading={isFormulaLoading}
          error={formulaError}
          pendingFormulas={pendingFormulas}
        />
      )}

      {/* Canvas table */}
      <div className="flex-1 relative">
        <DataEditor
          ref={gridRef}
          columns={gridColumns}
          rows={data.length}
          getCellContent={getCellContent}
          onCellEdited={onCellEdited}
          onCellActivated={onCellActivated}
          onHeaderClicked={onHeaderClicked}
          gridSelection={selection}
          onGridSelectionChange={onSelectionChanged}
          theme={theme}
          smoothScrollX
          smoothScrollY
          rowMarkers="both"
          rowMarkerStartIndex={currentPage * pageSize + 1}
          rowSelect="multi"
          rangeSelect="cell"
          getCellsForSelection={true}
          onColumnResize={onColumnResize}
          onColumnMoved={onColumnMoved}
          keybindings={{
            search: true,
            copy: true,
            paste: true,
            cut: true,
            selectAll: true,
            selectColumn: true,
            selectRow: true,
            downFill: true,
            rightFill: true,
            pageUp: true,
            pageDown: true,
            first: true,
            last: true,
          }}
          width="100%"
          height="100%"
        />

        {/* Loading overlay */}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ backgroundColor: `${themeColors.surfacePrimary}CC` }}
          >
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: themeColors.borderDefault, borderTopColor: accentColor }}
            />
          </div>
        )}

        {/* Add column button */}
        {onAddColumn && (
          <div ref={addColumnRef} className="absolute top-0 right-0 z-10">
            <button
              onClick={() => setShowAddColumn(!showAddColumn)}
              className="flex items-center justify-center w-8 h-9 transition-colors"
              style={{
                backgroundColor: showAddColumn ? accentColor : 'var(--surface-secondary)',
                color: showAddColumn ? 'white' : 'var(--text-secondary)',
                borderLeft: '1px solid var(--border-default)',
                borderBottom: '1px solid var(--border-default)',
              }}
              title="Add column"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Add column popover */}
            {showAddColumn && (
              <div
                className="absolute right-0 top-full mt-1 p-2 rounded shadow-lg z-20"
                style={{
                  backgroundColor: 'var(--surface-primary)',
                  border: '1px solid var(--border-default)',
                  minWidth: '160px',
                }}
              >
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn();
                    if (e.key === 'Escape') setShowAddColumn(false);
                  }}
                  placeholder="Column name"
                  className="w-full px-2 py-1 text-xs rounded"
                  style={{
                    backgroundColor: 'var(--surface-secondary)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-1.5 text-xs">
                  <button
                    onClick={() => {
                      setShowAddColumn(false);
                      setNewColumnName('');
                    }}
                    className="hover:underline transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddColumn}
                    disabled={!newColumnName.trim()}
                    className="hover:underline transition-colors disabled:opacity-50"
                    style={{ color: accentColor }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
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
              <button
                className="px-2 py-1 text-xs rounded disabled:opacity-30 transition-colors hover:bg-[var(--surface-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage === 0}
                onClick={() => onPageChange?.(0)}
              >
                ⟨⟨
              </button>
              <button
                className="px-2 py-1 text-xs rounded disabled:opacity-30 transition-colors hover:bg-[var(--surface-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage === 0}
                onClick={() => onPageChange?.(currentPage - 1)}
              >
                ← Prev
              </button>

              <span className="px-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {currentPage + 1} / {totalPages}
              </span>

              <button
                className="px-2 py-1 text-xs rounded disabled:opacity-30 transition-colors hover:bg-[var(--surface-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage >= totalPages - 1}
                onClick={() => onPageChange?.(currentPage + 1)}
              >
                Next →
              </button>
              <button
                className="px-2 py-1 text-xs rounded disabled:opacity-30 transition-colors hover:bg-[var(--surface-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
                disabled={currentPage >= totalPages - 1}
                onClick={() => onPageChange?.(totalPages - 1)}
              >
                ⟩⟩
              </button>
            </div>
          )}

          {/* Keyboard hints */}
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                ↵
              </kbd> edit
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                ⇥
              </kbd> next
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
                ⌘C
              </kbd> copy
            </span>
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      <FloatingToolbar
        isVisible={showToolbar && selectedCell !== null}
        position={toolbarPosition}
        selectedCell={selectedCell}
        columnSchema={selectedCell ? displayColumns.find(c => c.name === selectedCell.column) || null : null}
        onCopy={() => {
          setCopiedFeedback(true);
          setTimeout(() => setCopiedFeedback(false), 1500);
        }}
        onEdit={onCellEdit && selectedCell ? (value) => {
          onCellEdit(selectedCell.rowId, selectedCell.column, value);
        } : undefined}
        onFilter={onFilterByValue}
        onSort={onSortWithDirection}
        onClear={onCellEdit && selectedCell ? () => {
          onCellEdit(selectedCell.rowId, selectedCell.column, null);
        } : undefined}
        onClose={() => setShowToolbar(false)}
        accentColor={accentColor}
      />

      {/* Copy feedback toast */}
      {copiedFeedback && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium z-50"
          style={{
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--text-primary)',
          }}
        >
          Copied to clipboard
        </div>
      )}
    </div>
  );
}

export default CanvasDataTable;
