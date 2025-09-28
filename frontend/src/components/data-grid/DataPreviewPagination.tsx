import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DataPreviewPaginationProps {
  currentPage: number;
  totalPages: number;
  totalRows: number;
  rowsPerPage: number;
  isCountLoading: boolean;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  disabled?: boolean;
  compact?: boolean;
  columnCount?: number;
}

const DataPreviewPagination: React.FC<DataPreviewPaginationProps> = ({
  currentPage,
  totalPages,
  totalRows,
  rowsPerPage,
  isCountLoading,
  onPageChange,
  columnCount,
  onRowsPerPageChange,
  disabled = false,
  compact = false,
}) => {
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRowsPerPage = Number(e.target.value);
    if (onRowsPerPageChange) {
      onRowsPerPageChange(newRowsPerPage);
    }
  };

  // Calculate current range
  const startRow = (currentPage - 1) * rowsPerPage + 1;
  
  // Handle views (totalRows = -1) differently
  const isView = totalRows === -1;
  const endRow = isCountLoading 
    ? Math.min(currentPage * rowsPerPage, startRow + rowsPerPage - 1)
    : isView 
      ? startRow + rowsPerPage - 1  // For views, show estimated range
      : Math.min(currentPage * rowsPerPage, totalRows);

  return (
    <div className={`flex items-center justify-between bg-popover border-t border-border ${
      compact 
        ? 'px-1 sm:px-2 py-1 sm:py-2' 
        : 'px-4 py-3'
    }`}>
      {/* Left: Rows per page selector */}
      <div className={`flex items-center ${
        compact 
          ? 'space-x-1' 
          : 'space-x-3'
      }`}>
        <span className={`font-medium text-muted-foreground ${
          compact 
            ? 'text-xs hidden md:inline' 
            : 'text-sm'
        }`}>Show:</span>
        <select
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
          disabled={disabled}
          className={`bg-background text-foreground font-medium rounded-md border border-border hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-50 transition-all duration-200 ${
            compact 
              ? 'text-xs px-1 sm:px-2 py-0.5 sm:py-1' 
              : 'text-sm px-3 py-1.5'
          }`}
        >
          <option value={100}>100</option>
          <option value={500}>500</option>
          <option value={1000}>{compact ? '1K' : '1,000'}</option>
          <option value={5000}>{compact ? '5K' : '5,000'}</option>
          <option value={10000}>{compact ? '10K' : '10,000'}</option>
        </select>
        <span className={`text-muted-foreground ${
          compact 
            ? 'text-xs hidden sm:inline' 
            : 'text-sm'
        }`}>rows</span>
      </div>

      {/* Center: Range display with improved counting state */}
      <div className={`flex items-center flex-1 justify-center ${
        compact 
          ? 'space-x-1 px-1' 
          : 'space-x-2'
      }`}>
        {isCountLoading ? (
          <div className={`flex items-center ${
            compact 
              ? 'space-x-1' 
              : 'space-x-2'
          }`}>
            <div className="flex items-center">
              <div className={`bg-primary rounded-full animate-pulse ${
                compact 
                  ? 'w-1 h-1' 
                  : 'w-1.5 h-1.5 mr-2'
              }`}></div>
              <span className={`font-medium text-foreground ${
                compact 
                  ? 'text-xs' 
                  : 'text-sm'
              }`}>
                <span className={compact ? 'hidden md:inline' : 'hidden sm:inline'}>Showing </span>{startRow.toLocaleString()} - {endRow.toLocaleString()}
              </span>
            </div>
            {!compact && <div className="text-white/40">•</div>}
            <div className="flex items-center space-x-1">
              <svg className={`text-primary animate-spin ${
                compact 
                  ? 'w-2 h-2 hidden sm:inline' 
                  : 'w-3 h-3'
              }`} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className={`font-medium text-primary animate-pulse ${
                compact 
                  ? 'text-xs hidden sm:inline' 
                  : 'text-sm'
              }`}>
                {compact ? 'Counting...' : 'Counting total rows...'}
              </span>
            </div>
          </div>
        ) : isView ? (
          <span className={`font-medium text-foreground ${
            compact 
              ? 'text-xs' 
              : 'text-sm'
          }`}>
            {startRow.toLocaleString()} - {endRow.toLocaleString()}
            <span className={`text-muted-foreground ml-1 ${
              compact 
                ? 'hidden sm:inline' 
                : ''
            }`}>({compact ? 'large' : 'large file'})</span>
          </span>
        ) : (
          <div className={`flex items-center ${
            compact 
              ? 'space-x-2' 
              : 'space-x-3'
          }`}>
            <span className={`font-medium text-foreground ${
              compact 
                ? 'text-xs' 
                : 'text-sm'
            }`}>
              {startRow.toLocaleString()} - {endRow.toLocaleString()}<span className={compact ? 'hidden md:inline' : 'hidden sm:inline'}> of{" "}
              <span className="text-foreground font-semibold">{totalRows.toLocaleString()}</span> rows</span>
            </span>
            
            {columnCount && columnCount > 0 && (
              <>
                <span className="text-muted-foreground/60">•</span>
                <span className={`flex items-center gap-1 ${
                  compact 
                    ? 'text-xs' 
                    : 'text-sm'
                }`}>
                  <span className="font-semibold text-foreground">{columnCount}</span>
                  <span className="text-muted-foreground">columns</span>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: Navigation controls */}
      <div className={`flex items-center ${
        compact 
          ? 'space-x-0.5' 
          : 'space-x-1'
      }`}>
        {/* First page button */}
        <Button
          variant="ghost"
          size="sm"
          className={`p-0 flex items-center justify-center rounded-md hover:bg-accent/10 disabled:opacity-40 transition-all duration-200 ${
            compact 
              ? 'h-5 w-5 sm:h-6 sm:w-6 hidden sm:flex' 
              : 'h-8 w-8'
          }`}
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(1)}
          title="First Page"
        >
          <ChevronsLeft size={compact ? 12 : 16} className={compact ? 'sm:size-3' : ''} />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className={`p-0 flex items-center justify-center rounded-md hover:bg-accent/10 disabled:opacity-40 transition-all duration-200 ${
            compact 
              ? 'h-5 w-5 sm:h-6 sm:w-6' 
              : 'h-8 w-8'
          }`}
          disabled={disabled || currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous Page"
        >
          <ChevronLeft size={compact ? 12 : 16} className={compact ? 'sm:size-3' : ''} />
        </Button>

        <div className={`text-center ${
          compact 
            ? 'px-1 sm:px-2 min-w-[40px] sm:min-w-[60px]' 
            : 'px-3 min-w-[140px]'
        }`}>
          {isCountLoading && totalPages === 0 ? (
            <span className={`font-medium text-foreground ${
              compact 
                ? 'text-xs' 
                : 'text-sm'
            }`}>
              <span className={compact ? 'hidden md:inline' : ''}>{compact ? '' : 'Page '}</span><span className="font-semibold">{currentPage}</span>
              <span className={`text-white/60 ${
                compact 
                  ? 'hidden md:inline' 
                  : ''
              }`}>{compact ? ' / ?' : ' of ?'}</span>
            </span>
          ) : isView ? (
            <span className={`font-medium text-foreground ${
              compact 
                ? 'text-xs' 
                : 'text-sm'
            }`}>
              <span className={compact ? 'hidden md:inline' : ''}>{compact ? '' : 'Page '}</span><span className="font-semibold">{currentPage}</span>
            </span>
          ) : totalPages === 0 ? (
            <span className={`font-medium text-foreground ${
              compact 
                ? 'text-xs' 
                : 'text-sm'
            }`}>
              <span className={compact ? 'hidden md:inline' : ''}>{compact ? '' : 'Page '}</span><span className="font-semibold">{currentPage}</span>
            </span>
          ) : (
            <span className={`font-medium text-foreground ${
              compact 
                ? 'text-xs' 
                : 'text-sm'
            }`}>
              <span className={compact ? 'hidden md:inline' : ''}>{compact ? '' : 'Page '}</span><span className="font-semibold">{currentPage.toLocaleString()}</span><span className={compact ? 'hidden sm:inline' : ''}>{compact ? ` / ${totalPages}` : ` of ${totalPages.toLocaleString()}`}</span>
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={`p-0 flex items-center justify-center rounded-md hover:bg-accent/10 disabled:opacity-40 transition-all duration-200 ${
            compact 
              ? 'h-5 w-5 sm:h-6 sm:w-6' 
              : 'h-8 w-8'
          }`}
          disabled={
            disabled || (!isView && (currentPage === totalPages || totalPages === 0))
          }
          onClick={() => onPageChange(currentPage + 1)}
          title="Next Page"
        >
          <ChevronRight size={compact ? 12 : 16} className={compact ? 'sm:size-3' : ''} />
        </Button>
        
        {/* Last page button */}
        <Button
          variant="ghost"
          size="sm"
          className={`p-0 flex items-center justify-center rounded-md hover:bg-accent/10 disabled:opacity-40 transition-all duration-200 ${
            compact 
              ? 'h-5 w-5 sm:h-6 sm:w-6 hidden sm:flex' 
              : 'h-8 w-8'
          }`}
          disabled={
            disabled || isView || currentPage === totalPages || totalPages === 0
          }
          onClick={() => onPageChange(totalPages)}
          title={isView ? "Not available for views" : "Last Page"}
        >
          <ChevronsRight size={compact ? 12 : 16} className={compact ? 'sm:size-3' : ''} />
        </Button>
      </div>
    </div>
  );
};

export default DataPreviewPagination;