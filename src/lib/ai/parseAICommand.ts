/**
 * AI Command Parsing Utility
 *
 * This module handles parsing natural language commands into structured AICommand objects.
 * Designed for testability and reusability across the application.
 */

import type { ColumnSchema } from '@/store/duckDBViewStore';

// ============================================================================
// Types
// ============================================================================

export type CommandType =
  | 'sort'
  | 'filter'
  | 'search'
  | 'aggregate'
  | 'export'
  | 'theme'
  | 'fill'
  | 'update'
  | 'delete'
  | 'limit'
  | 'page'
  | 'reset'
  | 'sql'
  | 'custom';

export type SortDirection = 'ASC' | 'DESC';

export type FilterOperator = '=' | '>' | '<' | '>=' | '<=' | '!=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

export interface ParsedCommand {
  action: string;
  column?: string;
  direction?: SortDirection;
  operator?: string;
  value?: unknown;
  newValue?: unknown;
  condition?: FilterCondition;
  targetRows?: 'all' | 'filtered' | 'selected';
  limit?: number;
  page?: number;
}

export interface AICommand {
  type: CommandType;
  naturalLanguage: string;
  parsed: ParsedCommand;
  sql?: string;
  isWriteOperation?: boolean;
}

export interface ParseContext {
  schema: ColumnSchema[];
  caseSensitive?: boolean;
}

export interface ParseResult {
  success: boolean;
  command: AICommand | null;
  error?: string;
  matchedPattern?: string;
}

// ============================================================================
// Column Matching
// ============================================================================

/**
 * Find a column in the schema by name (case-insensitive by default)
 */
export function findColumn(
  columnName: string,
  schema: ColumnSchema[],
  caseSensitive = false
): ColumnSchema | undefined {
  if (caseSensitive) {
    return schema.find(c => c.name === columnName);
  }
  return schema.find(c => c.name.toLowerCase() === columnName.toLowerCase());
}

/**
 * Validate that a column exists and return the canonical name
 */
export function validateColumn(
  columnName: string,
  schema: ColumnSchema[]
): { valid: boolean; canonicalName?: string; error?: string } {
  const column = findColumn(columnName, schema);
  if (!column) {
    const suggestions = schema
      .filter(c => c.name.toLowerCase().includes(columnName.toLowerCase().slice(0, 3)))
      .slice(0, 3)
      .map(c => c.name);

    return {
      valid: false,
      error: suggestions.length > 0
        ? `Column "${columnName}" not found. Did you mean: ${suggestions.join(', ')}?`
        : `Column "${columnName}" not found in schema.`,
    };
  }
  return { valid: true, canonicalName: column.name };
}

// ============================================================================
// Command Patterns
// ============================================================================

interface CommandPattern {
  name: string;
  regex: RegExp;
  type: CommandType;
  isWriteOperation: boolean;
  parse: (match: RegExpMatchArray, context: ParseContext) => ParseResult;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  // SORT: "sort by column [asc|desc]"
  {
    name: 'sort',
    regex: /^sort\s+by\s+["']?(\w+)["']?\s*(asc|desc)?$/i,
    type: 'sort',
    isWriteOperation: false,
    parse: (match, { schema }) => {
      const columnName = match[1];
      const direction = match[2]?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

      const validation = validateColumn(columnName, schema);
      if (!validation.valid) {
        return { success: false, command: null, error: validation.error };
      }

      return {
        success: true,
        command: {
          type: 'sort',
          naturalLanguage: match[0],
          parsed: {
            action: 'sort',
            column: validation.canonicalName,
            direction,
          },
        },
        matchedPattern: 'sort',
      };
    },
  },

  // FILTER: "filter column operator value"
  {
    name: 'filter',
    regex: /^filter\s+["']?(\w+)["']?\s*(>=|<=|!=|=|>|<|contains)\s*["']?(.+?)["']?$/i,
    type: 'filter',
    isWriteOperation: false,
    parse: (match, { schema }) => {
      const columnName = match[1];
      const operator = match[2];
      const value = match[3];

      const validation = validateColumn(columnName, schema);
      if (!validation.valid) {
        return { success: false, command: null, error: validation.error };
      }

      // Convert 'contains' to SQL LIKE
      const sqlOperator = operator.toLowerCase() === 'contains' ? 'LIKE' : operator;
      const sqlValue = operator.toLowerCase() === 'contains' ? `%${value}%` : value;

      return {
        success: true,
        command: {
          type: 'filter',
          naturalLanguage: match[0],
          parsed: {
            action: 'filter',
            column: validation.canonicalName,
            operator: sqlOperator,
            value: sqlValue,
          },
        },
        matchedPattern: 'filter',
      };
    },
  },

  // SEARCH: "search term"
  {
    name: 'search',
    regex: /^search\s+(.+)$/i,
    type: 'search',
    isWriteOperation: false,
    parse: (match) => {
      return {
        success: true,
        command: {
          type: 'search',
          naturalLanguage: match[0],
          parsed: {
            action: 'search',
            value: match[1],
          },
        },
        matchedPattern: 'search',
      };
    },
  },

  // SHOW/LIMIT: "show first N rows" or "limit N" or "show N rows"
  {
    name: 'limit',
    regex: /^(?:show\s+(?:first\s+)?|limit\s+)(\d+)(?:\s+rows?)?$/i,
    type: 'limit',
    isWriteOperation: false,
    parse: (match) => {
      const limit = parseInt(match[1], 10);
      if (limit <= 0 || limit > 10000) {
        return {
          success: false,
          command: null,
          error: 'Limit must be between 1 and 10,000',
        };
      }
      return {
        success: true,
        command: {
          type: 'limit',
          naturalLanguage: match[0],
          parsed: {
            action: 'limit',
            limit,
          },
        },
        matchedPattern: 'limit',
      };
    },
  },

  // PAGE: "go to page N" or "page N"
  {
    name: 'page',
    regex: /^(?:go\s+to\s+)?page\s+(\d+)$/i,
    type: 'page',
    isWriteOperation: false,
    parse: (match) => {
      const page = parseInt(match[1], 10);
      if (page <= 0) {
        return {
          success: false,
          command: null,
          error: 'Page number must be at least 1',
        };
      }
      return {
        success: true,
        command: {
          type: 'page',
          naturalLanguage: match[0],
          parsed: {
            action: 'page',
            page,
          },
        },
        matchedPattern: 'page',
      };
    },
  },

  // RESET: "reset view" or "clear filters" or "show all"
  {
    name: 'reset',
    regex: /^(?:reset(?:\s+view)?|clear\s+(?:filters?|all)|show\s+all(?:\s+rows?)?)$/i,
    type: 'reset',
    isWriteOperation: false,
    parse: (match) => {
      return {
        success: true,
        command: {
          type: 'reset',
          naturalLanguage: match[0],
          parsed: {
            action: 'reset',
          },
        },
        matchedPattern: 'reset',
      };
    },
  },

  // EXPORT: "export as csv|json|parquet|xlsx"
  {
    name: 'export',
    regex: /^export\s+as\s+(csv|json|parquet|xlsx)$/i,
    type: 'export',
    isWriteOperation: false,
    parse: (match) => {
      return {
        success: true,
        command: {
          type: 'export',
          naturalLanguage: match[0],
          parsed: {
            action: 'export',
            value: match[1].toLowerCase(),
          },
        },
        matchedPattern: 'export',
      };
    },
  },

  // THEME: "toggle theme"
  {
    name: 'theme',
    regex: /^toggle\s+theme$/i,
    type: 'theme',
    isWriteOperation: false,
    parse: (match) => {
      return {
        success: true,
        command: {
          type: 'theme',
          naturalLanguage: match[0],
          parsed: {
            action: 'toggle',
          },
        },
        matchedPattern: 'theme',
      };
    },
  },

  // FILL: "fill empty column with 'value'"
  {
    name: 'fill',
    regex: /^fill\s+empty\s+["']?(\w+)["']?\s+with\s+["'](.+)["']$/i,
    type: 'fill',
    isWriteOperation: true,
    parse: (match, { schema }) => {
      const columnName = match[1];
      const newValue = match[2];

      const validation = validateColumn(columnName, schema);
      if (!validation.valid) {
        return { success: false, command: null, error: validation.error };
      }

      return {
        success: true,
        command: {
          type: 'fill',
          naturalLanguage: match[0],
          parsed: {
            action: 'fill',
            column: validation.canonicalName,
            newValue,
            targetRows: 'filtered',
            condition: {
              column: validation.canonicalName!,
              operator: 'IS NULL',
              value: null,
            },
          },
          isWriteOperation: true,
        },
        matchedPattern: 'fill',
      };
    },
  },

  // UPDATE with WHERE: "update column to 'value' where condition"
  {
    name: 'update-where',
    regex: /^update\s+["']?(\w+)["']?\s+to\s+["'](.+)["']\s+where\s+["']?(\w+)["']?\s*(>=|<=|!=|=|>|<)\s*["']?(.+?)["']?$/i,
    type: 'update',
    isWriteOperation: true,
    parse: (match, { schema }) => {
      const columnName = match[1];
      const newValue = match[2];
      const condColumn = match[3];
      const condOperator = match[4] as FilterOperator;
      const condValue = match[5];

      const colValidation = validateColumn(columnName, schema);
      if (!colValidation.valid) {
        return { success: false, command: null, error: colValidation.error };
      }

      const condValidation = validateColumn(condColumn, schema);
      if (!condValidation.valid) {
        return { success: false, command: null, error: condValidation.error };
      }

      return {
        success: true,
        command: {
          type: 'update',
          naturalLanguage: match[0],
          parsed: {
            action: 'update',
            column: colValidation.canonicalName,
            newValue,
            targetRows: 'filtered',
            condition: {
              column: condValidation.canonicalName!,
              operator: condOperator,
              value: condValue,
            },
          },
          isWriteOperation: true,
        },
        matchedPattern: 'update-where',
      };
    },
  },

  // UPDATE all: "update column to 'value'"
  {
    name: 'update-all',
    regex: /^update\s+["']?(\w+)["']?\s+to\s+["'](.+)["']$/i,
    type: 'update',
    isWriteOperation: true,
    parse: (match, { schema }) => {
      const columnName = match[1];
      const newValue = match[2];

      const validation = validateColumn(columnName, schema);
      if (!validation.valid) {
        return { success: false, command: null, error: validation.error };
      }

      return {
        success: true,
        command: {
          type: 'update',
          naturalLanguage: match[0],
          parsed: {
            action: 'update',
            column: validation.canonicalName,
            newValue,
            targetRows: 'all',
          },
          isWriteOperation: true,
        },
        matchedPattern: 'update-all',
      };
    },
  },

  // CHANGE: "change column from 'old' to 'new'"
  {
    name: 'change',
    regex: /^change\s+["']?(\w+)["']?\s+from\s+["'](.+)["']\s+to\s+["'](.+)["']$/i,
    type: 'update',
    isWriteOperation: true,
    parse: (match, { schema }) => {
      const columnName = match[1];
      const oldValue = match[2];
      const newValue = match[3];

      const validation = validateColumn(columnName, schema);
      if (!validation.valid) {
        return { success: false, command: null, error: validation.error };
      }

      // Wildcard means update all
      if (oldValue === '*') {
        return {
          success: true,
          command: {
            type: 'update',
            naturalLanguage: match[0],
            parsed: {
              action: 'update',
              column: validation.canonicalName,
              newValue,
              targetRows: 'all',
            },
            isWriteOperation: true,
          },
          matchedPattern: 'change',
        };
      }

      return {
        success: true,
        command: {
          type: 'update',
          naturalLanguage: match[0],
          parsed: {
            action: 'update',
            column: validation.canonicalName,
            newValue,
            targetRows: 'filtered',
            condition: {
              column: validation.canonicalName!,
              operator: '=',
              value: oldValue,
            },
          },
          isWriteOperation: true,
        },
        matchedPattern: 'change',
      };
    },
  },

  // DELETE: "delete where condition"
  {
    name: 'delete',
    regex: /^delete\s+where\s+["']?(\w+)["']?\s*(>=|<=|!=|=|>|<)\s*["']?(.+?)["']?$/i,
    type: 'delete',
    isWriteOperation: true,
    parse: (match, { schema }) => {
      const condColumn = match[1];
      const condOperator = match[2] as FilterOperator;
      const condValue = match[3];

      const validation = validateColumn(condColumn, schema);
      if (!validation.valid) {
        return { success: false, command: null, error: validation.error };
      }

      return {
        success: true,
        command: {
          type: 'delete',
          naturalLanguage: match[0],
          parsed: {
            action: 'delete',
            targetRows: 'filtered',
            condition: {
              column: validation.canonicalName!,
              operator: condOperator,
              value: condValue,
            },
          },
          isWriteOperation: true,
        },
        matchedPattern: 'delete',
      };
    },
  },
];

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a natural language command into an AICommand object
 *
 * @param input - The raw user input
 * @param context - Parsing context including schema
 * @returns ParseResult with success status and command or error
 *
 * @example
 * const result = parseAICommand("sort by name desc", { schema: columns });
 * if (result.success) {
 *   console.log(result.command.parsed.direction); // 'DESC'
 * }
 */
export function parseAICommand(input: string, context: ParseContext): ParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      success: false,
      command: null,
      error: 'Empty command',
    };
  }

  // Try each pattern in order
  for (const pattern of COMMAND_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      return pattern.parse(match, context);
    }
  }

  // No pattern matched - this is expected for AI queries
  return {
    success: false,
    command: null,
    error: undefined, // No error, just needs AI processing
  };
}

/**
 * Check if input looks like a command (starts with known verbs)
 */
export function looksLikeCommand(input: string): boolean {
  const commandVerbs = ['sort', 'filter', 'search', 'export', 'toggle', 'fill', 'update', 'change', 'delete', 'show', 'limit', 'page', 'go', 'reset', 'clear'];
  const firstWord = input.trim().toLowerCase().split(/\s+/)[0];
  return commandVerbs.includes(firstWord);
}

/**
 * Check if a command is a write operation
 */
export function isWriteOperation(command: AICommand): boolean {
  return command.isWriteOperation === true;
}

/**
 * Get all available command patterns (for documentation/help)
 */
export function getCommandPatterns(): { name: string; example: string; description: string }[] {
  return [
    { name: 'sort', example: 'sort by column_name desc', description: 'Sort data by a column' },
    { name: 'filter', example: 'filter column = value', description: 'Filter rows by condition' },
    { name: 'search', example: 'search keyword', description: 'Search across all text columns' },
    { name: 'limit', example: 'show first 10 rows', description: 'Limit rows displayed' },
    { name: 'page', example: 'go to page 5', description: 'Navigate to a specific page' },
    { name: 'reset', example: 'reset view', description: 'Clear filters and reset view' },
    { name: 'export', example: 'export as csv', description: 'Export data (csv, json, parquet, xlsx)' },
    { name: 'fill', example: "fill empty column with 'value'", description: 'Fill null values' },
    { name: 'update', example: "update column to 'value' where condition", description: 'Update values' },
    { name: 'change', example: "change column from 'old' to 'new'", description: 'Replace specific values' },
    { name: 'delete', example: 'delete where column = value', description: 'Delete matching rows' },
  ];
}

// ============================================================================
// Exports
// ============================================================================

export default parseAICommand;
