import type { ColumnSchema } from '@/store/duckDBViewStore';

export interface AIDataCommand {
  type: 'update' | 'delete' | 'filter' | 'sort' | 'transform' | 'compute';
  naturalLanguage: string;
  generatedSQL: string;
  affectedRowsEstimate: number;
  previewRows?: Record<string, unknown>[];
  confidence: number;
  warnings: string[];
}

export interface AICommandContext {
  viewName: string;
  schema: ColumnSchema[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
}

// Pattern matchers for common natural language commands
const COMMAND_PATTERNS = {
  // Sort patterns
  sort: [
    /sort\s+(?:by\s+)?["']?(\w+)["']?\s*(?:(asc|desc|ascending|descending))?/i,
    /order\s+(?:by\s+)?["']?(\w+)["']?\s*(?:(asc|desc|ascending|descending))?/i,
  ],
  // Filter patterns
  filter: [
    /(?:show|filter|where|find)\s+(?:rows?\s+)?(?:where\s+)?["']?(\w+)["']?\s*(=|!=|>|<|>=|<=|contains?|is|like)\s*["']?([^"']+)["']?/i,
    /(?:show|filter)\s+["']?(\w+)["']?\s+(is\s+not\s+null|is\s+null)/i,
    /(?:show|filter|only)\s+(?:rows?\s+)?(?:with\s+)?["']?(\w+)["']?\s*(?:greater|less)\s+than\s+["']?([^"']+)["']?/i,
  ],
  // Update patterns
  update: [
    /(?:set|change|update)\s+(?:all\s+)?["']?(\w+)["']?\s+to\s+["']?([^"']+)["']?\s*(?:where|for|if)?\s*(?:["']?(\w+)["']?\s*(=|!=|>|<|>=|<=|contains?|is|like)\s*["']?([^"']+)["']?)?/i,
    /(?:set|make)\s+["']?(\w+)["']?\s*=\s*["']?([^"']+)["']?\s+where\s+["']?(\w+)["']?\s*(=|!=|>|<|>=|<=)\s*["']?([^"']+)["']?/i,
    /replace\s+["']?([^"']+)["']?\s+with\s+["']?([^"']+)["']?\s+in\s+["']?(\w+)["']?/i,
  ],
  // Delete patterns
  delete: [
    /delete\s+(?:all\s+)?(?:rows?\s+)?(?:where\s+)?["']?(\w+)["']?\s*(=|!=|>|<|>=|<=|is|like)\s*["']?([^"']+)["']?/i,
    /remove\s+(?:all\s+)?(?:rows?\s+)?(?:where\s+)?["']?(\w+)["']?\s*(=|!=|>|<|>=|<=|is)\s*["']?([^"']+)["']?/i,
    /delete\s+(?:rows?\s+)?(?:with\s+)?(?:null|empty)\s+["']?(\w+)["']?/i,
  ],
  // Compute/Transform patterns
  transform: [
    /(?:add|create)\s+(?:a\s+)?(?:new\s+)?column\s+["']?(\w+)["']?\s+(?:as|with|calculated\s+as)\s+(.+)/i,
    /(?:compute|calculate)\s+["']?(\w+)["']?\s+(?:as|=)\s+(.+)/i,
    /(?:convert|transform)\s+["']?(\w+)["']?\s+to\s+(uppercase|lowercase|number|date|trim)/i,
  ],
};

// Match column name case-insensitively
function findColumn(name: string, schema: ColumnSchema[]): string | null {
  const lowerName = name.toLowerCase();
  const col = schema.find(c => c.name.toLowerCase() === lowerName);
  return col?.name || null;
}

// Parse value based on inferred type
function parseValue(value: string, columnType: string): string {
  const normalizedType = columnType.toUpperCase();
  const trimmed = value.trim();

  // Null handling
  if (trimmed.toLowerCase() === 'null' || trimmed === '') {
    return 'NULL';
  }

  // Numeric types
  if (['BIGINT', 'INTEGER', 'DOUBLE', 'FLOAT', 'DECIMAL'].some(t => normalizedType.includes(t))) {
    const num = parseFloat(trimmed.replace(/[,$]/g, ''));
    if (!isNaN(num)) return String(num);
  }

  // Boolean
  if (normalizedType === 'BOOLEAN') {
    if (['true', 'yes', '1'].includes(trimmed.toLowerCase())) return 'TRUE';
    if (['false', 'no', '0'].includes(trimmed.toLowerCase())) return 'FALSE';
  }

  // Default to string
  return `'${trimmed.replace(/'/g, "''")}'`;
}

// Convert operator from natural language
function normalizeOperator(op: string): string {
  const opLower = op.toLowerCase().trim();
  const opMap: Record<string, string> = {
    'is': '=',
    'equals': '=',
    'is not': '!=',
    'not': '!=',
    'contains': 'ILIKE',
    'contain': 'ILIKE',
    'like': 'ILIKE',
    'greater than': '>',
    'greater': '>',
    'less than': '<',
    'less': '<',
    'at least': '>=',
    'at most': '<=',
  };
  return opMap[opLower] || op;
}

// Parse natural language into SQL command
export function parseNaturalLanguage(
  input: string,
  context: AICommandContext
): AIDataCommand | null {
  const { viewName, schema, totalRows } = context;

  // Try sort patterns
  for (const pattern of COMMAND_PATTERNS.sort) {
    const match = input.match(pattern);
    if (match) {
      const [, columnName, direction] = match;
      const column = findColumn(columnName, schema);
      if (column) {
        const dir = direction?.toLowerCase().startsWith('desc') ? 'DESC' : 'ASC';
        return {
          type: 'sort',
          naturalLanguage: input,
          generatedSQL: `SELECT * FROM "${viewName}" ORDER BY "${column}" ${dir}`,
          affectedRowsEstimate: totalRows,
          confidence: 0.9,
          warnings: [],
        };
      }
    }
  }

  // Try filter patterns
  for (const pattern of COMMAND_PATTERNS.filter) {
    const match = input.match(pattern);
    if (match) {
      if (match[2]?.toLowerCase().includes('null')) {
        const column = findColumn(match[1], schema);
        if (column) {
          const isNotNull = match[2].toLowerCase().includes('not');
          return {
            type: 'filter',
            naturalLanguage: input,
            generatedSQL: `SELECT * FROM "${viewName}" WHERE "${column}" IS ${isNotNull ? 'NOT ' : ''}NULL`,
            affectedRowsEstimate: Math.floor(totalRows * 0.1),
            confidence: 0.85,
            warnings: [],
          };
        }
      } else {
        const [, columnName, operator, value] = match;
        const column = findColumn(columnName, schema);
        if (column) {
          const colSchema = schema.find(c => c.name === column);
          const sqlOp = normalizeOperator(operator);
          let sqlValue = parseValue(value, colSchema?.type || 'VARCHAR');

          // Handle LIKE patterns
          if (sqlOp === 'ILIKE') {
            sqlValue = `'%${value.replace(/'/g, "''")}%'`;
          }

          return {
            type: 'filter',
            naturalLanguage: input,
            generatedSQL: `SELECT * FROM "${viewName}" WHERE "${column}" ${sqlOp} ${sqlValue}`,
            affectedRowsEstimate: Math.floor(totalRows * 0.2),
            confidence: 0.8,
            warnings: [],
          };
        }
      }
    }
  }

  // Try update patterns
  for (const pattern of COMMAND_PATTERNS.update) {
    const match = input.match(pattern);
    if (match) {
      // Handle "replace X with Y in column" pattern
      if (pattern.source.includes('replace')) {
        const [, oldValue, newValue, columnName] = match;
        const column = findColumn(columnName, schema);
        if (column) {
          const colSchema = schema.find(c => c.name === column);
          const sqlNewValue = parseValue(newValue, colSchema?.type || 'VARCHAR');
          return {
            type: 'update',
            naturalLanguage: input,
            generatedSQL: `UPDATE "${viewName}" SET "${column}" = ${sqlNewValue} WHERE "${column}" = '${oldValue.replace(/'/g, "''")}'`,
            affectedRowsEstimate: Math.floor(totalRows * 0.1),
            confidence: 0.75,
            warnings: ['This will update all matching rows'],
          };
        }
      } else {
        const [, targetColumn, newValue, whereColumn, whereOp, whereValue] = match;
        const column = findColumn(targetColumn, schema);
        if (column) {
          const colSchema = schema.find(c => c.name === column);
          const sqlNewValue = parseValue(newValue, colSchema?.type || 'VARCHAR');

          let sql = `UPDATE "${viewName}" SET "${column}" = ${sqlNewValue}`;
          const warnings: string[] = [];

          if (whereColumn && whereOp && whereValue) {
            const condColumn = findColumn(whereColumn, schema);
            if (condColumn) {
              const condColSchema = schema.find(c => c.name === condColumn);
              const sqlOp = normalizeOperator(whereOp);
              const sqlCondValue = parseValue(whereValue, condColSchema?.type || 'VARCHAR');
              sql += ` WHERE "${condColumn}" ${sqlOp} ${sqlCondValue}`;
            }
          } else {
            warnings.push('No WHERE clause - this will update ALL rows!');
          }

          return {
            type: 'update',
            naturalLanguage: input,
            generatedSQL: sql,
            affectedRowsEstimate: whereColumn ? Math.floor(totalRows * 0.2) : totalRows,
            confidence: whereColumn ? 0.8 : 0.6,
            warnings,
          };
        }
      }
    }
  }

  // Try delete patterns
  for (const pattern of COMMAND_PATTERNS.delete) {
    const match = input.match(pattern);
    if (match) {
      // Handle "delete rows with null column" pattern
      if (pattern.source.includes('null|empty')) {
        const [, columnName] = match;
        const column = findColumn(columnName, schema);
        if (column) {
          return {
            type: 'delete',
            naturalLanguage: input,
            generatedSQL: `DELETE FROM "${viewName}" WHERE "${column}" IS NULL OR "${column}" = ''`,
            affectedRowsEstimate: Math.floor(totalRows * 0.05),
            confidence: 0.8,
            warnings: ['This will permanently delete matching rows'],
          };
        }
      } else {
        const [, columnName, operator, value] = match;
        const column = findColumn(columnName, schema);
        if (column) {
          const colSchema = schema.find(c => c.name === column);
          const sqlOp = normalizeOperator(operator);
          const sqlValue = parseValue(value, colSchema?.type || 'VARCHAR');

          if (value.toLowerCase() === 'null') {
            return {
              type: 'delete',
              naturalLanguage: input,
              generatedSQL: `DELETE FROM "${viewName}" WHERE "${column}" IS NULL`,
              affectedRowsEstimate: Math.floor(totalRows * 0.05),
              confidence: 0.8,
              warnings: ['This will permanently delete matching rows'],
            };
          }

          return {
            type: 'delete',
            naturalLanguage: input,
            generatedSQL: `DELETE FROM "${viewName}" WHERE "${column}" ${sqlOp} ${sqlValue}`,
            affectedRowsEstimate: Math.floor(totalRows * 0.1),
            confidence: 0.75,
            warnings: ['This will permanently delete matching rows'],
          };
        }
      }
    }
  }

  // Try transform patterns
  for (const pattern of COMMAND_PATTERNS.transform) {
    const match = input.match(pattern);
    if (match) {
      // Handle "convert column to uppercase/lowercase/etc"
      if (pattern.source.includes('convert|transform')) {
        const [, columnName, transformation] = match;
        const column = findColumn(columnName, schema);
        if (column) {
          let expr: string;
          switch (transformation.toLowerCase()) {
            case 'uppercase':
              expr = `UPPER("${column}")`;
              break;
            case 'lowercase':
              expr = `LOWER("${column}")`;
              break;
            case 'trim':
              expr = `TRIM("${column}")`;
              break;
            case 'number':
              expr = `TRY_CAST("${column}" AS DOUBLE)`;
              break;
            case 'date':
              expr = `TRY_CAST("${column}" AS DATE)`;
              break;
            default:
              expr = `"${column}"`;
          }

          return {
            type: 'transform',
            naturalLanguage: input,
            generatedSQL: `UPDATE "${viewName}" SET "${column}" = ${expr}`,
            affectedRowsEstimate: totalRows,
            confidence: 0.85,
            warnings: [`This will transform all values in ${column}`],
          };
        }
      }
    }
  }

  // No pattern matched
  return null;
}

// Generate a preview of affected rows
export async function generatePreview(
  command: AIDataCommand,
  executeQuery: (sql: string) => Promise<Record<string, unknown>[] | null>,
  limit: number = 5
): Promise<Record<string, unknown>[]> {
  try {
    // Convert UPDATE/DELETE to SELECT for preview
    let previewSQL = command.generatedSQL;

    if (command.type === 'update' || command.type === 'delete') {
      // Extract WHERE clause
      const whereMatch = command.generatedSQL.match(/WHERE\s+(.+)$/i);
      const whereClause = whereMatch ? ` WHERE ${whereMatch[1]}` : '';

      // Extract table name
      const tableMatch = command.generatedSQL.match(/(?:UPDATE|DELETE\s+FROM)\s+"([^"]+)"/i);
      const tableName = tableMatch ? tableMatch[1] : '';

      previewSQL = `SELECT * FROM "${tableName}"${whereClause} LIMIT ${limit}`;
    } else if (command.type === 'filter' || command.type === 'sort') {
      previewSQL = command.generatedSQL.replace(/;?\s*$/, ` LIMIT ${limit}`);
    }

    const result = await executeQuery(previewSQL);
    return result || [];
  } catch (err) {
    console.error('[AICommands] Preview generation failed:', err);
    return [];
  }
}

// Validate SQL for safety
export function validateSQL(sql: string, allowedTable: string): { valid: boolean; error?: string } {
  const upperSQL = sql.toUpperCase();

  // Forbidden keywords
  const forbidden = ['DROP TABLE', 'DROP VIEW', 'TRUNCATE', 'ALTER TABLE', 'CREATE TABLE', 'GRANT', 'REVOKE'];
  for (const keyword of forbidden) {
    if (upperSQL.includes(keyword)) {
      return { valid: false, error: `Forbidden SQL keyword: ${keyword}` };
    }
  }

  // Ensure only our table is referenced
  const tablePattern = /(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+"?([^"\s]+)"?/i;
  const match = sql.match(tablePattern);
  if (match && match[1] !== allowedTable) {
    return { valid: false, error: `Cannot modify table: ${match[1]}` };
  }

  return { valid: true };
}

export default {
  parseNaturalLanguage,
  generatePreview,
  validateSQL,
};
