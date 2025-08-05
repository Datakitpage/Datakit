import { useState, useEffect, useCallback } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { usePythonStore } from '@/store/pythonStore';
import { getPythonVariables } from '@/lib/python/executor';

export interface DuckDBTable {
  name: string;
  schema: Array<{ name: string; type: string }>;
  rowCount?: number;
  objectType: 'table' | 'view';
}

export interface PythonVariable {
  name: string;
  type: string;
  shape?: number[];
  columns?: string[];
  length?: number;
  value?: string;
  dtype?: string;
}

export interface NotebookContext {
  tables: DuckDBTable[];
  variables: PythonVariable[];
  selectedTables: Set<string>;
  selectedVariables: Set<string>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface ContextSummary {
  tableCount: number;
  variableCount: number;
  availableDataFrames: string[];
  availableTables: string[];
  contextDescription: string;
}

/**
 * Hook for detecting and managing notebook context (tables, variables, etc.)
 * This provides AI with contextual information about the user's data and environment
 */
export const useNotebookContext = () => {
  const [context, setContext] = useState<NotebookContext>({
    tables: [],
    variables: [],
    selectedTables: new Set(),
    selectedVariables: new Set(),
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  const { 
    isInitialized: isDuckDBInitialized, 
    getAvailableTables, 
    getTableSchema,
    getObjectType,
    registeredTables 
  } = useDuckDBStore();

  const { 
    pyodide: { isInitialized: isPyodideInitialized },
    globalVariables 
  } = usePythonStore();

  // Detect DuckDB tables and their schemas
  const detectTables = useCallback(async (): Promise<DuckDBTable[]> => {
    if (!isDuckDBInitialized) {
      return [];
    }

    try {
      const tableNames = getAvailableTables();
      const tables: DuckDBTable[] = [];

      for (const tableName of tableNames) {
        try {
          const [schema, objectType] = await Promise.all([
            getTableSchema(tableName),
            getObjectType(tableName),
          ]);

          if (schema && objectType) {
            tables.push({
              name: tableName,
              schema,
              objectType,
            });
          }
        } catch (error) {
          console.warn(`Failed to get schema for table ${tableName}:`, error);
        }
      }

      return tables;
    } catch (error) {
      console.error('Failed to detect tables:', error);
      throw error;
    }
  }, [isDuckDBInitialized, getAvailableTables, getTableSchema, getObjectType]);

  // Detect Python variables
  const detectVariables = useCallback(async (): Promise<PythonVariable[]> => {
    if (!isPyodideInitialized) {
      return [];
    }

    try {
      const variables = await getPythonVariables();
      return Object.entries(variables).map(([name, info]) => ({
        name,
        type: info.type,
        shape: info.shape,
        columns: info.columns,
        length: info.length,
        value: info.value,
        dtype: info.dtype,
      }));
    } catch (error) {
      console.error('Failed to detect variables:', error);
      throw error;
    }
  }, [isPyodideInitialized]);

  // Refresh context by detecting both tables and variables
  const refreshContext = useCallback(async () => {
    setContext(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [tables, variables] = await Promise.all([
        detectTables(),
        detectVariables(),
      ]);

      setContext(prev => ({
        tables,
        variables,
        // Auto-select new tables and variables, keep existing selections
        selectedTables: new Set([
          ...Array.from(prev.selectedTables).filter(name => tables.some(t => t.name === name)),
          ...tables.filter(t => !prev.selectedTables.has(t.name)).map(t => t.name)
        ]),
        selectedVariables: new Set([
          ...Array.from(prev.selectedVariables).filter(name => variables.some(v => v.name === name)),
          ...variables.filter(v => !prev.selectedVariables.has(v.name)).map(v => v.name)
        ]),
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setContext(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [detectTables, detectVariables]);

  // Auto-refresh context when environments are ready
  useEffect(() => {
    if (isDuckDBInitialized || isPyodideInitialized) {
      refreshContext();
    }
  }, [isDuckDBInitialized, isPyodideInitialized, refreshContext]);

  // Auto-refresh when DuckDB tables change
  useEffect(() => {
    if (isDuckDBInitialized && registeredTables.size > 0) {
      refreshContext();
    }
  }, [isDuckDBInitialized, registeredTables, refreshContext]);

  // Auto-refresh when Python variables change (debounced)
  useEffect(() => {
    if (isPyodideInitialized && Object.keys(globalVariables).length > 0) {
      const timeoutId = setTimeout(() => {
        refreshContext();
      }, 1000); // Debounce to avoid excessive refreshes

      return () => clearTimeout(timeoutId);
    }
  }, [isPyodideInitialized, globalVariables, refreshContext]);

  // Toggle table selection
  const toggleTableSelection = useCallback((tableName: string) => {
    setContext(prev => {
      const newSelectedTables = new Set(prev.selectedTables);
      if (newSelectedTables.has(tableName)) {
        newSelectedTables.delete(tableName);
      } else {
        newSelectedTables.add(tableName);
      }
      return { ...prev, selectedTables: newSelectedTables };
    });
  }, []);

  // Toggle variable selection
  const toggleVariableSelection = useCallback((variableName: string) => {
    setContext(prev => {
      const newSelectedVariables = new Set(prev.selectedVariables);
      if (newSelectedVariables.has(variableName)) {
        newSelectedVariables.delete(variableName);
      } else {
        newSelectedVariables.add(variableName);
      }
      return { ...prev, selectedVariables: newSelectedVariables };
    });
  }, []);

  // Select/deselect all tables
  const toggleAllTables = useCallback((selectAll: boolean) => {
    setContext(prev => ({
      ...prev,
      selectedTables: selectAll ? new Set(prev.tables.map(t => t.name)) : new Set(),
    }));
  }, []);

  // Select/deselect all variables
  const toggleAllVariables = useCallback((selectAll: boolean) => {
    setContext(prev => ({
      ...prev,
      selectedVariables: selectAll ? new Set(prev.variables.map(v => v.name)) : new Set(),
    }));
  }, []);

  // Generate context summary for AI (only selected items)
  const getContextSummary = useCallback((): ContextSummary => {
    const { tables, variables, selectedTables, selectedVariables } = context;
    
    const selectedTablesList = tables.filter(t => selectedTables.has(t.name));
    const selectedVariablesList = variables.filter(v => selectedVariables.has(v.name));
    
    const availableDataFrames = selectedVariablesList
      .filter(v => v.type === 'DataFrame')
      .map(v => v.name);
    
    const availableTables = selectedTablesList.map(t => t.name);
    
    let contextDescription = '';
    
    if (selectedTablesList.length > 0) {
      contextDescription += `Available DuckDB tables: ${selectedTablesList.map(t => 
        `${t.name} (${t.schema.length} columns: ${t.schema.map(c => `${c.name}:${c.type}`).join(', ')})`
      ).join('; ')}. `;
    }
    
    if (availableDataFrames.length > 0) {
      contextDescription += `Available DataFrames: ${selectedVariablesList
        .filter(v => v.type === 'DataFrame')
        .map(v => `${v.name} (${v.shape?.[0]}x${v.shape?.[1]}, columns: ${v.columns?.join(', ')})`)
        .join('; ')}. `;
    }
    
    const otherVariables = selectedVariablesList.filter(v => v.type !== 'DataFrame');
    if (otherVariables.length > 0) {
      contextDescription += `Other variables: ${otherVariables
        .map(v => `${v.name} (${v.type})`)
        .join(', ')}. `;
    }

    return {
      tableCount: selectedTablesList.length,
      variableCount: selectedVariablesList.length,
      availableDataFrames,
      availableTables,
      contextDescription: contextDescription.trim(),
    };
  }, [context]);

  // Generate formatted context for AI prompts (only selected items)
  const getAIContext = useCallback(() => {
    const summary = getContextSummary();
    
    if (summary.tableCount === 0 && summary.variableCount === 0) {
      return {
        hasContext: false,
        contextText: 'No data tables or variables selected for context.',
        tables: [],
        variables: [],
      };
    }

    let contextText = 'Selected notebook context:\n\n';
    
    const selectedTables = context.tables.filter(t => context.selectedTables.has(t.name));
    const selectedVariables = context.variables.filter(v => context.selectedVariables.has(v.name));
    
    if (selectedTables.length > 0) {
      contextText += 'DuckDB Tables:\n';
      selectedTables.forEach(table => {
        contextText += `- ${table.name} (${table.objectType}): ${table.schema.length} columns\n`;
        table.schema.forEach(col => {
          contextText += `  * ${col.name}: ${col.type}\n`;
        });
      });
      contextText += '\n';
    }
    
    if (selectedVariables.length > 0) {
      contextText += 'Python Variables:\n';
      selectedVariables.forEach(variable => {
        let varDesc = `- ${variable.name}: ${variable.type}`;
        if (variable.shape) {
          varDesc += ` (shape: ${variable.shape.join('x')})`;
        }
        if (variable.columns) {
          varDesc += ` (columns: ${variable.columns.join(', ')})`;
        }
        if (variable.length !== undefined) {
          varDesc += ` (length: ${variable.length})`;
        }
        if (variable.value) {
          varDesc += ` (value: ${variable.value})`;
        }
        contextText += varDesc + '\n';
      });
    }

    return {
      hasContext: true,
      contextText,
      tables: selectedTables,
      variables: selectedVariables,
      summary,
    };
  }, [context, getContextSummary]);

  return {
    context,
    refreshContext,
    getContextSummary,
    getAIContext,
    toggleTableSelection,
    toggleVariableSelection,
    toggleAllTables,
    toggleAllVariables,
    isReady: isDuckDBInitialized || isPyodideInitialized,
  };
};

export default useNotebookContext;