// hooks/ai/useEnhancedText2SQL.ts
import { useState, useCallback, useRef } from 'react';
import { enhancedIntentClassifier, EnhancedIntentResult } from '@/lib/ai/enhancedIntentClassifier';
import { contextAwareSQLGenerator, SQLGenerationResult } from '@/lib/ai/contextAwareSQLGenerator';
import { schemaContextBuilder } from '@/lib/ai/schemaContextBuilder';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';

export interface Text2SQLResult {
  query: string;
  sql: string;
  explanation: string;
  confidence: number;
  approach: 'pattern' | 'small_model' | 'large_model' | 'template';
  usedTables: string[];
  usedColumns: string[];
  complexity: 'simple' | 'medium' | 'complex';
  processingTime: number;
  warnings: string[];
  suggestions: string[];
  canExecute: boolean;
  intentResult: EnhancedIntentResult;
  sqlResult: SQLGenerationResult;
}

export interface Text2SQLError {
  message: string;
  type: 'classification' | 'generation' | 'validation' | 'execution';
  suggestions?: string[];
}

export interface Text2SQLOptions {
  maxRows?: number;
  preferredApproach?: 'fast' | 'accurate' | 'auto';
  includeOptimizations?: boolean;
  executeImmediately?: boolean;
  useMLModels?: boolean;
}

/**
 * Enhanced Text-to-SQL Hook
 * Integrates schema-aware intent classification and SQL generation
 */
export const useEnhancedText2SQL = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<Text2SQLResult | null>(null);
  const [lastError, setLastError] = useState<Text2SQLError | null>(null);
  
  // Performance tracking
  const [processingStats, setProcessingStats] = useState({
    totalQueries: 0,
    successfulQueries: 0,
    averageProcessingTime: 0,
    complexityDistribution: { simple: 0, medium: 0, complex: 0 }
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { executeQuery } = useDuckDBStore();
  const { files, activeFileId } = useAppStore();

  /**
   * Process natural language query to SQL
   */
  const processQuery = useCallback(async (
    naturalLanguageQuery: string,
    options: Text2SQLOptions = {}
  ): Promise<Text2SQLResult> => {
    
    // Cancel any ongoing processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    const startTime = Date.now();
    setIsProcessing(true);
    setLastError(null);

    try {
      console.log(`[useEnhancedText2SQL] Processing query: "${naturalLanguageQuery}"`);

      // Validate input
      if (!naturalLanguageQuery.trim()) {
        throw new Error('Query cannot be empty');
      }

      // Check if we have data available
      if (files.length === 0) {
        throw {
          type: 'validation',
          message: 'No data available. Please upload a file first.',
          suggestions: ['Upload a CSV, JSON, or Parquet file to get started']
        } as Text2SQLError;
      }

      const opts: Text2SQLOptions = {
        maxRows: 100,
        preferredApproach: 'auto',
        includeOptimizations: true,
        executeImmediately: false,
        useMLModels: true,
        ...options
      };

      // Step 1: Enhanced Intent Classification
      console.log('[useEnhancedText2SQL] Step 1: Intent Classification');
      const intentResult = await enhancedIntentClassifier.classifyWithSchema(
        naturalLanguageQuery,
        {
          useMLModels: opts.useMLModels,
          includeSchemaContext: true,
          maxContextTables: 5
        }
      );

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Processing cancelled');
      }

      console.log(`[useEnhancedText2SQL] Intent: ${intentResult.intent}, Confidence: ${intentResult.confidence}`);

      // Step 2: Context-Aware SQL Generation
      console.log('[useEnhancedText2SQL] Step 2: SQL Generation');
      const sqlResult = await contextAwareSQLGenerator.generateSQL({
        intent: intentResult.intent,
        entities: intentResult.entities,
        userQuery: naturalLanguageQuery,
        maxRows: opts.maxRows,
        preferredApproach: opts.preferredApproach,
        includeOptimizations: opts.includeOptimizations
      });

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Processing cancelled');
      }

      const processingTime = Date.now() - startTime;
      console.log(`[useEnhancedText2SQL] Completed in ${processingTime}ms`);

      // Build comprehensive result
      const result: Text2SQLResult = {
        query: naturalLanguageQuery,
        sql: sqlResult.sql,
        explanation: sqlResult.explanation,
        confidence: Math.min(intentResult.confidence, sqlResult.confidence),
        approach: sqlResult.approach,
        usedTables: sqlResult.usedTables,
        usedColumns: sqlResult.usedColumns,
        complexity: sqlResult.estimatedComplexity,
        processingTime,
        warnings: [
          ...(intentResult.warnings || []),
          ...sqlResult.warnings
        ],
        suggestions: [
          ...(intentResult.suggestions || []),
          ...sqlResult.suggestions
        ],
        canExecute: sqlResult.sql.trim().length > 0 && sqlResult.confidence > 0.5,
        intentResult,
        sqlResult
      };

      // Update statistics
      updateProcessingStats(result);
      
      setLastResult(result);

      // Auto-execute if requested and safe
      if (opts.executeImmediately && result.canExecute && result.confidence > 0.7) {
        console.log('[useEnhancedText2SQL] Auto-executing generated SQL');
        try {
          await executeQuery(result.sql);
        } catch (executionError) {
          console.warn('[useEnhancedText2SQL] Auto-execution failed:', executionError);
          result.warnings.push('Auto-execution failed - please review the SQL before running manually');
        }
      }

      return result;

    } catch (error) {
      console.error('[useEnhancedText2SQL] Processing failed:', error);
      
      const text2SQLError: Text2SQLError = error as Text2SQLError;
      if (!text2SQLError.type) {
        text2SQLError.type = 'generation';
        text2SQLError.message = error instanceof Error ? error.message : String(error);
      }
      
      setLastError(text2SQLError);
      throw text2SQLError;
      
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [executeQuery, files]);

  /**
   * Execute the SQL from the last result
   */
  const executeLastSQL = useCallback(async (): Promise<void> => {
    if (!lastResult || !lastResult.canExecute) {
      throw new Error('No executable SQL available');
    }

    try {
      console.log(`[useEnhancedText2SQL] Executing: ${lastResult.sql}`);
      await executeQuery(lastResult.sql);
    } catch (error) {
      console.error('[useEnhancedText2SQL] SQL execution failed:', error);
      throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [lastResult, executeQuery]);

  /**
   * Validate SQL before execution
   */
  const validateSQL = useCallback(async (sql: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> => {
    try {
      // Use DuckDB's EXPLAIN to validate syntax
      const explainResult = await executeQuery(`EXPLAIN ${sql}`);
      
      return {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        isValid: false,
        errors: [errorMessage],
        warnings: [],
        suggestions: ['Check table and column names', 'Verify SQL syntax']
      };
    }
  }, [executeQuery]);

  /**
   * Get context about available data for help
   */
  const getDataContext = useCallback(async () => {
    try {
      const context = await schemaContextBuilder.buildFullContext({
        includeSampleData: true,
        maxSamplesPerColumn: 3
      });

      return {
        tables: context.tables.map(table => ({
          name: table.name,
          rowCount: table.rowCount,
          columns: table.columns.map(col => ({
            name: col.name,
            type: col.type,
            sampleValues: col.sampleValues?.slice(0, 2)
          }))
        })),
        summary: schemaContextBuilder.generateContextSummary(context)
      };
    } catch (error) {
      console.error('[useEnhancedText2SQL] Failed to get data context:', error);
      return null;
    }
  }, []);

  /**
   * Update processing statistics
   */
  const updateProcessingStats = useCallback((result: Text2SQLResult) => {
    setProcessingStats(prev => {
      const newStats = {
        totalQueries: prev.totalQueries + 1,
        successfulQueries: prev.successfulQueries + (result.canExecute ? 1 : 0),
        averageProcessingTime: (
          (prev.averageProcessingTime * prev.totalQueries + result.processingTime) / 
          (prev.totalQueries + 1)
        ),
        complexityDistribution: {
          ...prev.complexityDistribution,
          [result.complexity]: prev.complexityDistribution[result.complexity] + 1
        }
      };
      
      return newStats;
    });
  }, []);

  /**
   * Cancel ongoing processing
   */
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  }, []);

  /**
   * Clear cache and reset state
   */
  const resetState = useCallback(() => {
    setLastResult(null);
    setLastError(null);
    setProcessingStats({
      totalQueries: 0,
      successfulQueries: 0,
      averageProcessingTime: 0,
      complexityDistribution: { simple: 0, medium: 0, complex: 0 }
    });
    
    // Clear AI caches
    enhancedIntentClassifier.clearCache();
    contextAwareSQLGenerator.clearCache();
    schemaContextBuilder.clearCache();
  }, []);

  /**
   * Get example queries based on current data
   */
  const getExampleQueries = useCallback(async (): Promise<string[]> => {
    try {
      const context = await schemaContextBuilder.buildFullContext();
      const examples: string[] = [];

      if (context.tables.length > 0) {
        const table = context.tables[0];
        
        // Basic examples
        examples.push(`Show me data from ${table.name}`);
        
        if (table.columns.length > 0) {
          const firstCol = table.columns[0].name;
          examples.push(`Count records by ${firstCol}`);
          
          // Find numeric column for aggregation examples
          const numericCol = table.columns.find(col => col.isNumeric);
          if (numericCol) {
            examples.push(`Average ${numericCol.name} by ${firstCol}`);
            examples.push(`Show top 10 highest ${numericCol.name}`);
          }
          
          // Find categorical column for grouping
          const categoricalCol = table.columns.find(col => col.isCategorical);
          if (categoricalCol && numericCol) {
            examples.push(`Create a chart of ${numericCol.name} by ${categoricalCol.name}`);
          }
        }
        
        // Time-based examples if date columns exist
        const dateCol = table.columns.find(col => col.isDate);
        if (dateCol) {
          examples.push(`Show trends over ${dateCol.name}`);
          examples.push(`Filter data from last month`);
        }
      }

      return examples.slice(0, 6); // Limit to 6 examples
    } catch (error) {
      console.error('[useEnhancedText2SQL] Failed to generate examples:', error);
      return [
        'Show me the data',
        'Count records by category',
        'Create a chart',
        'Find patterns in the data'
      ];
    }
  }, []);

  return {
    // Main functions
    processQuery,
    executeLastSQL,
    validateSQL,
    getDataContext,
    getExampleQueries,
    
    // State
    isProcessing,
    lastResult,
    lastError,
    processingStats,
    
    // Utilities
    cancelProcessing,
    resetState,
    
    // Computed values
    hasAvailableData: files.length > 0,
    canProcess: files.length > 0 && !isProcessing
  };
};

export default useEnhancedText2SQL;