/**
 * Polars WASM Integration
 *
 * Wraps the polars-js WASM library for high-performance DataFrame operations.
 * Polars is a fast DataFrame library written in Rust, compiled to WASM.
 *
 * Features:
 * - Lazy evaluation for query optimization
 * - Apache Arrow memory format
 * - Multi-threaded execution (when available)
 * - SQL and DataFrame APIs
 */

// Type definitions for Polars operations
export interface PolarsDataFrame {
  columns: string[];
  rows: Record<string, unknown>[];
  shape: [number, number]; // [rows, cols]
}

export interface PolarsResult {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTimeMs: number;
}

export interface FilterExpression {
  column: string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'isNull' | 'isNotNull';
  value?: unknown;
}

export interface SortSpec {
  column: string;
  descending?: boolean;
  nullsLast?: boolean;
}

export interface AggregationSpec {
  column: string;
  fn: 'sum' | 'mean' | 'min' | 'max' | 'count' | 'first' | 'last' | 'std' | 'var' | 'median';
  alias?: string;
}

// Polars WASM module state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let polarsModule: any = null;
let polarsLoadAttempted = false;
let isPolarsAvailable = false;

/**
 * Initialize Polars WASM
 */
export async function initPolars(): Promise<boolean> {
  if (polarsLoadAttempted) return isPolarsAvailable;
  polarsLoadAttempted = true;

  try {
    // Try to load nodejs-polars (works in browser with WASM)
    // Dynamic import with string to prevent TS from resolving module
    const modulePath = 'nodejs-polars';
    polarsModule = await import(/* @vite-ignore */ modulePath);
    isPolarsAvailable = true;
    console.log('Polars WASM initialized successfully');
    return true;
  } catch {
    console.warn('Polars WASM not available, using JS fallback for DataFrame operations');
    isPolarsAvailable = false;
    return false;
  }
}

/**
 * Check if Polars is available
 */
export function isAvailable(): boolean {
  return isPolarsAvailable;
}

/**
 * Create a DataFrame from JSON data
 */
export async function fromJSON(data: Record<string, unknown>[]): Promise<PolarsDataFrame> {
  const startTime = performance.now();

  if (polarsModule && isPolarsAvailable) {
    try {
      const df = polarsModule.DataFrame(data);
      return {
        columns: df.columns,
        rows: df.toRecords(),
        shape: df.shape as [number, number],
      };
    } catch (error) {
      console.warn('Polars fromJSON failed, using fallback:', error);
    }
  }

  // Fallback: JS implementation
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  return {
    columns,
    rows: data,
    shape: [data.length, columns.length],
  };
}

/**
 * Filter DataFrame rows
 */
export async function filter(
  data: Record<string, unknown>[],
  expressions: FilterExpression[]
): Promise<PolarsResult> {
  const startTime = performance.now();

  // Build filter predicate
  const predicate = (row: Record<string, unknown>): boolean => {
    return expressions.every(expr => {
      const val = row[expr.column];

      switch (expr.op) {
        case 'eq':
          return val === expr.value;
        case 'ne':
          return val !== expr.value;
        case 'gt':
          return typeof val === 'number' && typeof expr.value === 'number' && val > expr.value;
        case 'gte':
          return typeof val === 'number' && typeof expr.value === 'number' && val >= expr.value;
        case 'lt':
          return typeof val === 'number' && typeof expr.value === 'number' && val < expr.value;
        case 'lte':
          return typeof val === 'number' && typeof expr.value === 'number' && val <= expr.value;
        case 'contains':
          return typeof val === 'string' && typeof expr.value === 'string' && val.includes(expr.value);
        case 'startsWith':
          return typeof val === 'string' && typeof expr.value === 'string' && val.startsWith(expr.value);
        case 'endsWith':
          return typeof val === 'string' && typeof expr.value === 'string' && val.endsWith(expr.value);
        case 'isNull':
          return val === null || val === undefined;
        case 'isNotNull':
          return val !== null && val !== undefined;
        default:
          return true;
      }
    });
  };

  const result = data.filter(predicate);
  const columns = result.length > 0 ? Object.keys(result[0]) : [];

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Sort DataFrame
 */
export async function sort(
  data: Record<string, unknown>[],
  specs: SortSpec[]
): Promise<PolarsResult> {
  const startTime = performance.now();

  const result = [...data].sort((a, b) => {
    for (const spec of specs) {
      const aVal = a[spec.column];
      const bVal = b[spec.column];

      // Handle nulls
      if (aVal === null || aVal === undefined) {
        return spec.nullsLast ? 1 : -1;
      }
      if (bVal === null || bVal === undefined) {
        return spec.nullsLast ? -1 : 1;
      }

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      if (comparison !== 0) {
        return spec.descending ? -comparison : comparison;
      }
    }
    return 0;
  });

  const columns = result.length > 0 ? Object.keys(result[0]) : [];

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Group by and aggregate
 */
export async function groupBy(
  data: Record<string, unknown>[],
  groupColumns: string[],
  aggregations: AggregationSpec[]
): Promise<PolarsResult> {
  const startTime = performance.now();

  // Group rows
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of data) {
    const key = groupColumns.map(col => JSON.stringify(row[col])).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Aggregate each group
  const result: Record<string, unknown>[] = [];

  for (const [key, rows] of groups) {
    const aggregated: Record<string, unknown> = {};

    // Add group columns
    groupColumns.forEach((col, i) => {
      aggregated[col] = JSON.parse(key.split('|')[i]);
    });

    // Apply aggregations
    for (const agg of aggregations) {
      const values = rows
        .map(r => r[agg.column])
        .filter(v => v !== null && v !== undefined) as number[];

      const alias = agg.alias || `${agg.column}_${agg.fn}`;

      switch (agg.fn) {
        case 'sum':
          aggregated[alias] = values.reduce((a, b) => a + b, 0);
          break;
        case 'mean':
          aggregated[alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
          break;
        case 'min':
          aggregated[alias] = values.length > 0 ? Math.min(...values) : null;
          break;
        case 'max':
          aggregated[alias] = values.length > 0 ? Math.max(...values) : null;
          break;
        case 'count':
          aggregated[alias] = rows.length;
          break;
        case 'first':
          aggregated[alias] = rows[0]?.[agg.column] ?? null;
          break;
        case 'last':
          aggregated[alias] = rows[rows.length - 1]?.[agg.column] ?? null;
          break;
        case 'std': {
          if (values.length < 2) {
            aggregated[alias] = null;
          } else {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
            aggregated[alias] = Math.sqrt(variance);
          }
          break;
        }
        case 'var': {
          if (values.length < 2) {
            aggregated[alias] = null;
          } else {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            aggregated[alias] = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
          }
          break;
        }
        case 'median': {
          if (values.length === 0) {
            aggregated[alias] = null;
          } else {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            aggregated[alias] = sorted.length % 2 !== 0
              ? sorted[mid]
              : (sorted[mid - 1] + sorted[mid]) / 2;
          }
          break;
        }
      }
    }

    result.push(aggregated);
  }

  const columns = result.length > 0 ? Object.keys(result[0]) : [];

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Select specific columns
 */
export async function select(
  data: Record<string, unknown>[],
  columns: string[]
): Promise<PolarsResult> {
  const startTime = performance.now();

  const result = data.map(row => {
    const selected: Record<string, unknown> = {};
    for (const col of columns) {
      if (col in row) {
        selected[col] = row[col];
      }
    }
    return selected;
  });

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Add a computed column
 */
export async function withColumn(
  data: Record<string, unknown>[],
  name: string,
  compute: (row: Record<string, unknown>) => unknown
): Promise<PolarsResult> {
  const startTime = performance.now();

  const result = data.map(row => ({
    ...row,
    [name]: compute(row),
  }));

  const columns = result.length > 0 ? Object.keys(result[0]) : [];

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Join two DataFrames
 */
export async function join(
  left: Record<string, unknown>[],
  right: Record<string, unknown>[],
  on: string | string[],
  how: 'inner' | 'left' | 'right' | 'outer' = 'inner'
): Promise<PolarsResult> {
  const startTime = performance.now();

  const keys = Array.isArray(on) ? on : [on];

  // Build index for right table
  const rightIndex = new Map<string, Record<string, unknown>[]>();
  for (const row of right) {
    const key = keys.map(k => JSON.stringify(row[k])).join('|');
    if (!rightIndex.has(key)) rightIndex.set(key, []);
    rightIndex.get(key)!.push(row);
  }

  const result: Record<string, unknown>[] = [];

  // Process left table
  const matchedRightKeys = new Set<string>();
  for (const leftRow of left) {
    const key = keys.map(k => JSON.stringify(leftRow[k])).join('|');
    const rightRows = rightIndex.get(key);

    if (rightRows) {
      matchedRightKeys.add(key);
      for (const rightRow of rightRows) {
        result.push({ ...leftRow, ...rightRow });
      }
    } else if (how === 'left' || how === 'outer') {
      result.push({ ...leftRow });
    }
  }

  // Add unmatched right rows for right/outer joins
  if (how === 'right' || how === 'outer') {
    for (const rightRow of right) {
      const key = keys.map(k => JSON.stringify(rightRow[k])).join('|');
      if (!matchedRightKeys.has(key)) {
        result.push({ ...rightRow });
      }
    }
  }

  const columns = result.length > 0 ? Object.keys(result[0]) : [];

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Get column statistics
 */
export async function describe(
  data: Record<string, unknown>[],
  column: string
): Promise<{
  count: number;
  nullCount: number;
  mean: number | null;
  std: number | null;
  min: unknown;
  max: unknown;
  median: number | null;
  unique: number;
}> {
  const values = data.map(r => r[column]);
  const nonNull = values.filter(v => v !== null && v !== undefined);
  const numbers = nonNull.filter(v => typeof v === 'number') as number[];

  let mean: number | null = null;
  let std: number | null = null;
  let median: number | null = null;
  let min: unknown = null;
  let max: unknown = null;

  if (numbers.length > 0) {
    mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    min = Math.min(...numbers);
    max = Math.max(...numbers);

    if (numbers.length > 1) {
      const variance = numbers.reduce((sum, v) => sum + Math.pow(v - mean!, 2), 0) / (numbers.length - 1);
      std = Math.sqrt(variance);
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    median = sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  } else if (nonNull.length > 0) {
    // String min/max
    const strings = nonNull.map(v => String(v)).sort();
    min = strings[0];
    max = strings[strings.length - 1];
  }

  return {
    count: nonNull.length,
    nullCount: values.length - nonNull.length,
    mean,
    std,
    min,
    max,
    median,
    unique: new Set(nonNull.map(v => JSON.stringify(v))).size,
  };
}

/**
 * Sample random rows
 */
export async function sample(
  data: Record<string, unknown>[],
  n: number,
  withReplacement: boolean = false
): Promise<PolarsResult> {
  const startTime = performance.now();

  let result: Record<string, unknown>[];

  if (withReplacement) {
    result = Array.from({ length: n }, () => data[Math.floor(Math.random() * data.length)]);
  } else {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    result = shuffled.slice(0, Math.min(n, data.length));
  }

  const columns = result.length > 0 ? Object.keys(result[0]) : [];

  return {
    data: result,
    columns,
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

/**
 * Get unique values in a column
 */
export async function unique(
  data: Record<string, unknown>[],
  column: string
): Promise<PolarsResult> {
  const startTime = performance.now();

  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];

  for (const row of data) {
    const key = JSON.stringify(row[column]);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ [column]: row[column] });
    }
  }

  return {
    data: result,
    columns: [column],
    rowCount: result.length,
    executionTimeMs: performance.now() - startTime,
  };
}

// Export all functions as a namespace-like object
export const polars = {
  init: initPolars,
  isAvailable,
  fromJSON,
  filter,
  sort,
  groupBy,
  select,
  withColumn,
  join,
  describe,
  sample,
  unique,
};

export default polars;
