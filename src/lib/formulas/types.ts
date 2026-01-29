/**
 * Excel Formula Types
 *
 * Type definitions for the formula parser and translator.
 * Formulas are parsed into an AST and then translated to DuckDB SQL.
 */

import type { ColumnSchema } from '@/store/duckDBViewStore';

// ============================================================================
// Token Types (Lexer Output)
// ============================================================================

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER' // Column name or function name
  | 'OPERATOR'
  | 'COMPARISON'
  | 'LOGICAL' // AND, OR
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ============================================================================
// AST Node Types (Parser Output)
// ============================================================================

export interface NumberLiteral {
  type: 'number';
  value: number;
}

export interface StringLiteral {
  type: 'string';
  value: string;
}

export interface ColumnRef {
  type: 'column';
  name: string;
}

export interface BinaryOp {
  type: 'binary';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOp {
  type: 'unary';
  operator: string;
  operand: ASTNode;
}

export interface FunctionCall {
  type: 'function';
  name: string;
  args: ASTNode[];
}

export interface Comparison {
  type: 'comparison';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface LogicalOp {
  type: 'logical';
  operator: 'AND' | 'OR';
  left: ASTNode;
  right: ASTNode;
}

export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | ColumnRef
  | BinaryOp
  | UnaryOp
  | FunctionCall
  | Comparison
  | LogicalOp;

// ============================================================================
// Parser Result Types
// ============================================================================

export interface FormulaAST {
  root: ASTNode;
  columnRefs: string[]; // All referenced column names
  functionCalls: string[]; // All function names used
  isAggregate: boolean; // True if contains SUM, AVG, COUNT, etc.
}

export interface ParseSuccess {
  success: true;
  ast: FormulaAST;
}

export interface ParseError {
  success: false;
  error: string;
  position?: number;
}

export type ParseResult = ParseSuccess | ParseError;

// ============================================================================
// Translator Types
// ============================================================================

export interface TranslateOptions {
  viewName: string;
  rowId?: number; // For row-specific evaluation (cell formulas)
  schema: ColumnSchema[];
}

export interface TranslateResult {
  sql: string;
  isAggregate: boolean;
}

// ============================================================================
// Function Mapping Types
// ============================================================================

export interface FunctionMapping {
  sql: string;
  isAggregate: boolean;
  minArgs?: number;
  maxArgs?: number;
  // For functions that need special transformation (like IF → CASE WHEN)
  transform?: (args: ASTNode[]) => ASTNode;
}

// ============================================================================
// Formula Evaluation Types
// ============================================================================

export interface FormulaContext {
  viewName: string;
  schema: ColumnSchema[];
  rowId: number;
  column: string;
}

export interface FormulaSuccess {
  success: true;
  value: unknown;
  sql: string;
  isAggregate: boolean;
}

export interface FormulaError {
  success: false;
  error: string;
}

export type FormulaResult = FormulaSuccess | FormulaError;

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationSuccess {
  valid: true;
}

export interface ValidationError {
  valid: false;
  error: string;
  suggestions?: string[];
}

export type ValidationResult = ValidationSuccess | ValidationError;
