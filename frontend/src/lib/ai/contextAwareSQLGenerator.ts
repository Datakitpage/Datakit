// lib/ai/contextAwareSQLGenerator.ts
import { QueryIntent, IntentResult } from './intentClassifier';
import { SchemaContext, TableSchema, ColumnInfo, schemaContextBuilder } from './schemaContextBuilder';
import { modelManager } from './modelManager';

export interface SQLGenerationResult {
  sql: string;
  explanation: string;
  confidence: number;
  approach: 'pattern' | 'small_model' | 'large_model' | 'template';
  usedTables: string[];
  usedColumns: string[];
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  warnings: string[];
  suggestions: string[];
  generationTime: number;
}

export interface SQLGenerationOptions {
  intent: QueryIntent;
  entities: {
    columns: string[];
    values: string[];
    operations: string[];
    timeRanges: string[];
    chartTypes: string[];
    aggregations: string[];
  };
  userQuery: string;
  maxRows?: number;
  preferredApproach?: 'fast' | 'accurate' | 'auto';
  includeOptimizations?: boolean;
}

/**
 * Context-Aware SQL Generator
 * Uses rich schema context and progressive complexity to generate SQL
 */
export class ContextAwareSQLGenerator {
  private static instance: ContextAwareSQLGenerator;
  private generationCache = new Map<string, SQLGenerationResult>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  static getInstance(): ContextAwareSQLGenerator {
    if (!ContextAwareSQLGenerator.instance) {
      ContextAwareSQLGenerator.instance = new ContextAwareSQLGenerator();
    }
    return ContextAwareSQLGenerator.instance;
  }

  /**
   * Generate SQL with progressive complexity handling
   */
  async generateSQL(options: SQLGenerationOptions): Promise<SQLGenerationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[SQLGenerator] Generating SQL for intent: ${options.intent}`);
      console.log(`[SQLGenerator] User query: "${options.userQuery}"`);

      // Check cache first
      const cacheKey = this.buildCacheKey(options);
      const cached = this.generationCache.get(cacheKey);
      if (cached && (Date.now() - startTime) < this.CACHE_TTL) {
        console.log(`[SQLGenerator] Using cached result`);
        return cached;
      }

      // Build schema context for relevant tables
      const schemaContext = await this.buildRelevantSchemaContext(options);
      
      // Assess query complexity
      const complexity = this.assessQueryComplexity(options, schemaContext);
      
      // Choose generation approach based on complexity and preferences
      const approach = this.selectGenerationApproach(complexity, options.preferredApproach);
      
      // Generate SQL using the selected approach
      const result = await this.generateSQLWithApproach(options, schemaContext, approach);
      
      // Add optimizations if requested
      if (options.includeOptimizations) {
        this.addOptimizationSuggestions(result, options);
      }

      // Cache the result
      this.generationCache.set(cacheKey, result);
      
      const generationTime = Date.now() - startTime;
      result.generationTime = generationTime;
      
      console.log(`[SQLGenerator] Generated SQL in ${generationTime}ms using ${approach} approach`);
      return result;

    } catch (error) {
      console.error('[SQLGenerator] SQL generation failed:', error);
      
      // Fallback to basic template approach
      return this.generateFallbackSQL(options, Date.now() - startTime);
    }
  }

  /**
   * Build schema context relevant to the user's query
   */
  private async buildRelevantSchemaContext(options: SQLGenerationOptions): Promise<SchemaContext> {
    // Get all available tables
    const fullContext = await schemaContextBuilder.buildFullContext({
      includeSampleData: true,
      maxSamplesPerColumn: 3, // Keep it lightweight
      detectRelationships: false // Skip for now to keep it fast
    });

    // Filter to most relevant tables based on entities
    const relevantTables = this.findRelevantTables(fullContext, options);
    
    if (relevantTables.length === 0) {
      console.log('[SQLGenerator] No relevant tables found, using all available tables');
      return fullContext;
    }

    if (relevantTables.length < fullContext.tables.length) {
      console.log(`[SQLGenerator] Filtered to ${relevantTables.length} relevant tables`);
      return schemaContextBuilder.buildContextForTables(
        relevantTables.map(t => t.name),
        { includeSampleData: true, maxSamplesPerColumn: 3 }
      );
    }

    return fullContext;
  }

  /**
   * Find tables most relevant to the user's query
   */
  private findRelevantTables(context: SchemaContext, options: SQLGenerationOptions): TableSchema[] {
    const { entities, userQuery } = options;
    const queryLower = userQuery.toLowerCase();
    
    const relevantTables: { table: TableSchema; score: number }[] = [];

    for (const table of context.tables) {
      let score = 0;

      // Check if table name appears in query
      if (queryLower.includes(table.name.toLowerCase())) {
        score += 10;
      }

      // Check if any mentioned columns exist in this table
      for (const entityColumn of entities.columns) {
        const matchingColumn = table.columns.find(col => 
          col.name.toLowerCase() === entityColumn.toLowerCase() ||
          this.fuzzyColumnMatch(col.name, entityColumn)
        );
        if (matchingColumn) {
          score += 5;
        }
      }

      // Check for semantic matches in column names
      for (const column of table.columns) {
        if (this.columnSemanticMatch(column.name, queryLower)) {
          score += 2;
        }
      }

      // Boost score for tables with sample data that matches query values
      if (entities.values.length > 0 && table.sampleData) {
        for (const row of table.sampleData) {
          for (const value of entities.values) {
            if (Object.values(row).some(v => 
              String(v).toLowerCase().includes(value.toLowerCase())
            )) {
              score += 1;
            }
          }
        }
      }

      if (score > 0) {
        relevantTables.push({ table, score });
      }
    }

    // Return top 3 relevant tables, sorted by score
    return relevantTables
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.table);
  }

  /**
   * Assess query complexity to choose the right approach
   */
  private assessQueryComplexity(
    options: SQLGenerationOptions, 
    context: SchemaContext
  ): 'simple' | 'medium' | 'complex' {
    let complexityScore = 0;

    // Query length factor
    if (options.userQuery.length > 50) complexityScore += 1;
    if (options.userQuery.length > 100) complexityScore += 2;

    // Entity complexity
    if (options.entities.columns.length > 2) complexityScore += 1;
    if (options.entities.operations.length > 1) complexityScore += 1;
    if (options.entities.aggregations.length > 0) complexityScore += 2;

    // Intent complexity
    const complexIntents: QueryIntent[] = [
      'find_correlations', 'detect_outliers', 'time_analysis', 'compare_groups'
    ];
    if (complexIntents.includes(options.intent)) {
      complexityScore += 3;
    }

    // Multi-table operations
    if (context.tables.length > 1 && options.entities.columns.length > 3) {
      complexityScore += 2;
    }

    // SQL complexity keywords in user query
    const complexKeywords = ['join', 'union', 'subquery', 'window', 'partition', 'case when'];
    const queryLower = options.userQuery.toLowerCase();
    complexityScore += complexKeywords.filter(kw => queryLower.includes(kw)).length * 2;

    // Return complexity level
    if (complexityScore >= 8) return 'complex';
    if (complexityScore >= 4) return 'medium';
    return 'simple';
  }

  /**
   * Select the best generation approach based on complexity and preferences
   */
  private selectGenerationApproach(
    complexity: 'simple' | 'medium' | 'complex',
    preference?: 'fast' | 'accurate' | 'auto'
  ): 'pattern' | 'small_model' | 'large_model' | 'template' {
    
    if (preference === 'fast') {
      return complexity === 'simple' ? 'pattern' : 'template';
    }
    
    if (preference === 'accurate') {
      return complexity === 'complex' ? 'large_model' : 'small_model';
    }

    // Auto selection based on complexity
    switch (complexity) {
      case 'simple':
        return 'pattern'; // Fast pattern matching for simple queries
      case 'medium': 
        return 'small_model'; // Small ML model for medium complexity
      case 'complex':
        return 'large_model'; // Larger model for complex queries
      default:
        return 'template';
    }
  }

  /**
   * Generate SQL using the selected approach
   */
  private async generateSQLWithApproach(
    options: SQLGenerationOptions,
    context: SchemaContext,
    approach: 'pattern' | 'small_model' | 'large_model' | 'template'
  ): Promise<SQLGenerationResult> {
    
    switch (approach) {
      case 'pattern':
        return this.generateWithPatterns(options, context);
      
      case 'small_model':
        return this.generateWithModel(options, context, 'text2sql-small');
      
      case 'large_model':
        return this.generateWithModel(options, context, 'text2sql-base');
      
      case 'template':
        return this.generateWithTemplates(options, context);
      
      default:
        throw new Error(`Unknown generation approach: ${approach}`);
    }
  }

  /**
   * Generate SQL using pattern matching (fastest approach)
   */
  private async generateWithPatterns(
    options: SQLGenerationOptions,
    context: SchemaContext
  ): Promise<SQLGenerationResult> {
    
    const { intent, entities } = options;
    const primaryTable = context.tables[0];
    
    if (!primaryTable) {
      throw new Error('No tables available for SQL generation');
    }

    const tableName = primaryTable.escapedName;
    const resolvedColumns = this.resolveColumnNames(entities.columns, primaryTable);
    
    let sql: string;
    let explanation: string;

    switch (intent) {
      case 'show_data':
        sql = this.generateShowDataSQL(tableName, resolvedColumns, options.maxRows);
        explanation = `Display data from ${primaryTable.name}${resolvedColumns.length > 0 ? ` showing columns: ${resolvedColumns.join(', ')}` : ''}`;
        break;

      case 'filter_data':
        sql = this.generateFilterSQL(tableName, resolvedColumns, entities.values, primaryTable);
        explanation = `Filter ${primaryTable.name} data based on specified criteria`;
        break;

      case 'aggregate_data':
        sql = this.generateAggregateSQL(tableName, resolvedColumns, entities.aggregations, primaryTable);
        explanation = `Aggregate data from ${primaryTable.name} using ${entities.aggregations.join(', ')}`;
        break;

      case 'sort_data':
        sql = this.generateSortSQL(tableName, resolvedColumns, options.maxRows);
        explanation = `Sort ${primaryTable.name} data by ${resolvedColumns[0] || 'default column'}`;
        break;

      case 'count_data':
        sql = this.generateCountSQL(tableName, resolvedColumns, primaryTable);
        explanation = `Count records in ${primaryTable.name}`;
        break;

      default:
        sql = this.generateShowDataSQL(tableName, [], options.maxRows);
        explanation = `Basic data display from ${primaryTable.name}`;
    }

    return {
      sql,
      explanation,
      confidence: 0.8,
      approach: 'pattern',
      usedTables: [primaryTable.name],
      usedColumns: resolvedColumns,
      estimatedComplexity: 'simple',
      warnings: [],
      suggestions: [],
      generationTime: 0
    };
  }

  /**
   * Generate SQL using ML models
   */
  private async generateWithModel(
    options: SQLGenerationOptions,
    context: SchemaContext,
    modelId: 'text2sql-small' | 'text2sql-base'
  ): Promise<SQLGenerationResult> {
    
    try {
      // Load the model (will use cache if already loaded)
      const model = await modelManager.loadModel(modelId);
      
      // Build rich prompt with schema context
      const prompt = this.buildModelPrompt(options, context);
      
      console.log(`[SQLGenerator] Using ${modelId} with prompt length: ${prompt.length}`);
      
      // Generate SQL
      const result = await model(prompt, {
        max_length: 200,
        temperature: 0.1, // Low temperature for deterministic SQL
        do_sample: false
      });
      
      let generatedSQL = '';
      if (result && result.length > 0 && result[0].generated_text) {
        generatedSQL = this.cleanGeneratedSQL(result[0].generated_text);
      }
      
      // Validate and enhance the generated SQL
      const { sql, warnings } = this.validateAndEnhanceSQL(generatedSQL, context, options);
      
      return {
        sql,
        explanation: `Generated SQL query using ${modelId} based on your request: "${options.userQuery}"`,
        confidence: 0.85,
        approach: modelId === 'text2sql-small' ? 'small_model' : 'large_model',
        usedTables: this.extractUsedTables(sql, context),
        usedColumns: this.extractUsedColumns(sql, context),
        estimatedComplexity: 'medium',
        warnings,
        suggestions: [],
        generationTime: 0
      };
      
    } catch (error) {
      console.error(`[SQLGenerator] Model generation failed with ${modelId}:`, error);
      
      // Fallback to pattern-based generation
      console.log('[SQLGenerator] Falling back to pattern-based generation');
      return this.generateWithPatterns(options, context);
    }
  }

  /**
   * Generate SQL using templates (reliable fallback)
   */
  private async generateWithTemplates(
    options: SQLGenerationOptions,
    context: SchemaContext
  ): Promise<SQLGenerationResult> {
    
    const primaryTable = context.tables[0];
    if (!primaryTable) {
      throw new Error('No tables available for template generation');
    }

    // Use existing query template system as fallback
    const { QueryTemplateEngine } = await import('./queryTemplates');
    const templateEngine = new QueryTemplateEngine();
    
    const templates = templateEngine.getTemplatesByIntent(options.intent);
    if (templates.length === 0) {
      // Fallback to basic show data
      const sql = this.generateShowDataSQL(primaryTable.escapedName, [], options.maxRows);
      return {
        sql,
        explanation: `Basic template query for ${primaryTable.name}`,
        confidence: 0.6,
        approach: 'template',
        usedTables: [primaryTable.name],
        usedColumns: [],
        estimatedComplexity: 'simple',
        warnings: ['Using basic template - query may not match your intent exactly'],
        suggestions: ['Try rephrasing your query for better results'],
        generationTime: 0
      };
    }

    const template = templates[0];
    const resolvedColumns = this.resolveColumnNames(options.entities.columns, primaryTable);
    
    // Fill template with resolved parameters
    const parameters: Record<string, string> = {
      column: resolvedColumns[0] || primaryTable.columns[0]?.name || 'id',
      groupColumn: resolvedColumns[0] || this.findBestCategoricalColumn(primaryTable),
      valueColumn: resolvedColumns[1] || this.findBestNumericColumn(primaryTable),
      limit: String(options.maxRows || 100)
    };

    const sql = templateEngine.fillTemplate(template, parameters, primaryTable.name);
    
    return {
      sql,
      explanation: `Generated using template: ${template.description}`,
      confidence: 0.7,
      approach: 'template',
      usedTables: [primaryTable.name],
      usedColumns: Object.values(parameters).filter(p => primaryTable.columns.some(c => c.name === p)),
      estimatedComplexity: template.difficulty === 'beginner' ? 'simple' : 'medium',
      warnings: [],
      suggestions: [`This used the "${template.name}" template - you can customize the query further`],
      generationTime: 0
    };
  }

  /**
   * Build rich prompt for ML model generation
   */
  private buildModelPrompt(options: SQLGenerationOptions, context: SchemaContext): string {
    let prompt = `Convert this natural language query to SQL:\n\nQuery: "${options.userQuery}"\n\n`;
    
    // Add schema context
    prompt += `Database Schema:\n`;
    for (const table of context.tables) {
      prompt += `Table "${table.name}" (${table.rowCount ? `${table.rowCount} rows` : 'unknown size'}):\n`;
      
      for (const col of table.columns.slice(0, 10)) { // Limit columns to keep prompt manageable
        prompt += `  - ${col.name} (${col.type})`;
        if (col.sampleValues && col.sampleValues.length > 0) {
          prompt += ` [e.g., ${col.sampleValues.slice(0, 3).join(', ')}]`;
        }
        if (col.isCategorical) prompt += ' [categorical]';
        if (col.isNumeric) prompt += ' [numeric]';
        if (col.isDate) prompt += ' [date/time]';
        prompt += '\n';
      }
      
      if (table.columns.length > 10) {
        prompt += `  ... and ${table.columns.length - 10} more columns\n`;
      }
      prompt += '\n';
    }
    
    // Add entity context if available
    if (options.entities.columns.length > 0) {
      prompt += `Mentioned columns: ${options.entities.columns.join(', ')}\n`;
    }
    
    if (options.entities.operations.length > 0) {
      prompt += `Operations: ${options.entities.operations.join(', ')}\n`;
    }
    
    if (options.entities.values.length > 0) {
      prompt += `Values: ${options.entities.values.join(', ')}\n`;
    }
    
    // Add intent context
    prompt += `Intent: ${options.intent}\n`;
    
    // Add safety constraints
    prompt += `\nConstraints:\n`;
    prompt += `- Use proper table/column escaping with double quotes\n`;
    prompt += `- Add LIMIT clause for large result sets\n`;
    prompt += `- Only use SELECT statements (no INSERT/UPDATE/DELETE)\n`;
    
    prompt += '\nSQL:';
    
    return prompt;
  }

  /**
   * Pattern-based SQL generators for different intents
   */
  private generateShowDataSQL(tableName: string, columns: string[], maxRows?: number): string {
    const columnList = columns.length > 0 
      ? columns.map(col => `"${col}"`).join(', ')
      : '*';
    
    const limit = maxRows || 100;
    return `SELECT ${columnList} FROM ${tableName} LIMIT ${limit}`;
  }

  private generateFilterSQL(
    tableName: string, 
    columns: string[], 
    values: string[], 
    table: TableSchema
  ): string {
    const baseColumns = columns.length > 0 
      ? columns.map(col => `"${col}"`).join(', ')
      : '*';
    
    let whereClause = '';
    if (columns.length > 0 && values.length > 0) {
      const filterColumn = `"${columns[0]}"`;
      const filterValue = values[0];
      
      // Determine if we should quote the value
      const column = table.columns.find(c => c.name === columns[0]);
      const shouldQuote = !column?.isNumeric;
      
      whereClause = ` WHERE ${filterColumn} = ${shouldQuote ? `'${filterValue}'` : filterValue}`;
    }
    
    return `SELECT ${baseColumns} FROM ${tableName}${whereClause} LIMIT 100`;
  }

  private generateAggregateSQL(
    tableName: string,
    columns: string[],
    aggregations: string[],
    table: TableSchema
  ): string {
    const groupByColumn = columns[0] || this.findBestCategoricalColumn(table);
    const valueColumn = columns[1] || this.findBestNumericColumn(table);
    const aggFunction = aggregations[0]?.toUpperCase() || 'COUNT';
    
    if (aggFunction === 'COUNT') {
      return `SELECT "${groupByColumn}", COUNT(*) as count FROM ${tableName} GROUP BY "${groupByColumn}" ORDER BY count DESC LIMIT 20`;
    } else {
      return `SELECT "${groupByColumn}", ${aggFunction}("${valueColumn}") as ${aggFunction.toLowerCase()}_value FROM ${tableName} GROUP BY "${groupByColumn}" ORDER BY ${aggFunction.toLowerCase()}_value DESC LIMIT 20`;
    }
  }

  private generateSortSQL(tableName: string, columns: string[], maxRows?: number): string {
    const sortColumn = columns[0] || 'rowid';
    const limit = maxRows || 100;
    return `SELECT * FROM ${tableName} ORDER BY "${sortColumn}" DESC LIMIT ${limit}`;
  }

  private generateCountSQL(tableName: string, columns: string[], table: TableSchema): string {
    if (columns.length > 0) {
      return `SELECT "${columns[0]}", COUNT(*) as count FROM ${tableName} GROUP BY "${columns[0]}" ORDER BY count DESC LIMIT 20`;
    } else {
      return `SELECT COUNT(*) as total_count FROM ${tableName}`;
    }
  }

  /**
   * Utility methods
   */
  private resolveColumnNames(entityColumns: string[], table: TableSchema): string[] {
    const resolved: string[] = [];
    
    for (const entityCol of entityColumns) {
      // Exact match
      const exactMatch = table.columns.find(col => 
        col.name.toLowerCase() === entityCol.toLowerCase()
      );
      
      if (exactMatch) {
        resolved.push(exactMatch.name);
        continue;
      }
      
      // Fuzzy match
      const fuzzyMatch = table.columns.find(col => 
        this.fuzzyColumnMatch(col.name, entityCol)
      );
      
      if (fuzzyMatch) {
        resolved.push(fuzzyMatch.name);
      }
    }
    
    return resolved;
  }

  private fuzzyColumnMatch(columnName: string, entityColumn: string): boolean {
    const col = columnName.toLowerCase();
    const entity = entityColumn.toLowerCase();
    
    // Check if one contains the other
    return col.includes(entity) || entity.includes(col);
  }

  private columnSemanticMatch(columnName: string, query: string): boolean {
    const col = columnName.toLowerCase();
    
    // Common semantic patterns
    const semanticMap: Record<string, string[]> = {
      'sales': ['revenue', 'income', 'earnings'],
      'date': ['time', 'created', 'updated'],
      'name': ['title', 'label', 'description'],
      'price': ['cost', 'amount', 'value'],
      'category': ['type', 'group', 'class']
    };
    
    for (const [key, synonyms] of Object.entries(semanticMap)) {
      if (col.includes(key) && synonyms.some(syn => query.includes(syn))) {
        return true;
      }
    }
    
    return false;
  }

  private findBestCategoricalColumn(table: TableSchema): string {
    // Find a good categorical column for grouping
    const categorical = table.columns.find(col => col.isCategorical);
    if (categorical) return categorical.name;
    
    // Fallback to string columns with reasonable distinct count
    const stringCol = table.columns.find(col => 
      !col.isNumeric && !col.isDate && (col.distinctCount || 0) < 50
    );
    if (stringCol) return stringCol.name;
    
    // Last resort - first non-numeric column
    const firstStringCol = table.columns.find(col => !col.isNumeric && !col.isDate);
    return firstStringCol?.name || table.columns[0]?.name || 'id';
  }

  private findBestNumericColumn(table: TableSchema): string {
    // Find a numeric column that's not an ID
    const numeric = table.columns.find(col => 
      col.isNumeric && !col.name.toLowerCase().includes('id')
    );
    if (numeric) return numeric.name;
    
    // Fallback to any numeric column
    const anyNumeric = table.columns.find(col => col.isNumeric);
    return anyNumeric?.name || table.columns[1]?.name || table.columns[0]?.name || 'value';
  }

  private cleanGeneratedSQL(rawSQL: string): string {
    // Clean up model-generated SQL
    let cleanSQL = rawSQL
      .replace(/^SQL:\s*/i, '')
      .replace(/^SELECT\s+SQL:\s*/i, 'SELECT ')
      .replace(/\n\n.*$/s, '') // Remove everything after double newline
      .trim();
    
    // Ensure it starts with SELECT
    if (!cleanSQL.toUpperCase().startsWith('SELECT')) {
      const selectMatch = cleanSQL.match(/(SELECT.*?)(?:\n|$)/i);
      if (selectMatch) {
        cleanSQL = selectMatch[1];
      } else {
        throw new Error('Generated SQL does not contain a valid SELECT statement');
      }
    }
    
    return cleanSQL;
  }

  private validateAndEnhanceSQL(
    sql: string, 
    context: SchemaContext, 
    options: SQLGenerationOptions
  ): { sql: string; warnings: string[] } {
    const warnings: string[] = [];
    let enhancedSQL = sql;
    
    // Check for dangerous keywords
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE'];
    const upperSQL = sql.toUpperCase();
    
    for (const keyword of dangerousKeywords) {
      if (upperSQL.includes(keyword)) {
        warnings.push(`Dangerous SQL keyword detected: ${keyword}`);
        // For safety, replace with a basic SELECT
        enhancedSQL = this.generateShowDataSQL(
          context.tables[0]?.escapedName || '"table"', 
          [], 
          options.maxRows
        );
        warnings.push('Replaced with safe SELECT query');
        break;
      }
    }
    
    // Add LIMIT if not present
    if (!upperSQL.includes('LIMIT')) {
      const limit = options.maxRows || 1000;
      enhancedSQL += ` LIMIT ${limit}`;
      warnings.push(`Added LIMIT ${limit} for performance`);
    }
    
    // Check for unquoted table/column names and fix them
    for (const table of context.tables) {
      // Replace unquoted table names
      const tableRegex = new RegExp(`\\b${table.name}\\b(?!["])`, 'gi');
      enhancedSQL = enhancedSQL.replace(tableRegex, table.escapedName);
      
      // Replace unquoted column names
      for (const column of table.columns) {
        const columnRegex = new RegExp(`\\b${column.name}\\b(?!["])`, 'gi');
        enhancedSQL = enhancedSQL.replace(columnRegex, `"${column.name}"`);
      }
    }
    
    return { sql: enhancedSQL, warnings };
  }

  private extractUsedTables(sql: string, context: SchemaContext): string[] {
    const usedTables: string[] = [];
    const upperSQL = sql.toUpperCase();
    
    for (const table of context.tables) {
      if (upperSQL.includes(table.name.toUpperCase()) || 
          upperSQL.includes(table.escapedName.toUpperCase())) {
        usedTables.push(table.name);
      }
    }
    
    return usedTables;
  }

  private extractUsedColumns(sql: string, context: SchemaContext): string[] {
    const usedColumns: string[] = [];
    const upperSQL = sql.toUpperCase();
    
    for (const table of context.tables) {
      for (const column of table.columns) {
        if (upperSQL.includes(`"${column.name.toUpperCase()}"`) ||
            upperSQL.includes(column.name.toUpperCase())) {
          usedColumns.push(column.name);
        }
      }
    }
    
    return [...new Set(usedColumns)]; // Remove duplicates
  }

  private addOptimizationSuggestions(result: SQLGenerationResult, options: SQLGenerationOptions): void {
    // Add performance and style suggestions
    const suggestions: string[] = [];
    
    // Check for SELECT *
    if (result.sql.includes('SELECT *')) {
      suggestions.push('Consider selecting specific columns instead of * for better performance');
    }
    
    // Check for missing WHERE clause on large tables
    const usedTable = result.usedTables[0];
    // You could check table size here and suggest filters
    
    // Check for complex aggregations
    if (result.sql.toUpperCase().includes('GROUP BY') && !result.sql.toUpperCase().includes('LIMIT')) {
      suggestions.push('Consider adding LIMIT to aggregation queries for faster results');
    }
    
    result.suggestions = suggestions;
  }

  private generateFallbackSQL(options: SQLGenerationOptions, generationTime: number): SQLGenerationResult {
    // Ultimate fallback - basic SELECT
    return {
      sql: 'SELECT * FROM "table" LIMIT 100',
      explanation: 'Fallback query due to generation failure',
      confidence: 0.3,
      approach: 'template',
      usedTables: [],
      usedColumns: [],
      estimatedComplexity: 'simple',
      warnings: ['SQL generation failed, using basic fallback query'],
      suggestions: ['Try rephrasing your query or check if your data is loaded correctly'],
      generationTime
    };
  }

  private buildCacheKey(options: SQLGenerationOptions): string {
    return `${options.intent}-${options.userQuery}-${JSON.stringify(options.entities)}`;
  }

  /**
   * Clear generation cache
   */
  clearCache(): void {
    this.generationCache.clear();
    console.log('[SQLGenerator] Cache cleared');
  }
}

/**
 * Singleton instance for easy access
 */
export const contextAwareSQLGenerator = ContextAwareSQLGenerator.getInstance();