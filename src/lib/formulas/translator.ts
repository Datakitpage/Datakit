/**
 * Formula AST to DuckDB SQL Translator
 *
 * Converts a parsed formula AST into executable DuckDB SQL.
 * Handles both row-level formulas (with WHERE _rowid = N) and
 * aggregate formulas (without row restriction).
 */

import type {
  ASTNode,
  FormulaAST,
  TranslateOptions,
  TranslateResult,
  NumberLiteral,
  StringLiteral,
  ColumnRef,
  BinaryOp,
  UnaryOp,
  FunctionCall,
  Comparison,
} from './types';
import { getFunctionMapping } from './functions';

/**
 * Translate a formula AST to DuckDB SQL
 *
 * @param ast - Parsed formula AST
 * @param options - Translation options (viewName, rowId, schema)
 * @returns SQL string and metadata
 */
export function translateToSQL(
  ast: FormulaAST,
  options: TranslateOptions
): TranslateResult {
  const translator = new SQLTranslator(options);
  const expression = translator.translate(ast.root);

  // Build the full SELECT statement
  let sql: string;

  if (ast.isAggregate) {
    // Aggregate formula: no row restriction
    sql = `SELECT ${expression} AS result FROM "${options.viewName}"`;
  } else if (options.rowId !== undefined) {
    // Row-level formula: restrict to specific row
    sql = `SELECT ${expression} AS result FROM "${options.viewName}" WHERE _rowid = ${options.rowId}`;
  } else {
    // No row context - just select the expression (useful for validation)
    sql = `SELECT ${expression} AS result FROM "${options.viewName}" LIMIT 1`;
  }

  return {
    sql,
    isAggregate: ast.isAggregate,
  };
}

/**
 * Translate just the expression part (without SELECT wrapper)
 * Useful for generating computed column expressions
 */
export function translateExpression(
  ast: FormulaAST,
  options: TranslateOptions
): string {
  const translator = new SQLTranslator(options);
  return translator.translate(ast.root);
}

// ============================================================================
// SQL Translator Class
// ============================================================================

class SQLTranslator {
  private options: TranslateOptions;

  constructor(options: TranslateOptions) {
    this.options = options;
  }

  translate(node: ASTNode): string {
    switch (node.type) {
      case 'number':
        return this.translateNumber(node);
      case 'string':
        return this.translateString(node);
      case 'column':
        return this.translateColumn(node);
      case 'binary':
        return this.translateBinary(node);
      case 'unary':
        return this.translateUnary(node);
      case 'function':
        return this.translateFunction(node);
      case 'comparison':
        return this.translateComparison(node);
      default:
        throw new Error(`Unknown AST node type: ${(node as ASTNode).type}`);
    }
  }

  private translateNumber(node: NumberLiteral): string {
    return node.value.toString();
  }

  private translateString(node: StringLiteral): string {
    // Escape single quotes for SQL
    const escaped = node.value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  private translateColumn(node: ColumnRef): string {
    // Always quote column names to handle special characters and reserved words
    return `"${node.name}"`;
  }

  private translateBinary(node: BinaryOp): string {
    const left = this.translate(node.left);
    const right = this.translate(node.right);
    return `(${left} ${node.operator} ${right})`;
  }

  private translateUnary(node: UnaryOp): string {
    const operand = this.translate(node.operand);
    return `(${node.operator}${operand})`;
  }

  private translateComparison(node: Comparison): string {
    const left = this.translate(node.left);
    const right = this.translate(node.right);

    // Convert Excel comparison operators to SQL
    let operator = node.operator;
    if (operator === '=') {
      operator = '='; // Same in SQL
    } else if (operator === '<>') {
      operator = '!='; // DuckDB supports both, but != is clearer
    }

    return `(${left} ${operator} ${right})`;
  }

  private translateFunction(node: FunctionCall): string {
    const mapping = getFunctionMapping(node.name);

    if (!mapping) {
      throw new Error(`Unknown function: ${node.name}`);
    }

    // Special handling for IF (Excel IF → SQL CASE WHEN)
    if (node.name === 'IF') {
      return this.translateIF(node);
    }

    // Standard function translation
    const args = node.args.map((arg) => this.translate(arg)).join(', ');
    return `${mapping.sql}(${args})`;
  }

  /**
   * Translate IF(condition, true_value, false_value) to CASE WHEN
   */
  private translateIF(node: FunctionCall): string {
    if (node.args.length !== 3) {
      throw new Error('IF function requires exactly 3 arguments');
    }

    const condition = this.translate(node.args[0]);
    const trueValue = this.translate(node.args[1]);
    const falseValue = this.translate(node.args[2]);

    return `(CASE WHEN ${condition} THEN ${trueValue} ELSE ${falseValue} END)`;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate SQL for applying a formula to all rows (creating a computed column)
 */
export function translateForComputedColumn(
  ast: FormulaAST,
  options: TranslateOptions
): string {
  const translator = new SQLTranslator(options);
  const expression = translator.translate(ast.root);

  // For a computed column, we just return the expression
  // The caller will use it in: ALTER TABLE ADD COLUMN name AS (expression)
  return expression;
}

/**
 * Generate SQL for updating multiple rows with a formula result
 */
export function translateForBulkUpdate(
  ast: FormulaAST,
  options: TranslateOptions,
  targetColumn: string
): string {
  const translator = new SQLTranslator(options);
  const expression = translator.translate(ast.root);

  // Generate UPDATE statement that sets column to computed value for all rows
  return `UPDATE "${options.viewName}" SET "${targetColumn}" = ${expression}`;
}
