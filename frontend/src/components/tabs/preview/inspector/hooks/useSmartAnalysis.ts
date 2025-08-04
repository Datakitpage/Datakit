import { useState, useEffect, useCallback } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';
import { selectActiveFile } from '@/store/selectors/appSelectors';
import { analyzeColumnSemantics, ColumnAnalysis } from '../utils/columnAnalyzer';
import { detectDataPatterns, DataPattern } from '../utils/patternDetection';
import { generateSmartSuggestions, SmartSuggestion, ColumnWithPattern } from '../utils/smartSuggestions';

interface UseSmartAnalysisResult {
  suggestions: SmartSuggestion[];
  isAnalyzing: boolean;
  error: string | null;
  columnAnalysis: ColumnWithPattern[];
  reanalyze: () => void;
}

export const useSmartAnalysis = (): UseSmartAnalysisResult => {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [columnAnalysis, setColumnAnalysis] = useState<ColumnWithPattern[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const activeFile = useAppStore(selectActiveFile);
  const { getTableSchema, executeQuery } = useDuckDBStore();
  
  const analyzeTable = useCallback(async () => {
    if (!activeFile?.tableName) {
      setSuggestions([]);
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      console.log('[SmartAnalysis] Starting analysis for table:', activeFile.tableName);
      
      // Get table schema
      const schema = await getTableSchema(activeFile.tableName);
      if (!schema || schema.length === 0) {
        throw new Error('No schema found for table');
      }
      
      console.log('[SmartAnalysis] Schema:', schema);
      
      // Analyze each column
      const columnsWithPatterns: ColumnWithPattern[] = await Promise.all(
        schema.map(async (col) => {
          try {
            // Semantic analysis using NLP
            const semanticAnalysis = analyzeColumnSemantics(col.name);
            
            // Sample data for pattern detection
            const sampleQuery = `
              SELECT "${col.name}" 
              FROM ${activeFile.tableName} 
              WHERE "${col.name}" IS NOT NULL 
              LIMIT 1000
            `;
            
            const sampleResult = await executeQuery(sampleQuery);
            // Convert DuckDB result to array format
            const data = sampleResult ? sampleResult.toArray().map(row => Object.fromEntries(row)) : [];
            const values = data.map(row => row[col.name]);
            
            // Pattern detection
            const patterns = await detectDataPatterns(values);
            
            return {
              analysis: semanticAnalysis,
              pattern: patterns,
              columnName: col.name,
              dataType: col.type,
            };
          } catch (err) {
            console.error(`[SmartAnalysis] Error analyzing column ${col.name}:`, err);
            // Return basic analysis on error
            return {
              analysis: analyzeColumnSemantics(col.name),
              pattern: {
                isNumeric: false,
                isCurrency: false,
                isPercentage: false,
                isInteger: false,
                isFloat: false,
                isDate: false,
                isEmail: false,
                isURL: false,
                isPhone: false,
                isBoolean: false,
                isCategory: false,
                uniqueCount: 0,
                uniqueRatio: 0,
                nullCount: 0,
                nullRatio: 0,
                sampleValues: [],
              },
              columnName: col.name,
              dataType: col.type,
            };
          }
        })
      );
      
      console.log('[SmartAnalysis] Column analysis complete:', columnsWithPatterns);
      setColumnAnalysis(columnsWithPatterns);
      
      // Generate smart suggestions
      const smartSuggestions = generateSmartSuggestions(
        columnsWithPatterns,
        activeFile.tableName
      );
      
      console.log('[SmartAnalysis] Generated suggestions:', smartSuggestions);
      setSuggestions(smartSuggestions);
      
    } catch (err) {
      console.error('[SmartAnalysis] Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setSuggestions([]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeFile, getTableSchema, executeQuery]);
  
  // Analyze when active file changes
  useEffect(() => {
    if (activeFile?.tableName) {
      analyzeTable();
    }
  }, [activeFile?.tableName, analyzeTable]);
  
  return {
    suggestions,
    isAnalyzing,
    error,
    columnAnalysis,
    reanalyze: analyzeTable,
  };
};