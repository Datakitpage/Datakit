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
  samplingMode?: "fixed" | "smart" | "custom";
  samplingType?: "random" | "systematic";
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
    mode: "fixed" | "smart" | "custom";
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
   * Calculate optimal sample size for smart sampling
   */
  const calculateSmartSampleSize = useCallback((tableRowCount: number): number => {
    // Smart sampling algorithm based on statistical principles
    if (tableRowCount <= 1000) return tableRowCount; // No sampling needed
    if (tableRowCount <= 10000) return Math.min(5000, Math.floor(tableRowCount * 0.8));
    if (tableRowCount <= 100000) return Math.min(10000, Math.floor(tableRowCount * 0.3));
    if (tableRowCount <= 1000000) return Math.min(25000, Math.floor(tableRowCount * 0.1));
    // For very large datasets (>1M), use statistical sampling
    return Math.min(50000, Math.floor(Math.sqrt(tableRowCount) * 100));
  }, []);

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
      samplingType = "random",
      tableRowCount,
    } = options;

    // Determine if we need SQL-level aggregation for performance
    const effectiveRowCount = tableRowCount || 0;
    const needsAggregation = effectiveRowCount > 100000;
    let aggregationBins = 100; // Default bins for large datasets

    if (needsAggregation) {
      // Calculate optimal bins based on data size
      if (effectiveRowCount <= 1000000) aggregationBins = 200;
      else if (effectiveRowCount <= 10000000) aggregationBins = 100;
      else aggregationBins = 50; // Massive datasets
    }

    // Build table reference with sampling
    let tableRef = database ? `"${database}"."${table}"` : `"${table}"`;
    
    // Apply sampling if needed
    if (samplingMode !== "fixed" && effectiveRowCount > 0) {
      let sampleSize: number;
      
      if (samplingMode === "smart") {
        sampleSize = calculateSmartSampleSize(effectiveRowCount);
      } else {
        sampleSize = limit || 1000;
      }
      
      // Only apply sampling if it's beneficial
      if (sampleSize < effectiveRowCount) {
        const samplePercentage = (sampleSize / effectiveRowCount) * 100;
        
        if (samplingType === "random") {
          // Use TABLESAMPLE BERNOULLI for random sampling
          tableRef = `${tableRef} TABLESAMPLE BERNOULLI(${samplePercentage.toFixed(2)})`;
        } else {
          // Use TABLESAMPLE SYSTEM for systematic sampling (faster)
          tableRef = `${tableRef} TABLESAMPLE SYSTEM(${samplePercentage.toFixed(2)})`;
        }
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
    
    // Apply intelligent binning for large datasets - optimized for Mosaic
    if (needsAggregation && effectiveRowCount > 500000) {
      // Use percentile-based binning for better distribution
      dimensionSQL = `
        CASE 
          WHEN "${dimension}" IS NULL THEN 'NULL'
          ELSE CAST(
            ROUND(
              CAST("${dimension}" AS DOUBLE), 
              CASE 
                WHEN ABS(CAST("${dimension}" AS DOUBLE)) > 1000 THEN -1
                WHEN ABS(CAST("${dimension}" AS DOUBLE)) > 10 THEN 0  
                ELSE 2
              END
            ) AS VARCHAR
          )
        END`;
    } else if (needsAggregation) {
      // Simpler binning for medium datasets
      dimensionSQL = `
        CASE 
          WHEN "${dimension}" IS NULL THEN 'NULL'
          ELSE CAST(ROUND(CAST("${dimension}" AS DOUBLE), 1) AS VARCHAR)
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

    // Determine final limit - optimized for Mosaic streaming
    let finalLimit = limit;
    if (samplingMode === "smart" && effectiveRowCount > 0) {
      // For Mosaic, allow larger result sets since they're streamed efficiently
      const smartSampleSize = calculateSmartSampleSize(effectiveRowCount);
      finalLimit = Math.min(limit * 5, Math.floor(smartSampleSize / 2)); // Allow more results for Mosaic
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
      `-- Performance: SQL-level binning applied (${aggregationBins} bins for ${effectiveRowCount.toLocaleString()} rows)\n` : 
      `-- Performance: Direct query (${effectiveRowCount.toLocaleString()} rows)\n`;
    
    return performanceNote + query;
  }, [calculateSmartSampleSize]);

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
        if (options.samplingMode !== "fixed" && effectiveTableRowCount > 0) {
          const sampleSize = options.samplingMode === "smart" 
            ? calculateSmartSampleSize(effectiveTableRowCount)
            : options.limit || 1000;
          
          samplingInfo = {
            mode: options.samplingMode,
            sampleSize,
            totalRows: effectiveTableRowCount,
            samplingRatio: sampleSize / effectiveTableRowCount,
          };
        }

        const queryResult: QueryResult = {
          data: formattedData,
          rowCount: formattedData.length,
          executionTime,
          query,
          samplingInfo,
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
