export type QueryIntent = 
  | 'show_data'           // "show me the data", "display records"
  | 'filter_data'         // "filter by category X", "where sales > 1000"
  | 'aggregate_data'      // "sum of sales by month", "average revenue"
  | 'find_correlations'   // "what correlates with sales?", "relationships"
  | 'detect_outliers'     // "find unusual values", "anomalies"
  | 'create_chart'        // "make a bar chart", "visualize this"
  | 'explain_data'        // "what does this data show?", "summary"
  | 'sort_data'           // "order by sales", "top 10 customers"
  | 'count_data'          // "how many records", "count unique values"
  | 'time_analysis'       // "trends over time", "monthly breakdown"
  | 'compare_groups'      // "compare regions", "difference between"
  | 'get_help'            // "help", "what can you do?"
  | 'unknown';            // fallback

export interface IntentResult {
  intent: QueryIntent;
  confidence: number;
  entities: EntityExtraction;
  suggestedAction: string;
  parameters: Record<string, any>;
}

export interface EntityExtraction {
  columns: string[];           // ["sales", "region", "date"]
  values: string[];           // ["west", "2023", ">1000"]
  operations: string[];       // ["sum", "avg", "count"]
  timeRanges: string[];       // ["last month", "2023", "Q1"]
  chartTypes: string[];       // ["bar", "line", "pie"]
  aggregations: string[];     // ["group by", "order by"]
}

/**
 * Pure JavaScript intent classifier using pattern matching and heuristics
 * No ML models required - works instantly
 */
export class IntentClassifier {
  private intentPatterns: Record<QueryIntent, string[]> = {
    show_data: [
      'show', 'display', 'view', 'see', 'list', 'get', 'fetch', 'select',
      'give me', 'i want to see', 'show me', 'let me see'
    ],
    
    filter_data: [
      'filter', 'where', 'only', 'just', 'exclude', 'include', 'with',
      'greater than', 'less than', 'equal to', 'contains', 'like'
    ],
    
    aggregate_data: [
      'sum', 'total', 'average', 'mean', 'count', 'max', 'min', 'median',
      'aggregate', 'group by', 'grouped', 'breakdown', 'summary'
    ],
    
    find_correlations: [
      'correlat', 'relationship', 'connect', 'related', 'influence',
      'affect', 'depend', 'association', 'pattern', 'trend'
    ],
    
    detect_outliers: [
      'outlier', 'anomal', 'unusual', 'strange', 'weird', 'different',
      'exception', 'odd', 'abnormal', 'suspicious'
    ],
    
    create_chart: [
      'chart', 'graph', 'plot', 'visualiz', 'draw', 'create chart',
      'make chart', 'bar chart', 'line chart', 'pie chart', 'scatter'
    ],
    
    explain_data: [
      'explain', 'what does', 'what is', 'describe', 'tell me about',
      'summary', 'overview', 'insight', 'what can you tell me'
    ],
    
    sort_data: [
      'sort', 'order', 'rank', 'arrange', 'top', 'bottom', 'highest',
      'lowest', 'first', 'last', 'best', 'worst'
    ],
    
    count_data: [
      'count', 'how many', 'number of', 'quantity', 'total number',
      'unique', 'distinct'
    ],
    
    time_analysis: [
      'over time', 'trend', 'timeline', 'monthly', 'daily', 'yearly',
      'quarterly', 'seasonal', 'time series', 'historical'
    ],
    
    compare_groups: [
      'compare', 'difference', 'versus', 'vs', 'between', 'contrast',
      'against', 'relative to'
    ],
    
    get_help: [
      'help', 'what can you do', 'commands', 'how to', 'tutorial',
      'guide', 'assistance'
    ],
    
    unknown: []
  };

  private operationPatterns = {
    aggregations: ['sum', 'avg', 'average', 'count', 'max', 'min', 'total'],
    comparisons: ['>', '<', '>=', '<=', '=', '!=', 'greater', 'less', 'equal'],
    grouping: ['by', 'group by', 'per', 'each', 'every'],
    sorting: ['asc', 'desc', 'ascending', 'descending', 'top', 'bottom']
  };

  /**
   * Classify user intent from natural language query
   */
  classifyIntent(query: string, availableColumns: string[] = []): IntentResult {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Extract entities first
    const entities = this.extractEntities(normalizedQuery, availableColumns);
    
    // Score each intent
    const intentScores = new Map<QueryIntent, number>();
    
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      if (intent === 'unknown') continue;
      
      let score = 0;
      for (const pattern of patterns) {
        if (normalizedQuery.includes(pattern)) {
          score += 1;
          // Boost score for exact matches
          if (normalizedQuery === pattern || normalizedQuery.startsWith(pattern + ' ')) {
            score += 0.5;
          }
        }
      }
      
      // Contextual scoring based on entities
      score += this.getContextualScore(intent as QueryIntent, entities, normalizedQuery);
      
      intentScores.set(intent as QueryIntent, score);
    }
    
    // Find best match
    const sortedIntents = Array.from(intentScores.entries())
      .sort(([,a], [,b]) => b - a);
    
    const [bestIntent, bestScore] = sortedIntents[0] || ['unknown', 0];
    
    // Calculate confidence (0-1)
    const confidence = Math.min(bestScore / 2, 1); // Normalize to 0-1
    
    // Generate suggested action
    const suggestedAction = this.generateSuggestedAction(
      bestIntent as QueryIntent, 
      entities, 
      normalizedQuery
    );
    
    // Extract parameters
    const parameters = this.extractParameters(bestIntent as QueryIntent, entities, normalizedQuery);
    
    return {
      intent: confidence < 0.3 ? 'unknown' : bestIntent as QueryIntent,
      confidence,
      entities,
      suggestedAction,
      parameters
    };
  }

  /**
   * Extract entities (columns, values, operations) from query
   */
  private extractEntities(query: string, availableColumns: string[]): EntityExtraction {
    const entities: EntityExtraction = {
      columns: [],
      values: [],
      operations: [],
      timeRanges: [],
      chartTypes: [],
      aggregations: []
    };

    // Extract column names (fuzzy matching)
    for (const column of availableColumns) {
      const columnLower = column.toLowerCase();
      if (query.includes(columnLower) || 
          query.includes(column) ||
          this.fuzzyMatch(columnLower, query)) {
        entities.columns.push(column);
      }
    }

    // Extract operations
    for (const [category, patterns] of Object.entries(this.operationPatterns)) {
      for (const pattern of patterns) {
        if (query.includes(pattern)) {
          entities.operations.push(pattern);
          if (category === 'aggregations') {
            entities.aggregations.push(pattern);
          }
        }
      }
    }

    // Extract chart types
    const chartTypes = ['bar', 'line', 'pie', 'scatter', 'area'];
    for (const chartType of chartTypes) {
      if (query.includes(chartType)) {
        entities.chartTypes.push(chartType);
      }
    }

    // Extract time ranges (basic patterns)
    const timePatterns = [
      'last month', 'this month', 'last year', 'this year',
      'yesterday', 'today', 'last week', 'this week',
      'q1', 'q2', 'q3', 'q4', 'january', 'february', 'march',
      '2023', '2024', '2025'
    ];
    
    for (const timePattern of timePatterns) {
      if (query.includes(timePattern)) {
        entities.timeRanges.push(timePattern);
      }
    }

    // Extract numeric values and comparison operators
    const numberRegex = /\d+/g;
    const numbers = query.match(numberRegex);
    if (numbers) {
      entities.values.push(...numbers);
    }

    return entities;
  }

  /**
   * Fuzzy match for column names (handles typos and variations)
   */
  private fuzzyMatch(columnName: string, query: string): boolean {
    // Simple fuzzy matching - can be enhanced
    const words = query.split(' ');
    return words.some(word => {
      if (word.length < 3) return false;
      
      // Check if word is substring of column or vice versa
      return columnName.includes(word) || word.includes(columnName);
    });
  }

  /**
   * Add contextual scoring based on entities and patterns
   */
  private getContextualScore(intent: QueryIntent, entities: EntityExtraction, query: string): number {
    let score = 0;

    switch (intent) {
      case 'create_chart':
        if (entities.chartTypes.length > 0) score += 1;
        if (entities.columns.length >= 2) score += 0.5;
        break;
        
      case 'aggregate_data':
        if (entities.aggregations.length > 0) score += 1;
        if (query.includes('group by') || query.includes('per')) score += 0.5;
        break;
        
      case 'filter_data':
        if (entities.values.length > 0) score += 0.5;
        if (query.includes('where') || query.includes('only')) score += 0.5;
        break;
        
      case 'time_analysis':
        if (entities.timeRanges.length > 0) score += 1;
        if (entities.columns.some(col => 
          col.toLowerCase().includes('date') || 
          col.toLowerCase().includes('time'))) score += 0.5;
        break;
        
      case 'show_data':
        if (entities.columns.length > 0 && entities.operations.length === 0) score += 0.5;
        break;
    }

    return score;
  }

  /**
   * Generate human-readable suggested action
   */
  private generateSuggestedAction(intent: QueryIntent, entities: EntityExtraction, query: string): string {
    const columns = entities.columns.join(', ');
    
    switch (intent) {
      case 'show_data':
        return columns ? `Show data from columns: ${columns}` : 'Display the dataset';
        
      case 'create_chart':
        const chartType = entities.chartTypes[0] || 'appropriate';
        return `Create a ${chartType} chart${columns ? ` using ${columns}` : ''}`;
        
      case 'aggregate_data':
        const agg = entities.aggregations[0] || 'aggregate';
        return `${agg}${columns ? ` ${columns}` : ' the data'}`;
        
      case 'filter_data':
        return `Filter data${columns ? ` by ${columns}` : ''}`;
        
      case 'time_analysis':
        return `Analyze trends over time${columns ? ` for ${columns}` : ''}`;
        
      case 'find_correlations':
        return `Find correlations${columns ? ` involving ${columns}` : ' in the data'}`;
        
      case 'detect_outliers':
        return `Detect outliers${columns ? ` in ${columns}` : ' in the data'}`;
        
      case 'get_help':
        return 'Show available commands and examples';
        
      case 'unknown':
        return 'I\'m not sure what you want to do. Try asking for help or being more specific.';
        
      default:
        return 'Process your request';
    }
  }

  /**
   * Extract structured parameters for query execution
   */
  private extractParameters(intent: QueryIntent, entities: EntityExtraction, query: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Common parameters
    params.columns = entities.columns;
    params.operations = entities.operations;

    // Intent-specific parameters
    switch (intent) {
      case 'create_chart':
        params.chartType = entities.chartTypes[0] || 'bar';
        params.xAxis = entities.columns[0];
        params.yAxis = entities.columns[1];
        break;
        
      case 'aggregate_data':
        params.aggregation = entities.aggregations[0] || 'count';
        params.groupBy = entities.columns[0];
        break;
        
      case 'filter_data':
        params.filterColumn = entities.columns[0];
        params.filterValue = entities.values[0];
        break;
        
      case 'time_analysis':
        params.timeColumn = entities.columns.find(col => 
          col.toLowerCase().includes('date') || 
          col.toLowerCase().includes('time')) || entities.columns[0];
        params.valueColumn = entities.columns.find(col => 
          !col.toLowerCase().includes('date') && 
          !col.toLowerCase().includes('time')) || entities.columns[1];
        break;
    }

    return params;
  }

  /**
   * Get example queries for help
   */
  getExampleQueries(): Record<QueryIntent, string[]> {
    return {
      show_data: [
        "Show me the data",
        "Display all records",
        "Let me see the sales data"
      ],
      filter_data: [
        "Filter by region = 'West'",
        "Show only sales > 1000", 
        "Where category contains 'electronics'"
      ],
      aggregate_data: [
        "Sum of sales by region",
        "Average revenue per month",
        "Count of customers by category"
      ],
      find_correlations: [
        "What correlates with sales?",
        "Show relationships between price and demand",
        "Find patterns in the data"
      ],
      detect_outliers: [
        "Find unusual values in sales",
        "Detect anomalies",
        "Show me outliers"
      ],
      create_chart: [
        "Create a bar chart of sales by region",
        "Make a line chart showing trends",
        "Visualize this data"
      ],
      explain_data: [
        "What does this data show?",
        "Explain the dataset",
        "Give me insights"
      ],
      sort_data: [
        "Sort by sales descending",
        "Show top 10 customers",
        "Order by date"
      ],
      count_data: [
        "How many records?",
        "Count unique regions",
        "Number of customers"
      ],
      time_analysis: [
        "Show trends over time",
        "Monthly breakdown",
        "Analyze by quarter"
      ],
      compare_groups: [
        "Compare regions",
        "Difference between Q1 and Q2",
        "Sales vs target"
      ],
      get_help: [
        "Help",
        "What can you do?",
        "Show examples"
      ],
      unknown: []
    };
  }
}