import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useQueryColumnFormatting } from './useQueryColumnFormatting';

interface QueryResultsHeaderProps {
  totalRows: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  results: any[];
  columns: string[];
}

const QueryResultsHeader: React.FC<QueryResultsHeaderProps> = ({ 
  totalRows, 
  currentPage, 
  totalPages, 
  rowsPerPage,
  results,
  columns
}) => {
  const { formatCellValue } = useQueryColumnFormatting({
    results,
    columns,
  });


  const downloadCSV = () => {
    if (!results || !columns) return;
    
    const csvContent = [
      columns.join(','),
      ...results.map((row, rowIndex) => 
        columns.map((col, colIndex) => {
          const rawValue = row[col];
          const formattedValue = formatCellValue(String(rawValue || ''), rowIndex + 1, colIndex + 1);
          
          if (formattedValue === null || formattedValue === undefined || formattedValue === '') {
            return '';
          }
          
          // Handle CSV escaping for formatted values
          const valueStr = String(formattedValue);
          if (valueStr.includes(',') || valueStr.includes('"') || valueStr.includes('\n')) {
            return `"${valueStr.replace(/"/g, '""')}"`;
          }
          return valueStr;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `query_results_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex justify-between items-center p-3 border-b border-border">
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">{totalRows.toLocaleString()}</span> rows returned
        {totalRows > rowsPerPage && (
          <span className="ml-2">
            (showing page {currentPage} of {totalPages})
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs border-primary"
          onClick={downloadCSV}
        >
          <Download size={12} className="mr-1" />
          <span>Download CSV</span>
        </Button>
      </div>
    </div>
  );
};

export default QueryResultsHeader;