import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ColumnInspectorProps {
  isOpen: boolean;
  column: string | null;
  data: Record<string, unknown>[];
  onClose: () => void;
  onAction: (action: 'sort-asc' | 'sort-desc' | 'filter' | 'group' | 'hide', column: string) => void;
}

interface ColumnStats {
  type: 'number' | 'string' | 'boolean' | 'date' | 'mixed';
  count: number;
  nullCount: number;
  uniqueCount: number;
  mean?: number;
  min?: number | string;
  max?: number | string;
  samples: unknown[];
}

function inferColumnType(values: unknown[]): ColumnStats['type'] {
  const nonNull = values.filter(v => v != null);
  if (nonNull.length === 0) return 'mixed';

  const sample = nonNull.slice(0, 100);
  const types = new Set(sample.map(v => typeof v));

  if (types.size === 1) {
    if (types.has('number')) return 'number';
    if (types.has('boolean')) return 'boolean';
    if (types.has('string')) {
      // Check if dates
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/;
      if (sample.every(v => datePattern.test(String(v)))) return 'date';
      return 'string';
    }
  }

  return 'mixed';
}

function computeStats(data: Record<string, unknown>[], column: string): ColumnStats {
  const values = data.map(row => row[column]);
  const nonNull = values.filter(v => v != null);
  const type = inferColumnType(nonNull);

  const stats: ColumnStats = {
    type,
    count: nonNull.length,
    nullCount: values.length - nonNull.length,
    uniqueCount: new Set(nonNull.map(v => String(v))).size,
    samples: nonNull.slice(0, 5),
  };

  if (type === 'number') {
    const nums = nonNull.filter(v => typeof v === 'number') as number[];
    if (nums.length > 0) {
      stats.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      stats.min = Math.min(...nums);
      stats.max = Math.max(...nums);
    }
  } else if (type === 'string' || type === 'date') {
    const sorted = [...nonNull].sort((a, b) => String(a).localeCompare(String(b)));
    stats.min = sorted[0] as string;
    stats.max = sorted[sorted.length - 1] as string;
  }

  return stats;
}

const typeIcons: Record<ColumnStats['type'], { icon: string; label: string }> = {
  number: { icon: '#', label: 'Number' },
  string: { icon: 'Aa', label: 'Text' },
  boolean: { icon: '◉', label: 'Boolean' },
  date: { icon: '📅', label: 'Date' },
  mixed: { icon: '?', label: 'Mixed' },
};

export function ColumnInspector({
  isOpen,
  column,
  data,
  onClose,
  onAction,
}: ColumnInspectorProps) {
  const stats = useMemo(() => {
    if (!column || data.length === 0) return null;
    return computeStats(data, column);
  }, [column, data]);

  if (!isOpen || !column || !stats) return null;

  const typeInfo = typeIcons[stats.type];

  const quickActions = [
    { id: 'sort-asc' as const, icon: '↑', label: 'Sort A→Z' },
    { id: 'sort-desc' as const, icon: '↓', label: 'Sort Z→A' },
    { id: 'filter' as const, icon: '⊘', label: 'Filter' },
    { id: 'group' as const, icon: 'Σ', label: 'Group by' },
  ];

  return (
    <motion.div
      className="w-72 h-full flex flex-col"
      style={{
        backgroundColor: 'var(--surface-primary)',
        borderLeft: '1px solid var(--border-default)',
      }}
      initial={{ x: 288, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 288, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>
            {column}
          </span>
        </div>
        <motion.button
          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onClick={onClose}
          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-secondary)' }}
          whileTap={{ scale: 0.9 }}
        >
          ✕
        </motion.button>
      </div>

      {/* Type badge */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
            style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
          >
            {typeInfo.icon}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{typeInfo.label}</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Statistics
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="Count" value={stats.count.toLocaleString()} />
            <StatItem
              label="Nulls"
              value={`${stats.nullCount} (${((stats.nullCount / (stats.count + stats.nullCount)) * 100).toFixed(1)}%)`}
              highlight={stats.nullCount > 0}
            />
            <StatItem label="Unique" value={stats.uniqueCount.toLocaleString()} />
            {stats.mean !== undefined && (
              <StatItem label="Mean" value={stats.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
            )}
          </div>
        </div>

        {(stats.min !== undefined || stats.max !== undefined) && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Range
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {stats.min !== undefined && (
                <StatItem
                  label="Min"
                  value={typeof stats.min === 'number'
                    ? stats.min.toLocaleString()
                    : String(stats.min).slice(0, 20)
                  }
                />
              )}
              {stats.max !== undefined && (
                <StatItem
                  label="Max"
                  value={typeof stats.max === 'number'
                    ? stats.max.toLocaleString()
                    : String(stats.max).slice(0, 20)
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Mini distribution */}
        {stats.type === 'number' && stats.min !== undefined && stats.max !== undefined && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Distribution
            </h4>
            <MiniHistogram
              data={data}
              column={column}
              min={stats.min as number}
              max={stats.max as number}
            />
          </div>
        )}

        {/* Sample values */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Sample Values
          </h4>
          <div className="space-y-1">
            {stats.samples.map((value, i) => (
              <div
                key={i}
                className="text-xs font-mono truncate px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
              >
                {value === null ? (
                  <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>null</span>
                ) : typeof value === 'number' ? (
                  <span style={{ color: '#3B82F6' }}>{value.toLocaleString()}</span>
                ) : typeof value === 'boolean' ? (
                  <span style={{ color: value ? '#10B981' : '#EF4444' }}>
                    {String(value)}
                  </span>
                ) : (
                  String(value).slice(0, 40)
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <h4 className="text-xs font-medium uppercase tracking-wider px-1" style={{ color: 'var(--text-tertiary)' }}>
          Quick Actions
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {quickActions.map((action) => (
            <motion.button
              key={action.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors"
              style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
              onClick={() => onAction(action.id, column)}
              whileHover={{ scale: 1.02, backgroundColor: 'var(--surface-tertiary)' }}
              whileTap={{ scale: 0.98 }}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StatItem({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--surface-secondary)' }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: highlight ? '#F59E0B' : 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function MiniHistogram({
  data,
  column,
  min,
  max
}: {
  data: Record<string, unknown>[];
  column: string;
  min: number;
  max: number;
}) {
  const bins = 10;
  const range = max - min || 1;
  const bucketSize = range / bins;

  const histogram = useMemo(() => {
    const counts = new Array(bins).fill(0);
    data.forEach(row => {
      const value = row[column];
      if (typeof value === 'number') {
        const bucketIndex = Math.min(
          Math.floor((value - min) / bucketSize),
          bins - 1
        );
        counts[bucketIndex]++;
      }
    });
    const maxCount = Math.max(...counts);
    return counts.map(count => count / maxCount);
  }, [data, column, min, bucketSize, bins]);

  return (
    <div className="flex items-end gap-0.5 h-12">
      {histogram.map((height, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{
            height: `${Math.max(height * 100, 4)}%`,
            backgroundColor: 'var(--primary-muted)',
          }}
        />
      ))}
    </div>
  );
}

export default ColumnInspector;
