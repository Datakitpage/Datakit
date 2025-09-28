import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QueryResultsPaginationProps {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
}

const QueryResultsPagination: React.FC<QueryResultsPaginationProps> = ({
  currentPage,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) => {
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRowsPerPage = Number(e.target.value);
    if (onRowsPerPageChange) {
      onRowsPerPageChange(newRowsPerPage);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-popover mt-1 rounded-b">
      <div className="flex items-center space-x-2">
        <span className="text-xs text-muted-foreground">Rows per page:</span>
        <select
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
          className="bg-background text-foreground text-xs p-1 rounded border border-border"
        >
          <option value={100}>100</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
          <option value={5000}>5000</option>
          <option value={10000}>10000</option>
          <option value={20000}>20000</option>
          <option value={50000}>50000</option>
        </select>
      </div>

      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === 1}
          onClick={() => onPageChange && onPageChange(1)}
          title="First Page"
        >
          <ChevronsLeft size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === 1}
          onClick={() => onPageChange && onPageChange(currentPage - 1)}
          title="Previous Page"
        >
          <ChevronLeft size={14} />
        </Button>

        <span className="text-xs text-muted-foreground px-2">
          Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange && onPageChange(currentPage + 1)}
          title="Next Page"
        >
          <ChevronRight size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange && onPageChange(totalPages)}
          title="Last Page"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>

      {/* Jump to page input for large result sets */}
      {totalPages > 10 && (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground">Go to:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value);
              if (!isNaN(page) && page >= 1 && page <= totalPages) {
                onPageChange && onPageChange(page);
              }
            }}
            className="bg-background text-foreground text-xs p-1 rounded border border-border w-16 text-center"
          />
        </div>
      )}
    </div>
  );
};

export default QueryResultsPagination;
