import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical } from 'lucide-react';
import MiniHistogram from './MiniHistogram';
import TypeIndicator from './TypeIndicator';
import { ColumnMetrics } from '@/store/inspectorStore';

interface ColumnHeaderCellProps {
  columnName: string;
  columnType?: string;
  columnIndex: number;
  stats?: ColumnMetrics;
  isLoading?: boolean;
  width: number;
  shouldLoadStats?: boolean;
  sortState?: {
    columnIndex: number | null;
    direction: 'asc' | 'desc' | null;
  };
  onSort?: (columnIndex: number, direction: 'asc' | 'desc') => void;
  onColumnAction?: (columnName: string, columnType: string, position: { x: number; y: number }) => void;
  tableName?: string;
  isView?: boolean;
}

const ColumnHeaderCell: React.FC<ColumnHeaderCellProps> = ({
  columnName,
  columnType = 'VARCHAR',
  columnIndex,
  stats,
  isLoading,
  width,
  shouldLoadStats = false,
  sortState,
  onSort,
  onColumnAction,
  tableName,
  isView = false,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  const handleSort = () => {
    if (!onSort || columnIndex === 0) return; // Don't sort row number column
    const newDirection = 
      sortState?.columnIndex === columnIndex && sortState?.direction === 'asc' 
        ? 'desc' 
        : 'asc';
    onSort(columnIndex, newDirection);
  };

  const handleColumnAction = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent sort from triggering
    if (!onColumnAction || isRowNumberColumn || isView) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.left,
      y: rect.bottom + 4
    };
    
    onColumnAction(columnName, columnType, position);
  };

  // Format percentage
  const formatPercent = (value: number) => {
    if (value === 0) return '0%';
    if (value < 1) return '<1%';
    return `${Math.round(value)}%`;
  };

  // Format count
  const formatCount = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const isRowNumberColumn = columnIndex === 0;
  const hasStats = stats && !isLoading && !isRowNumberColumn;
  const hasHistogram = hasStats && stats.histogramData && stats.histogramData.length > 0;
  const isSorted = sortState?.columnIndex === columnIndex;

  return (
    <div 
      className={`h-full w-full flex flex-col border-b-2 border-border border-r border-border/60 overflow-hidden group cursor-pointer transition-all duration-300 ease-in-out column-header-cell ${
        isSorted ? 'sorted' : 'bg-popover hover:bg-primary/5'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSort}
    >
      {/* Header row with type icon and name */}
      <div className="flex items-center justify-between px-2 py-1 min-h-[32px]">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {!isRowNumberColumn && (
            <TypeIndicator type={columnType} size={12} />
          )}
          <span className="text-sm font-semibold text-foreground truncate">
            {columnName}
          </span>
        </div>
        
        {/* Action buttons */}
        {!isRowNumberColumn && (
          <div className="flex items-center gap-1">
            {/* TODO: To be added on next iterations */}
            {/* Column actions button - only for tables, not views */}
            {/* {onColumnAction && !isView && (
              <button
                onClick={handleColumnAction}
                className={`p-1 rounded hover:bg-accent/10 transition-all duration-200 ${
                  isHovered ? 'opacity-100' : 'opacity-40'
                }`}
                title="AI Column Actions"
              >
                <MoreVertical size={14} className="text-muted-foreground hover:text-primary" />
              </button>
            )} */}
            
            {/* Sort indicator */}
            <div className={`transition-all duration-200 ${
              isHovered || isSorted ? 'opacity-90' : 'opacity-30'
            }`}>
              {isSorted ? (
                sortState.direction === 'asc' ? (
                  <ArrowUp size={14} className={`${isSorted ? 'text-foreground drop-shadow-sm' : 'text-primary'}`} />
                ) : (
                  <ArrowDown size={14} className={`${isSorted ? 'text-foreground drop-shadow-sm' : 'text-primary'}`} />
                )
              ) : (
                <ArrowUpDown size={12} className="text-muted-foreground" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats section - show for all columns when stats are enabled */}
      {shouldLoadStats && !isRowNumberColumn && (
        <div className="px-2 pb-1 space-y-1 transition-all duration-300 ease-in-out">
          {/* Histogram if available, otherwise placeholder */}
          <div className="flex justify-center transition-all duration-300 ease-in-out">
            {hasHistogram ? (
              <MiniHistogram 
                data={stats.histogramData}
                width={Math.max(40, Math.min(width - 16, 100))}
                height={20}
                color="#00BFA5"
                showOutliers={true}
              />
            ) : (
              <div 
                className="flex items-center justify-center text-muted-foreground/40 text-[8px] font-mono transition-all duration-300 ease-in-out"
                style={{ 
                  height: 20,
                  width: Math.max(40, Math.min(width - 16, 100))
                }}
              >   
              </div>
            )}
          </div>
          
          {/* Quick stats or placeholder */}
          <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground min-h-[12px] justify-center transition-all duration-300 ease-in-out">
            {hasStats && (stats.nullPercentage > 0 || stats.uniqueCount > 0 || stats.numericStats) ? (
              <>
                {stats.nullPercentage > 0 && (
                  <span className="whitespace-nowrap">
                    null: {formatPercent(stats.nullPercentage)}
                  </span>
                )}
                {stats.uniqueCount > 0 && (
                  <span className="whitespace-nowrap">
                    uniq: {formatCount(stats.uniqueCount)}
                  </span>
                )}
                {stats.numericStats && (
                  <>
                    {stats.numericStats.mean !== undefined && (
                      <span className="whitespace-nowrap">
                        μ: {stats.numericStats.mean.toFixed(1)}
                      </span>
                    )}
                  </>
                )}
              </>
            ) : (
              <span className="text-muted-foreground/40 text-[8px]">no stats</span>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !isRowNumberColumn && (
        <div className="px-2 pb-1">
          <div className="h-4 bg-accent/10 rounded animate-pulse mb-1" />
          <div className="h-3 bg-accent/10 rounded animate-pulse w-3/4" />
        </div>
      )}
    </div>
  );
};

export default ColumnHeaderCell;