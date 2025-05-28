// lib/ai/enhancedIntentClassifier.ts
import { QueryIntent, IntentResult, EntityExtraction, IntentClassifier } from './intentClassifier';
import { SchemaContext, schemaContextBuilder } from './schemaContextBuilder';
import { modelManager, shouldUseAdvancedModel } from './modelManager';

export interface EnhancedIntentResult extends IntentResult {
  schemaContext?: SchemaContext;
  resolvedColumns: string[];
  resolvedTables: string[];
  columnConfidence: Record<string, number>;
  complexity: 'simple' | 'medium' | 'complex';
  modelUsed: 'pattern' | 'small_model' | 'large_model';
  processingTime: number;
  suggestions?: string[];
  warnings?: string[];
}

export interface SchemaAwareEntity extends EntityExtraction {
  resolvedColumns: Array<{
    original: string;
    resolved: string;
    table: string;
    confidence: number;
    type: string;
  }>;
  contextualValues: Array<{
    value: string;
    suggestedColumn: string;
    table: string;
    matchType: 'exact' | 'fuzzy' | 'semantic';
  }>;
}

/**
 * Enhanced Intent Classifier with Schema Integration
 * Uses rich schema context for better entity resolution and intent classification
 */
export class EnhancedIntentClassifier {
  private static instance: EnhancedIntentClassifier;
  private basicClassifier: IntentClassifier;
  private classificationCache = new Map<string, EnhancedIntentResult>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  static getInstance(): EnhancedIntentClassifier {
    if (!EnhancedIntentClassifier.instance) {
      EnhancedIntentClassifier.instance = new EnhancedIntentClassifier();
    }
    return EnhancedIntentClassifier.instance;
  }

  constructor() {
    this.basicClassifier = new IntentClassifier();
  }

  /**
   * Enhanced intent classification with schema awareness
   */
  async classifyWithSchema(
    query: string,
    options?: {
      useMLModels?: boolean;
      includeSchemaContext?: boolean;
      maxContextTables?: number;
    }
  ): Promise<EnhancedIntentResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[EnhancedIntentClassifier] Processing: "${query}"`);
      
      const opts = {
        useMLModels: true,
        includeSchemaContext: true,
        maxContextTables: 5,
        ...options
      };

      // Check cache first
      const cacheKey = `${query}-${JSON.stringify(opts)}`;
      const cached = this.classificationCache.get(cacheKey);
      if (cached && (Date.now() - cached.processingTime) < this.CACHE_TTL) {
        console.log('[EnhancedIntentClassifier] Using cached result');
        return cached;
      }

      // Build schema context if requested
      let schemaContext: SchemaContext | undefined;
      if (opts.includeSchemaContext) {
        schemaContext = await schemaContextBuilder.buildFullContext({
          includeSampleData: true,
          maxSamplesPerColumn: 3,
          detectRelationships: false
        });
        
        // Limit to most relevant tables to keep context manageable
        if (schemaContext.tables.length > opts.maxContextTables) {
          const relevantTables = await this.findMostRelevantTables(query, schemaContext, opts.maxContextTables);
          schemaContext = await schemaContextBuilder.buildContextForTables(
            relevantTables,
            { includeSampleData: true, maxSamplesPerColumn: 3 }
          );
        }
      }

      // Start with basic classification as foundation
      const basicResult = this.basicClassifier.classifyIntent(
        query, 
        schemaContext?.tables.flatMap(t => t.columns.map(c => c.name)) || []
      );

      // Enhance entity extraction with schema awareness
      const enhancedEntities = await this.enhanceEntityExtraction(
        query, 
        basicResult.entities, 
        schemaContext
      );

      // Determine if we should use ML models
      const shouldUseML = opts.useMLModels && shouldUseAdvancedModel(query);
      const modelUsed = shouldUseML ? 
        (this.assessQueryComplexity(query, enhancedEntities) === 'complex' ? 'large_model' : 'small_model') : 
        'pattern';

      // Enhance intent classification with ML if appropriate
      let enhancedIntent = basicResult.intent;
      let enhancedConfidence = basicResult.confidence;

      if (shouldUseML && schemaContext) {
        try {
          const mlResult = await this.classifyWithML(query, enhancedEntities, schemaContext, modelUsed);
          enhancedIntent = mlResult.intent;
          enhancedConfidence = Math.max(mlResult.confidence, basicResult.confidence);
        } catch (error) {
          console.warn('[EnhancedIntentClassifier] ML classification failed, using basic result:', error);
        }
      }

      // Resolve columns and tables
      const resolvedColumns = enhancedEntities.resolvedColumns.map(rc => rc.resolved);
      const resolvedTables = [...new Set(enhancedEntities.resolvedColumns.map(rc => rc.table))];

      // Build column confidence map
      const columnConfidence = enhancedEntities.resolvedColumns.reduce((acc, rc) => {
        acc[rc.resolved] = rc.confidence;
        return acc;
      }, {} as Record<string, number>);

      // Assess complexity
      const complexity = this.assessQueryComplexity(query, enhancedEntities);

      // Generate suggestions and warnings
      const suggestions = this.generateSuggestions(query, enhancedEntities, schemaContext);
      const warnings = this.generateWarnings(query, enhancedEntities, schemaContext);

      const result: EnhancedIntentResult = {
        intent: enhancedIntent,
        confidence: enhancedConfidence,
        entities: enhancedEntities,
        suggestedAction: this.generateEnhancedSuggestedAction(enhancedIntent, enhancedEntities),
        parameters: this.extractEnhancedParameters(enhancedIntent, enhancedEntities),
        schemaContext,
        resolvedColumns,
        resolvedTables,
        columnConfidence,
        complexity,
        modelUsed,
        processingTime: Date.now(),
        suggestions,
        warnings
      };

      // Cache the result
      this.classificationCache.set(cacheKey, result);

      const processingTime = Date.now() - startTime;
      console.log(`[EnhancedIntentClassifier] Completed in ${processingTime}ms using ${modelUsed} approach`);
      
      return result;

    } catch (error) {
      console.error('[EnhancedIntentClassifier] Error in enhanced classification:', error);
      
      // Fallback to basic classification
      const fallbackResult = this.basicClassifier.classifyIntent(query, []);
      return {
        ...fallbackResult,
        schemaContext: undefined,
        resolvedColumns: [],
        resolvedTables: [],
        columnConfidence: {},
        complexity: 'simple',
        modelUsed: 'pattern',
        processingTime: Date.now(),
        warnings: ['Enhanced classification failed, using basic pattern matching']
      };
    }
  }

  /**
   * Find the most relevant tables for the query
   */
  private async findMostRelevantTables(
    query: string, 
    context: SchemaContext, 
    maxTables: number
  ): Promise<string[]> {
    const queryLower = query.toLowerCase();
    const relevantTables: { name: string; score: number }[] = [];

    for (const table of context.tables) {
      let score = 0;

      // Direct table name mention
      if (queryLower.includes(table.name.toLowerCase())) {
        score += 10;
      }

      // Column name matches
      for (const column of table.columns) {
        if (queryLower.includes(column.name.toLowerCase())) {
          score += 5;
        }
        
        // Semantic matches
        if (this.hasSemanticMatch(column.name, queryLower)) {
          score += 2;
        }
      }

      // Sample data matches
      if (table.sampleData) {
        for (const row of table.sampleData) {
          for (const value of Object.values(row)) {
            if (queryLower.includes(String(value).toLowerCase())) {
              score += 1;
            }
          }
        }
      }

      if (score > 0) {
        relevantTables.push({ name: table.name, score });
      }
    }

    // If no tables scored, return the first few tables
    if (relevantTables.length === 0) {
      return context.tables.slice(0, maxTables).map(t => t.name);
    }

    return relevantTables
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTables)
      .map(t => t.name);
  }

  /**
   * Enhanced entity extraction using schema context
   */
  private async enhanceEntityExtraction(
    query: string,
    basicEntities: EntityExtraction,
    schemaContext?: SchemaContext
  ): Promise<SchemaAwareEntity> {
    
    // Start with basic entities
    const enhanced: SchemaAwareEntity = {
      ...basicEntities,
      resolvedColumns: [],
      contextualValues: []
    };

    if (!schemaContext) {
      return enhanced;
    }

    // Enhanced column resolution
    enhanced.resolvedColumns = await this.resolveColumnsWithSchema(
      basicEntities.columns, 
      query, 
      schemaContext
    );

    // Enhanced value resolution with context
    enhanced.contextualValues = await this.resolveValuesWithSchema(
      basicEntities.values,
      query,
      schemaContext
    );

    // Update the basic entities with resolved information
    enhanced.columns = enhanced.resolvedColumns.map(rc => rc.resolved);

    return enhanced;
  }

  /**
   * Resolve column names using schema context
   */
  private async resolveColumnsWithSchema(
    entityColumns: string[],
    query: string,
    context: SchemaContext
  ): Promise<Array<{
    original: string;
    resolved: string;
    table: string;
    confidence: number;
    type: string;
  }>> {
    
    const resolved: Array<{
      original: string;
      resolved: string;
      table: string;
      confidence: number;
      type: string;
    }> = [];

    // Also extract potential column names directly from the query
    const potentialColumns = this.extractPotentialColumnNames(query);
    const allEntityColumns = [...new Set([...entityColumns, ...potentialColumns])];

    for (const entityCol of allEntityColumns) {
      const matches = this.findColumnMatches(entityCol, context);
      
      if (matches.length > 0) {
        // Take the best match
        const bestMatch = matches[0];
        resolved.push({
          original: entityCol,
          resolved: bestMatch.column.name,
          table: bestMatch.table,
          confidence: bestMatch.confidence,
          type: bestMatch.column.type
        });
      }
    }

    return resolved;
  }

  /**
   * Extract potential column names from query text
   */
  private extractPotentialColumnNames(query: string): string[] {
    const potentialColumns: string[] = [];
    const words = query.toLowerCase().split(/\s+/);
    
    // Look for common column name patterns
    const columnKeywords = [
      'name', 'id', 'date', 'time', 'price', 'cost', 'amount', 'value',
      'sales', 'revenue', 'category', 'type', 'status', 'count', 'total',
      'description', 'title', 'email', 'phone', 'address', 'city', 'state'
    ];

    for (const word of words) {
      if (columnKeywords.includes(word)) {
        potentialColumns.push(word);
      }
      
      // Look for compound words that might be column names
      if (word.includes('_') || /[A-Z]/.test(word)) {
        potentialColumns.push(word);
      }
    }

    return potentialColumns;
  }

  /**
   * Find column matches with confidence scoring
   */
  private findColumnMatches(
    entityColumn: string,
    context: SchemaContext
  ): Array<{
    column: { name: string; type: string };
    table: string;
    confidence: number;
    matchType: 'exact' | 'fuzzy' | 'semantic';
  }> {
    
    const matches: Array<{
      column: { name: string; type: string };
      table: string;
      confidence: number;
      matchType: 'exact' | 'fuzzy' | 'semantic';
    }> = [];

    const entityLower = entityColumn.toLowerCase();

    for (const table of context.tables) {
      for (const column of table.columns) {
        const columnLower = column.name.toLowerCase();

        // Exact match
        if (columnLower === entityLower) {
          matches.push({
            column,
            table: table.name,
            confidence: 1.0,
            matchType: 'exact'
          });
          continue;
        }

        // Fuzzy match (contains)
        if (columnLower.includes(entityLower) || entityLower.includes(columnLower)) {
          const confidence = Math.max(
            entityLower.length / columnLower.length,
            columnLower.length / entityLower.length
          ) * 0.8;
          
          matches.push({
            column,
            table: table.name,
            confidence,
            matchType: 'fuzzy'
          });
          continue;
        }

        // Semantic match
        if (this.hasSemanticMatch(column.name, entityColumn)) {
          matches.push({
            column,
            table: table.name,
            confidence: 0.6,
            matchType: 'semantic'
          });
        }
      }
    }

    // Sort by confidence
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Resolve values using schema context
   */
  private async resolveValuesWithSchema(
    entityValues: string[],
    query: string,
    context: SchemaContext
  ): Promise<Array<{
    value: string;
    suggestedColumn: string;
    table: string;
    matchType: 'exact' | 'fuzzy' | 'semantic';
  }>> {
    
    const resolved: Array<{
      value: string;
      suggestedColumn: string;
      table: string;
      matchType: 'exact' | 'fuzzy' | 'semantic';
    }> = [];

    for (const value of entityValues) {
      const matches = this.findValueMatches(value, context);
      if (matches.length > 0) {
        resolved.push(matches[0]); // Take best match
      }
    }

    return resolved;
  }

  /**
   * Find which columns might contain specific values
   */
  private findValueMatches(
    value: string,
    context: SchemaContext
  ): Array<{
    value: string;
    suggestedColumn: string;
    table: string;
    matchType: 'exact' | 'fuzzy' | 'semantic';
  }> {
    
    const matches: Array<{
      value: string;
      suggestedColumn: string;
      table: string;
      matchType: 'exact' | 'fuzzy' | 'semantic';
    }> = [];

    for (const table of context.tables) {
      for (const column of table.columns) {
        if (column.sampleValues) {
          for (const sampleValue of column.sampleValues) {
            if (String(sampleValue).toLowerCase() === value.toLowerCase()) {
              matches.push({
                value,
                suggestedColumn: column.name,
                table: table.name,
                matchType: 'exact'
              });
            } else if (String(sampleValue).toLowerCase().includes(value.toLowerCase())) {
              matches.push({
                value,
                suggestedColumn: column.name,
                table: table.name,
                matchType: 'fuzzy'
              });
            }
          }
        }
      }
    }

    return matches;
  }

  /**
   * Check for semantic matches between column names and query terms
   */
  private hasSemanticMatch(columnName: string, queryTerm: string): boolean {
    const column = columnName.toLowerCase();
    const term = queryTerm.toLowerCase();
    
    // Semantic mapping for common database column patterns
    const semanticMaps: Record<string, string[]> = {
      'sales': ['revenue', 'income', 'earnings', 'money', 'profit'],
      'date': ['time', 'when', 'created', 'updated', 'timestamp'],
      'name': ['title', 'label', 'description', 'called', 'named'],
      'price': ['cost', 'amount', 'value', 'expense', 'fee'],
      'category': ['type', 'group', 'class', 'kind', 'genre'],
      'quantity': ['count', 'number', 'amount', 'total', 'sum'],
      'status': ['state', 'condition', 'phase', 'stage'],
      'location': ['place', 'address', 'city', 'region', 'area']
    };

    // Check if column matches any semantic pattern
    for (const [key, synonyms] of Object.entries(semanticMaps)) {
      if (column.includes(key) && synonyms.some(syn => term.includes(syn))) {
        return true;
      }
      if (synonyms.includes(column) && term.includes(key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Use ML models for intent classification
   */
  private async classifyWithML(
    query: string,
    entities: SchemaAwareEntity,
    context: SchemaContext,
    modelType: 'small_model' | 'large_model'
  ): Promise<{ intent: QueryIntent; confidence: number }> {
    
    try {
      const modelId = modelType === 'small_model' ? 'intent-classifier' : 'text2sql-base';
      const model = await modelManager.loadModel(modelId);

      // Build enhanced prompt with schema context
      const prompt = this.buildMLPrompt(query, entities, context);
      
      // For intent classification, we might use a different approach
      // For now, use the basic classifier with enhanced entities
      const result = this.basicClassifier.classifyIntent(query, entities.columns);
      
      // Boost confidence if we have good column resolution
      const avgColumnConfidence = entities.resolvedColumns.length > 0 
        ? entities.resolvedColumns.reduce((sum, rc) => sum + rc.confidence, 0) / entities.resolvedColumns.length
        : 0;
      
      const enhancedConfidence = Math.min(result.confidence + (avgColumnConfidence * 0.2), 1.0);
      
      return {
        intent: result.intent,
        confidence: enhancedConfidence
      };

    } catch (error) {
      console.error('[EnhancedIntentClassifier] ML classification failed:', error);
      throw error;
    }
  }

  /**
   * Build ML prompt with rich context
   */
  private buildMLPrompt(
    query: string,
    entities: SchemaAwareEntity,
    context: SchemaContext
  ): string {
    let prompt = `Classify the intent of this database query:\n\nQuery: "${query}"\n\n`;
    
    prompt += `Available tables and columns:\n`;
    for (const table of context.tables) {
      prompt += `${table.name}: ${table.columns.map(c => c.name).join(', ')}\n`;
    }
    
    if (entities.resolvedColumns.length > 0) {
      prompt += `\nDetected columns: ${entities.resolvedColumns.map(rc => `${rc.resolved} (${rc.table})`).join(', ')}\n`;
    }
    
    prompt += `\nClassify as one of: show_data, filter_data, aggregate_data, create_chart, find_correlations, sort_data, count_data, time_analysis, compare_groups, explain_data, detect_outliers, get_help, unknown\n`;
    
    return prompt;
  }

  /**
   * Assess query complexity based on enhanced entities
   */
  private assessQueryComplexity(query: string, entities: SchemaAwareEntity): 'simple' | 'medium' | 'complex' {
    let complexityScore = 0;

    // Query length
    if (query.length > 50) complexityScore += 1;
    if (query.length > 100) complexityScore += 2;

    // Entity complexity
    if (entities.resolvedColumns.length > 2) complexityScore += 1;
    if (entities.resolvedColumns.length > 4) complexityScore += 2;
    
    // Multiple tables involved
    const uniqueTables = new Set(entities.resolvedColumns.map(rc => rc.table));
    if (uniqueTables.size > 1) complexityScore += 3;

    // Operations complexity
    if (entities.operations.length > 1) complexityScore += 1;
    if (entities.aggregations.length > 1) complexityScore += 2;

    // Complex SQL keywords
    const complexKeywords = ['join', 'union', 'subquery', 'window', 'case', 'having'];
    const queryLower = query.toLowerCase();
    complexityScore += complexKeywords.filter(kw => queryLower.includes(kw)).length * 2;

    if (complexityScore >= 8) return 'complex';
    if (complexityScore >= 4) return 'medium';
    return 'simple';
  }

  /**
   * Generate enhanced suggested action
   */
  private generateEnhancedSuggestedAction(intent: QueryIntent, entities: SchemaAwareEntity): string {
    const resolvedColumns = entities.resolvedColumns.map(rc => rc.resolved).join(', ');
    const tables = [...new Set(entities.resolvedColumns.map(rc => rc.table))].join(', ');
    
    switch (intent) {
      case 'show_data':
        return resolvedColumns 
          ? `Show data from ${tables} focusing on: ${resolvedColumns}`
          : `Display data from available tables`;
        
      case 'create_chart':
        const chartType = entities.chartTypes[0] || 'appropriate';
        return resolvedColumns
          ? `Create a ${chartType} chart using ${resolvedColumns} from ${tables}`
          : `Create a ${chartType} chart from your data`;
        
      case 'aggregate_data':
        const agg = entities.aggregations[0] || 'aggregate';
        return resolvedColumns
          ? `${agg} ${resolvedColumns} from ${tables}`
          : `Aggregate data using ${agg}`;
        
      case 'filter_data':
        return resolvedColumns
          ? `Filter ${tables} by ${resolvedColumns}`
          : `Filter data based on specified criteria`;
        
      case 'find_correlations':
        return resolvedColumns
          ? `Find correlations between ${resolvedColumns} in ${tables}`
          : `Analyze correlations in your data`;
        
      default:
        return this.basicClassifier.classifyIntent('', []).suggestedAction;
    }
  }

  /**
   * Extract enhanced parameters
   */
  private extractEnhancedParameters(intent: QueryIntent, entities: SchemaAwareEntity): Record<string, any> {
    const params: Record<string, any> = {
      columns: entities.resolvedColumns.map(rc => rc.resolved),
      tables: [...new Set(entities.resolvedColumns.map(rc => rc.table))],
      operations: entities.operations,
      columnMapping: entities.resolvedColumns.reduce((acc, rc) => {
        acc[rc.original] = {
          resolved: rc.resolved,
          table: rc.table,
          confidence: rc.confidence,
          type: rc.type
        };
        return acc;
      }, {} as Record<string, any>)
    };

    // Intent-specific parameters
    switch (intent) {
      case 'create_chart':
        params.chartType = entities.chartTypes[0] || 'bar';
        params.xAxis = entities.resolvedColumns[0]?.resolved;
        params.yAxis = entities.resolvedColumns[1]?.resolved;
        break;
        
      case 'aggregate_data':
        params.aggregation = entities.aggregations[0] || 'count';
        params.groupBy = entities.resolvedColumns.find(rc => 
          rc.type.includes('VARCHAR') || rc.type.includes('TEXT')
        )?.resolved;
        break;
        
      case 'filter_data':
        params.filterColumn = entities.resolvedColumns[0]?.resolved;
        params.filterValue = entities.contextualValues[0]?.value;
        break;
    }

    return params;
  }

  /**
   * Generate helpful suggestions
   */
  private generateSuggestions(
    query: string,
    entities: SchemaAwareEntity,
    context?: SchemaContext
  ): string[] {
    const suggestions: string[] = [];

    // Suggest improvements based on entity resolution
    if (entities.columns.length > entities.resolvedColumns.length) {
      const unresolvedColumns = entities.columns.filter(col => 
        !entities.resolvedColumns.some(rc => rc.original === col)
      );
      if (unresolvedColumns.length > 0) {
        suggestions.push(`Consider using these column names instead: ${unresolvedColumns.join(', ')}`);
      }
    }

    // Suggest charts for appropriate data
    if (context && entities.resolvedColumns.length >= 2) {
      const hasNumeric = entities.resolvedColumns.some(rc => 
        rc.type.includes('INT') || rc.type.includes('DOUBLE') || rc.type.includes('FLOAT')
      );
      const hasCategorical = entities.resolvedColumns.some(rc => 
        rc.type.includes('VARCHAR') || rc.type.includes('TEXT')
      );
      
      if (hasNumeric && hasCategorical) {
        suggestions.push('This data would work well for a bar chart or scatter plot');
      }
    }

    // Suggest aggregations for large datasets
    if (context && context.tables.some(t => (t.rowCount || 0) > 1000)) {
      suggestions.push('Consider using aggregations (SUM, AVG, COUNT) for better performance with large datasets');
    }

    return suggestions;
  }

  /**
   * Generate warnings about potential issues
   */
  private generateWarnings(
    query: string,
    entities: SchemaAwareEntity,
    context?: SchemaContext
  ): string[] {
    const warnings: string[] = [];

    // Warn about low confidence column matches
    const lowConfidenceColumns = entities.resolvedColumns.filter(rc => rc.confidence < 0.7);
    if (lowConfidenceColumns.length > 0) {
      warnings.push(`Uncertain about these column names: ${lowConfidenceColumns.map(rc => rc.original).join(', ')}`);
    }

    // Warn about multiple table complexity
    const tables = new Set(entities.resolvedColumns.map(rc => rc.table));
    if (tables.size > 2) {
      warnings.push('Query involves multiple tables - may require JOIN operations');
    }

    // Warn about missing values
    if (entities.values.length > 0 && entities.contextualValues.length === 0) {
      warnings.push('Could not match specified values with available data');
    }

    return warnings;
  }

  /**
   * Clear classification cache
   */
  clearCache(): void {
    this.classificationCache.clear();
    console.log('[EnhancedIntentClassifier] Cache cleared');
  }
}

/**
 * Singleton instance for easy access
 */
export const enhancedIntentClassifier = EnhancedIntentClassifier.getInstance();