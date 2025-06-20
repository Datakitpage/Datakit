import { useState, useCallback, useEffect } from "react";
import { useDuckDBStore } from "@/store/duckDBStore";

export interface QueryOptions {
  table: string;
  dimension: string;
  measure: string;
  aggregation: "sum" | "avg" | "min" | "max" | "count";
  filters?: Filter[];
  limit?: number;
  groupBy?: string;
  orderBy?: "value" | "dimension";
  orderDirection?: "asc" | "desc";
  source?: "local" | "motherduck";
  database?: string;
}

export interface Filter {
  field: string;
  operator:
    | "="
    | ">"
    | "<"
    | ">="
    | "<="
    | "!="
    | "contains"
    | "startsWith"
    | "endsWith";
  value: string | number;
}

export interface QueryResult {
  data: any[];
  rowCount: number;
  executionTime: number;
  query: string;
}

/**
 * Hook for building and executing Mosaic-compatible queries
 */
export const useMosaicQuery = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<QueryResult | null>(null);

  const { executeQuery, executeMotherDuckQuery } = useDuckDBStore();

  /**
   * Build SQL query from options
   */
  const buildQuery = useCallback((options: QueryOptions): string => {
    const {
      table,
      dimension,
      measure,
      aggregation,
      filters = [],
      limit = 1000,
      groupBy,
      orderBy = "value",
      orderDirection = "desc",
      database,
    } = options;

    // Build table reference
    const tableRef = database ? `"${database}"."${table}"` : `"${table}"`;

    // Build WHERE clause
    let whereClause = "";
    if (filters.length > 0) {
      const conditions = filters.map((filter) => {
        const field = `"${filter.field}"`;
        const value =
          typeof filter.value === "string" ? `'${filter.value}'` : filter.value;

        switch (filter.operator) {
          case "contains":
            return `${field} LIKE '%${filter.value}%'`;
          case "startsWith":
            return `${field} LIKE '${filter.value}%'`;
          case "endsWith":
            return `${field} LIKE '%${filter.value}'`;
          default:
            return `${field} ${filter.operator} ${value}`;
        }
      });
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    // Build GROUP BY clause
    const groupByField = groupBy || dimension;
    const groupByClause = `GROUP BY "${groupByField}"`;

    // Build ORDER BY clause
    const orderField =
      orderBy === "value" ? `${aggregation}_value` : `"${dimension}"`;
    const orderByClause = `ORDER BY ${orderField} ${orderDirection.toUpperCase()}`;

    // Handle special aggregations
    let aggregationSQL = "";
    switch (aggregation) {
      case "count":
        aggregationSQL = `COUNT(*) as ${aggregation}_value`;
        break;
      case "sum":
      case "avg":
      case "min":
      case "max":
        aggregationSQL = `${aggregation.toUpperCase()}("${measure}") as ${aggregation}_value`;
        break;
      default:
        aggregationSQL = `${aggregation.toUpperCase()}("${measure}") as ${aggregation}_value`;
    }

    // Build final query
    const query = `
      SELECT 
        "${dimension}" as dimension,
        ${aggregationSQL},
        COUNT(*) as count
      FROM ${tableRef}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `.trim();

    return query;
  }, []);

  /**
   * Build a query for getting row count
   */
  const buildCountQuery = useCallback(
    (table: string, database?: string, filters?: Filter[]): string => {
      const tableRef = database ? `"${database}"."${table}"` : `"${table}"`;

      let whereClause = "";
      if (filters && filters.length > 0) {
        const conditions = filters.map((filter) => {
          const field = `"${filter.field}"`;
          const value =
            typeof filter.value === "string"
              ? `'${filter.value}'`
              : filter.value;

          switch (filter.operator) {
            case "contains":
              return `${field} LIKE '%${filter.value}%'`;
            case "startsWith":
              return `${field} LIKE '${filter.value}%'`;
            case "endsWith":
              return `${field} LIKE '%${filter.value}'`;
            default:
              return `${field} ${filter.operator} ${value}`;
          }
        });
        whereClause = `WHERE ${conditions.join(" AND ")}`;
      }

      return `SELECT COUNT(*) as total_count FROM ${tableRef} ${whereClause}`;
    },
    []
  );

  /**
   * Execute query with progress tracking
   */
  const executeQueryWithProgress = useCallback(
    async (options: QueryOptions): Promise<QueryResult> => {
      setIsExecuting(true);
      setError(null);
      setProgress(0);

      const startTime = Date.now();

      try {
        // Build the main query
        const query = buildQuery(options);
        console.log("[MosaicQuery] Executing query:", query);

        // Simulate progress for UX (since DuckDB doesn't provide real progress)
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        // Execute based on source
        let result;
        if (options.source === "motherduck" && options.database) {
          result = await executeMotherDuckQuery(query, options.database);
        } else {
          const queryResult = await executeQuery(query);
          result = queryResult?.toArray() || [];
        }

        clearInterval(progressInterval);
        setProgress(100);

        // Format the result data
        const formattedData = result.map((row: any) => ({
          [options.dimension]: row.dimension,
          [options.measure]: row[`${options.aggregation}_value`],
          count: typeof row.count === "bigint" ? Number(row.count) : row.count,
          // Keep original values for export
          _raw: row,
        }));

        const executionTime = Date.now() - startTime;

        const queryResult: QueryResult = {
          data: formattedData,
          rowCount: formattedData.length,
          executionTime,
          query,
        };

        setLastResult(queryResult);
        setProgress(0);
        setIsExecuting(false);

        return queryResult;
      } catch (err) {
        console.error("[MosaicQuery] Query execution error:", err);
        setError(err instanceof Error ? err.message : "Query execution failed");
        setProgress(0);
        setIsExecuting(false);
        throw err;
      }
    },
    [buildQuery, executeQuery, executeMotherDuckQuery]
  );

  /**
   * Get total row count for a table
   */
  const getTableRowCount = useCallback(
    async (
      table: string,
      database?: string,
      filters?: Filter[]
    ): Promise<number> => {
      try {
        const countQuery = buildCountQuery(table, database, filters);
        console.log("[MosaicQuery] Getting row count:", countQuery);

        let result;
        if (database) {
          result = await executeMotherDuckQuery(countQuery, database);
        } else {
          const queryResult = await executeQuery(countQuery);
          result = queryResult?.toArray() || [];
        }

        return result[0]?.total_count || 0;
      } catch (err) {
        console.error("[MosaicQuery] Count query error:", err);
        return 0;
      }
    },
    [buildCountQuery, executeQuery, executeMotherDuckQuery]
  );

  /**
   * Generate SQL without executing
   */
  const generateSQL = useCallback(
    (options: QueryOptions): string => {
      return buildQuery(options);
    },
    [buildQuery]
  );

  return {
    executeQuery: executeQueryWithProgress,
    generateSQL,
    getTableRowCount,
    isExecuting,
    error,
    progress,
    lastResult,
  };
};
