import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentNodeData, ContentType } from './ContentNode';

interface FocusedFileViewProps {
  file: ContentNodeData;
  onClose: () => void;
  onAction?: (action: string, params?: Record<string, unknown>) => void;
}

// Type configurations
const typeConfigs: Record<ContentType, { icon: string; label: string; color: string }> = {
  csv: { icon: '⊞', label: 'CSV', color: '#10B981' },
  json: { icon: '{ }', label: 'JSON', color: '#F59E0B' },
  xlsx: { icon: '▦', label: 'Excel', color: '#059669' },
  parquet: { icon: '⬡', label: 'Parquet', color: '#8B5CF6' },
  txt: { icon: '≡', label: 'Text', color: '#6B7280' },
  md: { icon: 'M↓', label: 'Markdown', color: '#6366F1' },
  image: { icon: '◐', label: 'Image', color: '#EC4899' },
  pdf: { icon: '▤', label: 'PDF', color: '#EF4444' },
  unknown: { icon: '?', label: 'File', color: '#9CA3AF' },
};

/**
 * FocusedFileView - Expanded view of a file taking ~80% of viewport
 *
 * Features:
 * - Large data table with pagination
 * - Column statistics
 * - Inline action bar for quick transforms
 * - Search/filter within data
 */
export function FocusedFileView({ file, onClose, onAction }: FocusedFileViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const config = typeConfigs[file.type];
  const rowsPerPage = 25;

  // Filter and sort data
  const processedData = useMemo(() => {
    if (!file.data) return [];

    let result = [...file.data] as Record<string, unknown>[];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(v =>
          String(v).toLowerCase().includes(query)
        )
      );
    }

    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [file.data, searchQuery, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / rowsPerPage);
  const paginatedData = processedData.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Quick actions for the action bar
  const quickActions = [
    { id: 'filter', icon: '⊘', label: 'Filter', color: '#8B5CF6' },
    { id: 'sort', icon: '↕', label: 'Sort', color: '#10B981' },
    { id: 'group', icon: 'Σ', label: 'Group by', color: '#06B6D4' },
    { id: 'ai', icon: '✦', label: 'Ask AI', color: '#6366F1' },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Main container */}
      <motion.div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          width: '85%',
          maxWidth: '1400px',
          height: '85vh',
          maxHeight: '900px',
        }}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-stone-100"
          style={{ backgroundColor: `${config.color}08` }}
        >
          <div className="flex items-center gap-4">
            {/* File icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ backgroundColor: `${config.color}15`, color: config.color }}
            >
              {config.icon}
            </div>

            {/* File info */}
            <div>
              <h2 className="text-lg font-medium text-stone-800">{file.name}</h2>
              <p className="text-sm text-stone-500">
                {file.rowCount?.toLocaleString()} rows · {file.columnCount} columns
                {searchQuery && ` · ${processedData.length.toLocaleString()} matching`}
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search data..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-64 px-4 py-2 pl-10 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-200"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                ⌕
              </span>
            </div>

            {/* Close button */}
            <motion.button
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ✕
            </motion.button>
          </div>
        </div>

        {/* Data content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Table for CSV/JSON */}
          {(file.type === 'csv' || file.type === 'json' || file.type === 'xlsx') && file.columns && (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-stone-50 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-400 w-12">
                      #
                    </th>
                    {file.columns.map((col, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left font-medium text-stone-600 cursor-pointer hover:bg-stone-100 transition-colors"
                        onClick={() => handleSort(col)}
                      >
                        <div className="flex items-center gap-2">
                          {col}
                          {sortColumn === col && (
                            <span className="text-stone-400">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, rowIdx) => (
                    <motion.tr
                      key={rowIdx}
                      className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: rowIdx * 0.01 }}
                    >
                      <td className="px-4 py-2.5 text-xs text-stone-300 font-mono">
                        {currentPage * rowsPerPage + rowIdx + 1}
                      </td>
                      {file.columns?.map((col, colIdx) => (
                        <td key={colIdx} className="px-4 py-2.5 text-stone-700">
                          {row[col] === null || row[col] === undefined ? (
                            <span className="text-stone-300 italic">null</span>
                          ) : typeof row[col] === 'number' ? (
                            <span className="font-mono text-blue-600">
                              {(row[col] as number).toLocaleString()}
                            </span>
                          ) : typeof row[col] === 'boolean' ? (
                            <span className={row[col] ? 'text-green-600' : 'text-red-500'}>
                              {String(row[col])}
                            </span>
                          ) : (
                            <span className="truncate max-w-xs block">
                              {String(row[col]).slice(0, 100)}
                            </span>
                          )}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Text content */}
          {(file.type === 'txt' || file.type === 'md') && file.rawContent && (
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-stone-700 whitespace-pre-wrap font-mono">
                {file.rawContent}
              </pre>
            </div>
          )}

          {/* Image content */}
          {file.type === 'image' && file.imageUrl && (
            <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-stone-50">
              <img
                src={file.imageUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          )}

          {/* Processing state */}
          {file.processing && (
            <div className="flex-1 flex items-center justify-center">
              <motion.div
                className="w-12 h-12 border-3 rounded-full"
                style={{ borderColor: `${config.color}30`, borderTopColor: config.color }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
        </div>

        {/* Footer with pagination and actions */}
        <div className="border-t border-stone-100 bg-stone-50/50">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-6 py-3 border-b border-stone-100">
              <motion.button
                className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-md disabled:opacity-30"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => p - 1)}
                whileTap={{ scale: 0.95 }}
              >
                ← Previous
              </motion.button>

              <span className="text-sm text-stone-500 px-4">
                Page {currentPage + 1} of {totalPages}
              </span>

              <motion.button
                className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-md disabled:opacity-30"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(p => p + 1)}
                whileTap={{ scale: 0.95 }}
              >
                Next →
              </motion.button>
            </div>
          )}

          {/* Quick action bar */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              {quickActions.map((action) => (
                <motion.button
                  key={action.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: `${action.color}10`,
                    color: action.color,
                  }}
                  whileHover={{
                    backgroundColor: `${action.color}20`,
                    scale: 1.02,
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onAction?.(action.id)}
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Keyboard hint */}
            <div className="text-xs text-stone-400">
              <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] font-mono">ESC</kbd>
              {' '}to close
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default FocusedFileView;
