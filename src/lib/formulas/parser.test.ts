/**
 * Formula Parser Tests
 *
 * Comprehensive tests for the Excel formula parser including:
 * - Tokenization
 * - AST generation
 * - Column validation
 * - Error handling
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import { parseFormula, isFormula, validateFormula } from './parser';
import type { ColumnSchema } from '@/store/duckDBViewStore';

// Test schema representing a typical sales dataset
const testSchema: ColumnSchema[] = [
  { name: 'id', type: 'BIGINT' },
  { name: 'product', type: 'VARCHAR' },
  { name: 'price', type: 'DOUBLE' },
  { name: 'quantity', type: 'INTEGER' },
  { name: 'discount', type: 'DOUBLE' },
  { name: 'total', type: 'DOUBLE' },
  { name: 'category', type: 'VARCHAR' },
  { name: 'is_active', type: 'BOOLEAN' },
  { name: 'created_at', type: 'TIMESTAMP' },
  { name: 'First Name', type: 'VARCHAR' }, // Column with space
  { name: 'Order ID', type: 'VARCHAR' }, // Column with space
];

describe('isFormula', () => {
  it('should detect formulas starting with =', () => {
    expect(isFormula('=SUM(price)')).toBe(true);
    expect(isFormula('=price * quantity')).toBe(true);
    expect(isFormula('=1+1')).toBe(true);
  });

  it('should detect formulas with leading whitespace', () => {
    expect(isFormula('  =SUM(price)')).toBe(true);
    expect(isFormula('\t=price')).toBe(true);
  });

  it('should reject non-formulas', () => {
    expect(isFormula('SUM(price)')).toBe(false);
    expect(isFormula('100')).toBe(false);
    expect(isFormula('hello world')).toBe(false);
    expect(isFormula('')).toBe(false);
    expect(isFormula('price = 100')).toBe(false);
  });
});

describe('parseFormula - Basic Arithmetic', () => {
  it('should parse simple addition', () => {
    const result = parseFormula('=price + discount', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('binary');
      expect(result.ast.columnRefs).toContain('price');
      expect(result.ast.columnRefs).toContain('discount');
      expect(result.ast.isAggregate).toBe(false);
    }
  });

  it('should parse multiplication', () => {
    const result = parseFormula('=price * quantity', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('binary');
      expect((result.ast.root as any).operator).toBe('*');
    }
  });

  it('should parse division', () => {
    const result = parseFormula('=total / quantity', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('/');
    }
  });

  it('should parse subtraction', () => {
    const result = parseFormula('=price - discount', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('-');
    }
  });

  it('should parse complex arithmetic with precedence', () => {
    const result = parseFormula('=price * quantity - discount', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      // Should be: (price * quantity) - discount
      expect(result.ast.root.type).toBe('binary');
      expect((result.ast.root as any).operator).toBe('-');
      expect((result.ast.root as any).left.type).toBe('binary');
      expect((result.ast.root as any).left.operator).toBe('*');
    }
  });

  it('should parse parenthesized expressions', () => {
    const result = parseFormula('=(price + discount) * quantity', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      // Should be: (price + discount) * quantity
      expect(result.ast.root.type).toBe('binary');
      expect((result.ast.root as any).operator).toBe('*');
      expect((result.ast.root as any).left.type).toBe('binary');
      expect((result.ast.root as any).left.operator).toBe('+');
    }
  });

  it('should parse unary negation', () => {
    const result = parseFormula('=-price', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('unary');
      expect((result.ast.root as any).operator).toBe('-');
    }
  });

  it('should parse number literals', () => {
    const result = parseFormula('=price * 1.5', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).right.type).toBe('number');
      expect((result.ast.root as any).right.value).toBe(1.5);
    }
  });

  it('should parse integer literals', () => {
    const result = parseFormula('=quantity + 100', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).right.type).toBe('number');
      expect((result.ast.root as any).right.value).toBe(100);
    }
  });
});

describe('parseFormula - Comparisons', () => {
  it('should parse equals comparison', () => {
    const result = parseFormula('=price = 100', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('comparison');
      expect((result.ast.root as any).operator).toBe('=');
    }
  });

  it('should parse not equals comparison', () => {
    const result = parseFormula('=price != 0', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('!=');
    }
  });

  it('should parse greater than', () => {
    const result = parseFormula('=price > 50', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('>');
    }
  });

  it('should parse less than', () => {
    const result = parseFormula('=quantity < 10', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('<');
    }
  });

  it('should parse greater than or equal', () => {
    const result = parseFormula('=price >= 100', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('>=');
    }
  });

  it('should parse less than or equal', () => {
    const result = parseFormula('=discount <= 0.5', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('<=');
    }
  });

  it('should parse <> as not equals', () => {
    const result = parseFormula("=category <> 'electronics'", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).operator).toBe('<>');
    }
  });
});

describe('parseFormula - String Literals', () => {
  it('should parse single-quoted strings', () => {
    const result = parseFormula("=category = 'electronics'", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).right.type).toBe('string');
      expect((result.ast.root as any).right.value).toBe('electronics');
    }
  });

  it('should parse strings with spaces', () => {
    const result = parseFormula("=product = 'Gaming Mouse'", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).right.value).toBe('Gaming Mouse');
    }
  });
});

describe('parseFormula - Aggregate Functions', () => {
  it('should parse SUM', () => {
    const result = parseFormula('=SUM(price)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('function');
      expect((result.ast.root as any).name).toBe('SUM');
      expect(result.ast.isAggregate).toBe(true);
      expect(result.ast.functionCalls).toContain('SUM');
    }
  });

  it('should parse AVG', () => {
    const result = parseFormula('=AVG(price)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('AVG');
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse AVERAGE (alias for AVG)', () => {
    const result = parseFormula('=AVERAGE(price)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('AVERAGE');
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse COUNT', () => {
    const result = parseFormula('=COUNT(id)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('COUNT');
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse MIN', () => {
    const result = parseFormula('=MIN(price)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('MIN');
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse MAX', () => {
    const result = parseFormula('=MAX(price)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('MAX');
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should be case-insensitive for function names', () => {
    const result1 = parseFormula('=sum(price)', testSchema);
    const result2 = parseFormula('=Sum(price)', testSchema);
    const result3 = parseFormula('=SUM(price)', testSchema);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);
  });
});

describe('parseFormula - Row-Level Functions', () => {
  it('should parse UPPER', () => {
    const result = parseFormula('=UPPER(product)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('UPPER');
      expect(result.ast.isAggregate).toBe(false);
    }
  });

  it('should parse LOWER', () => {
    const result = parseFormula('=LOWER(category)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.isAggregate).toBe(false);
    }
  });

  it('should parse ROUND with two arguments', () => {
    const result = parseFormula('=ROUND(price, 2)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('ROUND');
      expect((result.ast.root as any).args.length).toBe(2);
    }
  });

  it('should parse ABS', () => {
    const result = parseFormula('=ABS(discount)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('ABS');
    }
  });

  it('should parse TRIM', () => {
    const result = parseFormula('=TRIM(product)', testSchema);
    expect(result.success).toBe(true);
  });

  it('should parse LEN', () => {
    const result = parseFormula('=LEN(product)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('LEN');
    }
  });
});

describe('parseFormula - IF Function', () => {
  it('should parse simple IF', () => {
    const result = parseFormula("=IF(price > 100, 'expensive', 'cheap')", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('IF');
      expect((result.ast.root as any).args.length).toBe(3);
      expect(result.ast.isAggregate).toBe(false);
    }
  });

  it('should parse IF with numeric results', () => {
    const result = parseFormula('=IF(quantity > 10, price * 0.9, price)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).args.length).toBe(3);
    }
  });

  it('should parse IF with column comparison', () => {
    const result = parseFormula("=IF(category = 'electronics', total * 1.1, total)", testSchema);
    expect(result.success).toBe(true);
  });

  it('should reject IF with wrong number of arguments', () => {
    const result = parseFormula("=IF(price > 100, 'expensive')", testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('requires');
    }
  });
});

describe('parseFormula - Column Validation', () => {
  it('should accept valid column names', () => {
    const result = parseFormula('=price + quantity', testSchema);
    expect(result.success).toBe(true);
  });

  it('should be case-insensitive for column names', () => {
    const result1 = parseFormula('=PRICE + QUANTITY', testSchema);
    const result2 = parseFormula('=Price + Quantity', testSchema);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });

  it('should reject unknown column names', () => {
    const result = parseFormula('=unknown_column + price', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unknown column');
      expect(result.error).toContain('unknown_column');
    }
  });

  it('should provide available columns in error message', () => {
    const result = parseFormula('=foo', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Available columns');
    }
  });

  it('should track all referenced columns', () => {
    const result = parseFormula('=price * quantity + discount', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.columnRefs).toContain('price');
      expect(result.ast.columnRefs).toContain('quantity');
      expect(result.ast.columnRefs).toContain('discount');
      expect(result.ast.columnRefs.length).toBe(3);
    }
  });
});

describe('parseFormula - Error Handling', () => {
  it('should reject empty formula', () => {
    const result = parseFormula('', testSchema);
    expect(result.success).toBe(false);
  });

  it('should reject formula with only =', () => {
    const result = parseFormula('=', testSchema);
    expect(result.success).toBe(false);
  });

  it('should reject unknown function', () => {
    const result = parseFormula('=UNKNOWNFUNC(price)', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unknown function');
    }
  });

  it('should reject unterminated string', () => {
    const result = parseFormula("=category = 'electronics", testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unterminated');
    }
  });

  it('should reject mismatched parentheses', () => {
    const result = parseFormula('=SUM(price', testSchema);
    expect(result.success).toBe(false);
  });

  it('should reject unexpected tokens', () => {
    const result = parseFormula('=price + + quantity', testSchema);
    expect(result.success).toBe(false);
  });

  it('should reject trailing tokens', () => {
    const result = parseFormula('=price quantity', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unexpected');
    }
  });
});

describe('parseFormula - Complex Expressions', () => {
  it('should parse formula with multiple functions', () => {
    const result = parseFormula('=ROUND(price * quantity, 2)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.functionCalls).toContain('ROUND');
    }
  });

  it('should parse nested arithmetic in function', () => {
    const result = parseFormula('=SUM(price * quantity)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse arithmetic with aggregate', () => {
    const result = parseFormula('=SUM(price) * 1.1', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.isAggregate).toBe(true);
      expect(result.ast.root.type).toBe('binary');
    }
  });

  it('should parse complex discount calculation', () => {
    const result = parseFormula('=(price * quantity) - (price * quantity * discount)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.columnRefs).toContain('price');
      expect(result.ast.columnRefs).toContain('quantity');
      expect(result.ast.columnRefs).toContain('discount');
    }
  });

  it('should parse percentage calculation', () => {
    const result = parseFormula('=price * (1 - discount)', testSchema);
    expect(result.success).toBe(true);
  });
});

describe('validateFormula', () => {
  it('should validate correct formula', () => {
    const result = validateFormula('=SUM(price)', testSchema);
    expect(result.valid).toBe(true);
  });

  it('should invalidate incorrect formula', () => {
    const result = validateFormula('=UNKNOWN(price)', testSchema);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should invalidate formula with unknown column', () => {
    const result = validateFormula('=foo + bar', testSchema);
    expect(result.valid).toBe(false);
  });
});

describe('parseFormula - Edge Cases', () => {
  it('should handle whitespace in formula', () => {
    const result = parseFormula('=  price   +   quantity  ', testSchema);
    expect(result.success).toBe(true);
  });

  it('should handle decimal numbers starting with dot', () => {
    const result = parseFormula('=price * .5', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).right.value).toBe(0.5);
    }
  });

  it('should handle very large numbers', () => {
    const result = parseFormula('=price + 9999999999', testSchema);
    expect(result.success).toBe(true);
  });

  it('should handle zero', () => {
    const result = parseFormula('=price + 0', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).right.value).toBe(0);
    }
  });

  it('should handle negative numbers', () => {
    const result = parseFormula('=price + -5', testSchema);
    expect(result.success).toBe(true);
  });

  it('should handle multiple levels of nesting', () => {
    const result = parseFormula('=((price + discount) * quantity) / 100', testSchema);
    expect(result.success).toBe(true);
  });

  it('should handle formula without leading =', () => {
    // Should still work - parser strips the = if present
    const result = parseFormula('price + quantity', testSchema);
    expect(result.success).toBe(true);
  });
});

describe('parseFormula - Large Schema', () => {
  const largeSchema: ColumnSchema[] = Array.from({ length: 100 }, (_, i) => ({
    name: `column_${i}`,
    type: i % 3 === 0 ? 'BIGINT' : i % 3 === 1 ? 'VARCHAR' : 'DOUBLE',
  }));

  it('should handle schema with many columns', () => {
    const result = parseFormula('=column_0 + column_50 + column_99', largeSchema);
    expect(result.success).toBe(true);
  });

  it('should efficiently validate against large schema', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      parseFormula('=column_0 + column_50', largeSchema);
    }
    const elapsed = performance.now() - start;
    // Should complete 100 parses in under 100ms
    expect(elapsed).toBeLessThan(100);
  });
});

describe('parseFormula - Special Column Names', () => {
  it('should handle columns with underscores', () => {
    const schema: ColumnSchema[] = [{ name: 'order_total', type: 'DOUBLE' }];
    const result = parseFormula('=order_total * 1.1', schema);
    expect(result.success).toBe(true);
  });

  it('should handle columns starting with underscore', () => {
    const schema: ColumnSchema[] = [{ name: '_internal', type: 'DOUBLE' }];
    const result = parseFormula('=_internal + 1', schema);
    expect(result.success).toBe(true);
  });
});

describe('parseFormula - Logical Operators (AND/OR)', () => {
  it('should parse simple AND condition', () => {
    const result = parseFormula('=price > 100 AND quantity > 5', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('logical');
      expect((result.ast.root as any).operator).toBe('AND');
    }
  });

  it('should parse simple OR condition', () => {
    const result = parseFormula("=category = 'electronics' OR category = 'appliances'", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('logical');
      expect((result.ast.root as any).operator).toBe('OR');
    }
  });

  it('should parse IF with AND condition', () => {
    const result = parseFormula("=IF(price > 100 AND quantity > 10, 'bulk discount', 'regular')", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('function');
      expect((result.ast.root as any).name).toBe('IF');
      // First argument should be logical AND
      const condition = (result.ast.root as any).args[0];
      expect(condition.type).toBe('logical');
      expect(condition.operator).toBe('AND');
    }
  });

  it('should parse IF with OR condition', () => {
    const result = parseFormula("=IF(category = 'sale' OR discount > 0.5, 'promo', 'regular')", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      const condition = (result.ast.root as any).args[0];
      expect(condition.type).toBe('logical');
      expect(condition.operator).toBe('OR');
    }
  });

  it('should handle AND and OR together with correct precedence', () => {
    // AND has higher precedence than OR: a OR b AND c = a OR (b AND c)
    const result = parseFormula('=price > 100 OR quantity > 5 AND discount > 0', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      // Root should be OR
      expect(result.ast.root.type).toBe('logical');
      expect((result.ast.root as any).operator).toBe('OR');
      // Right child should be AND
      expect((result.ast.root as any).right.type).toBe('logical');
      expect((result.ast.root as any).right.operator).toBe('AND');
    }
  });

  it('should handle multiple AND operators', () => {
    const result = parseFormula('=price > 0 AND quantity > 0 AND total > 0', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('logical');
    }
  });

  it('should handle multiple OR operators', () => {
    const result = parseFormula("=category = 'a' OR category = 'b' OR category = 'c'", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('logical');
    }
  });

  it('should handle parentheses to override precedence', () => {
    const result = parseFormula('=(price > 100 OR quantity > 5) AND discount > 0', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      // Root should be AND (due to parentheses)
      expect(result.ast.root.type).toBe('logical');
      expect((result.ast.root as any).operator).toBe('AND');
      // Left child should be OR
      expect((result.ast.root as any).left.type).toBe('logical');
      expect((result.ast.root as any).left.operator).toBe('OR');
    }
  });

  it('should be case-insensitive for AND/OR', () => {
    const result1 = parseFormula('=price > 100 and quantity > 5', testSchema);
    const result2 = parseFormula('=price > 100 And quantity > 5', testSchema);
    const result3 = parseFormula('=price > 100 AND quantity > 5', testSchema);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);
  });

  it('should parse complex IF with nested logical operators', () => {
    const result = parseFormula(
      "=IF((price > 100 AND quantity > 10) OR is_active = 1, 'premium', 'standard')",
      testSchema
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const condition = (result.ast.root as any).args[0];
      expect(condition.type).toBe('logical');
      expect(condition.operator).toBe('OR');
    }
  });
});

describe('parseFormula - Date Functions', () => {
  it('should parse YEAR function', () => {
    const result = parseFormula('=YEAR(created_at)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('YEAR');
    }
  });

  it('should parse MONTH function', () => {
    const result = parseFormula('=MONTH(created_at)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('MONTH');
    }
  });

  it('should parse DAY function', () => {
    const result = parseFormula('=DAY(created_at)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('DAY');
    }
  });

  it('should parse NOW function (no args)', () => {
    const result = parseFormula('=NOW()', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('NOW');
      expect((result.ast.root as any).args.length).toBe(0);
    }
  });

  it('should parse TODAY function (no args)', () => {
    const result = parseFormula('=TODAY()', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('TODAY');
      expect((result.ast.root as any).args.length).toBe(0);
    }
  });

  it('should parse DATE function with 3 args', () => {
    const result = parseFormula('=DATE(2024, 12, 25)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('DATE');
      expect((result.ast.root as any).args.length).toBe(3);
    }
  });

  it('should parse HOUR function', () => {
    const result = parseFormula('=HOUR(created_at)', testSchema);
    expect(result.success).toBe(true);
  });

  it('should parse MINUTE function', () => {
    const result = parseFormula('=MINUTE(created_at)', testSchema);
    expect(result.success).toBe(true);
  });

  it('should parse SECOND function', () => {
    const result = parseFormula('=SECOND(created_at)', testSchema);
    expect(result.success).toBe(true);
  });

  it('should parse date comparison with YEAR', () => {
    const result = parseFormula('=YEAR(created_at) = 2024', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.root.type).toBe('comparison');
    }
  });

  it('should parse IF with date condition', () => {
    const result = parseFormula(
      "=IF(YEAR(created_at) > 2023, 'recent', 'old')",
      testSchema
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('IF');
    }
  });
});

describe('parseFormula - Conditional Aggregates (SUMIF/COUNTIF/AVERAGEIF)', () => {
  it('should parse SUMIF function', () => {
    const result = parseFormula("=SUMIF(category = 'electronics', price)", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('SUMIF');
      expect((result.ast.root as any).args.length).toBe(2);
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse COUNTIF function', () => {
    const result = parseFormula("=COUNTIF(category = 'electronics')", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('COUNTIF');
      expect((result.ast.root as any).args.length).toBe(1);
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse AVERAGEIF function', () => {
    const result = parseFormula("=AVERAGEIF(category = 'electronics', price)", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).name).toBe('AVERAGEIF');
      expect((result.ast.root as any).args.length).toBe(2);
      expect(result.ast.isAggregate).toBe(true);
    }
  });

  it('should parse SUMIF with numeric condition', () => {
    const result = parseFormula('=SUMIF(quantity > 10, price)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).args[0].type).toBe('comparison');
    }
  });

  it('should parse COUNTIF with AND condition', () => {
    const result = parseFormula('=COUNTIF(price > 100 AND quantity > 5)', testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).args[0].type).toBe('logical');
    }
  });

  it('should parse SUMIF with OR condition', () => {
    const result = parseFormula("=SUMIF(category = 'electronics' OR category = 'appliances', price)", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.ast.root as any).args[0].type).toBe('logical');
    }
  });

  it('should reject SUMIF with wrong number of arguments', () => {
    const result = parseFormula('=SUMIF(price > 100)', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('requires');
    }
  });

  it('should reject COUNTIF with wrong number of arguments', () => {
    const result = parseFormula('=COUNTIF(price > 100, quantity)', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('accepts at most');
    }
  });

  it('should parse multiple conditional aggregates', () => {
    const result = parseFormula("=SUMIF(category = 'electronics', price) + COUNTIF(quantity > 10)", testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.isAggregate).toBe(true);
    }
  });
});
