/**
 * Formula Integration Tests
 *
 * End-to-end tests that verify the complete formula flow:
 * - Parse → Translate → Execute pattern
 * - Complex real-world scenarios
 * - Edge cases and error handling
 * - Performance characteristics
 */

import { describe, it, expect } from 'vitest';
import { parseFormula, isFormula, validateFormula } from './parser';
import { translateToSQL, translateExpression, translateForBulkUpdate } from './translator';
import { getSupportedFunctions, isAggregateFunction } from './functions';
import type { ColumnSchema } from '@/store/duckDBViewStore';

// ============================================================================
// Test Fixtures
// ============================================================================

// Sales dataset schema
const salesSchema: ColumnSchema[] = [
  { name: '_rowid', type: 'BIGINT' },
  { name: 'order_id', type: 'VARCHAR' },
  { name: 'customer_id', type: 'BIGINT' },
  { name: 'product_name', type: 'VARCHAR' },
  { name: 'category', type: 'VARCHAR' },
  { name: 'unit_price', type: 'DOUBLE' },
  { name: 'quantity', type: 'INTEGER' },
  { name: 'discount', type: 'DOUBLE' },
  { name: 'tax_rate', type: 'DOUBLE' },
  { name: 'shipping_cost', type: 'DOUBLE' },
  { name: 'order_date', type: 'DATE' },
  { name: 'status', type: 'VARCHAR' },
  { name: 'is_priority', type: 'BOOLEAN' },
];

// Financial dataset schema
const financialSchema: ColumnSchema[] = [
  { name: '_rowid', type: 'BIGINT' },
  { name: 'account_id', type: 'VARCHAR' },
  { name: 'account_name', type: 'VARCHAR' },
  { name: 'balance', type: 'DECIMAL(18,2)' },
  { name: 'interest_rate', type: 'DOUBLE' },
  { name: 'monthly_fee', type: 'DOUBLE' },
  { name: 'transactions', type: 'INTEGER' },
  { name: 'credit_limit', type: 'DOUBLE' },
  { name: 'utilization', type: 'DOUBLE' },
  { name: 'account_type', type: 'VARCHAR' },
  { name: 'is_active', type: 'BOOLEAN' },
];

// Helper to run full parse-translate flow
function parseAndTranslate(
  formula: string,
  schema: ColumnSchema[],
  viewName = 'test_view',
  rowId = 1
) {
  const parseResult = parseFormula(formula, schema);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }
  const translateResult = translateToSQL(parseResult.ast, {
    viewName,
    rowId: parseResult.ast.isAggregate ? undefined : rowId,
    schema,
  });
  return {
    success: true,
    sql: translateResult.sql,
    isAggregate: translateResult.isAggregate,
    columnRefs: parseResult.ast.columnRefs,
    functionCalls: parseResult.ast.functionCalls,
  };
}

// ============================================================================
// Real-World Business Calculations
// ============================================================================

describe('Sales Calculations', () => {
  describe('Order Total Calculation', () => {
    it('should calculate basic order total', () => {
      const result = parseAndTranslate('=unit_price * quantity', salesSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.sql).toContain('"unit_price"');
        expect(result.sql).toContain('"quantity"');
        expect(result.columnRefs).toEqual(['unit_price', 'quantity']);
      }
    });

    it('should calculate order total with discount', () => {
      const result = parseAndTranslate('=(unit_price * quantity) * (1 - discount)', salesSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.sql).toContain('(("unit_price" * "quantity") * (1 - "discount"))');
      }
    });

    it('should calculate order total with tax', () => {
      const result = parseAndTranslate(
        '=(unit_price * quantity) * (1 + tax_rate)',
        salesSchema
      );
      expect(result.success).toBe(true);
    });

    it('should calculate full order total with discount, tax, and shipping', () => {
      const result = parseAndTranslate(
        '=((unit_price * quantity) * (1 - discount) * (1 + tax_rate)) + shipping_cost',
        salesSchema
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.columnRefs).toContain('unit_price');
        expect(result.columnRefs).toContain('quantity');
        expect(result.columnRefs).toContain('discount');
        expect(result.columnRefs).toContain('tax_rate');
        expect(result.columnRefs).toContain('shipping_cost');
      }
    });
  });

  describe('Aggregate Calculations', () => {
    it('should calculate total revenue', () => {
      const result = parseAndTranslate('=SUM(unit_price * quantity)', salesSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isAggregate).toBe(true);
        expect(result.sql).not.toContain('WHERE _rowid');
      }
    });

    it('should calculate average order value', () => {
      const result = parseAndTranslate('=AVG(unit_price * quantity)', salesSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isAggregate).toBe(true);
      }
    });

    it('should calculate order count', () => {
      const result = parseAndTranslate('=COUNT(order_id)', salesSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isAggregate).toBe(true);
        expect(result.functionCalls).toContain('COUNT');
      }
    });

    it('should calculate min and max prices', () => {
      const minResult = parseAndTranslate('=MIN(unit_price)', salesSchema);
      const maxResult = parseAndTranslate('=MAX(unit_price)', salesSchema);
      expect(minResult.success).toBe(true);
      expect(maxResult.success).toBe(true);
    });
  });

  describe('Conditional Calculations', () => {
    it('should apply priority discount', () => {
      const result = parseAndTranslate(
        "=IF(is_priority = 'true', unit_price * 0.9, unit_price)",
        salesSchema
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.sql).toContain('CASE WHEN');
        expect(result.sql).toContain('THEN');
        expect(result.sql).toContain('ELSE');
        expect(result.sql).toContain('END');
      }
    });

    it('should categorize order value', () => {
      const result = parseAndTranslate(
        "=IF(unit_price * quantity > 1000, 'high', 'normal')",
        salesSchema
      );
      expect(result.success).toBe(true);
    });

    it('should apply tiered discount', () => {
      const result = parseAndTranslate(
        '=IF(quantity > 100, unit_price * 0.8, IF(quantity > 50, unit_price * 0.9, unit_price))',
        salesSchema
      );
      // This might fail because we don't support nested IF yet
      // But the outer IF should parse
      expect(result.success).toBe(true);
    });
  });
});

describe('Financial Calculations', () => {
  describe('Interest Calculations', () => {
    it('should calculate monthly interest', () => {
      const result = parseAndTranslate('=balance * (interest_rate / 12)', financialSchema);
      expect(result.success).toBe(true);
    });

    it('should calculate annual interest', () => {
      const result = parseAndTranslate('=balance * interest_rate', financialSchema);
      expect(result.success).toBe(true);
    });

    it('should calculate net balance after fees', () => {
      const result = parseAndTranslate('=balance - monthly_fee', financialSchema);
      expect(result.success).toBe(true);
    });
  });

  describe('Credit Calculations', () => {
    it('should calculate available credit', () => {
      const result = parseAndTranslate('=credit_limit - balance', financialSchema);
      expect(result.success).toBe(true);
    });

    it('should calculate credit utilization percentage', () => {
      const result = parseAndTranslate('=(balance / credit_limit) * 100', financialSchema);
      expect(result.success).toBe(true);
    });
  });

  describe('Portfolio Aggregates', () => {
    it('should calculate total portfolio value', () => {
      const result = parseAndTranslate('=SUM(balance)', financialSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isAggregate).toBe(true);
      }
    });

    it('should calculate average balance', () => {
      const result = parseAndTranslate('=AVG(balance)', financialSchema);
      expect(result.success).toBe(true);
    });

    it('should count active accounts', () => {
      const result = parseAndTranslate('=COUNT(account_id)', financialSchema);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// String Operations
// ============================================================================

describe('String Operations', () => {
  it('should convert to uppercase', () => {
    const result = parseAndTranslate('=UPPER(category)', salesSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sql).toContain('UPPER("category")');
    }
  });

  it('should convert to lowercase', () => {
    const result = parseAndTranslate('=LOWER(product_name)', salesSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sql).toContain('LOWER("product_name")');
    }
  });

  it('should trim whitespace', () => {
    const result = parseAndTranslate('=TRIM(product_name)', salesSchema);
    expect(result.success).toBe(true);
  });

  it('should calculate string length', () => {
    const result = parseAndTranslate('=LEN(product_name)', salesSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sql).toContain('LENGTH("product_name")');
    }
  });
});

// ============================================================================
// Math Operations
// ============================================================================

describe('Math Operations', () => {
  it('should round to decimal places', () => {
    const result = parseAndTranslate('=ROUND(unit_price * quantity * tax_rate, 2)', salesSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sql).toContain('ROUND');
    }
  });

  it('should calculate absolute value', () => {
    const result = parseAndTranslate('=ABS(balance)', financialSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sql).toContain('ABS("balance")');
    }
  });

  it('should floor value', () => {
    const result = parseAndTranslate('=FLOOR(unit_price)', salesSchema);
    expect(result.success).toBe(true);
  });

  it('should ceiling value', () => {
    const result = parseAndTranslate('=CEIL(unit_price)', salesSchema);
    expect(result.success).toBe(true);
  });

  it('should calculate square root', () => {
    const result = parseAndTranslate('=SQRT(balance)', financialSchema);
    expect(result.success).toBe(true);
  });

  it('should calculate power', () => {
    const result = parseAndTranslate('=POWER(1 + interest_rate, 12)', financialSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sql).toContain('POWER');
    }
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  it('should handle formula with just column reference', () => {
    const result = parseAndTranslate('=unit_price', salesSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sql).toContain('SELECT "unit_price"');
    }
  });

  it('should handle formula with just number', () => {
    const parseResult = parseFormula('=42', salesSchema);
    expect(parseResult.success).toBe(true);
  });

  it('should handle zero in calculations', () => {
    const result = parseAndTranslate('=unit_price + 0', salesSchema);
    expect(result.success).toBe(true);
  });

  it('should handle negative numbers', () => {
    const result = parseAndTranslate('=unit_price - -10', salesSchema);
    expect(result.success).toBe(true);
  });

  it('should handle deeply nested parentheses', () => {
    const result = parseAndTranslate('=((((unit_price))))', salesSchema);
    expect(result.success).toBe(true);
  });

  it('should handle whitespace variations', () => {
    const formulas = [
      '=unit_price+quantity',
      '= unit_price + quantity',
      '=  unit_price  +  quantity  ',
      '=unit_price +quantity',
    ];

    for (const formula of formulas) {
      const result = parseAndTranslate(formula, salesSchema);
      expect(result.success).toBe(true);
    }
  });

  it('should handle case-insensitive column names', () => {
    const formulas = ['=UNIT_PRICE', '=Unit_Price', '=unit_price'];

    for (const formula of formulas) {
      const result = parseAndTranslate(formula, salesSchema);
      expect(result.success).toBe(true);
    }
  });
});

describe('Error Handling', () => {
  it('should reject unknown columns with helpful message', () => {
    const result = parseAndTranslate('=unknown_column + unit_price', salesSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unknown column');
      expect(result.error).toContain('unknown_column');
    }
  });

  it('should reject unknown functions with helpful message', () => {
    const result = parseAndTranslate('=VLOOKUP(unit_price)', salesSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unknown function');
    }
  });

  it('should reject wrong number of arguments', () => {
    const result = parseAndTranslate('=ROUND(unit_price, 2, 3)', salesSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('argument');
    }
  });

  it('should reject IF with wrong arguments', () => {
    const result = parseAndTranslate("=IF(unit_price > 100, 'expensive')", salesSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('argument');
    }
  });

  it('should reject unclosed parenthesis', () => {
    const result = parseAndTranslate('=SUM(unit_price', salesSchema);
    expect(result.success).toBe(false);
  });

  it('should reject unclosed string', () => {
    const result = parseAndTranslate("=category = 'electronics", salesSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unterminated');
    }
  });

  it('should reject empty formula', () => {
    const result = parseFormula('', salesSchema);
    expect(result.success).toBe(false);
  });

  it('should reject formula with only =', () => {
    const result = parseFormula('=', salesSchema);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should parse simple formulas quickly', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      parseFormula('=unit_price * quantity', salesSchema);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500); // 1000 parses in under 500ms
  });

  it('should parse complex formulas quickly', () => {
    const complexFormula =
      '=((unit_price * quantity) * (1 - discount) * (1 + tax_rate)) + shipping_cost';

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      parseFormula(complexFormula, salesSchema);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200); // 100 parses in under 200ms
  });

  it('should validate formulas efficiently', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      validateFormula('=SUM(unit_price)', salesSchema);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('should translate quickly', () => {
    const parseResult = parseFormula('=unit_price * quantity', salesSchema);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        translateToSQL(parseResult.ast, {
          viewName: 'test_view',
          rowId: 1,
          schema: salesSchema,
        });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100); // 1000 translations in under 100ms
    }
  });

  it('should handle large schema efficiently', () => {
    const largeSchema: ColumnSchema[] = Array.from({ length: 200 }, (_, i) => ({
      name: `column_${i}`,
      type: i % 4 === 0 ? 'DOUBLE' : i % 4 === 1 ? 'INTEGER' : i % 4 === 2 ? 'VARCHAR' : 'BOOLEAN',
    }));

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      parseFormula('=column_0 + column_100 + column_199', largeSchema);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});

// ============================================================================
// Bulk Operations
// ============================================================================

describe('Bulk Update Generation', () => {
  it('should generate UPDATE statement for bulk formula application', () => {
    const parseResult = parseFormula('=unit_price * quantity', salesSchema);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const sql = translateForBulkUpdate(
        parseResult.ast,
        { viewName: 'orders', schema: salesSchema },
        'total'
      );
      expect(sql).toContain('UPDATE "orders"');
      expect(sql).toContain('SET "total" =');
      expect(sql).toContain('("unit_price" * "quantity")');
    }
  });

  it('should generate expression for computed columns', () => {
    const parseResult = parseFormula('=(unit_price * quantity) * (1 - discount)', salesSchema);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const expr = translateExpression(parseResult.ast, {
        viewName: 'orders',
        schema: salesSchema,
      });
      expect(expr).toBe('(("unit_price" * "quantity") * (1 - "discount"))');
      expect(expr).not.toContain('SELECT');
    }
  });
});

// ============================================================================
// Function Coverage
// ============================================================================

describe('Supported Functions', () => {
  it('should support all aggregate functions', () => {
    const aggregates = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
    for (const func of aggregates) {
      expect(isAggregateFunction(func)).toBe(true);
      const result = parseAndTranslate(`=${func}(unit_price)`, salesSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isAggregate).toBe(true);
      }
    }
  });

  it('should support all string functions', () => {
    const stringFuncs = ['UPPER', 'LOWER', 'TRIM', 'LEN'];
    for (const func of stringFuncs) {
      const result = parseAndTranslate(`=${func}(product_name)`, salesSchema);
      expect(result.success).toBe(true);
    }
  });

  it('should support all math functions', () => {
    const mathFuncs = ['ABS', 'ROUND', 'FLOOR', 'CEIL', 'SQRT'];
    for (const func of mathFuncs) {
      const result = parseAndTranslate(`=${func}(unit_price)`, salesSchema);
      expect(result.success).toBe(true);
    }
  });

  it('should list all supported functions', () => {
    const functions = getSupportedFunctions();
    expect(functions.length).toBeGreaterThan(20);
    expect(functions).toContain('SUM');
    expect(functions).toContain('IF');
    expect(functions).toContain('UPPER');
    expect(functions).toContain('ROUND');
  });
});

// ============================================================================
// isFormula Detection
// ============================================================================

describe('Formula Detection', () => {
  it('should detect formulas starting with =', () => {
    expect(isFormula('=SUM(price)')).toBe(true);
    expect(isFormula('=price * quantity')).toBe(true);
    expect(isFormula('=1+1')).toBe(true);
  });

  it('should not detect non-formulas', () => {
    expect(isFormula('SUM(price)')).toBe(false);
    expect(isFormula('100')).toBe(false);
    expect(isFormula('hello')).toBe(false);
    expect(isFormula('')).toBe(false);
    expect(isFormula('price = 100')).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(isFormula('  =SUM(price)')).toBe(true);
    expect(isFormula('\t=price')).toBe(true);
  });
});
