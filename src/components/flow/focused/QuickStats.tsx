import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface QuickStatsProps {
  data: Record<string, unknown>[];
  columns: string[];
  filteredCount?: number;
  color: string;
}

interface StatsSummary {
  totalRows: number;
  totalColumns: number;
  nullPercentage: number;
  numericColumns: number;
  textColumns: number;
  dateColumns: number;
}

function computeQuickStats(
  data: Record<string, unknown>[],
  columns: string[]
): StatsSummary {
  let totalNulls = 0;
  let totalCells = 0;
  let numericColumns = 0;
  let textColumns = 0;
  let dateColumns = 0;

  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/;

  columns.forEach(col => {
    const values = data.slice(0, 100).map(row => row[col]);
    const nonNull = values.filter(v => v != null);

    // Count nulls
    totalNulls += values.filter(v => v == null).length;
    totalCells += values.length;

    // Infer type
    if (nonNull.length === 0) {
      textColumns++;
      return;
    }

    const types = new Set(nonNull.map(v => typeof v));
    if (types.size === 1) {
      if (types.has('number')) {
        numericColumns++;
      } else if (types.has('string')) {
        // Check for dates
        if (nonNull.every(v => datePattern.test(String(v)))) {
          dateColumns++;
        } else {
          textColumns++;
        }
      } else {
        textColumns++;
      }
    } else {
      textColumns++;
    }
  });

  return {
    totalRows: data.length,
    totalColumns: columns.length,
    nullPercentage: totalCells > 0 ? (totalNulls / totalCells) * 100 : 0,
    numericColumns,
    textColumns,
    dateColumns,
  };
}

export function QuickStats({ data, columns, filteredCount, color }: QuickStatsProps) {
  const stats = useMemo(
    () => computeQuickStats(data, columns),
    [data, columns]
  );

  const isFiltered = filteredCount !== undefined && filteredCount !== stats.totalRows;

  return (
    <motion.div
      className="flex items-center gap-4 px-6 py-2"
      style={{
        backgroundColor: 'var(--surface-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      {/* Row count */}
      <StatBadge
        icon="⊞"
        label="Rows"
        value={isFiltered
          ? `${filteredCount?.toLocaleString()} / ${stats.totalRows.toLocaleString()}`
          : stats.totalRows.toLocaleString()
        }
        color={isFiltered ? '#F59E0B' : color}
      />

      {/* Columns */}
      <StatBadge
        icon="◫"
        label="Columns"
        value={stats.totalColumns.toString()}
        color="#6B7280"
      />

      {/* Column type breakdown */}
      {stats.numericColumns > 0 && (
        <StatBadge
          icon="#"
          label="Numeric"
          value={stats.numericColumns.toString()}
          color="#3B82F6"
        />
      )}

      {stats.textColumns > 0 && (
        <StatBadge
          icon="Aa"
          label="Text"
          value={stats.textColumns.toString()}
          color="#6B7280"
        />
      )}

      {stats.dateColumns > 0 && (
        <StatBadge
          icon="◷"
          label="Dates"
          value={stats.dateColumns.toString()}
          color="#F59E0B"
        />
      )}

      {/* Null percentage */}
      {stats.nullPercentage > 0 && (
        <StatBadge
          icon="∅"
          label="Nulls"
          value={`${stats.nullPercentage.toFixed(1)}%`}
          color={stats.nullPercentage > 20 ? '#EF4444' : '#9CA3AF'}
          warning={stats.nullPercentage > 20}
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Keyboard hint */}
      <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        <span>
          <kbd
            className="px-1 py-0.5 rounded font-mono"
            style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-default)' }}
          >
            ↑↓←→
          </kbd> navigate
        </span>
        <span>
          <kbd
            className="px-1 py-0.5 rounded font-mono"
            style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-default)' }}
          >
            click
          </kbd> inspect
        </span>
        <span>
          <kbd
            className="px-1 py-0.5 rounded font-mono"
            style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-default)' }}
          >
            dbl-click
          </kbd> sort
        </span>
      </div>
    </motion.div>
  );
}

function StatBadge({
  icon,
  label,
  value,
  color,
  warning = false
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  warning?: boolean;
}) {
  return (
    <motion.div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
      style={{
        backgroundColor: warning ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-primary)',
        border: '1px solid var(--border-subtle)',
      }}
      whileHover={{ scale: 1.02, backgroundColor: `${color}08` }}
    >
      <span
        className="w-4 h-4 rounded flex items-center justify-center text-[10px]"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-medium tabular-nums" style={{ color: warning ? '#EF4444' : 'var(--text-primary)' }}>
        {value}
      </span>
    </motion.div>
  );
}

export default QuickStats;
