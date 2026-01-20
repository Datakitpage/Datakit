/**
 * WASM Data Engine
 *
 * Abstraction layer over high-performance WASM-based data processing engines.
 * Currently supports:
 * - DuckDB WASM (SQL queries)
 * - Polars WASM (DataFrame operations)
 * - Custom Rust WASM modules (future)
 *
 * The goal is to keep heavy computation in WASM while keeping the UI responsive.
 */

import * as polars from '@/lib/polars/polars';

export interface DataEngineResult {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTimeMs: number;
  source: 'duckdb' | 'polars' | 'js';
}

export interface DataEngineStats {
  initialized: boolean;
  memoryUsageBytes: number;
  queriesExecuted: number;
  avgQueryTimeMs: number;
}

// Performance tracking
const performanceStats = {
  queriesExecuted: 0,
  totalQueryTimeMs: 0,
};

// DuckDB module interface (lazy loaded)
interface DuckDBModule {
  getDuckDB: () => Promise<unknown>;
  runQuery: (sql: string) => Promise<{ rows: Record<string, unknown>[]; columns: string[] }>;
  registerTable: (name: string, rows: Record<string, unknown>[]) => Promise<void>;
}

let duckdbModule: DuckDBModule | null = null;
let duckdbLoadAttempted = false;

async function loadDuckDB(): Promise<DuckDBModule | null> {
  if (duckdbLoadAttempted) return duckdbModule;
  duckdbLoadAttempted = true;

  try {
    // Dynamic import to avoid blocking initial load
    duckdbModule = await import('@/lib/duckdb/duckdb') as unknown as DuckDBModule;
    return duckdbModule;
  } catch {
    console.warn('DuckDB WASM not available, using JS fallback');
    return null;
  }
}

/**
 * Execute a SQL query using DuckDB WASM
 */
export async function executeSQL(
  sql: string,
  data?: { tableName: string; rows: Record<string, unknown>[] }
): Promise<DataEngineResult> {
  const startTime = performance.now();

  const duckdb = await loadDuckDB();

  if (!duckdb) {
    // Fallback: parse simple SQL and execute with JS
    return executeSimpleSQL(sql, data, startTime);
  }

  try {
    const db = await duckdb.getDuckDB();
    if (!db) {
      throw new Error('DuckDB not initialized');
    }

    // Register data as table if provided
    if (data) {
      await duckdb.registerTable(data.tableName, data.rows);
    }

    // Execute query
    const result = await duckdb.runQuery(sql);

    const executionTimeMs = performance.now() - startTime;
    performanceStats.queriesExecuted++;
    performanceStats.totalQueryTimeMs += executionTimeMs;

    return {
      data: result.rows || [],
      columns: result.columns || [],
      rowCount: result.rows?.length || 0,
      executionTimeMs,
      source: 'duckdb',
    };
  } catch (error) {
    console.error('SQL execution failed:', error);
    throw error;
  }
}

/**
 * Simple SQL parser for basic queries when DuckDB isn't available
 */
function executeSimpleSQL(
  sql: string,
  data?: { tableName: string; rows: Record<string, unknown>[] },
  startTime: number = performance.now()
): DataEngineResult {
  if (!data?.rows) {
    return {
      data: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: performance.now() - startTime,
      source: 'js',
    };
  }

  // Very basic SELECT * support
  const rows = data.rows;
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    data: rows,
    columns,
    rowCount: rows.length,
    executionTimeMs: performance.now() - startTime,
    source: 'js',
  };
}

/**
 * Filter data using Polars expressions
 */
export async function filterData(
  data: Record<string, unknown>[],
  expressions: polars.FilterExpression[]
): Promise<DataEngineResult> {
  const result = await polars.filter(data, expressions);

  performanceStats.queriesExecuted++;
  performanceStats.totalQueryTimeMs += result.executionTimeMs;

  return {
    data: result.data,
    columns: result.columns,
    rowCount: result.rowCount,
    executionTimeMs: result.executionTimeMs,
    source: polars.isAvailable() ? 'polars' : 'js',
  };
}

/**
 * Filter data with a predicate function (JS fallback)
 */
export async function filterDataWithPredicate(
  data: Record<string, unknown>[],
  predicate: (row: Record<string, unknown>) => boolean
): Promise<DataEngineResult> {
  const startTime = performance.now();

  const result = data.filter(predicate);

  const executionTimeMs = performance.now() - startTime;
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  performanceStats.queriesExecuted++;
  performanceStats.totalQueryTimeMs += executionTimeMs;

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs,
    source: 'js',
  };
}

/**
 * Sort data using Polars
 */
export async function sortData(
  data: Record<string, unknown>[],
  column: string,
  direction: 'asc' | 'desc' = 'asc'
): Promise<DataEngineResult> {
  const result = await polars.sort(data, [
    { column, descending: direction === 'desc', nullsLast: true }
  ]);

  performanceStats.queriesExecuted++;
  performanceStats.totalQueryTimeMs += result.executionTimeMs;

  return {
    data: result.data,
    columns: result.columns,
    rowCount: result.rowCount,
    executionTimeMs: result.executionTimeMs,
    source: polars.isAvailable() ? 'polars' : 'js',
  };
}

/**
 * Sort data by multiple columns
 */
export async function sortDataMultiple(
  data: Record<string, unknown>[],
  specs: { column: string; descending?: boolean }[]
): Promise<DataEngineResult> {
  const result = await polars.sort(data, specs.map(s => ({
    column: s.column,
    descending: s.descending,
    nullsLast: true,
  })));

  performanceStats.queriesExecuted++;
  performanceStats.totalQueryTimeMs += result.executionTimeMs;

  return {
    data: result.data,
    columns: result.columns,
    rowCount: result.rowCount,
    executionTimeMs: result.executionTimeMs,
    source: polars.isAvailable() ? 'polars' : 'js',
  };
}

/**
 * Aggregate data using Polars groupBy
 */
export async function aggregateData(
  data: Record<string, unknown>[],
  groupByColumns: string[],
  aggregations: { column: string; fn: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'mean' | 'std' | 'median' }[]
): Promise<DataEngineResult> {
  // Map to Polars aggregation spec
  const polarsAggs: polars.AggregationSpec[] = aggregations.map(agg => ({
    column: agg.column,
    fn: agg.fn === 'avg' ? 'mean' : agg.fn as polars.AggregationSpec['fn'],
  }));

  const result = await polars.groupBy(data, groupByColumns, polarsAggs);

  performanceStats.queriesExecuted++;
  performanceStats.totalQueryTimeMs += result.executionTimeMs;

  return {
    data: result.data,
    columns: result.columns,
    rowCount: result.rowCount,
    executionTimeMs: result.executionTimeMs,
    source: polars.isAvailable() ? 'polars' : 'js',
  };
}

/**
 * Get engine statistics
 */
export function getEngineStats(): DataEngineStats {
  return {
    initialized: polars.isAvailable() || duckdbLoadAttempted,
    memoryUsageBytes: 0, // TODO: Get actual memory usage from WASM
    queriesExecuted: performanceStats.queriesExecuted,
    avgQueryTimeMs:
      performanceStats.queriesExecuted > 0
        ? performanceStats.totalQueryTimeMs / performanceStats.queriesExecuted
        : 0,
  };
}

/**
 * Initialize all WASM engines
 */
export async function initEngines(): Promise<{
  polars: boolean;
  duckdb: boolean;
}> {
  const [polarsReady, duckdbReady] = await Promise.all([
    polars.initPolars(),
    loadDuckDB().then(m => !!m),
  ]);

  return { polars: polarsReady, duckdb: duckdbReady };
}

/**
 * Get column statistics using Polars
 */
export async function describeColumn(
  data: Record<string, unknown>[],
  column: string
) {
  return polars.describe(data, column);
}

/**
 * Join two datasets
 */
export async function joinData(
  left: Record<string, unknown>[],
  right: Record<string, unknown>[],
  on: string | string[],
  how: 'inner' | 'left' | 'right' | 'outer' = 'inner'
): Promise<DataEngineResult> {
  const result = await polars.join(left, right, on, how);

  performanceStats.queriesExecuted++;
  performanceStats.totalQueryTimeMs += result.executionTimeMs;

  return {
    data: result.data,
    columns: result.columns,
    rowCount: result.rowCount,
    executionTimeMs: result.executionTimeMs,
    source: polars.isAvailable() ? 'polars' : 'js',
  };
}

/**
 * Select specific columns
 */
export async function selectColumns(
  data: Record<string, unknown>[],
  columns: string[]
): Promise<DataEngineResult> {
  const result = await polars.select(data, columns);

  return {
    data: result.data,
    columns: result.columns,
    rowCount: result.rowCount,
    executionTimeMs: result.executionTimeMs,
    source: polars.isAvailable() ? 'polars' : 'js',
  };
}

/**
 * Sample random rows
 */
export async function sampleData(
  data: Record<string, unknown>[],
  n: number
): Promise<DataEngineResult> {
  const result = await polars.sample(data, n);

  return {
    data: result.data,
    columns: result.columns,
    rowCount: result.rowCount,
    executionTimeMs: result.executionTimeMs,
    source: polars.isAvailable() ? 'polars' : 'js',
  };
}

// Re-export Polars types for convenience
export type { FilterExpression, SortSpec, AggregationSpec } from '@/lib/polars/polars';

/**
 * Benchmark data operation
 */
export async function benchmark(
  operation: () => Promise<DataEngineResult>,
  iterations: number = 10
): Promise<{ avgMs: number; minMs: number; maxMs: number }> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await operation();
    times.push(performance.now() - start);
  }

  return {
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}
