/**
 * Function Mapping Tests
 *
 * Tests for the Excel to DuckDB function mapping including:
 * - Function existence
 * - Aggregate detection
 * - Argument validation
 * - Function suggestions
 */

import { describe, it, expect } from 'vitest';
import {
  FUNCTION_MAP,
  AGGREGATE_FUNCTIONS,
  isAggregateFunction,
  getFunctionMapping,
  getSupportedFunctions,
  suggestFunction,
} from './functions';

describe('FUNCTION_MAP', () => {
  describe('Aggregate Functions', () => {
    it('should have SUM mapping', () => {
      expect(FUNCTION_MAP.SUM).toBeDefined();
      expect(FUNCTION_MAP.SUM.sql).toBe('SUM');
      expect(FUNCTION_MAP.SUM.isAggregate).toBe(true);
    });

    it('should have AVG mapping', () => {
      expect(FUNCTION_MAP.AVG).toBeDefined();
      expect(FUNCTION_MAP.AVG.sql).toBe('AVG');
      expect(FUNCTION_MAP.AVG.isAggregate).toBe(true);
    });

    it('should have AVERAGE as alias for AVG', () => {
      expect(FUNCTION_MAP.AVERAGE).toBeDefined();
      expect(FUNCTION_MAP.AVERAGE.sql).toBe('AVG');
      expect(FUNCTION_MAP.AVERAGE.isAggregate).toBe(true);
    });

    it('should have COUNT mapping', () => {
      expect(FUNCTION_MAP.COUNT).toBeDefined();
      expect(FUNCTION_MAP.COUNT.sql).toBe('COUNT');
      expect(FUNCTION_MAP.COUNT.isAggregate).toBe(true);
    });

    it('should have MIN mapping', () => {
      expect(FUNCTION_MAP.MIN).toBeDefined();
      expect(FUNCTION_MAP.MIN.sql).toBe('MIN');
      expect(FUNCTION_MAP.MIN.isAggregate).toBe(true);
    });

    it('should have MAX mapping', () => {
      expect(FUNCTION_MAP.MAX).toBeDefined();
      expect(FUNCTION_MAP.MAX.sql).toBe('MAX');
      expect(FUNCTION_MAP.MAX.isAggregate).toBe(true);
    });
  });

  describe('String Functions', () => {
    it('should have UPPER mapping', () => {
      expect(FUNCTION_MAP.UPPER).toBeDefined();
      expect(FUNCTION_MAP.UPPER.sql).toBe('UPPER');
      expect(FUNCTION_MAP.UPPER.isAggregate).toBe(false);
    });

    it('should have LOWER mapping', () => {
      expect(FUNCTION_MAP.LOWER).toBeDefined();
      expect(FUNCTION_MAP.LOWER.sql).toBe('LOWER');
      expect(FUNCTION_MAP.LOWER.isAggregate).toBe(false);
    });

    it('should have TRIM mapping', () => {
      expect(FUNCTION_MAP.TRIM).toBeDefined();
      expect(FUNCTION_MAP.TRIM.sql).toBe('TRIM');
    });

    it('should have LEN mapping to LENGTH', () => {
      expect(FUNCTION_MAP.LEN).toBeDefined();
      expect(FUNCTION_MAP.LEN.sql).toBe('LENGTH');
    });

    it('should have LEFT mapping', () => {
      expect(FUNCTION_MAP.LEFT).toBeDefined();
      expect(FUNCTION_MAP.LEFT.sql).toBe('LEFT');
      expect(FUNCTION_MAP.LEFT.minArgs).toBe(2);
      expect(FUNCTION_MAP.LEFT.maxArgs).toBe(2);
    });

    it('should have RIGHT mapping', () => {
      expect(FUNCTION_MAP.RIGHT).toBeDefined();
      expect(FUNCTION_MAP.RIGHT.sql).toBe('RIGHT');
    });

    it('should have CONCAT mapping', () => {
      expect(FUNCTION_MAP.CONCAT).toBeDefined();
      expect(FUNCTION_MAP.CONCAT.sql).toBe('CONCAT');
      expect(FUNCTION_MAP.CONCAT.minArgs).toBe(1);
      expect(FUNCTION_MAP.CONCAT.maxArgs).toBeUndefined(); // Variable args
    });

    it('should have MID mapping to SUBSTRING', () => {
      expect(FUNCTION_MAP.MID).toBeDefined();
      expect(FUNCTION_MAP.MID.sql).toBe('SUBSTRING');
    });
  });

  describe('Math Functions', () => {
    it('should have ABS mapping', () => {
      expect(FUNCTION_MAP.ABS).toBeDefined();
      expect(FUNCTION_MAP.ABS.sql).toBe('ABS');
      expect(FUNCTION_MAP.ABS.isAggregate).toBe(false);
    });

    it('should have ROUND mapping', () => {
      expect(FUNCTION_MAP.ROUND).toBeDefined();
      expect(FUNCTION_MAP.ROUND.sql).toBe('ROUND');
      expect(FUNCTION_MAP.ROUND.minArgs).toBe(1);
      expect(FUNCTION_MAP.ROUND.maxArgs).toBe(2);
    });

    it('should have FLOOR mapping', () => {
      expect(FUNCTION_MAP.FLOOR).toBeDefined();
      expect(FUNCTION_MAP.FLOOR.sql).toBe('FLOOR');
    });

    it('should have CEIL mapping', () => {
      expect(FUNCTION_MAP.CEIL).toBeDefined();
      expect(FUNCTION_MAP.CEIL.sql).toBe('CEIL');
    });

    it('should have CEILING as alias for CEIL', () => {
      expect(FUNCTION_MAP.CEILING).toBeDefined();
      expect(FUNCTION_MAP.CEILING.sql).toBe('CEIL');
    });

    it('should have SQRT mapping', () => {
      expect(FUNCTION_MAP.SQRT).toBeDefined();
      expect(FUNCTION_MAP.SQRT.sql).toBe('SQRT');
    });

    it('should have POWER mapping', () => {
      expect(FUNCTION_MAP.POWER).toBeDefined();
      expect(FUNCTION_MAP.POWER.sql).toBe('POWER');
      expect(FUNCTION_MAP.POWER.minArgs).toBe(2);
      expect(FUNCTION_MAP.POWER.maxArgs).toBe(2);
    });

    it('should have MOD mapping', () => {
      expect(FUNCTION_MAP.MOD).toBeDefined();
      expect(FUNCTION_MAP.MOD.sql).toBe('MOD');
    });

    it('should have LOG mapping', () => {
      expect(FUNCTION_MAP.LOG).toBeDefined();
      expect(FUNCTION_MAP.LOG.sql).toBe('LOG');
    });

    it('should have EXP mapping', () => {
      expect(FUNCTION_MAP.EXP).toBeDefined();
      expect(FUNCTION_MAP.EXP.sql).toBe('EXP');
    });
  });

  describe('Conditional Function', () => {
    it('should have IF mapping', () => {
      expect(FUNCTION_MAP.IF).toBeDefined();
      expect(FUNCTION_MAP.IF.sql).toBe('CASE');
      expect(FUNCTION_MAP.IF.isAggregate).toBe(false);
      expect(FUNCTION_MAP.IF.minArgs).toBe(3);
      expect(FUNCTION_MAP.IF.maxArgs).toBe(3);
    });
  });

  describe('Null Functions', () => {
    it('should have COALESCE mapping', () => {
      expect(FUNCTION_MAP.COALESCE).toBeDefined();
      expect(FUNCTION_MAP.COALESCE.sql).toBe('COALESCE');
    });

    it('should have IFNULL as alias for COALESCE', () => {
      expect(FUNCTION_MAP.IFNULL).toBeDefined();
      expect(FUNCTION_MAP.IFNULL.sql).toBe('COALESCE');
    });
  });
});

describe('AGGREGATE_FUNCTIONS', () => {
  it('should contain SUM', () => {
    expect(AGGREGATE_FUNCTIONS.has('SUM')).toBe(true);
  });

  it('should contain AVG', () => {
    expect(AGGREGATE_FUNCTIONS.has('AVG')).toBe(true);
  });

  it('should contain AVERAGE', () => {
    expect(AGGREGATE_FUNCTIONS.has('AVERAGE')).toBe(true);
  });

  it('should contain COUNT', () => {
    expect(AGGREGATE_FUNCTIONS.has('COUNT')).toBe(true);
  });

  it('should contain MIN', () => {
    expect(AGGREGATE_FUNCTIONS.has('MIN')).toBe(true);
  });

  it('should contain MAX', () => {
    expect(AGGREGATE_FUNCTIONS.has('MAX')).toBe(true);
  });

  it('should not contain UPPER', () => {
    expect(AGGREGATE_FUNCTIONS.has('UPPER')).toBe(false);
  });

  it('should not contain IF', () => {
    expect(AGGREGATE_FUNCTIONS.has('IF')).toBe(false);
  });
});

describe('isAggregateFunction', () => {
  it('should return true for aggregate functions', () => {
    expect(isAggregateFunction('SUM')).toBe(true);
    expect(isAggregateFunction('AVG')).toBe(true);
    expect(isAggregateFunction('COUNT')).toBe(true);
    expect(isAggregateFunction('MIN')).toBe(true);
    expect(isAggregateFunction('MAX')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAggregateFunction('sum')).toBe(true);
    expect(isAggregateFunction('Sum')).toBe(true);
    expect(isAggregateFunction('SuM')).toBe(true);
  });

  it('should return false for non-aggregate functions', () => {
    expect(isAggregateFunction('UPPER')).toBe(false);
    expect(isAggregateFunction('LOWER')).toBe(false);
    expect(isAggregateFunction('IF')).toBe(false);
    expect(isAggregateFunction('ROUND')).toBe(false);
  });

  it('should return false for unknown functions', () => {
    expect(isAggregateFunction('UNKNOWN')).toBe(false);
    expect(isAggregateFunction('')).toBe(false);
  });
});

describe('getFunctionMapping', () => {
  it('should return mapping for known functions', () => {
    const sumMapping = getFunctionMapping('SUM');
    expect(sumMapping).toBeDefined();
    expect(sumMapping?.sql).toBe('SUM');
  });

  it('should be case-insensitive', () => {
    const mapping1 = getFunctionMapping('sum');
    const mapping2 = getFunctionMapping('Sum');
    const mapping3 = getFunctionMapping('SUM');
    expect(mapping1).toEqual(mapping2);
    expect(mapping2).toEqual(mapping3);
  });

  it('should return undefined for unknown functions', () => {
    expect(getFunctionMapping('UNKNOWN')).toBeUndefined();
    expect(getFunctionMapping('')).toBeUndefined();
    expect(getFunctionMapping('VLOOKUP')).toBeUndefined();
  });
});

describe('getSupportedFunctions', () => {
  it('should return array of function names', () => {
    const functions = getSupportedFunctions();
    expect(Array.isArray(functions)).toBe(true);
    expect(functions.length).toBeGreaterThan(0);
  });

  it('should include common functions', () => {
    const functions = getSupportedFunctions();
    expect(functions).toContain('SUM');
    expect(functions).toContain('AVG');
    expect(functions).toContain('COUNT');
    expect(functions).toContain('UPPER');
    expect(functions).toContain('IF');
  });

  it('should return sorted list', () => {
    const functions = getSupportedFunctions();
    const sorted = [...functions].sort();
    expect(functions).toEqual(sorted);
  });

  it('should return all mapped functions', () => {
    const functions = getSupportedFunctions();
    const mappedKeys = Object.keys(FUNCTION_MAP);
    expect(functions.length).toBe(mappedKeys.length);
  });
});

describe('suggestFunction', () => {
  it('should suggest similar functions', () => {
    const suggestions = suggestFunction('SUMM');
    expect(suggestions).toContain('SUM');
  });

  it('should suggest functions starting with same letter', () => {
    const suggestions = suggestFunction('S');
    expect(suggestions.some(s => s.startsWith('S'))).toBe(true);
  });

  it('should return limited suggestions', () => {
    const suggestions = suggestFunction('A');
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('should handle empty input', () => {
    const suggestions = suggestFunction('');
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('should be case-insensitive', () => {
    const suggestions1 = suggestFunction('sum');
    const suggestions2 = suggestFunction('SUM');
    // Both should find SUM-related suggestions
    expect(suggestions1.length).toBeGreaterThan(0);
    expect(suggestions2.length).toBeGreaterThan(0);
  });
});

describe('Argument Count Validation', () => {
  it('should define minArgs for functions that require arguments', () => {
    expect(FUNCTION_MAP.IF.minArgs).toBe(3);
    expect(FUNCTION_MAP.POWER.minArgs).toBe(2);
    expect(FUNCTION_MAP.LEFT.minArgs).toBe(2);
  });

  it('should define maxArgs for functions with fixed arguments', () => {
    expect(FUNCTION_MAP.IF.maxArgs).toBe(3);
    expect(FUNCTION_MAP.POWER.maxArgs).toBe(2);
    expect(FUNCTION_MAP.ABS.maxArgs).toBe(1);
  });

  it('should allow variable args for CONCAT', () => {
    expect(FUNCTION_MAP.CONCAT.minArgs).toBe(1);
    expect(FUNCTION_MAP.CONCAT.maxArgs).toBeUndefined();
  });

  it('should allow ROUND with 1 or 2 arguments', () => {
    expect(FUNCTION_MAP.ROUND.minArgs).toBe(1);
    expect(FUNCTION_MAP.ROUND.maxArgs).toBe(2);
  });
});

describe('Function Mapping Completeness', () => {
  it('should have all aggregate functions marked as aggregate', () => {
    for (const name of AGGREGATE_FUNCTIONS) {
      const mapping = getFunctionMapping(name);
      if (mapping) {
        expect(mapping.isAggregate).toBe(true);
      }
    }
  });

  it('should have all non-aggregate functions marked correctly', () => {
    const nonAggregates = ['UPPER', 'LOWER', 'TRIM', 'IF', 'ABS', 'ROUND'];
    for (const name of nonAggregates) {
      const mapping = getFunctionMapping(name);
      expect(mapping).toBeDefined();
      expect(mapping?.isAggregate).toBe(false);
    }
  });

  it('should have consistent mapping between Excel and SQL', () => {
    // Functions that map to themselves
    const sameMapping = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'UPPER', 'LOWER', 'TRIM', 'ABS', 'ROUND', 'FLOOR', 'SQRT', 'POWER'];
    for (const name of sameMapping) {
      const mapping = getFunctionMapping(name);
      expect(mapping?.sql).toBe(name);
    }
  });

  it('should have different SQL for Excel aliases', () => {
    // LEN -> LENGTH
    expect(getFunctionMapping('LEN')?.sql).toBe('LENGTH');
    // AVERAGE -> AVG
    expect(getFunctionMapping('AVERAGE')?.sql).toBe('AVG');
    // CEILING -> CEIL
    expect(getFunctionMapping('CEILING')?.sql).toBe('CEIL');
    // MID -> SUBSTRING
    expect(getFunctionMapping('MID')?.sql).toBe('SUBSTRING');
  });
});
