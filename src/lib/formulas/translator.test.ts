/**
 * Formula Translator Tests
 *
 * Comprehensive tests for the AST to SQL translator including:
 * - Basic arithmetic translation
 * - Aggregate vs row-level queries
 * - Function translation
 * - Column quoting
 * - IF to CASE WHEN transformation
 */

import { describe, it, expect } from 'vitest';
import { parseFormula } from './parser';
import { translateToSQL, translateExpression, translateForBulkUpdate } from './translator';
import type { ColumnSchema } from '@/store/duckDBViewStore';
import type { TranslateOptions } from './types';

// Test schema
const testSchema: ColumnSchema[] = [
  { name: 'id', type: 'BIGINT' },
  { name: 'product', type: 'VARCHAR' },
  { name: 'price', type: 'DOUBLE' },
  { name: 'quantity', type: 'INTEGER' },
  { name: 'discount', type: 'DOUBLE' },
  { name: 'total', type: 'DOUBLE' },
  { name: 'category', type: 'VARCHAR' },
  { name: 'is_active', type: 'BOOLEAN' },
];

const baseOptions: TranslateOptions = {
  viewName: 'test_view',
  rowId: 5,
  schema: testSchema,
};

// Helper to parse and translate
function translateFormula(formula: string, options: Partial<TranslateOptions> = {}) {
  const parseResult = parseFormula(formula, testSchema);
  if (!parseResult.success) {
    throw new Error(`Parse failed: ${parseResult.error}`);
  }
  return translateToSQL(parseResult.ast, { ...baseOptions, ...options });
}

describe('translateToSQL - Basic Arithmetic', () => {
  it('should translate addition', () => {
    const result = translateFormula('=price + discount');
    expect(result.sql).toContain('("price" + "discount")');
    expect(result.sql).toContain('WHERE _rowid = 5');
    expect(result.isAggregate).toBe(false);
  });

  it('should translate subtraction', () => {
    const result = translateFormula('=price - discount');
    expect(result.sql).toContain('("price" - "discount")');
  });

  it('should translate multiplication', () => {
    const result = translateFormula('=price * quantity');
    expect(result.sql).toContain('("price" * "quantity")');
  });

  it('should translate division', () => {
    const result = translateFormula('=total / quantity');
    expect(result.sql).toContain('("total" / "quantity")');
  });

  it('should translate number literals', () => {
    const result = translateFormula('=price * 1.5');
    expect(result.sql).toContain('("price" * 1.5)');
  });

  it('should translate complex arithmetic', () => {
    const result = translateFormula('=(price * quantity) - discount');
    expect(result.sql).toContain('(("price" * "quantity") - "discount")');
  });

  it('should translate unary negation', () => {
    const result = translateFormula('=-price');
    expect(result.sql).toContain('(-"price")');
  });
});

describe('translateToSQL - Column Quoting', () => {
  it('should quote all column names', () => {
    const result = translateFormula('=price + quantity');
    expect(result.sql).toContain('"price"');
    expect(result.sql).toContain('"quantity"');
  });

  it('should quote view name', () => {
    const result = translateFormula('=price');
    expect(result.sql).toContain('FROM "test_view"');
  });

  it('should handle special characters in view name', () => {
    const result = translateFormula('=price', { viewName: 'my-view_123' });
    expect(result.sql).toContain('FROM "my-view_123"');
  });
});

describe('translateToSQL - Row-Level Queries', () => {
  it('should include WHERE clause for row-level formulas', () => {
    const result = translateFormula('=price * quantity', { rowId: 10 });
    expect(result.sql).toContain('WHERE _rowid = 10');
    expect(result.isAggregate).toBe(false);
  });

  it('should use provided rowId', () => {
    const result = translateFormula('=price', { rowId: 999 });
    expect(result.sql).toContain('WHERE _rowid = 999');
  });

  it('should use LIMIT 1 when no rowId provided for non-aggregate', () => {
    const result = translateFormula('=price * 2', { rowId: undefined });
    expect(result.sql).toContain('LIMIT 1');
  });
});

describe('translateToSQL - Aggregate Functions', () => {
  it('should translate SUM without WHERE clause', () => {
    const result = translateFormula('=SUM(price)');
    expect(result.sql).toContain('SUM("price")');
    expect(result.sql).not.toContain('WHERE _rowid');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate AVG', () => {
    const result = translateFormula('=AVG(price)');
    expect(result.sql).toContain('AVG("price")');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate AVERAGE to AVG', () => {
    const result = translateFormula('=AVERAGE(price)');
    expect(result.sql).toContain('AVG("price")');
  });

  it('should translate COUNT', () => {
    const result = translateFormula('=COUNT(id)');
    expect(result.sql).toContain('COUNT("id")');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate MIN', () => {
    const result = translateFormula('=MIN(price)');
    expect(result.sql).toContain('MIN("price")');
  });

  it('should translate MAX', () => {
    const result = translateFormula('=MAX(price)');
    expect(result.sql).toContain('MAX("price")');
  });

  it('should translate aggregate with expression', () => {
    const result = translateFormula('=SUM(price * quantity)');
    expect(result.sql).toContain('SUM(("price" * "quantity"))');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate aggregate in expression', () => {
    const result = translateFormula('=SUM(price) * 1.1');
    expect(result.sql).toContain('(SUM("price") * 1.1)');
    expect(result.isAggregate).toBe(true);
  });
});

describe('translateToSQL - Row-Level Functions', () => {
  it('should translate UPPER with WHERE clause', () => {
    const result = translateFormula('=UPPER(product)', { rowId: 5 });
    expect(result.sql).toContain('UPPER("product")');
    expect(result.sql).toContain('WHERE _rowid = 5');
    expect(result.isAggregate).toBe(false);
  });

  it('should translate LOWER', () => {
    const result = translateFormula('=LOWER(category)');
    expect(result.sql).toContain('LOWER("category")');
  });

  it('should translate TRIM', () => {
    const result = translateFormula('=TRIM(product)');
    expect(result.sql).toContain('TRIM("product")');
  });

  it('should translate LEN to LENGTH', () => {
    const result = translateFormula('=LEN(product)');
    expect(result.sql).toContain('LENGTH("product")');
  });

  it('should translate ROUND with precision', () => {
    const result = translateFormula('=ROUND(price, 2)');
    expect(result.sql).toContain('ROUND("price", 2)');
  });

  it('should translate ABS', () => {
    const result = translateFormula('=ABS(discount)');
    expect(result.sql).toContain('ABS("discount")');
  });

  it('should translate FLOOR', () => {
    const result = translateFormula('=FLOOR(price)');
    expect(result.sql).toContain('FLOOR("price")');
  });

  it('should translate CEIL/CEILING', () => {
    const result = translateFormula('=CEIL(price)');
    expect(result.sql).toContain('CEIL("price")');
  });

  it('should translate SQRT', () => {
    const result = translateFormula('=SQRT(price)');
    expect(result.sql).toContain('SQRT("price")');
  });

  it('should translate POWER', () => {
    const result = translateFormula('=POWER(price, 2)');
    expect(result.sql).toContain('POWER("price", 2)');
  });
});

describe('translateToSQL - IF to CASE WHEN', () => {
  it('should translate IF to CASE WHEN', () => {
    const result = translateFormula("=IF(price > 100, 'expensive', 'cheap')");
    expect(result.sql).toContain('CASE WHEN');
    expect(result.sql).toContain('("price" > 100)');
    expect(result.sql).toContain("THEN 'expensive'");
    expect(result.sql).toContain("ELSE 'cheap'");
    expect(result.sql).toContain('END');
  });

  it('should translate IF with numeric condition', () => {
    const result = translateFormula('=IF(quantity > 10, price * 0.9, price)');
    expect(result.sql).toContain('CASE WHEN');
    expect(result.sql).toContain('("quantity" > 10)');
    expect(result.sql).toContain('THEN ("price" * 0.9)');
    expect(result.sql).toContain('ELSE "price"');
  });

  it('should translate IF with equals comparison', () => {
    const result = translateFormula("=IF(category = 'electronics', total * 1.1, total)");
    expect(result.sql).toContain('CASE WHEN');
    expect(result.sql).toContain('("category" = \'electronics\')');
  });
});

describe('translateToSQL - Comparisons', () => {
  it('should translate equals', () => {
    const result = translateFormula('=price = 100');
    expect(result.sql).toContain('("price" = 100)');
  });

  it('should translate not equals', () => {
    const result = translateFormula('=price != 0');
    expect(result.sql).toContain('("price" != 0)');
  });

  it('should translate <> to !=', () => {
    const result = translateFormula('=quantity <> 0');
    expect(result.sql).toContain('("quantity" != 0)');
  });

  it('should translate greater than', () => {
    const result = translateFormula('=price > 50');
    expect(result.sql).toContain('("price" > 50)');
  });

  it('should translate less than', () => {
    const result = translateFormula('=quantity < 10');
    expect(result.sql).toContain('("quantity" < 10)');
  });

  it('should translate >= and <=', () => {
    const result1 = translateFormula('=price >= 100');
    const result2 = translateFormula('=discount <= 0.5');
    expect(result1.sql).toContain('("price" >= 100)');
    expect(result2.sql).toContain('("discount" <= 0.5)');
  });
});

describe('translateToSQL - String Literals', () => {
  it('should quote string literals', () => {
    const result = translateFormula("=category = 'electronics'");
    expect(result.sql).toContain("'electronics'");
  });

  it('should handle strings in comparisons', () => {
    const parseResult = parseFormula("=product = 'OReilly Books'", testSchema);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const result = translateToSQL(parseResult.ast, baseOptions);
      expect(result.sql).toContain("'OReilly Books'");
    }
  });
});

describe('translateToSQL - SELECT Structure', () => {
  it('should generate valid SELECT statement', () => {
    const result = translateFormula('=price * quantity');
    expect(result.sql).toMatch(/^SELECT .+ AS result FROM ".+"/);
  });

  it('should alias result as "result"', () => {
    const result = translateFormula('=price');
    expect(result.sql).toContain('AS result');
  });
});

describe('translateExpression', () => {
  it('should return just the expression without SELECT', () => {
    const parseResult = parseFormula('=price * quantity', testSchema);
    if (!parseResult.success) throw new Error('Parse failed');

    const expr = translateExpression(parseResult.ast, baseOptions);
    expect(expr).toBe('("price" * "quantity")');
    expect(expr).not.toContain('SELECT');
    expect(expr).not.toContain('FROM');
  });

  it('should work for aggregate expressions', () => {
    const parseResult = parseFormula('=SUM(price)', testSchema);
    if (!parseResult.success) throw new Error('Parse failed');

    const expr = translateExpression(parseResult.ast, baseOptions);
    expect(expr).toBe('SUM("price")');
  });
});

describe('translateForBulkUpdate', () => {
  it('should generate UPDATE statement', () => {
    const parseResult = parseFormula('=price * quantity', testSchema);
    if (!parseResult.success) throw new Error('Parse failed');

    const sql = translateForBulkUpdate(parseResult.ast, baseOptions, 'total');
    expect(sql).toContain('UPDATE "test_view"');
    expect(sql).toContain('SET "total" =');
    expect(sql).toContain('("price" * "quantity")');
  });

  it('should quote target column', () => {
    const parseResult = parseFormula('=price * 1.1', testSchema);
    if (!parseResult.success) throw new Error('Parse failed');

    const sql = translateForBulkUpdate(parseResult.ast, baseOptions, 'new_price');
    expect(sql).toContain('"new_price"');
  });
});

describe('translateToSQL - Complex Scenarios', () => {
  it('should handle nested functions', () => {
    const result = translateFormula('=ROUND(price * quantity, 2)');
    expect(result.sql).toContain('ROUND(("price" * "quantity"), 2)');
  });

  it('should handle multiple column references', () => {
    const result = translateFormula('=price * quantity - discount + total');
    expect(result.sql).toContain('"price"');
    expect(result.sql).toContain('"quantity"');
    expect(result.sql).toContain('"discount"');
    expect(result.sql).toContain('"total"');
  });

  it('should handle deeply nested expressions', () => {
    const result = translateFormula('=((price + discount) * quantity) / 100');
    expect(result.sql).toContain('((("price" + "discount") * "quantity") / 100)');
  });

  it('should handle percentage calculation', () => {
    const result = translateFormula('=price * (1 - discount)');
    expect(result.sql).toContain('("price" * (1 - "discount"))');
  });

  it('should handle margin calculation', () => {
    const result = translateFormula('=(total - (price * quantity)) / total');
    expect(result.sql).toContain('(("total" - ("price" * "quantity")) / "total")');
  });
});

describe('translateToSQL - Edge Cases', () => {
  it('should handle simple column reference', () => {
    const result = translateFormula('=price');
    expect(result.sql).toContain('SELECT "price" AS result');
  });

  it('should handle simple number', () => {
    const parseResult = parseFormula('=100', testSchema);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      const result = translateToSQL(parseResult.ast, baseOptions);
      expect(result.sql).toContain('100');
    }
  });

  it('should handle zero', () => {
    const parseResult = parseFormula('=0', testSchema);
    expect(parseResult.success).toBe(true);
  });

  it('should handle negative literal', () => {
    const result = translateFormula('=-5');
    expect(result.sql).toContain('(-5)');
  });

  it('should handle large numbers', () => {
    const result = translateFormula('=price + 9999999999');
    expect(result.sql).toContain('9999999999');
  });

  it('should handle decimal precision', () => {
    const result = translateFormula('=price * 0.123456789');
    expect(result.sql).toContain('0.123456789');
  });
});

describe('translateToSQL - Performance', () => {
  it('should translate quickly for complex formulas', () => {
    const complexFormula = '=((price * quantity) - discount) * (1 + (total / 100))';
    const parseResult = parseFormula(complexFormula, testSchema);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        translateToSQL(parseResult.ast, baseOptions);
      }
      const elapsed = performance.now() - start;
      // Should complete 1000 translations in under 100ms
      expect(elapsed).toBeLessThan(100);
    }
  });
});

describe('translateToSQL - Logical Operators (AND/OR)', () => {
  it('should translate AND operator', () => {
    const result = translateFormula('=price > 100 AND quantity > 5');
    expect(result.sql).toContain('((\"price\" > 100) AND (\"quantity\" > 5))');
  });

  it('should translate OR operator', () => {
    const result = translateFormula("=category = 'electronics' OR category = 'appliances'");
    expect(result.sql).toContain("((\"category\" = 'electronics') OR (\"category\" = 'appliances'))");
  });

  it('should translate IF with AND condition to CASE WHEN', () => {
    const result = translateFormula("=IF(price > 100 AND quantity > 10, 'bulk', 'regular')");
    expect(result.sql).toContain('CASE WHEN');
    expect(result.sql).toContain('AND');
    expect(result.sql).toContain("THEN 'bulk'");
    expect(result.sql).toContain("ELSE 'regular'");
  });

  it('should translate IF with OR condition to CASE WHEN', () => {
    const result = translateFormula("=IF(price < 10 OR discount > 0.5, 'cheap', 'normal')");
    expect(result.sql).toContain('CASE WHEN');
    expect(result.sql).toContain('OR');
    expect(result.sql).toContain("THEN 'cheap'");
    expect(result.sql).toContain("ELSE 'normal'");
  });

  it('should respect precedence: AND before OR', () => {
    const result = translateFormula('=price > 100 OR quantity > 5 AND discount > 0');
    // Should be: (price > 100) OR ((quantity > 5) AND (discount > 0))
    expect(result.sql).toContain('((\"price\" > 100) OR ((\"quantity\" > 5) AND (\"discount\" > 0)))');
  });

  it('should translate multiple AND operators', () => {
    const result = translateFormula('=price > 0 AND quantity > 0 AND total > 0');
    expect(result.sql).toContain('AND');
    expect(result.sql).toContain('\"price\" > 0');
    expect(result.sql).toContain('\"quantity\" > 0');
    expect(result.sql).toContain('\"total\" > 0');
  });

  it('should translate parenthesized logical expressions', () => {
    const result = translateFormula('=(price > 100 OR quantity > 5) AND discount > 0');
    // Should be: ((price > 100) OR (quantity > 5)) AND (discount > 0)
    expect(result.sql).toContain('(((\"price\" > 100) OR (\"quantity\" > 5)) AND (\"discount\" > 0))');
  });
});

describe('translateToSQL - Date Functions', () => {
  // Create a schema with a date column for these tests
  const dateSchema: ColumnSchema[] = [
    { name: 'id', type: 'BIGINT' },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'updated_at', type: 'DATE' },
    { name: 'amount', type: 'DOUBLE' },
  ];

  const dateOptions: TranslateOptions = {
    viewName: 'test_view',
    rowId: 5,
    schema: dateSchema,
  };

  function translateDateFormula(formula: string) {
    const parseResult = parseFormula(formula, dateSchema);
    if (!parseResult.success) {
      throw new Error(`Parse failed: ${parseResult.error}`);
    }
    return translateToSQL(parseResult.ast, dateOptions);
  }

  it('should translate YEAR function', () => {
    const result = translateDateFormula('=YEAR(created_at)');
    expect(result.sql).toContain('YEAR(\"created_at\")');
  });

  it('should translate MONTH function', () => {
    const result = translateDateFormula('=MONTH(created_at)');
    expect(result.sql).toContain('MONTH(\"created_at\")');
  });

  it('should translate DAY function', () => {
    const result = translateDateFormula('=DAY(created_at)');
    expect(result.sql).toContain('DAY(\"created_at\")');
  });

  it('should translate NOW() to CURRENT_TIMESTAMP', () => {
    const result = translateDateFormula('=NOW()');
    expect(result.sql).toContain('CURRENT_TIMESTAMP');
    expect(result.sql).not.toContain('CURRENT_TIMESTAMP()');
  });

  it('should translate TODAY() to CURRENT_DATE', () => {
    const result = translateDateFormula('=TODAY()');
    expect(result.sql).toContain('CURRENT_DATE');
    expect(result.sql).not.toContain('CURRENT_DATE()');
  });

  it('should translate DATE function to MAKE_DATE', () => {
    const result = translateDateFormula('=DATE(2024, 12, 25)');
    expect(result.sql).toContain('MAKE_DATE(2024, 12, 25)');
  });

  it('should translate HOUR function', () => {
    const result = translateDateFormula('=HOUR(created_at)');
    expect(result.sql).toContain('HOUR(\"created_at\")');
  });

  it('should translate MINUTE function', () => {
    const result = translateDateFormula('=MINUTE(created_at)');
    expect(result.sql).toContain('MINUTE(\"created_at\")');
  });

  it('should translate SECOND function', () => {
    const result = translateDateFormula('=SECOND(created_at)');
    expect(result.sql).toContain('SECOND(\"created_at\")');
  });

  it('should translate DATEVALUE to CAST AS DATE', () => {
    const result = translateDateFormula("=DATEVALUE('2024-01-15')");
    expect(result.sql).toContain("CAST('2024-01-15' AS DATE)");
  });

  it('should translate date comparison', () => {
    const result = translateDateFormula('=YEAR(created_at) = 2024');
    expect(result.sql).toContain('(YEAR(\"created_at\") = 2024)');
  });

  it('should translate IF with date condition', () => {
    const result = translateDateFormula("=IF(YEAR(created_at) > 2023, 'recent', 'old')");
    expect(result.sql).toContain('CASE WHEN');
    expect(result.sql).toContain('YEAR(\"created_at\") > 2023');
    expect(result.sql).toContain("THEN 'recent'");
    expect(result.sql).toContain("ELSE 'old'");
  });

  it('should translate arithmetic with date functions', () => {
    const result = translateDateFormula('=YEAR(created_at) - 2000');
    expect(result.sql).toContain('(YEAR(\"created_at\") - 2000)');
  });
});

describe('translateToSQL - Conditional Aggregates (SUMIF/COUNTIF/AVERAGEIF)', () => {
  it('should translate SUMIF to SUM with CASE WHEN', () => {
    const result = translateFormula("=SUMIF(category = 'electronics', price)");
    expect(result.sql).toContain('SUM(CASE WHEN');
    expect(result.sql).toContain("(\"category\" = 'electronics')");
    expect(result.sql).toContain('THEN \"price\"');
    expect(result.sql).toContain('ELSE 0 END)');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate COUNTIF to SUM with CASE WHEN', () => {
    const result = translateFormula("=COUNTIF(category = 'electronics')");
    expect(result.sql).toContain('SUM(CASE WHEN');
    expect(result.sql).toContain("(\"category\" = 'electronics')");
    expect(result.sql).toContain('THEN 1 ELSE 0 END)');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate AVERAGEIF to AVG with CASE WHEN and NULL', () => {
    const result = translateFormula("=AVERAGEIF(category = 'electronics', price)");
    expect(result.sql).toContain('AVG(CASE WHEN');
    expect(result.sql).toContain("(\"category\" = 'electronics')");
    expect(result.sql).toContain('THEN \"price\"');
    expect(result.sql).toContain('ELSE NULL END)');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate SUMIF with numeric condition', () => {
    const result = translateFormula('=SUMIF(quantity > 10, price)');
    expect(result.sql).toContain('SUM(CASE WHEN (\"quantity\" > 10) THEN \"price\" ELSE 0 END)');
  });

  it('should translate COUNTIF with AND condition', () => {
    const result = translateFormula('=COUNTIF(price > 100 AND quantity > 5)');
    expect(result.sql).toContain('SUM(CASE WHEN');
    expect(result.sql).toContain('AND');
    expect(result.sql).toContain('THEN 1 ELSE 0 END)');
  });

  it('should translate SUMIF with OR condition', () => {
    const result = translateFormula("=SUMIF(category = 'a' OR category = 'b', price)");
    expect(result.sql).toContain('SUM(CASE WHEN');
    expect(result.sql).toContain('OR');
    expect(result.sql).toContain('THEN \"price\" ELSE 0 END)');
  });

  it('should translate SUMIF with complex condition using AND/OR', () => {
    const result = translateFormula("=SUMIF((category = 'electronics' OR category = 'appliances') AND price > 50, quantity)");
    expect(result.sql).toContain('SUM(CASE WHEN');
    expect(result.sql).toContain('AND');
    expect(result.sql).toContain('OR');
    expect(result.sql).toContain('THEN \"quantity\" ELSE 0 END)');
  });

  it('should not include WHERE clause for SUMIF (aggregate)', () => {
    const result = translateFormula("=SUMIF(category = 'electronics', price)");
    expect(result.sql).not.toContain('WHERE _rowid');
    expect(result.isAggregate).toBe(true);
  });

  it('should translate addition of conditional aggregates', () => {
    const result = translateFormula("=SUMIF(category = 'electronics', price) + COUNTIF(quantity > 10)");
    expect(result.sql).toContain('(SUM(CASE WHEN');
    expect(result.sql).toContain(' + SUM(CASE WHEN');
    expect(result.isAggregate).toBe(true);
  });
});
