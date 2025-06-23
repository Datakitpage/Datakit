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
  samplingMode?: "fixed" | "custom";
  tableRowCount?: number;
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
  samplingInfo?: {
    mode: "fixed" | "custom";
    sampleSize?: number;
    totalRows?: number;
    samplingRatio?: number;
  };
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
      samplingMode = "fixed",
      tableRowCount,
    } = options;

    // Determine if we need SQL-level aggregation for performance
    const effectiveRowCount = tableRowCount || 0;
    const needsAggregation = effectiveRowCount > 500000; // Higher threshold for better data fidelity
    let aggregationBins = 200; // More bins by default for better resolution

    if (needsAggregation) {
      // Calculate optimal bins based on data size - preserve more detail
      if (effectiveRowCount <= 1000000) aggregationBins = 500;
      else if (effectiveRowCount <= 5000000) aggregationBins = 300;
      else if (effectiveRowCount <= 10000000) aggregationBins = 200;
      else aggregationBins = 100; // Only for truly massive datasets
    }

    // Build table reference with sampling
    let tableRef = database ? `"${database}"."${table}"` : `"${table}"`;
    
    // Apply intelligent sampling (only for custom mode and very large datasets)
    if (samplingMode === "custom" && effectiveRowCount > 100000) {
      const sampleSize = Math.max(limit || 10000, 10000); // Minimum 10k for good visualization
      
      // Only apply sampling if dataset is very large and sample size is significantly smaller
      if (sampleSize < effectiveRowCount * 0.5) { // Only sample if less than 50% of data
        const samplePercentage = Math.min(100, (sampleSize / effectiveRowCount) * 100 * 1.2); // 20% buffer
        
        // Use TABLESAMPLE SYSTEM for consistent sampling
        tableRef = `${tableRef} TABLESAMPLE SYSTEM(${samplePercentage.toFixed(2)})`;
      }
    }

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

    // Build GROUP BY clause with binning support
    const groupByClause = needsAggregation ? 
      `GROUP BY ${dimensionSQL}` : 
      `GROUP BY "${groupBy || dimension}"`;

    // Build ORDER BY clause
    const orderField =
      orderBy === "value" ? `${aggregation}_value` : `"${dimension}"`;
    const orderByClause = `ORDER BY ${orderField} ${orderDirection.toUpperCase()}`;

    // Handle special aggregations with optimized SQL for large datasets
    let dimensionSQL = `"${dimension}"`;
    let aggregationSQL = "";
    
    // Apply intelligent binning for large datasets - preserves more granularity
    if (needsAggregation && effectiveRowCount > 2000000) {
      // Adaptive precision binning for very large datasets
      dimensionSQL = `
        CASE 
          WHEN "${dimension}" IS NULL THEN 'NULL'
          ELSE CAST(
            ROUND(
              CAST("${dimension}" AS DOUBLE), 
              CASE 
                WHEN ABS(CAST("${dimension}" AS DOUBLE)) > 10000 THEN -2
                WHEN ABS(CAST("${dimension}" AS DOUBLE)) > 1000 THEN -1
                WHEN ABS(CAST("${dimension}" AS DOUBLE)) > 100 THEN 0
                WHEN ABS(CAST("${dimension}" AS DOUBLE)) > 10 THEN 1
                ELSE 2
              END
            ) AS VARCHAR
          )
        END`;
    } else if (needsAggregation) {
      // Moderate binning for large datasets - preserve more detail
      dimensionSQL = `
        CASE 
          WHEN "${dimension}" IS NULL THEN 'NULL'
          ELSE CAST(
            ROUND(
              CAST("${dimension}" AS DOUBLE), 
              CASE 
                WHEN ABS(CAST("${dimension}" AS DOUBLE)) > 100 THEN 0
                ELSE 1
              END
            ) AS VARCHAR
          )
        END`;
    }

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

    // Use intelligent limit based on dataset size and aggregation
    let finalLimit = limit;
    if (needsAggregation) {
      // For aggregated queries, we can handle more bins
      finalLimit = Math.min(limit || 1000, aggregationBins * 2);
    } else {
      // For direct queries, use the provided limit or a reasonable default
      finalLimit = limit || Math.min(25000, effectiveRowCount);
    }

    // Build final query with performance optimizations for database-driven visualization
    const query = `
      SELECT 
        ${dimensionSQL} as dimension,
        ${aggregationSQL},
        COUNT(*) as count,
        MIN("${measure}") as min_value,
        MAX("${measure}") as max_value
      FROM ${tableRef}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${finalLimit}
    `.trim();

    // Add performance comment for debugging
    const performanceNote = needsAggregation ? 
      `-- Performance: SQL-level binning applied (${aggregationBins} bins for ${effectiveRowCount.toLocaleString()} rows, limit: ${finalLimit})\n` : 
      `-- Performance: Direct query (${effectiveRowCount.toLocaleString()} rows, limit: ${finalLimit})\n`;
    
    return performanceNote + query;
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

        // Calculate sampling info
        let samplingInfo = undefined;
        const effectiveTableRowCount = options.tableRowCount || 0;
        if (options.samplingMode === "custom" && effectiveTableRowCount > 100000) {
          const requestedSampleSize = Math.max(options.limit || 10000, 10000);
          const actualSampleSize = formattedData.length;
          
          // Only show sampling info if we actually applied sampling
          if (requestedSampleSize < effectiveTableRowCount * 0.5) {
            samplingInfo = {
              mode: options.samplingMode,
              sampleSize: actualSampleSize,
              totalRows: effectiveTableRowCount,
              samplingRatio: actualSampleSize / effectiveTableRowCount,
            };
          }
        }

        const queryResult: QueryResult = {
          data: formattedData,
          rowCount: formattedData.length,
          executionTime,
          query,
          samplingInfo,
        };
        
        console.log(`[MosaicQuery] Query completed: ${formattedData.length} rows in ${executionTime}ms`, samplingInfo ? `(sampled from ${effectiveTableRowCount.toLocaleString()})` : '');

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
