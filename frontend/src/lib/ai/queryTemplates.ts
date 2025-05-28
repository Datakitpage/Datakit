// lib/ai/queryTemplates.ts
import { QueryIntent } from './intentClassifier';

export interface QueryTemplate {
  id: string;
  intent: QueryIntent;
  name: string;
  description: string;
  template: string;
  examples: string[];
  parameters: TemplateParameter[];
  category: 'exploration' | 'analysis' | 'visualization' | 'filtering' | 'aggregation';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface TemplateParameter {
  name: string;
  type: 'column' | 'value' | 'aggregation' | 'condition';
  required: boolean;
  description: string;
  defaultValue?: string;
}

/**
 * Pre-defined query templates for common data analysis tasks
 */
export const QUERY_TEMPLATES: QueryTemplate[] = [
  // Data Exploration Templates
  {
    id: 'data_overview',
    intent: 'show_data',
    name: 'Data Overview',
    description: 'Get a quick overview of your dataset',
    template: 'SELECT * FROM "{tableName}" LIMIT {limit}',
    examples: [
      'Show me the data',
      'Display the dataset',
      'Let me see what we have'
    ],
    parameters: [
      { name: 'limit', type: 'value', required: false, description: 'Number of rows to show', defaultValue: '100' }
    ],
    category: 'exploration',
    difficulty: 'beginner',
    tags: ['overview', 'sample', 'explore']
  },

  {
    id: 'column_summary',
    intent: 'explain_data',
    name: 'Column Summary',
    description: 'Analyze the structure and content of specific columns',
    template: 'SELECT "{column}", COUNT(*) as count, COUNT(DISTINCT "{column}") as unique_values FROM "{tableName}" GROUP BY "{column}" ORDER BY count DESC LIMIT 20',
    examples: [
      'Analyze the category column',
      'Show me unique values in region',
      'What are the different types in status?'
    ],
    parameters: [
      { name: 'column', type: 'column', required: true, description: 'Column to analyze' }
    ],
    category: 'exploration',
    difficulty: 'beginner',
    tags: ['column', 'summary', 'unique']
  },

  // Filtering Templates
  {
    id: 'filter_by_value',
    intent: 'filter_data',
    name: 'Filter by Value',
    description: 'Show only records matching a specific condition',
    template: 'SELECT * FROM "{tableName}" WHERE "{column}" {operator} {value} LIMIT {limit}',
    examples: [
      'Show sales greater than 1000',
      'Filter by region = West',
      'Where price is less than 50'
    ],
    parameters: [
      { name: 'column', type: 'column', required: true, description: 'Column to filter by' },
      { name: 'operator', type: 'condition', required: true, description: 'Comparison operator', defaultValue: '=' },
      { name: 'value', type: 'value', required: true, description: 'Value to compare against' },
      { name: 'limit', type: 'value', required: false, description: 'Number of results', defaultValue: '100' }
    ],
    category: 'filtering',
    difficulty: 'beginner',
    tags: ['filter', 'where', 'condition']
  },

  {
    id: 'filter_date_range',
    intent: 'filter_data',
    name: 'Date Range Filter',
    description: 'Filter data within a specific date range',
    template: 'SELECT * FROM "{tableName}" WHERE "{dateColumn}" BETWEEN \'{startDate}\' AND \'{endDate}\' ORDER BY "{dateColumn}" DESC LIMIT {limit}',
    examples: [
      'Show data from last month',
      'Filter by date range',
      'Data between January and March'
    ],
    parameters: [
      { name: 'dateColumn', type: 'column', required: true, description: 'Date column to filter by' },
      { name: 'startDate', type: 'value', required: true, description: 'Start date (YYYY-MM-DD)' },
      { name: 'endDate', type: 'value', required: true, description: 'End date (YYYY-MM-DD)' },
      { name: 'limit', type: 'value', required: false, description: 'Number of results', defaultValue: '100' }
    ],
    category: 'filtering',
    difficulty: 'intermediate',
    tags: ['date', 'range', 'time', 'filter']
  },

  // Aggregation Templates
  {
    id: 'group_by_count',
    intent: 'aggregate_data',
    name: 'Count by Category',
    description: 'Count records grouped by a categorical column',
    template: 'SELECT "{groupColumn}", COUNT(*) as count FROM "{tableName}" GROUP BY "{groupColumn}" ORDER BY count DESC LIMIT {limit}',
    examples: [
      'Count by region',
      'How many per category?',
      'Group by department and count'
    ],
    parameters: [
      { name: 'groupColumn', type: 'column', required: true, description: 'Column to group by' },
      { name: 'limit', type: 'value', required: false, description: 'Number of groups to show', defaultValue: '20' }
    ],
    category: 'aggregation',
    difficulty: 'beginner',
    tags: ['count', 'group by', 'aggregate']
  },

  {
    id: 'sum_by_category',
    intent: 'aggregate_data',
    name: 'Sum by Category',
    description: 'Sum numeric values grouped by categories',
    template: 'SELECT "{groupColumn}", SUM("{valueColumn}") as total_{valueColumn}, COUNT(*) as count FROM "{tableName}" GROUP BY "{groupColumn}" ORDER BY total_{valueColumn} DESC LIMIT {limit}',
    examples: [
      'Sum sales by region',
      'Total revenue per month',
      'Add up amounts by category'
    ],
    parameters: [
      { name: 'groupColumn', type: 'column', required: true, description: 'Column to group by' },
      { name: 'valueColumn', type: 'column', required: true, description: 'Numeric column to sum' },
      { name: 'limit', type: 'value', required: false, description: 'Number of groups to show', defaultValue: '20' }
    ],
    category: 'aggregation',
    difficulty: 'beginner',
    tags: ['sum', 'total', 'group by', 'aggregate']
  },

  {
    id: 'average_by_category',
    intent: 'aggregate_data',
    name: 'Average by Category',
    description: 'Calculate average values for different categories',
    template: 'SELECT "{groupColumn}", AVG("{valueColumn}") as avg_{valueColumn}, COUNT(*) as count FROM "{tableName}" GROUP BY "{groupColumn}" ORDER BY avg_{valueColumn} DESC LIMIT {limit}',
    examples: [
      'Average price by category',
      'Mean sales per region',
      'Calculate average scores by group'
    ],
    parameters: [
      { name: 'groupColumn', type: 'column', required: true, description: 'Column to group by' },
      { name: 'valueColumn', type: 'column', required: true, description: 'Numeric column to average' },
      { name: 'limit', type: 'value', required: false, description: 'Number of groups to show', defaultValue: '20' }
    ],
    category: 'aggregation',
    difficulty: 'beginner',
    tags: ['average', 'mean', 'group by', 'aggregate']
  },

  // Analysis Templates
  {
    id: 'top_bottom_values',
    intent: 'sort_data',
    name: 'Top and Bottom Values',
    description: 'Find the highest and lowest values in a column',
    template: '(SELECT \'Top {limit}\' as type, * FROM "{tableName}" ORDER BY "{column}" DESC LIMIT {limit}) UNION ALL (SELECT \'Bottom {limit}\' as type, * FROM "{tableName}" ORDER BY "{column}" ASC LIMIT {limit})',
    examples: [
      'Show top 10 sales',
      'Highest and lowest prices',
      'Best and worst performers'
    ],
    parameters: [
      { name: 'column', type: 'column', required: true, description: 'Column to sort by' },
      { name: 'limit', type: 'value', required: false, description: 'Number of top/bottom records', defaultValue: '5' }
    ],
    category: 'analysis',
    difficulty: 'intermediate',
    tags: ['top', 'bottom', 'sort', 'ranking']
  },

  {
    id: 'monthly_trends',
    intent: 'time_analysis',
    name: 'Monthly Trends',
    description: 'Analyze trends by month from date data',
    template: 'SELECT EXTRACT(YEAR FROM "{dateColumn}") as year, EXTRACT(MONTH FROM "{dateColumn}") as month, COUNT(*) as count, AVG("{valueColumn}") as avg_value FROM "{tableName}" GROUP BY year, month ORDER BY year, month',
    examples: [
      'Show monthly trends',
      'Analyze by month',
      'Monthly breakdown of sales'
    ],
    parameters: [
      { name: 'dateColumn', type: 'column', required: true, description: 'Date column for time analysis' },
      { name: 'valueColumn', type: 'column', required: false, description: 'Numeric column to analyze', defaultValue: '*' }
    ],
    category: 'analysis',
    difficulty: 'intermediate',
    tags: ['time', 'trends', 'monthly', 'temporal']
  },

  // Advanced Templates
  {
    id: 'correlation_analysis',
    intent: 'find_correlations',
    name: 'Basic Correlation',
    description: 'Calculate correlation between two numeric columns',
    template: 'SELECT CORR("{column1}", "{column2}") as correlation, COUNT(*) as sample_size FROM "{tableName}" WHERE "{column1}" IS NOT NULL AND "{column2}" IS NOT NULL',
    examples: [
      'Correlation between price and sales',
      'How does age relate to income?',
      'Find relationship between variables'
    ],
    parameters: [
      { name: 'column1', type: 'column', required: true, description: 'First numeric column' },
      { name: 'column2', type: 'column', required: true, description: 'Second numeric column' }
    ],
    category: 'analysis',
    difficulty: 'advanced',
    tags: ['correlation', 'relationship', 'statistics']
  },

  {
    id: 'outlier_detection',
    intent: 'detect_outliers',
    name: 'Outlier Detection',
    description: 'Find statistical outliers using IQR method',
    template: `WITH stats AS (
      SELECT 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{column}") as q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{column}") as q3
      FROM "{tableName}"
      WHERE "{column}" IS NOT NULL
    )
    SELECT *, 
           CASE 
             WHEN "{column}" < (stats.q1 - 1.5 * (stats.q3 - stats.q1)) THEN 'Low Outlier'
             WHEN "{column}" > (stats.q3 + 1.5 * (stats.q3 - stats.q1)) THEN 'High Outlier'
             ELSE 'Normal'
           END as outlier_type
    FROM "{tableName}", stats
    WHERE "{column}" IS NOT NULL
      AND ("{column}" < (stats.q1 - 1.5 * (stats.q3 - stats.q1)) 
           OR "{column}" > (stats.q3 + 1.5 * (stats.q3 - stats.q1)))
    ORDER BY "{column}" DESC`,
    examples: [
      'Find outliers in sales',
      'Detect unusual values',
      'Show anomalies in the data'
    ],
    parameters: [
      { name: 'column', type: 'column', required: true, description: 'Numeric column to analyze for outliers' }
    ],
    category: 'analysis',
    difficulty: 'advanced',
    tags: ['outliers', 'anomalies', 'statistics', 'iqr']
  }
];

/**
 * Template engine for generating SQL from templates and parameters
 */
export class QueryTemplateEngine {
  /**
   * Fill a template with provided parameters
   */
  fillTemplate(template: QueryTemplate, parameters: Record<string, string>, tableName: string): string {
    let sql = template.template;

    // Replace table name
    sql = sql.replace(/{tableName}/g, tableName);

    // Replace parameters
    for (const param of template.parameters) {
      const value = parameters[param.name] || param.defaultValue || '';
      const placeholder = new RegExp(`{${param.name}}`, 'g');
      
      // Handle different parameter types
      switch (param.type) {
        case 'column':
          sql = sql.replace(placeholder, value);
          break;
        case 'value':
          // Don't quote numeric values
          const isNumeric = /^\d+(\.\d+)?$/.test(value);
          sql = sql.replace(placeholder, isNumeric ? value : `'${value}'`);
          break;
        case 'condition':
          sql = sql.replace(placeholder, value);
          break;
        case 'aggregation':
          sql = sql.replace(placeholder, value.toUpperCase());
          break;
        default:
          sql = sql.replace(placeholder, value);
      }
    }

    return sql;
  }

  /**
   * Get templates by intent
   */
  getTemplatesByIntent(intent: QueryIntent): QueryTemplate[] {
    return QUERY_TEMPLATES.filter(template => template.intent === intent);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: QueryTemplate['category']): QueryTemplate[] {
    return QUERY_TEMPLATES.filter(template => template.category === category);
  }

  /**
   * Search templates by keywords
   */
  searchTemplates(keywords: string[]): QueryTemplate[] {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    
    return QUERY_TEMPLATES.filter(template => {
      const searchText = [
        template.name,
        template.description,
        ...template.tags,
        ...template.examples
      ].join(' ').toLowerCase();
      
      return lowerKeywords.some(keyword => searchText.includes(keyword));
    });
  }

  /**
   * Get suggested templates based on available columns
   */
  getSuggestedTemplates(availableColumns: string[]): QueryTemplate[] {
    const columnTypes = this.inferColumnTypes(availableColumns);
    const suggestions: QueryTemplate[] = [];

    // Always suggest basic exploration
    suggestions.push(...this.getTemplatesByIntent('show_data'));

    // Suggest aggregation if we have categorical columns
    const categoricalColumns = Object.entries(columnTypes)
      .filter(([, type]) => type === 'categorical')
      .map(([name]) => name);
    
    if (categoricalColumns.length > 0) {
      suggestions.push(...this.getTemplatesByIntent('aggregate_data').slice(0, 2));
    }

    // Suggest time analysis if we have date columns
    const dateColumns = Object.entries(columnTypes)
      .filter(([, type]) => type === 'date')
      .map(([name]) => name);
    
    if (dateColumns.length > 0) {
      suggestions.push(...this.getTemplatesByIntent('time_analysis'));
    }

    // Suggest correlation analysis if we have multiple numeric columns
    const numericColumns = Object.entries(columnTypes)
      .filter(([, type]) => type === 'numeric')
      .map(([name]) => name);
    
    if (numericColumns.length >= 2) {
      suggestions.push(...this.getTemplatesByIntent('find_correlations'));
    }

    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter((template, index, self) =>
      index === self.findIndex(t => t.id === template.id)
    );

    return uniqueSuggestions.slice(0, 6);
  }

  /**
   * Infer column types from column names (simple heuristic)
   */
  private inferColumnTypes(columns: string[]): Record<string, 'numeric' | 'categorical' | 'date'> {
    const types: Record<string, 'numeric' | 'categorical' | 'date'> = {};

    for (const column of columns) {
      const lowerName = column.toLowerCase();
      
      if (lowerName.includes('date') || lowerName.includes('time') || lowerName.includes('created')) {
        types[column] = 'date';
      } else if (lowerName.includes('price') || lowerName.includes('amount') || 
                 lowerName.includes('sales') || lowerName.includes('revenue') ||
                 lowerName.includes('count') || lowerName.includes('quantity')) {
        types[column] = 'numeric';
      } else {
        types[column] = 'categorical';
      }
    }

    return types;
  }

  /**
   * Generate example queries for a given file context
   */
  generateExampleQueries(fileContext: any): string[] {
    if (!fileContext || !fileContext.columnTypes) {
      return [
        'Show me the data',
        'What insights can you find?',
        'Create a chart',
        'Help me explore this dataset'
      ];
    }

    const columns = fileContext.columnTypes.map((col: any, index: number) => {
      if (col && typeof col === 'object' && col.name) {
        return col.name;
      }
      if (fileContext.data?.length > 0) {
        return Object.keys(fileContext.data[0])[index];
      }
      return null;
    }).filter(Boolean);

    const examples = [
      'Show me the data',
      `Analyze ${columns[0]}`,
      `Create a chart with ${columns[0]}${columns[1] ? ` and ${columns[1]}` : ''}`,
      'Find patterns in this data',
      'What insights do you see?'
    ];

    if (columns.length > 1) {
      examples.push(`Compare ${columns[0]} vs ${columns[1]}`);
      examples.push(`Group by ${columns[0]}`);
    }

    // Add specific suggestions based on column names
    const dateColumn = columns.find(col => 
      col.toLowerCase().includes('date') || col.toLowerCase().includes('time')
    );
    if (dateColumn) {
      examples.push(`Show trends over ${dateColumn}`);
    }

    const numericColumns = columns.filter(col =>
      col.toLowerCase().includes('sales') || 
      col.toLowerCase().includes('price') ||
      col.toLowerCase().includes('amount') ||
      col.toLowerCase().includes('revenue')
    );
    if (numericColumns.length > 0) {
      examples.push(`Sum ${numericColumns[0]} by category`);
    }

    return examples.slice(0, 8);
  }
}