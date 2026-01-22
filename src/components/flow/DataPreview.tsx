import { motion } from 'framer-motion';

interface DataPreviewProps {
  data: Record<string, unknown>[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function DataPreview({ data, position, onClose }: DataPreviewProps) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const preview = data.slice(0, 5);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Preview card */}
      <motion.div
        className="fixed z-50 bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          maxWidth: 500,
          maxHeight: 300,
          border: '1px solid rgba(0,0,0,0.06)',
        }}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
          <span className="text-xs font-medium text-stone-500">
            Preview ({data.length.toLocaleString()} rows × {columns.length} columns)
          </span>
          <span className="text-xs text-stone-400">first 5 rows</span>
        </div>

        {/* Table */}
        <div className="overflow-auto" style={{ maxHeight: 240 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr>
                {columns.slice(0, 6).map(col => (
                  <th
                    key={col}
                    className="px-2 py-1.5 text-left font-medium text-stone-700 border-b border-stone-100"
                  >
                    {col}
                  </th>
                ))}
                {columns.length > 6 && (
                  <th className="px-2 py-1.5 text-left font-medium text-stone-400 border-b border-stone-100">
                    +{columns.length - 6} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-stone-50"
                >
                  {columns.slice(0, 6).map(col => (
                    <td
                      key={col}
                      className="px-2 py-1.5 text-stone-600 border-b border-stone-50 truncate max-w-[100px]"
                      title={String(row[col] ?? '')}
                    >
                      {row[col] === null || row[col] === undefined ? (
                        <span className="text-stone-300 italic">null</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                  {columns.length > 6 && (
                    <td className="px-2 py-1.5 text-stone-300 border-b border-stone-50">
                      …
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-100 text-xs text-stone-400">
          click anywhere to close
        </div>
      </motion.div>
    </>
  );
}

// Column type badge
interface ColumnTypeBadgeProps {
  type: 'string' | 'number' | 'date' | 'boolean' | 'null' | 'mixed';
}

export function ColumnTypeBadge({ type }: ColumnTypeBadgeProps) {
  const styles: Record<string, { bg: string; text: string }> = {
    string: { bg: '#F0FDF4', text: '#15803D' },
    number: { bg: '#EFF6FF', text: '#1D4ED8' },
    date: { bg: '#FFF7ED', text: '#C2410C' },
    boolean: { bg: '#F5F3FF', text: '#6D28D9' },
    null: { bg: '#F5F5F4', text: '#78716C' },
    mixed: { bg: '#FEF2F2', text: '#B91C1C' },
  };

  const style = styles[type] || styles.mixed;

  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {type}
    </span>
  );
}
