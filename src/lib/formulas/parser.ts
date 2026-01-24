/**
 * Excel Formula Parser
 *
 * Tokenizes and parses Excel-style formulas into an AST.
 * Supports arithmetic, comparisons, function calls, and column references.
 *
 * Grammar (simplified):
 *   formula     → "=" expression
 *   expression  → comparison
 *   comparison  → term (("=" | "!=" | "<" | ">" | "<=" | ">=") term)?
 *   term        → factor (("+" | "-") factor)*
 *   factor      → unary (("*" | "/") unary)*
 *   unary       → ("-")? primary
 *   primary     → NUMBER | STRING | function_call | column_ref | "(" expression ")"
 *   function    → IDENTIFIER "(" arguments? ")"
 *   arguments   → expression ("," expression)*
 *   column_ref  → IDENTIFIER | '"' IDENTIFIER '"'
 */

import type { ColumnSchema } from '@/store/duckDBViewStore';
import type {
  Token,
  TokenType,
  ASTNode,
  FormulaAST,
  ParseResult,
  NumberLiteral,
  StringLiteral,
  ColumnRef,
  BinaryOp,
  UnaryOp,
  FunctionCall,
  Comparison,
} from './types';
import { getFunctionMapping, isAggregateFunction } from './functions';

// ============================================================================
// Tokenizer
// ============================================================================

class Tokenizer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    // Remove leading = if present
    this.input = input.startsWith('=') ? input.slice(1) : input;
  }

  tokenize(): Token[] {
    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];

      if (this.isDigit(char) || (char === '.' && this.isDigit(this.peek(1)))) {
        this.readNumber();
      } else if (char === '"') {
        // Could be a string literal or quoted identifier
        this.readQuotedString();
      } else if (char === "'") {
        this.readSingleQuotedString();
      } else if (this.isAlpha(char) || char === '_') {
        this.readIdentifier();
      } else if (char === '(') {
        this.addToken('LPAREN', '(');
        this.position++;
      } else if (char === ')') {
        this.addToken('RPAREN', ')');
        this.position++;
      } else if (char === ',') {
        this.addToken('COMMA', ',');
        this.position++;
      } else if (this.isComparisonStart(char)) {
        this.readComparison();
      } else if (this.isOperator(char)) {
        this.addToken('OPERATOR', char);
        this.position++;
      } else {
        throw new Error(
          `Unexpected character '${char}' at position ${this.position}`
        );
      }
    }

    this.addToken('EOF', '');
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (
      this.position < this.input.length &&
      /\s/.test(this.input[this.position])
    ) {
      this.position++;
    }
  }

  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos < this.input.length ? this.input[pos] : '';
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private isOperator(char: string): boolean {
    return ['+', '-', '*', '/'].includes(char);
  }

  private isComparisonStart(char: string): boolean {
    return ['=', '!', '<', '>'].includes(char);
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({ type, value, position: this.position });
  }

  private readNumber(): void {
    const start = this.position;
    let hasDecimal = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (this.isDigit(char)) {
        this.position++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        this.position++;
      } else {
        break;
      }
    }

    this.addToken('NUMBER', this.input.slice(start, this.position));
  }

  private readQuotedString(): void {
    const start = this.position;
    this.position++; // Skip opening quote

    while (this.position < this.input.length && this.input[this.position] !== '"') {
      if (this.input[this.position] === '\\') {
        this.position++; // Skip escape character
      }
      this.position++;
    }

    if (this.position >= this.input.length) {
      throw new Error('Unterminated string');
    }

    this.position++; // Skip closing quote
    const value = this.input.slice(start + 1, this.position - 1);

    // Check if this is followed by ( - if so, it's a weird function call
    // Otherwise treat as identifier (column name with spaces)
    this.skipWhitespace();
    if (this.peek() === '(') {
      this.addToken('IDENTIFIER', value);
    } else {
      // It's a quoted column reference
      this.addToken('IDENTIFIER', value);
    }
  }

  private readSingleQuotedString(): void {
    this.position++; // Skip opening quote
    const start = this.position;

    while (this.position < this.input.length && this.input[this.position] !== "'") {
      if (this.input[this.position] === '\\') {
        this.position++; // Skip escape character
      }
      this.position++;
    }

    if (this.position >= this.input.length) {
      throw new Error('Unterminated string');
    }

    const value = this.input.slice(start, this.position);
    this.position++; // Skip closing quote
    this.addToken('STRING', value);
  }

  private readIdentifier(): void {
    const start = this.position;
    while (
      this.position < this.input.length &&
      this.isAlphaNumeric(this.input[this.position])
    ) {
      this.position++;
    }
    this.addToken('IDENTIFIER', this.input.slice(start, this.position));
  }

  private readComparison(): void {
    const start = this.position;
    const char = this.input[this.position];

    if (char === '=' && this.peek(1) !== '=') {
      // Single = is comparison in Excel formulas
      this.addToken('COMPARISON', '=');
      this.position++;
    } else if (char === '!' && this.peek(1) === '=') {
      this.addToken('COMPARISON', '!=');
      this.position += 2;
    } else if (char === '<') {
      if (this.peek(1) === '=') {
        this.addToken('COMPARISON', '<=');
        this.position += 2;
      } else if (this.peek(1) === '>') {
        this.addToken('COMPARISON', '<>');
        this.position += 2;
      } else {
        this.addToken('COMPARISON', '<');
        this.position++;
      }
    } else if (char === '>') {
      if (this.peek(1) === '=') {
        this.addToken('COMPARISON', '>=');
        this.position += 2;
      } else {
        this.addToken('COMPARISON', '>');
        this.position++;
      }
    } else {
      throw new Error(`Unexpected comparison operator at position ${start}`);
    }
  }
}

// ============================================================================
// Parser
// ============================================================================

class Parser {
  private tokens: Token[];
  private current: number = 0;
  private schema: ColumnSchema[];
  private columnRefs: Set<string> = new Set();
  private functionCalls: Set<string> = new Set();
  private hasAggregate: boolean = false;

  constructor(tokens: Token[], schema: ColumnSchema[]) {
    this.tokens = tokens;
    this.schema = schema;
  }

  parse(): FormulaAST {
    const root = this.expression();

    if (!this.isAtEnd()) {
      throw new Error(
        `Unexpected token '${this.peek().value}' at position ${this.peek().position}`
      );
    }

    return {
      root,
      columnRefs: Array.from(this.columnRefs),
      functionCalls: Array.from(this.functionCalls),
      isAggregate: this.hasAggregate,
    };
  }

  private expression(): ASTNode {
    return this.comparison();
  }

  private comparison(): ASTNode {
    let left = this.term();

    if (this.check('COMPARISON')) {
      const operator = this.advance().value;
      const right = this.term();
      left = { type: 'comparison', operator, left, right } as Comparison;
    }

    return left;
  }

  private term(): ASTNode {
    let left = this.factor();

    while (this.checkOperator('+') || this.checkOperator('-')) {
      const operator = this.advance().value;
      const right = this.factor();
      left = { type: 'binary', operator, left, right } as BinaryOp;
    }

    return left;
  }

  private factor(): ASTNode {
    let left = this.unary();

    while (this.checkOperator('*') || this.checkOperator('/')) {
      const operator = this.advance().value;
      const right = this.unary();
      left = { type: 'binary', operator, left, right } as BinaryOp;
    }

    return left;
  }

  private unary(): ASTNode {
    if (this.checkOperator('-')) {
      this.advance();
      const operand = this.unary();
      return { type: 'unary', operator: '-', operand } as UnaryOp;
    }

    return this.primary();
  }

  private primary(): ASTNode {
    // Number literal
    if (this.check('NUMBER')) {
      const value = parseFloat(this.advance().value);
      return { type: 'number', value } as NumberLiteral;
    }

    // String literal
    if (this.check('STRING')) {
      const value = this.advance().value;
      return { type: 'string', value } as StringLiteral;
    }

    // Parenthesized expression
    if (this.check('LPAREN')) {
      this.advance(); // consume (
      const expr = this.expression();
      this.consume('RPAREN', "Expected ')' after expression");
      return expr;
    }

    // Identifier - could be function call or column reference
    if (this.check('IDENTIFIER')) {
      const name = this.advance().value;

      // Check if it's a function call
      if (this.check('LPAREN')) {
        return this.functionCall(name);
      }

      // It's a column reference
      return this.columnReference(name);
    }

    throw new Error(
      `Unexpected token '${this.peek().value}' at position ${this.peek().position}`
    );
  }

  private functionCall(name: string): FunctionCall {
    const upperName = name.toUpperCase();
    this.functionCalls.add(upperName);

    // Check if it's a known aggregate function
    if (isAggregateFunction(upperName)) {
      this.hasAggregate = true;
    }

    // Validate function exists
    const mapping = getFunctionMapping(upperName);
    if (!mapping) {
      throw new Error(
        `Unknown function '${name}'. Supported functions: SUM, AVG, COUNT, MIN, MAX, IF, UPPER, LOWER, ROUND, ABS, etc.`
      );
    }

    this.consume('LPAREN', "Expected '(' after function name");

    const args: ASTNode[] = [];

    if (!this.check('RPAREN')) {
      do {
        args.push(this.expression());
      } while (this.match('COMMA'));
    }

    this.consume('RPAREN', "Expected ')' after function arguments");

    // Validate argument count
    if (mapping.minArgs !== undefined && args.length < mapping.minArgs) {
      throw new Error(
        `Function ${upperName} requires at least ${mapping.minArgs} argument(s), got ${args.length}`
      );
    }
    if (mapping.maxArgs !== undefined && args.length > mapping.maxArgs) {
      throw new Error(
        `Function ${upperName} accepts at most ${mapping.maxArgs} argument(s), got ${args.length}`
      );
    }

    return { type: 'function', name: upperName, args };
  }

  private columnReference(name: string): ColumnRef {
    // Validate column exists in schema
    const columnExists = this.schema.some(
      (col) => col.name.toLowerCase() === name.toLowerCase()
    );

    if (!columnExists) {
      const availableColumns = this.schema.map((c) => c.name).join(', ');
      throw new Error(
        `Unknown column '${name}'. Available columns: ${availableColumns}`
      );
    }

    // Find the actual column name (preserve original casing from schema)
    const actualColumn = this.schema.find(
      (col) => col.name.toLowerCase() === name.toLowerCase()
    );

    const columnName = actualColumn?.name || name;
    this.columnRefs.add(columnName);

    return { type: 'column', name: columnName };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private checkOperator(op: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    return token.type === 'OPERATOR' && token.value === op;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at position ${this.peek().position}`);
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse an Excel-style formula into an AST
 *
 * @param input - Formula string (with or without leading =)
 * @param schema - Column schema for validation
 * @returns ParseResult with AST on success, or error message on failure
 */
export function parseFormula(
  input: string,
  schema: ColumnSchema[]
): ParseResult {
  try {
    const trimmed = input.trim();

    if (!trimmed) {
      return { success: false, error: 'Empty formula' };
    }

    // Remove leading = if present
    const formula = trimmed.startsWith('=') ? trimmed : `=${trimmed}`;

    const tokenizer = new Tokenizer(formula);
    const tokens = tokenizer.tokenize();

    const parser = new Parser(tokens, schema);
    const ast = parser.parse();

    return { success: true, ast };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Parse error',
    };
  }
}

/**
 * Check if a string looks like a formula (starts with =)
 */
export function isFormula(input: string): boolean {
  return input.trim().startsWith('=');
}

/**
 * Validate a formula without fully parsing it
 * Useful for quick validation during typing
 */
export function validateFormula(
  input: string,
  schema: ColumnSchema[]
): { valid: boolean; error?: string } {
  const result = parseFormula(input, schema);

  if (result.success) {
    return { valid: true };
  }

  return { valid: false, error: result.error };
}
