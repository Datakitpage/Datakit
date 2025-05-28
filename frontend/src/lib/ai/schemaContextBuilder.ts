import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';

export interface TableSchema {
  name: string;
  escapedName: string;
  columns: ColumnInfo[];
  rowCount?: number;
  sampleData?: Record<string, any>[];
  relationships?: TableRelationship[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
  sampleValues?: string[];
  distinctCount?: number;
  isNumeric?: boolean;
  isDate?: boolean;
  isCategorical?: boolean;
}

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'foreign_key' | 'suggested';
}

export interface SchemaContext {
  tables: TableSchema[];
  totalTables: number;
  totalColumns: number;
  relationships: TableRelationship[];
  contextSize: number; // for prompt optimization
  buildTime: number;
}

/**
 * Enhanced Schema Context Builder
 * Builds rich schema context from DuckDB cache for AI processing
 */
export class SchemaContextBuilder {
  private static instance: SchemaContextBuilder;
  private cache = new Map<string, SchemaContext>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  static getInstance(): SchemaContextBuilder {
    if (!SchemaContextBuilder.instance) {
      SchemaContextBuilder.instance = new SchemaContextBuilder();
    }
    return SchemaContextBuilder.instance;
  }

  /**
   * Build complete schema context for all available tables
   */
  async buildFullContext(options?: {
    includeSampleData?: boolean;
    maxSamplesPerColumn?: number;
    detectRelationships?: boolean;
  }): Promise<SchemaContext> {
    const startTime = Date.now();
    const opts = {
      includeSampleData: true,
      maxSamplesPerColumn: 5,
      detectRelationships: false, // Keep simple for now
      ...options
    };

    // Check cache first
    const cacheKey = `full-${JSON.stringify(opts)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.buildTime) < this.CACHE_TTL) {
      return cached;
    }

    try {
      const duckDBStore = useDuckDBStore.getState();
      const appStore = useAppStore.getState();
      
      // Get all available tables
      const tableNames = duckDBStore.getAvailableTables();
      console.log(`[SchemaContextBuilder] Building context for ${tableNames.length} tables`);
      
      const tables: TableSchema[] = [];
      let totalColumns = 0;

      for (const tableName of tableNames) {
        const tableSchema = await this.buildTableSchema(tableName, opts);
        if (tableSchema) {
          tables.push(tableSchema);
          totalColumns += tableSchema.columns.length;
        }
      }

      // Detect relationships between tables (if enabled)
      const relationships: TableRelationship[] = [];
      if (opts.detectRelationships) {
        relationships.push(...await this.detectTableRelationships(tables));
      }

      const context: SchemaContext = {
        tables,
        totalTables: tables.length,
        totalColumns,
        relationships,
        contextSize: this.estimateContextSize(tables, relationships),
        buildTime: Date.now()
      };

      // Cache the result
      this.cache.set(cacheKey, context);
      
      const buildTime = Date.now() - startTime;
      console.log(`[SchemaContextBuilder] Built context in ${buildTime}ms - ${tables.length} tables, ${totalColumns} columns`);
      
      return context;

    } catch (error) {
      console.error('[SchemaContextBuilder] Failed to build schema context:', error);
      throw new Error(`Schema context building failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build schema context for specific tables only
   */
  async buildContextForTables(tableNames: string[], options?: {
    includeSampleData?: boolean;
    maxSamplesPerColumn?: number;
  }): Promise<SchemaContext> {
    const startTime = Date.now();
    const opts = {
      includeSampleData: true,
      maxSamplesPerColumn: 5,
      ...options
    };

    const tables: TableSchema[] = [];
    let totalColumns = 0;

    for (const tableName of tableNames) {
      const tableSchema = await this.buildTableSchema(tableName, opts);
      if (tableSchema) {
        tables.push(tableSchema);
        totalColumns += tableSchema.columns.length;
      }
    }

    return {
      tables,
      totalTables: tables.length,
      totalColumns,
      relationships: [], // Skip relationships for targeted context
      contextSize: this.estimateContextSize(tables, []),
      buildTime: Date.now()
    };
  }

  /**
   * Build detailed schema for a single table
   */
  private async buildTableSchema(tableName: string, options: {
    includeSampleData?: boolean;
    maxSamplesPerColumn?: number;
  }): Promise<TableSchema | null> {
    try {
      const duckDBStore = useDuckDBStore.getState();
      const appStore = useAppStore.getState();
      
      // Get basic schema from DuckDB
      const basicSchema = await duckDBStore.getTableSchema(tableName);
      if (!basicSchema) {
        console.warn(`[SchemaContextBuilder] No schema found for table: ${tableName}`);
        return null;
      }

      // Get escaped table name
      const registeredTables = duckDBStore.registeredTables;
      const escapedName = registeredTables.get(tableName) || `"${tableName}"`;

      // Enhanced column analysis
      const columns: ColumnInfo[] = [];
      for (const col of basicSchema) {
        const columnInfo = await this.analyzeColumn(tableName, escapedName, col, options);
        columns.push(columnInfo);
      }

      // Get row count
      let rowCount: number | undefined;
      try {
        const countResult = await duckDBStore.executeQuery(`SELECT COUNT(*) as count FROM ${escapedName}`);
        if (countResult) {
          const countData = countResult.toArray();
          rowCount = Number(countData[0]?.count) || 0;
        }
      } catch (error) {
        console.warn(`[SchemaContextBuilder] Could not get row count for ${tableName}:`, error);
      }

      // Get sample data if requested
      let sampleData: Record<string, any>[] | undefined;
      if (options.includeSampleData) {
        try {
          const sampleResult = await duckDBStore.executeQuery(`SELECT * FROM ${escapedName} LIMIT 3`);
          if (sampleResult) {
            sampleData = sampleResult.toArray();
          }
        } catch (error) {
          console.warn(`[SchemaContextBuilder] Could not get sample data for ${tableName}:`, error);
        }
      }

      return {
        name: tableName,
        escapedName,
        columns,
        rowCount,
        sampleData,
        relationships: []
      };

    } catch (error) {
      console.error(`[SchemaContextBuilder] Error building schema for table ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Analyze individual column for enhanced context
   */
  private async analyzeColumn(
    tableName: string, 
    escapedTableName: string,
    column: { name: string; type: string },
    options: { maxSamplesPerColumn?: number }
  ): Promise<ColumnInfo> {
    const columnInfo: ColumnInfo = {
      name: column.name,
      type: column.type,
      isNumeric: this.isNumericType(column.type),
      isDate: this.isDateType(column.name, column.type),
      isCategorical: false // Will be determined by sample analysis
    };

    // Get sample values and analysis
    if (options.maxSamplesPerColumn && options.maxSamplesPerColumn > 0) {
      try {
        const duckDBStore = useDuckDBStore.getState();
        const escapedColumnName = `"${column.name}"`;
        
        // Get distinct sample values
        const sampleQuery = `
          SELECT DISTINCT ${escapedColumnName} as value, COUNT(*) as freq 
          FROM ${escapedTableName} 
          WHERE ${escapedColumnName} IS NOT NULL 
          GROUP BY ${escapedColumnName} 
          ORDER BY freq DESC 
          LIMIT ${options.maxSamplesPerColumn}
        `;
        
        const sampleResult = await duckDBStore.executeQuery(sampleQuery);
        if (sampleResult) {
          const samples = sampleResult.toArray();
          columnInfo.sampleValues = samples.map(s => String(s.value));
          columnInfo.distinctCount = samples.length;
          
          // Determine if categorical (few distinct values relative to data size)
          if (samples.length <= 20 && !columnInfo.isNumeric && !columnInfo.isDate) {
            columnInfo.isCategorical = true;
          }
        }
      } catch (error) {
        console.warn(`[SchemaContextBuilder] Could not analyze column ${column.name}:`, error);
      }
    }

    return columnInfo;
  }

  /**
   * Detect relationships between tables (simple heuristic approach)
   */
  private async detectTableRelationships(tables: TableSchema[]): Promise<TableRelationship[]> {
    const relationships: TableRelationship[] = [];
    
    // Simple heuristic: look for columns with similar names that might be foreign keys
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const table1 = tables[i];
        const table2 = tables[j];
        
        // Look for potential foreign key relationships
        for (const col1 of table1.columns) {
          for (const col2 of table2.columns) {
            if (this.isPotentialForeignKey(col1, col2, table1.name, table2.name)) {
              relationships.push({
                fromTable: table1.name,
                fromColumn: col1.name,
                toTable: table2.name,
                toColumn: col2.name,
                type: 'suggested'
              });
            }
          }
        }
      }
    }
    
    return relationships;
  }

  /**
   * Simple heuristic to detect potential foreign key relationships
   */
  private isPotentialForeignKey(
    col1: ColumnInfo, 
    col2: ColumnInfo, 
    table1: string, 
    table2: string
  ): boolean {
    // Look for common patterns like:
    // - id columns
    // - table_name_id patterns
    // - similar column names with compatible types
    
    const name1 = col1.name.toLowerCase();
    const name2 = col2.name.toLowerCase();
    
    // Check for id columns
    if (name1 === 'id' && name2.includes(table1.toLowerCase() + '_id')) {
      return true;
    }
    if (name2 === 'id' && name1.includes(table2.toLowerCase() + '_id')) {
      return true;
    }
    
    // Check for exact name matches with compatible types
    if (name1 === name2 && col1.type === col2.type && col1.isNumeric) {
      return true;
    }
    
    return false;
  }

  /**
   * Utility methods for type detection
   */
  private isNumericType(type: string): boolean {
    const numericTypes = ['INTEGER', 'BIGINT', 'DOUBLE', 'FLOAT', 'DECIMAL', 'NUMERIC'];
    return numericTypes.some(t => type.toUpperCase().includes(t));
  }

  private isDateType(columnName: string, type: string): boolean {
    const name = columnName.toLowerCase();
    const typeUpper = type.toUpperCase();
    
    return (
      typeUpper.includes('DATE') ||
      typeUpper.includes('TIME') ||
      typeUpper.includes('TIMESTAMP') ||
      name.includes('date') ||
      name.includes('time') ||
      name.includes('created') ||
      name.includes('updated')
    );
  }

  /**
   * Estimate the size of context for prompt optimization
   */
  private estimateContextSize(tables: TableSchema[], relationships: TableRelationship[]): number {
    let size = 0;
    
    // Base size for table structure
    size += tables.length * 50; // ~50 chars per table name
    
    // Column information
    for (const table of tables) {
      size += table.columns.length * 30; // ~30 chars per column
      
      // Sample values
      for (const col of table.columns) {
        if (col.sampleValues) {
          size += col.sampleValues.join(', ').length;
        }
      }
    }
    
    // Relationships
    size += relationships.length * 40; // ~40 chars per relationship
    
    return size;
  }

  /**
   * Generate a human-readable summary of the schema context
   */
  generateContextSummary(context: SchemaContext): string {
    const { tables, totalColumns, relationships } = context;
    
    let summary = `Database contains ${tables.length} table(s) with ${totalColumns} total columns.\n\n`;
    
    for (const table of tables) {
      summary += `Table "${table.name}":\n`;
      summary += `  - ${table.columns.length} columns${table.rowCount ? `, ${table.rowCount.toLocaleString()} rows` : ''}\n`;
      
      // Group columns by type
      const numericCols = table.columns.filter(c => c.isNumeric);
      const dateCols = table.columns.filter(c => c.isDate);
      const categoricalCols = table.columns.filter(c => c.isCategorical);
      const otherCols = table.columns.filter(c => !c.isNumeric && !c.isDate && !c.isCategorical);
      
      if (numericCols.length > 0) {
        summary += `  - Numeric: ${numericCols.map(c => c.name).join(', ')}\n`;
      }
      if (dateCols.length > 0) {
        summary += `  - Date/Time: ${dateCols.map(c => c.name).join(', ')}\n`;
      }
      if (categoricalCols.length > 0) {
        summary += `  - Categorical: ${categoricalCols.map(c => c.name).join(', ')}\n`;
      }
      if (otherCols.length > 0) {
        summary += `  - Other: ${otherCols.map(c => c.name).join(', ')}\n`;
      }
      
      summary += '\n';
    }
    
    if (relationships.length > 0) {
      summary += `Relationships:\n`;
      for (const rel of relationships) {
        summary += `  - ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}\n`;
      }
    }
    
    return summary;
  }

  /**
   * Clear cache (useful for testing or when schema changes)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[SchemaContextBuilder] Cache cleared');
  }
}

/**
 * Singleton instance for easy access
 */
export const schemaContextBuilder = SchemaContextBuilder.getInstance();