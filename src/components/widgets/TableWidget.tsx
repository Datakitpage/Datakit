import { useEffect, useState } from "react";
import { useDataStore } from "@/store/dataStore";

interface TableWidgetProps {
  config: Record<string, unknown>;
}

export function TableWidget({ config }: TableWidgetProps) {
  const { executeQuery, getSampleData, dataSources } = useDataStore();
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dataSourceId = config.dataSourceId as string | undefined;
  const sql = config.sql as string | undefined;

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      
      try {
        let result: any[] | null = null;

        if (sql) {
          result = await executeQuery(sql);
        } else if (dataSourceId) {
          const ds = dataSources.find((d) => d.id === dataSourceId);
          if (ds) {
            result = await getSampleData(ds.tableName, 100);
          }
        }

        if (result && result.length > 0) {
          setColumns(Object.keys(result[0]));
          setData(result);
        }
      } catch (err) {
        console.error("[TableWidget] Load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [sql, dataSourceId, executeQuery, getSampleData, dataSources]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-muted text-sm">
        No data
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background-elevated">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-medium text-foreground-muted border-b border-border whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i} className="hover:bg-accent/50 transition-fast">
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-1.5 text-foreground border-b border-border/50 whitespace-nowrap max-w-[200px] truncate"
                >
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 50 && (
        <div className="px-3 py-2 text-xs text-foreground-muted border-t border-border">
          Showing 50 of {data.length} rows
        </div>
      )}
    </div>
  );
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}
