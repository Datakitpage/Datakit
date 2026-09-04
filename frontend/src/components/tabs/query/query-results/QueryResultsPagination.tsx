import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/Button";

interface QueryResultsPaginationProps {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
}

// Page sizes at or above this need an explicit confirmation, since loading and
// exporting that many rows can use a lot of memory and slow the browser down.
const LARGE_PAGE_SIZE_THRESHOLD = 500000;

const QueryResultsPagination: React.FC<QueryResultsPaginationProps> = ({
  currentPage,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) => {
  const { t } = useTranslation();
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRowsPerPage = Number(e.target.value);
    if (!onRowsPerPageChange) return;

    if (newRowsPerPage >= LARGE_PAGE_SIZE_THRESHOLD) {
      const confirmed = window.confirm(
        t('queryResults.pagination.largeSelectionWarning', {
          defaultValue:
            'Loading {{rows}} rows at once may use a lot of memory and slow down your browser. Continue?',
          rows: newRowsPerPage.toLocaleString(),
        })
      );
      if (!confirmed) return;
    }

    onRowsPerPageChange(newRowsPerPage);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-darkNav mt-1 rounded-b">
      <div className="flex items-center space-x-2">
        <span className="text-xs text-white/70">{t('queryResults.pagination.rowsPerPage', { defaultValue: 'Rows per page:' })}</span>
        <select
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
          className="bg-background text-white text-xs p-1 rounded border border-white/10"
        >
          <option value={100}>100</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
          <option value={5000}>5000</option>
          <option value={10000}>10000</option>
          <option value={20000}>20000</option>
          <option value={50000}>50000</option>
          <option value={100000}>100000</option>
          <option value={200000}>200000</option>
          <option value={500000}>500000</option>
          <option value={1000000}>1000000</option>
        </select>
      </div>

      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === 1}
          onClick={() => onPageChange && onPageChange(1)}
          title={t('queryResults.pagination.firstPage', { defaultValue: 'First Page' })}
        >
          <ChevronsLeft size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === 1}
          onClick={() => onPageChange && onPageChange(currentPage - 1)}
          title={t('queryResults.pagination.previousPage', { defaultValue: 'Previous Page' })}
        >
          <ChevronLeft size={14} />
        </Button>

        <span className="text-xs text-white/70 px-2">
          {t('queryResults.pagination.pageOf', { defaultValue: 'Page {{current}} of {{total}}', current: currentPage.toLocaleString(), total: totalPages.toLocaleString() })}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange && onPageChange(currentPage + 1)}
          title={t('queryResults.pagination.nextPage', { defaultValue: 'Next Page' })}
        >
          <ChevronRight size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 flex items-center justify-center"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange && onPageChange(totalPages)}
          title={t('queryResults.pagination.lastPage', { defaultValue: 'Last Page' })}
        >
          <ChevronsRight size={14} />
        </Button>
      </div>

      {/* Jump to page input for large result sets */}
      {totalPages > 10 && (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-white/70">{t('queryResults.pagination.goTo', { defaultValue: 'Go to:' })}</span>
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
            className="bg-background text-white text-xs p-1 rounded border border-white/10 w-16 text-center"
          />
        </div>
      )}
    </div>
  );
};

export default QueryResultsPagination;
