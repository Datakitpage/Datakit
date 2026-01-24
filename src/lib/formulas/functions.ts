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
