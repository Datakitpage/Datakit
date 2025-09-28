import React, { useState, useEffect, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import TableCell from "./TableCell";
import { useQueryColumnFormatting } from "./useQueryColumnFormatting";


interface QueryResultsTableProps {
  results: any[];
  columns: string[];
}

const QueryResultsTable: React.FC<QueryResultsTableProps> = ({
  results,
  columns,
}) => {
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [totalTableWidth, setTotalTableWidth] = useState<number>(0);

  const { columnTypes, formatCellValue } = useQueryColumnFormatting({
    results,
    columns,
  });

  // Calculate column widths based on content
  useEffect(() => {
    if (!columns?.length || !results?.length) {
      setColumnWidths([]);
      return;
    }

    // Initial default widths
    const minWidth = 100;
    const maxWidth = 300;

    // Sample a subset of rows for performance
    const sampleSize = Math.min(results.length, 100);
    const sampled = results.slice(0, sampleSize);

    // Calculate widths based on content length
    const widths = columns.map((column, colIndex) => {
      // Start with column header length
      let maxLength = column.length;

      // Check sample data
      for (const row of sampled) {
        const value = row[column];
        const valueStr = formatValueAsString(value);
        maxLength = Math.max(maxLength, valueStr.length);
      }

      // Estimate width (characters × 8px per character)
      // with some padding and boundaries
      return Math.max(minWidth, Math.min(maxWidth, maxLength * 8 + 24));
    });

    setColumnWidths(widths);

    // Calculate total table width
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    setTotalTableWidth(Math.max(totalWidth, 500));
  }, [columns, results]);

  // Format a value as string for width calculation
  const formatValueAsString = (value: any): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return "Error formatting value";
      }
    }
    return String(value);
  };

  // Memoize the row renderer for better performance
  const Row = useMemo(() => {
    return React.memo(
      ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const row = results[index];
        if (!row) return null;

        return (
          <div
            style={{
              ...style,
              display: "flex",
            }}
            className={`${
              index % 2 === 0 ? "bg-background/20" : ""
            } hover:bg-accent/5`}
            role="row"
          >
            {columns.map((column, colIndex) => {
              const rawValue = row[column];
              const formattedValue = formatCellValue(String(rawValue || ''), index + 1, colIndex + 1);
              
              return (
                <TableCell
                  key={colIndex}
                  value={rawValue}
                  formattedValue={formattedValue}
                  width={columnWidths[colIndex] || 150}
                />
              );
            })}
          </div>
        );
      }
    );
  }, [results, columns, columnWidths]);

  // Early return for no data
  if (!results?.length || !columns?.length) {
    return <div className="p-4 text-muted-foreground">No data to display</div>;
  }

  return (
    <div
      className="h-full flex flex-col"
      role="table"
      aria-label="Query Results Table"
      aria-rowcount={results.length}
      aria-colcount={columns.length}
    >
      {/* Single scrollable container for both header and body */}
      <div className="flex-1 overflow-auto">
        <div style={{ width: totalTableWidth, minWidth: "100%" }}>
          {/* Table Header - sticky positioning for vertical scrolling */}
          <div
            className="sticky top-0 bg-popover z-10 border-b border-border shadow-sm"
            role="rowgroup"
          >
            <div className="flex" role="row">
              {columns.map((column, index) => (
                <div
                  key={index}
                  className="text-left p-2 text-xs font-medium text-foreground border-r border-border whitespace-nowrap z-100 bg-background"
                  style={{
                    width: columnWidths[index] || 150,
                    minWidth: columnWidths[index] || 150,
                  }}
                  title={column}
                  role="columnheader"
                >
                  {column}
                </div>
              ))}
            </div>
          </div>

          {/* Table Body - virtualized list */}
          <div className="flex-1">
            <List
              height={500} // Fixed height for reliable rendering
              width={totalTableWidth}
              itemCount={results.length}
              itemSize={28}
              overscanCount={10}
              className="scrollbar"
            >
              {Row}
            </List>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(QueryResultsTable);
