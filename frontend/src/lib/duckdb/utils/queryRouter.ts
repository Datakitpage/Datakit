/**
 * Query Router Utility
 * 
 * Analyzes SQL queries to determine the appropriate execution target:
 * - PostgreSQL: Remote PostgreSQL connections
 * - MotherDuck: Cloud DuckDB databases  
 * - Local: Local DuckDB tables
 */

export interface TableReference {
  schema?: string;
  table: string;
  database?: string;
  isQuoted: boolean;
}

export interface QueryRouterResult {
  target: 'postgresql' | 'motherduck' | 'databricks' | 'local' | 'hybrid';
  confidence: number;
  tableReferences: TableReference[];
  postgresqlTables: TableReference[];
  motherduckTables: TableReference[];
  databricksTables: TableReference[];
  localTables: TableReference[];
  connectionId?: string;
  reasoning: string;
}

export interface PostgreSQLVirtualTable {
  connectionId: string;
  schemaName: string;
  tableName: string;
}

export class QueryRouter {
  private postgresVirtualTables: Map<string, PostgreSQLVirtualTable>;
  private postgresActiveConnections: Set<string>;
  private motherduckDatabases: Set<string>;
  private databricksVirtualTables: Map<string, any>; // Using any to avoid circular dependency

  constructor(
    postgresVirtualTables: Map<string, PostgreSQLVirtualTable> = new Map(),
    postgresActiveConnections: Set<string> = new Set(),
    motherduckDatabases: Set<string> = new Set(),
    databricksVirtualTables: Map<string, any> = new Map()
  ) {
    this.postgresVirtualTables = postgresVirtualTables;
    this.postgresActiveConnections = postgresActiveConnections;
    this.motherduckDatabases = motherduckDatabases;
    this.databricksVirtualTables = databricksVirtualTables;
  }

  analyzeQuery(sql: string): QueryRouterResult {
    const tableReferences = this.extractTableReferences(sql);

    const postgresqlTables: TableReference[] = [];
    const motherduckTables: TableReference[] = [];
    const databricksTables: TableReference[] = [];
    const localTables: TableReference[] = [];

    let connectionId: string | undefined;

    for (const ref of tableReferences) {
      const classification = this.classifyTable(ref);

      if (classification.type === 'postgresql') {
        postgresqlTables.push(ref);
        if (!connectionId) connectionId = classification.connectionId;
      } else if (classification.type === 'motherduck') {
        motherduckTables.push(ref);
      } else if (classification.type === 'databricks') {
        databricksTables.push(ref);
      } else {
        localTables.push(ref);
      }
    }

    const result = this.determineTarget(postgresqlTables, motherduckTables, databricksTables, localTables, connectionId);

    return {
      ...result,
      tableReferences,
      postgresqlTables,
      motherduckTables,
      databricksTables,
      localTables,
      connectionId,
    };
  }


  /**
   * Extract all table references from a SQL query
   */
  private extractTableReferences(sql: string): TableReference[] {
    const references: TableReference[] = [];
    const seen = new Set<string>();

    // More specific patterns ordered by complexity (most specific first)
    const patterns = [
      // Three-part: "database"."schema"."table" or database.schema.table
      {
        pattern: /(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+(?:[\w\s]*\s+)?(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))\.(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))\.(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
        type: 'three-part'
      },

      // Two-part: "schema"."table" or schema.table
      {
        pattern: /(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+(?:[\w\s]*\s+)?(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))\.(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
        type: 'two-part'
      },

      // Single table: "table" or table (only if no schema.table patterns found)
      {
        pattern: /(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+(?:[\w\s]*\s+)?(?:["']([^"']+)["']|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
        type: 'single'
      }
    ];

    // Process patterns in order
    // We track matched ranges to prevent sub-matches (e.g. "a.b" inside "a.b.c") from being counted twice
    const matchedRanges: { start: number; end: number }[] = [];

    for (const { pattern, type } of patterns) {
      pattern.lastIndex = 0; // Reset regex
      let match;

      while ((match = pattern.exec(sql)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;

        // Check for overlap with existing matches
        const isOverlapping = matchedRanges.some(range =>
          (start >= range.start && start < range.end) ||
          (end > range.start && end <= range.end) ||
          (start <= range.start && end >= range.end)
        );

        if (isOverlapping) {
          continue;
        }

        let ref: TableReference | null = null;
        let refKey: string = '';

        if (type === 'three-part') {
          const database = match[1] || match[2];
          const schema = match[3] || match[4];
          const table = match[5] || match[6];

          if (database && schema && table) {
            ref = {
              database,
              schema,
              table,
              isQuoted: !!(match[1] || match[3] || match[5]),
            };
            refKey = `${database}.${schema}.${table}`;
          }
        } else if (type === 'two-part') {
          const schema = match[1] || match[2];
          const table = match[3] || match[4];

          if (schema && table) {
            ref = {
              schema,
              table,
              isQuoted: !!(match[1] || match[3]),
            };
            refKey = `${schema}.${table}`;
          }
        } else if (type === 'single') {
          const table = match[1] || match[2];

          // Only match if we haven't found any complex matches, or if this is truly distinct?
          // Actually, now that we track ranges, we can trust non-overlapping single matches.
          if (table) {
            ref = {
              table,
              isQuoted: !!match[1],
            };
            refKey = table;
          }
        }

        // Add unique references only
        if (ref && !seen.has(refKey)) {
          seen.add(refKey);
          references.push(ref);
          matchedRanges.push({ start, end });
        }
      }
    }



    return references;
  }

  /**
   * Classify a table reference as PostgreSQL, MotherDuck, or Local
   */
  private classifyTable(ref: TableReference): { type: 'postgresql' | 'motherduck' | 'databricks' | 'local'; connectionId?: string } {
    // PostgreSQL check (existing logic)...
    for (const [_, table] of this.postgresVirtualTables) {
      const schemaMatch = ref.schema === table.schemaName || (!ref.schema && table.schemaName === 'public');
      const tableMatch = ref.table === table.tableName;
      if (schemaMatch && tableMatch) return { type: 'postgresql', connectionId: table.connectionId };
    }

    // Databricks check
    for (const [_, table] of this.databricksVirtualTables) {
      // Check for exact match on table name and schema
      if (ref.table === table.tableName && ref.schema === table.schema) {
        if (!ref.database || ref.database === table.catalog) {
          return { type: 'databricks' };
        }
      }
      // Check 3-part fully qualified match
      if (ref.database === table.catalog && ref.schema === table.schema && ref.table === table.tableName) {
        return { type: 'databricks' };
      }
    }

    // MotherDuck...
    if (ref.database && this.motherduckDatabases.has(ref.database)) return { type: 'motherduck' };

    // Special MotherDuck database patterns
    if (ref.database && (
      ref.database.includes('my_db') ||
      ref.database.includes('sample_data') ||
      ref.database.startsWith('md:')
    )) {
      return { type: 'motherduck' };
    }

    return { type: 'local' };
  }

  /**
   * Determine the final routing target based on classified tables
   */
  private determineTarget(
    postgresqlTables: TableReference[],
    motherduckTables: TableReference[],
    databricksTables: TableReference[],
    localTables: TableReference[],
    connectionId?: string
  ): Pick<QueryRouterResult, 'target' | 'confidence' | 'reasoning'> {
    const pgCount = postgresqlTables.length;
    const mdCount = motherduckTables.length;
    const dbCount = databricksTables.length;
    const localCount = localTables.length;
    const totalCount = pgCount + mdCount + localCount + dbCount;

    // No tables found
    if (totalCount === 0) {
      return {
        target: 'local',
        confidence: 0.5,
        reasoning: 'No table references found, defaulting to local execution'
      };
    }

    if (dbCount > 0 && pgCount === 0 && mdCount === 0 && localCount === 0) {
      return { target: 'databricks', confidence: 0.9, reasoning: `All ${dbCount} tables reference Databricks` };
    }

    // Pure PostgreSQL query
    if (pgCount > 0 && mdCount === 0 && localCount === 0 && dbCount === 0) {
      const confidence = connectionId && this.postgresActiveConnections.has(connectionId) ? 0.95 : 0.7;
      return {
        target: 'postgresql',
        confidence,
        reasoning: `All ${pgCount} table(s) reference PostgreSQL. Connection: ${connectionId ? 'active' : 'not found'}`
      };
    }

    // Pure MotherDuck query
    if (mdCount > 0 && pgCount === 0 && localCount === 0 && dbCount === 0) {
      return {
        target: 'motherduck',
        confidence: 0.9,
        reasoning: `All ${mdCount} table(s) reference MotherDuck databases`
      };
    }

    // Pure local query
    if (localCount > 0 && pgCount === 0 && mdCount === 0 && dbCount === 0) {
      return {
        target: 'local',
        confidence: 0.8,
        reasoning: `All ${localCount} table(s) appear to be local DuckDB tables`
      };
    }

    // Hybrid query - not supported yet
    const components = [];
    if (pgCount > 0) components.push(`${pgCount} PostgreSQL`);
    if (mdCount > 0) components.push(`${mdCount} MotherDuck`);
    if (dbCount > 0) components.push(`${dbCount} Databricks`);
    if (localCount > 0) components.push(`${localCount} local`);

    return {
      target: 'hybrid',
      confidence: 1.0,
      reasoning: `Cross-database query detected: ${components.join(', ')} tables`
    };
  }

  /**
   * Update the PostgreSQL virtual tables registry
   */
  updatePostgreSQLState(
    virtualTables: Map<string, PostgreSQLVirtualTable>,
    activeConnections: Set<string>
  ) {
    this.postgresVirtualTables = virtualTables;
    this.postgresActiveConnections = activeConnections;
  }

  /**
   * Update the MotherDuck databases registry
   */
  updateMotherDuckState(databases: Set<string>) {
    this.motherduckDatabases = databases;
  }
}

/**
 * Default singleton instance
 */
export const queryRouter = new QueryRouter();

/**
 * Convenience function for quick query analysis
 */
export function analyzeQuery(
  sql: string,
  postgresVirtualTables?: Map<string, PostgreSQLVirtualTable>,
  postgresActiveConnections?: Set<string>,
  motherduckDatabases?: Set<string>,
  databricksVirtualTables?: Map<string, any>
): QueryRouterResult {
  const router = new QueryRouter(
    postgresVirtualTables,
    postgresActiveConnections,
    motherduckDatabases,
    databricksVirtualTables
  );
  return router.analyzeQuery(sql);
}