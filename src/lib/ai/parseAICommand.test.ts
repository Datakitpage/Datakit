import { describe, it, expect } from 'vitest';
import {
  parseAICommand,
  findColumn,
  validateColumn,
  looksLikeCommand,
  isWriteOperation,
  getCommandPatterns,
  type ParseContext,
} from './parseAICommand';
import type { ColumnSchema } from '@/store/duckDBViewStore';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockSchema: ColumnSchema[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'email', type: 'VARCHAR', nullable: true },
  { name: 'age', type: 'INTEGER', nullable: true },
  { name: 'created_at', type: 'TIMESTAMP', nullable: false },
  { name: 'Status', type: 'VARCHAR', nullable: true }, // Mixed case for testing
  { name: 'total_amount', type: 'DECIMAL', nullable: true },
];

const context: ParseContext = { schema: mockSchema };

// ============================================================================
// Helper Functions Tests
// ============================================================================

describe('findColumn', () => {
  it('finds column by exact name', () => {
    const col = findColumn('name', mockSchema);
    expect(col).toBeDefined();
    expect(col?.name).toBe('name');
  });

  it('finds column case-insensitively by default', () => {
    const col = findColumn('NAME', mockSchema);
    expect(col).toBeDefined();
    expect(col?.name).toBe('name');
  });

  it('finds mixed case columns', () => {
    const col = findColumn('status', mockSchema);
    expect(col).toBeDefined();
    expect(col?.name).toBe('Status'); // Returns canonical name
  });

  it('returns undefined for non-existent column', () => {
    const col = findColumn('nonexistent', mockSchema);
    expect(col).toBeUndefined();
  });

  it('respects case sensitivity when enabled', () => {
    const col = findColumn('NAME', mockSchema, true);
    expect(col).toBeUndefined();
  });
});

describe('validateColumn', () => {
  it('returns valid for existing column', () => {
    const result = validateColumn('name', mockSchema);
    expect(result.valid).toBe(true);
    expect(result.canonicalName).toBe('name');
  });

  it('returns canonical name with proper casing', () => {
    const result = validateColumn('status', mockSchema);
    expect(result.valid).toBe(true);
    expect(result.canonicalName).toBe('Status');
  });

  it('returns error with suggestions for non-existent column', () => {
    const result = validateColumn('nam', mockSchema);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.error).toContain('name'); // Should suggest "name"
  });

  it('returns error without suggestions for completely unrelated column', () => {
    const result = validateColumn('xyz123', mockSchema);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found in schema');
  });
});

describe('looksLikeCommand', () => {
  it('returns true for sort commands', () => {
    expect(looksLikeCommand('sort by name')).toBe(true);
  });

  it('returns true for filter commands', () => {
    expect(looksLikeCommand('filter age > 25')).toBe(true);
  });

  it('returns true for search commands', () => {
    expect(looksLikeCommand('search john')).toBe(true);
  });

  it('returns true for export commands', () => {
    expect(looksLikeCommand('export as csv')).toBe(true);
  });

  it('returns true for update commands', () => {
    expect(looksLikeCommand('update name to "test"')).toBe(true);
  });

  it('returns true for delete commands', () => {
    expect(looksLikeCommand('delete where id = 5')).toBe(true);
  });

  it('returns true for show commands', () => {
    expect(looksLikeCommand('show first 5 rows')).toBe(true);
  });

  it('returns true for limit commands', () => {
    expect(looksLikeCommand('limit 10')).toBe(true);
  });

  it('returns true for page commands', () => {
    expect(looksLikeCommand('page 3')).toBe(true);
  });

  it('returns true for go to page commands', () => {
    expect(looksLikeCommand('go to page 5')).toBe(true);
  });

  it('returns true for reset commands', () => {
    expect(looksLikeCommand('reset view')).toBe(true);
  });

  it('returns true for clear commands', () => {
    expect(looksLikeCommand('clear filters')).toBe(true);
  });

  it('returns false for questions', () => {
    expect(looksLikeCommand('what files do I have?')).toBe(false);
  });

  it('returns false for unrecognized verbs', () => {
    expect(looksLikeCommand('describe the data')).toBe(false);
  });
});

describe('getCommandPatterns', () => {
  it('returns array of command patterns', () => {
    const patterns = getCommandPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('includes sort pattern', () => {
    const patterns = getCommandPatterns();
    const sortPattern = patterns.find(p => p.name === 'sort');
    expect(sortPattern).toBeDefined();
    expect(sortPattern?.example).toContain('sort by');
  });
});

// ============================================================================
// Sort Command Tests
// ============================================================================

describe('parseAICommand - sort', () => {
  it('parses basic sort ascending', () => {
    const result = parseAICommand('sort by name', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('sort');
    expect(result.command?.parsed.column).toBe('name');
    expect(result.command?.parsed.direction).toBe('ASC');
  });

  it('parses sort descending', () => {
    const result = parseAICommand('sort by name desc', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('name');
    expect(result.command?.parsed.direction).toBe('DESC');
  });

  it('parses sort ascending explicit', () => {
    const result = parseAICommand('sort by age asc', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('age');
    expect(result.command?.parsed.direction).toBe('ASC');
  });

  it('is case-insensitive for direction', () => {
    const result = parseAICommand('sort by name DESC', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.direction).toBe('DESC');
  });

  it('handles quoted column names', () => {
    const result = parseAICommand("sort by 'name' desc", context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('name');
  });

  it('handles double-quoted column names', () => {
    const result = parseAICommand('sort by "age" asc', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('age');
  });

  it('returns canonical column name (preserves casing)', () => {
    const result = parseAICommand('sort by status desc', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('Status'); // Canonical name
  });

  it('fails for non-existent column', () => {
    const result = parseAICommand('sort by nonexistent', context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('is not a write operation', () => {
    const result = parseAICommand('sort by name', context);
    expect(result.command?.isWriteOperation).toBeUndefined();
    expect(isWriteOperation(result.command!)).toBe(false);
  });

  it('stores natural language in command', () => {
    const result = parseAICommand('sort by name desc', context);
    expect(result.command?.naturalLanguage).toBe('sort by name desc');
  });
});

// ============================================================================
// Filter Command Tests
// ============================================================================

describe('parseAICommand - filter', () => {
  it('parses equality filter', () => {
    const result = parseAICommand('filter name = John', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('filter');
    expect(result.command?.parsed.column).toBe('name');
    expect(result.command?.parsed.operator).toBe('=');
    expect(result.command?.parsed.value).toBe('John');
  });

  it('parses greater than filter', () => {
    const result = parseAICommand('filter age > 25', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.operator).toBe('>');
    expect(result.command?.parsed.value).toBe('25');
  });

  it('parses less than filter', () => {
    const result = parseAICommand('filter age < 30', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.operator).toBe('<');
  });

  it('parses greater than or equal filter', () => {
    const result = parseAICommand('filter age >= 18', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.operator).toBe('>=');
  });

  it('parses less than or equal filter', () => {
    const result = parseAICommand('filter age <= 65', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.operator).toBe('<=');
  });

  it('parses not equal filter', () => {
    const result = parseAICommand('filter status != active', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('Status');
    expect(result.command?.parsed.operator).toBe('!=');
  });

  it('parses contains filter and converts to LIKE', () => {
    const result = parseAICommand('filter email contains gmail', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.operator).toBe('LIKE');
    expect(result.command?.parsed.value).toBe('%gmail%');
  });

  it('handles quoted values', () => {
    const result = parseAICommand("filter name = 'John Doe'", context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.value).toBe('John Doe');
  });

  it('fails for non-existent column', () => {
    const result = parseAICommand('filter unknown = value', context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('is not a write operation', () => {
    const result = parseAICommand('filter name = test', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });
});

// ============================================================================
// Search Command Tests
// ============================================================================

describe('parseAICommand - search', () => {
  it('parses simple search', () => {
    const result = parseAICommand('search john', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('search');
    expect(result.command?.parsed.action).toBe('search');
    expect(result.command?.parsed.value).toBe('john');
  });

  it('parses multi-word search', () => {
    const result = parseAICommand('search john doe', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.value).toBe('john doe');
  });

  it('is not a write operation', () => {
    const result = parseAICommand('search test', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });
});

// ============================================================================
// Export Command Tests
// ============================================================================

describe('parseAICommand - export', () => {
  it('parses export as csv', () => {
    const result = parseAICommand('export as csv', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('export');
    expect(result.command?.parsed.value).toBe('csv');
  });

  it('parses export as json', () => {
    const result = parseAICommand('export as json', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.value).toBe('json');
  });

  it('parses export as parquet', () => {
    const result = parseAICommand('export as parquet', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.value).toBe('parquet');
  });

  it('is case insensitive for format', () => {
    const result = parseAICommand('export as CSV', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.value).toBe('csv');
  });

  it('supports xlsx format', () => {
    const result = parseAICommand('export as xlsx', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.value).toBe('xlsx');
  });

  it('is not a write operation', () => {
    const result = parseAICommand('export as csv', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });
});

// ============================================================================
// Theme Command Tests
// ============================================================================

describe('parseAICommand - theme', () => {
  it('parses toggle theme', () => {
    const result = parseAICommand('toggle theme', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('theme');
    expect(result.command?.parsed.action).toBe('toggle');
  });

  it('is case insensitive', () => {
    const result = parseAICommand('Toggle Theme', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('theme');
  });
});

// ============================================================================
// Fill Command Tests (Write Operation)
// ============================================================================

describe('parseAICommand - fill', () => {
  it('parses fill empty command', () => {
    const result = parseAICommand("fill empty name with 'Unknown'", context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('fill');
    expect(result.command?.parsed.column).toBe('name');
    expect(result.command?.parsed.newValue).toBe('Unknown');
  });

  it('sets IS NULL condition', () => {
    const result = parseAICommand("fill empty email with 'no-email@example.com'", context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.condition?.operator).toBe('IS NULL');
  });

  it('is a write operation', () => {
    const result = parseAICommand("fill empty name with 'test'", context);
    expect(result.success).toBe(true);
    expect(result.command?.isWriteOperation).toBe(true);
    expect(isWriteOperation(result.command!)).toBe(true);
  });

  it('fails for non-existent column', () => {
    const result = parseAICommand("fill empty unknown with 'value'", context);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Update Command Tests (Write Operation)
// ============================================================================

describe('parseAICommand - update', () => {
  it('parses update with where clause', () => {
    const result = parseAICommand("update status to 'active' where id = 1", context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('update');
    expect(result.command?.parsed.column).toBe('Status');
    expect(result.command?.parsed.newValue).toBe('active');
    expect(result.command?.parsed.targetRows).toBe('filtered');
    expect(result.command?.parsed.condition).toEqual({
      column: 'id',
      operator: '=',
      value: '1',
    });
  });

  it('parses update all rows', () => {
    const result = parseAICommand("update status to 'pending'", context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.targetRows).toBe('all');
    expect(result.command?.parsed.condition).toBeUndefined();
  });

  it('handles different operators in where clause', () => {
    const result = parseAICommand("update name to 'Senior' where age >= 60", context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.condition?.operator).toBe('>=');
    expect(result.command?.parsed.condition?.value).toBe('60');
  });

  it('is a write operation', () => {
    const result = parseAICommand("update name to 'test'", context);
    expect(result.command?.isWriteOperation).toBe(true);
    expect(isWriteOperation(result.command!)).toBe(true);
  });

  it('fails for non-existent target column', () => {
    const result = parseAICommand("update unknown to 'value'", context);
    expect(result.success).toBe(false);
  });

  it('fails for non-existent condition column', () => {
    const result = parseAICommand("update name to 'value' where unknown = 1", context);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Change Command Tests (Write Operation)
// ============================================================================

describe('parseAICommand - change', () => {
  it('parses change from/to command', () => {
    const result = parseAICommand("change status from 'pending' to 'active'", context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('update');
    expect(result.command?.parsed.column).toBe('Status');
    expect(result.command?.parsed.newValue).toBe('active');
    expect(result.command?.parsed.condition).toEqual({
      column: 'Status',
      operator: '=',
      value: 'pending',
    });
  });

  it('handles wildcard for all rows', () => {
    const result = parseAICommand("change status from '*' to 'archived'", context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.targetRows).toBe('all');
    expect(result.command?.parsed.condition).toBeUndefined();
  });

  it('is a write operation', () => {
    const result = parseAICommand("change name from 'old' to 'new'", context);
    expect(result.command?.isWriteOperation).toBe(true);
  });
});

// ============================================================================
// Delete Command Tests (Write Operation)
// ============================================================================

describe('parseAICommand - delete', () => {
  it('parses delete where command', () => {
    const result = parseAICommand('delete where id = 5', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('delete');
    expect(result.command?.parsed.action).toBe('delete');
    expect(result.command?.parsed.condition).toEqual({
      column: 'id',
      operator: '=',
      value: '5',
    });
  });

  it('handles different operators', () => {
    const result = parseAICommand('delete where age < 18', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.condition?.operator).toBe('<');
  });

  it('is a write operation', () => {
    const result = parseAICommand('delete where id = 1', context);
    expect(result.command?.isWriteOperation).toBe(true);
    expect(isWriteOperation(result.command!)).toBe(true);
  });

  it('fails for non-existent column in condition', () => {
    const result = parseAICommand('delete where unknown = 1', context);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('parseAICommand - edge cases', () => {
  it('returns error for empty input', () => {
    const result = parseAICommand('', context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Empty command');
  });

  it('returns error for whitespace-only input', () => {
    const result = parseAICommand('   ', context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Empty command');
  });

  it('returns no error for unrecognized input (AI will handle)', () => {
    const result = parseAICommand('show me the data', context);
    expect(result.success).toBe(false);
    expect(result.error).toBeUndefined(); // No error, just needs AI
  });

  it('trims whitespace from input', () => {
    const result = parseAICommand('  sort by name desc  ', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('name');
  });

  it('handles columns with underscores', () => {
    const result = parseAICommand('sort by total_amount desc', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('total_amount');
  });

  it('handles columns with mixed case', () => {
    const result = parseAICommand('filter Status = active', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.column).toBe('Status');
  });
});

// ============================================================================
// isWriteOperation Tests
// ============================================================================

// ============================================================================
// Limit Command Tests
// ============================================================================

describe('parseAICommand - limit', () => {
  it('parses "show first N rows" format', () => {
    const result = parseAICommand('show first 5 rows', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('limit');
    expect(result.command?.parsed.action).toBe('limit');
    expect(result.command?.parsed.limit).toBe(5);
  });

  it('parses "show N rows" format', () => {
    const result = parseAICommand('show 10 rows', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('limit');
    expect(result.command?.parsed.limit).toBe(10);
  });

  it('parses "limit N" format', () => {
    const result = parseAICommand('limit 100', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('limit');
    expect(result.command?.parsed.limit).toBe(100);
  });

  it('parses "show first N" without rows', () => {
    const result = parseAICommand('show first 20', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.limit).toBe(20);
  });

  it('handles singular "row"', () => {
    const result = parseAICommand('show first 1 row', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.limit).toBe(1);
  });

  it('is case insensitive', () => {
    const result = parseAICommand('SHOW FIRST 5 ROWS', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.limit).toBe(5);
  });

  it('fails for limit of 0', () => {
    const result = parseAICommand('limit 0', context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('between 1 and 10,000');
  });

  it('fails for limit over 10000', () => {
    const result = parseAICommand('limit 50000', context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('between 1 and 10,000');
  });

  it('is not a write operation', () => {
    const result = parseAICommand('show first 5 rows', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });
});

// ============================================================================
// Page Command Tests
// ============================================================================

describe('parseAICommand - page', () => {
  it('parses "go to page N" format', () => {
    const result = parseAICommand('go to page 5', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('page');
    expect(result.command?.parsed.action).toBe('page');
    expect(result.command?.parsed.page).toBe(5);
  });

  it('parses "page N" format', () => {
    const result = parseAICommand('page 10', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('page');
    expect(result.command?.parsed.page).toBe(10);
  });

  it('is case insensitive', () => {
    const result = parseAICommand('GO TO PAGE 3', context);
    expect(result.success).toBe(true);
    expect(result.command?.parsed.page).toBe(3);
  });

  it('fails for page 0', () => {
    const result = parseAICommand('page 0', context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 1');
  });

  it('fails for negative page', () => {
    // Note: regex won't match negative numbers, so this returns no match
    const result = parseAICommand('page -1', context);
    expect(result.success).toBe(false);
  });

  it('is not a write operation', () => {
    const result = parseAICommand('go to page 1', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });
});

// ============================================================================
// Reset Command Tests
// ============================================================================

describe('parseAICommand - reset', () => {
  it('parses "reset view" format', () => {
    const result = parseAICommand('reset view', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
    expect(result.command?.parsed.action).toBe('reset');
  });

  it('parses "reset" alone', () => {
    const result = parseAICommand('reset', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
  });

  it('parses "clear filters" format', () => {
    const result = parseAICommand('clear filters', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
  });

  it('parses "clear filter" singular', () => {
    const result = parseAICommand('clear filter', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
  });

  it('parses "clear all" format', () => {
    const result = parseAICommand('clear all', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
  });

  it('parses "show all" format', () => {
    const result = parseAICommand('show all', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
  });

  it('parses "show all rows" format', () => {
    const result = parseAICommand('show all rows', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
  });

  it('is case insensitive', () => {
    const result = parseAICommand('RESET VIEW', context);
    expect(result.success).toBe(true);
    expect(result.command?.type).toBe('reset');
  });

  it('is not a write operation', () => {
    const result = parseAICommand('reset view', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });
});

// ============================================================================
// isWriteOperation Tests
// ============================================================================

describe('isWriteOperation', () => {
  it('returns false for sort command', () => {
    const result = parseAICommand('sort by name', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });

  it('returns false for filter command', () => {
    const result = parseAICommand('filter age > 25', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });

  it('returns false for search command', () => {
    const result = parseAICommand('search john', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });

  it('returns false for export command', () => {
    const result = parseAICommand('export as csv', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });

  it('returns true for fill command', () => {
    const result = parseAICommand("fill empty name with 'test'", context);
    expect(isWriteOperation(result.command!)).toBe(true);
  });

  it('returns true for update command', () => {
    const result = parseAICommand("update name to 'test'", context);
    expect(isWriteOperation(result.command!)).toBe(true);
  });

  it('returns true for delete command', () => {
    const result = parseAICommand('delete where id = 1', context);
    expect(isWriteOperation(result.command!)).toBe(true);
  });

  it('returns false for limit command', () => {
    const result = parseAICommand('show first 5 rows', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });

  it('returns false for page command', () => {
    const result = parseAICommand('go to page 2', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });

  it('returns false for reset command', () => {
    const result = parseAICommand('reset view', context);
    expect(isWriteOperation(result.command!)).toBe(false);
  });
});
