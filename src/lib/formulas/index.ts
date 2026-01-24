/**
 * Excel Formula Module
 *
 * Provides Excel-style formula parsing and translation to DuckDB SQL.
 *
 * Usage:
 * ```typescript
 * import { parseFormula, translateToSQL, isFormula } from '@/lib/formulas';
 *
 * // Check if input is a formula
 * if (isFormula(input)) {
 *   // Parse the formula
 *   const result = parseFormula(input, schema);
 *
 *   if (result.success) {
 *     // Translate to SQL
 *     const { sql, isAggregate } = translateToSQL(result.ast, {
 *       viewName: 'my_table',
 *       rowId: 5, // for row-level formulas
 *       schema,
 *     });
 *
 *     // Execute the SQL
 *     const queryResult = await executeSQL(sql);
 *   }
 * }
 * ```
 */

// Types
export type {
  Token,
  TokenType,
  ASTNode,
  FormulaAST,
  ParseResult,
  ParseSuccess,
  ParseError,
  TranslateOptions,
  TranslateResult,
  FormulaContext,
  FormulaResult,
  FormulaSuccess,
  FormulaError,
  ValidationResult,
  ValidationSuccess,
  ValidationError,
  NumberLiteral,
  StringLiteral,
  ColumnRef,
  BinaryOp,
  UnaryOp,
  FunctionCall,
  Comparison,
  FunctionMapping,
} from './types';

// Parser
export { parseFormula, isFormula, validateFormula } from './parser';

// Translator
export {
  translateToSQL,
  translateExpression,
  translateForComputedColumn,
  translateForBulkUpdate,
} from './translator';

// Functions
export {
  FUNCTION_MAP,
  AGGREGATE_FUNCTIONS,
  getFunctionMapping,
  isAggregateFunction,
  getSupportedFunctions,
  suggestFunction,
} from './functions';
