import { useState, useCallback } from 'react';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';
import { selectActiveFile } from '@/store/selectors/appSelectors';

interface AIResponse {
  content: string;
  suggestions?: string[];
  sqlQuery?: string;
  visualization?: {
    type: 'bar' | 'line' | 'scatter' | 'pie';
    config: any;
  };
}

interface AIContext {
  tableName?: string;
  tableSchema?: Array<{ name: string; type: string }>;
  recentQueries: string[];
  conversationHistory: Array<{ role: string; content: string }>;
  currentData?: any[];
}

export const useAIAssistant = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const activeFile = useAppStore(selectActiveFile);
  const { getTableSchema, executeQuery } = useDuckDBStore();
  
  // Generate SQL from natural language
  const generateSQL = useCallback(async (
    prompt: string, 
    context: AIContext
  ): Promise<string> => {
    // TODO: Integrate with actual AI service
    // For now, use pattern matching and templates
    
    const lowerPrompt = prompt.toLowerCase();
    const tableName = context.tableName || activeFile?.tableName || 'data';
    
    // Simple pattern matching for common queries
    if (lowerPrompt.includes('top') && lowerPrompt.includes('10')) {
      return `SELECT * FROM ${tableName} LIMIT 10`;
    }
    
    if (lowerPrompt.includes('count') || lowerPrompt.includes('how many')) {
      return `SELECT COUNT(*) as total_count FROM ${tableName}`;
    }
    
    if (lowerPrompt.includes('average') || lowerPrompt.includes('avg')) {
      const columns = context.tableSchema?.filter(col => 
        ['INTEGER', 'DOUBLE', 'FLOAT'].includes(col.type)
      );
      if (columns && columns.length > 0) {
        return `SELECT AVG(${columns[0].name}) as average FROM ${tableName}`;
      }
    }
    
    if (lowerPrompt.includes('group by')) {
      const match = prompt.match(/group by (\w+)/i);
      if (match) {
        return `SELECT ${match[1]}, COUNT(*) as count FROM ${tableName} GROUP BY ${match[1]} ORDER BY count DESC`;
      }
    }
    
    // Default fallback
    return `SELECT * FROM ${tableName} LIMIT 20`;
  }, [activeFile]);
  
  // Explain data patterns
  const explainData = useCallback(async (
    data: any[], 
    prompt: string
  ): Promise<string> => {
    // Simple data analysis
    if (!data || data.length === 0) {
      return "No data available to analyze.";
    }
    
    const rowCount = data.length;
    const columns = Object.keys(data[0] || {});
    
    // Basic statistics
    let explanation = `This dataset contains ${rowCount} rows and ${columns.length} columns.\n\n`;
    
    // Column analysis
    explanation += "Columns:\n";
    columns.forEach(col => {
      const values = data.map(row => row[col]);
      const uniqueCount = new Set(values).size;
      const nullCount = values.filter(v => v === null || v === undefined).length;
      
      explanation += `- **${col}**: ${uniqueCount} unique values`;
      if (nullCount > 0) {
        explanation += ` (${nullCount} nulls)`;
      }
      explanation += "\n";
    });
    
    return explanation;
  }, []);
  
  // Suggest next steps based on canvas content
  const suggestNextSteps = useCallback(async (
    canvasContent: string,
    context: AIContext
  ): Promise<string[]> => {
    const suggestions: string[] = [];
    
    // Analyze what user has done
    const hasQueries = canvasContent.includes('SELECT');
    const hasGroupBy = canvasContent.includes('GROUP BY');
    const hasWhere = canvasContent.includes('WHERE');
    
    if (!hasQueries) {
      suggestions.push("Start by exploring the first 10 rows of your data");
      suggestions.push("Check the total number of records");
      suggestions.push("View all column names and types");
    } else {
      if (!hasGroupBy) {
        suggestions.push("Try grouping by a categorical column to see distributions");
      }
      if (!hasWhere) {
        suggestions.push("Filter your data to focus on specific segments");
      }
      suggestions.push("Create a visualization of your results");
      suggestions.push("Export interesting findings");
    }
    
    return suggestions;
  }, []);
  
  // Main AI response function
  const getAIResponse = useCallback(async (
    prompt: string,
    context: AIContext
  ): Promise<AIResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const lowerPrompt = prompt.toLowerCase();
      
      // Determine intent
      if (lowerPrompt.includes('show') || lowerPrompt.includes('select') || 
          lowerPrompt.includes('find') || lowerPrompt.includes('get')) {
        // Generate SQL query
        const sql = await generateSQL(prompt, context);
        const suggestions = [
          "Run this query to see the results",
          "Modify the query to refine your search",
          "Visualize the results"
        ];
        
        return {
          content: `I'll help you explore that. Here's a SQL query:\n\n\`\`\`sql\n${sql}\n\`\`\``,
          sqlQuery: sql,
          suggestions,
        };
      }
      
      if (lowerPrompt.includes('explain') || lowerPrompt.includes('what')) {
        // Explain data
        const explanation = await explainData(context.currentData || [], prompt);
        return {
          content: explanation,
          suggestions: await suggestNextSteps('', context),
        };
      }
      
      if (lowerPrompt.includes('visualize') || lowerPrompt.includes('chart')) {
        // Suggest visualization
        return {
          content: "I can help you create a visualization. Based on your data, a bar chart would work well for categorical data, or a line chart for time series.",
          visualization: {
            type: 'bar',
            config: {
              xAxis: 'category',
              yAxis: 'value',
            }
          },
          suggestions: [
            "Choose a different chart type",
            "Customize the visualization",
            "Export the chart"
          ],
        };
      }
      
      // Default response
      const suggestions = await suggestNextSteps('', context);
      return {
        content: `I can help you explore your data. ${suggestions.length > 0 ? `Here are some suggestions:\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : 'Try asking me to show specific data or explain patterns.'}`,
        suggestions,
      };
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [generateSQL, explainData, suggestNextSteps]);
  
  // Build context from current state
  const buildContext = useCallback(async (): Promise<AIContext> => {
    const tableName = activeFile?.tableName;
    let tableSchema;
    
    if (tableName) {
      try {
        tableSchema = await getTableSchema(tableName);
      } catch {
        // Schema fetch failed
      }
    }
    
    return {
      tableName,
      tableSchema,
      recentQueries: [], // TODO: Get from canvas state
      conversationHistory: [], // TODO: Get from canvas state
    };
  }, [activeFile, getTableSchema]);
  
  return {
    isLoading,
    error,
    getAIResponse,
    generateSQL,
    explainData,
    suggestNextSteps,
    buildContext,
  };
};