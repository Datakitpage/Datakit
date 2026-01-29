/**
 * Excel Function to DuckDB SQL Mappings
 *
 * Maps common Excel functions to their DuckDB equivalents.
 * Some functions require special transformation (like IF → CASE WHEN).
 */

import type { FunctionMapping } from './types';

/**
 * Set of aggregate functions that operate on entire columns
 */
export const AGGREGATE_FUNCTIONS = new Set([
  'SUM',
  'AVG',
  'AVERAGE',
  'COUNT',
  'COUNTA',
  'MIN',
  'MAX',
  'STDEV',
  'STDEVP',
  'VAR',
  'VARP',
  'SUMIF',
  'COUNTIF',
  'AVERAGEIF',
]);

/**
 * Excel function to DuckDB SQL mapping
 */
export const FUNCTION_MAP: Record<string, FunctionMapping> = {
  // ============================================================================
  // Aggregate Functions
  // ============================================================================
  SUM: {
    sql: 'SUM',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },
  AVG: {
    sql: 'AVG',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },
  AVERAGE: {
    sql: 'AVG',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },
  COUNT: {
    sql: 'COUNT',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },
  COUNTA: {
    sql: 'COUNT',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },
  MIN: {
    sql: 'MIN',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },
  MAX: {
    sql: 'MAX',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },

  // ============================================================================
  // Conditional Aggregate Functions (special handling in translator)
  // ============================================================================
  // SUMIF(condition, sum_column) - sums sum_column where condition is true
  // COUNTIF(condition) - counts rows where condition is true
  // AVERAGEIF(condition, avg_column) - averages avg_column where condition is true
  SUMIF: {
    sql: 'SUM',
    isAggregate: true,
    minArgs: 2,
    maxArgs: 2,
  },
  COUNTIF: {
    sql: 'COUNT',
    isAggregate: true,
    minArgs: 1,
    maxArgs: 1,
  },
  AVERAGEIF: {
    sql: 'AVG',
    isAggregate: true,
    minArgs: 2,
    maxArgs: 2,
  },

  // ============================================================================
  // Conditional Functions (IF uses special handling in translator)
  // ============================================================================
  IF: {
    sql: 'CASE',
    isAggregate: false,
    minArgs: 3,
    maxArgs: 3,
  },

  // ============================================================================
  // String Functions
  // ============================================================================
  UPPER: {
    sql: 'UPPER',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  LOWER: {
    sql: 'LOWER',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  TRIM: {
    sql: 'TRIM',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  LEN: {
    sql: 'LENGTH',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  LENGTH: {
    sql: 'LENGTH',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  LEFT: {
    sql: 'LEFT',
    isAggregate: false,
    minArgs: 2,
    maxArgs: 2,
  },
  RIGHT: {
    sql: 'RIGHT',
    isAggregate: false,
    minArgs: 2,
    maxArgs: 2,
  },
  MID: {
    sql: 'SUBSTRING',
    isAggregate: false,
    minArgs: 3,
    maxArgs: 3,
  },
  CONCAT: {
    sql: 'CONCAT',
    isAggregate: false,
    minArgs: 1,
  },
  CONCATENATE: {
    sql: 'CONCAT',
    isAggregate: false,
    minArgs: 1,
  },
  SUBSTITUTE: {
    sql: 'REPLACE',
    isAggregate: false,
    minArgs: 3,
    maxArgs: 3,
  },

  // ============================================================================
  // Math Functions
  // ============================================================================
  ABS: {
    sql: 'ABS',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  ROUND: {
    sql: 'ROUND',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 2,
  },
  FLOOR: {
    sql: 'FLOOR',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  CEIL: {
    sql: 'CEIL',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  CEILING: {
    sql: 'CEIL',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  SQRT: {
    sql: 'SQRT',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  POWER: {
    sql: 'POWER',
    isAggregate: false,
    minArgs: 2,
    maxArgs: 2,
  },
  MOD: {
    sql: 'MOD',
    isAggregate: false,
    minArgs: 2,
    maxArgs: 2,
  },
  LOG: {
    sql: 'LOG',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 2,
  },
  LOG10: {
    sql: 'LOG10',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  EXP: {
    sql: 'EXP',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },

  // ============================================================================
  // Null/Coalesce Functions
  // ============================================================================
  COALESCE: {
    sql: 'COALESCE',
    isAggregate: false,
    minArgs: 1,
  },
  IFNULL: {
    sql: 'COALESCE',
    isAggregate: false,
    minArgs: 2,
    maxArgs: 2,
  },
  ISNULL: {
    sql: 'COALESCE',
    isAggregate: false,
    minArgs: 2,
    maxArgs: 2,
  },

  // ============================================================================
  // Date/Time Functions
  // ============================================================================
  YEAR: {
    sql: 'YEAR',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  MONTH: {
    sql: 'MONTH',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  DAY: {
    sql: 'DAY',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  HOUR: {
    sql: 'HOUR',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  MINUTE: {
    sql: 'MINUTE',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  SECOND: {
    sql: 'SECOND',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  NOW: {
    sql: 'CURRENT_TIMESTAMP',
    isAggregate: false,
    minArgs: 0,
    maxArgs: 0,
  },
  TODAY: {
    sql: 'CURRENT_DATE',
    isAggregate: false,
    minArgs: 0,
    maxArgs: 0,
  },
  DATE: {
    sql: 'MAKE_DATE',
    isAggregate: false,
    minArgs: 3,
    maxArgs: 3,
  },
  DATEVALUE: {
    sql: 'CAST',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  WEEKDAY: {
    sql: 'DAYOFWEEK',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
  WEEKNUM: {
    sql: 'WEEKOFYEAR',
    isAggregate: false,
    minArgs: 1,
    maxArgs: 1,
  },
};

/**
 * Check if a function name is a known aggregate function
 */
export function isAggregateFunction(name: string): boolean {
  const upperName = name.toUpperCase();
  return AGGREGATE_FUNCTIONS.has(upperName);
}

/**
 * Get function mapping for a given function name
 * Returns undefined if function is not supported
 */
export function getFunctionMapping(name: string): FunctionMapping | undefined {
  return FUNCTION_MAP[name.toUpperCase()];
}

/**
 * Get list of supported function names for error messages
 */
export function getSupportedFunctions(): string[] {
  return Object.keys(FUNCTION_MAP).sort();
}

/**
 * Suggest similar function names for typos
 */
export function suggestFunction(input: string): string[] {
  const upperInput = input.toUpperCase();
  const suggestions: string[] = [];

  for (const funcName of Object.keys(FUNCTION_MAP)) {
    // Simple similarity: starts with same letter or contains input
    if (
      funcName.startsWith(upperInput.charAt(0)) ||
      funcName.includes(upperInput) ||
      upperInput.includes(funcName)
    ) {
      suggestions.push(funcName);
    }
  }

  return suggestions.slice(0, 3);
}
