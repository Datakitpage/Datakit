import { ColumnAnalysis } from './columnAnalyzer';
import { DataPattern } from './patternDetection';

export interface SmartSuggestion {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'timeline' | 'ranking' | 'distribution' | 'comparison' | 'quality' | 'exploration';
  priority: number;
  query: string;
  visualization?: {
    type: 'line' | 'bar' | 'pie' | 'scatter' | 'table' | 'heatmap';
    config?: any;
  };
  requiredColumns: string[];
  confidence: number;
}

export interface ColumnWithPattern {
  analysis: ColumnAnalysis;
  pattern: DataPattern;
  columnName: string;
  dataType: string;
}

/**
 * Generates smart suggestions based on column analysis and patterns
 */
export const generateSmartSuggestions = (
  columns: ColumnWithPattern[],
  tableName: string
): SmartSuggestion[] => {
  const suggestions: SmartSuggestion[] = [];
  
  // Find different column types
  const dateColumns = columns.filter(c => c.analysis.insights.hasDate || c.pattern.isDate);
  const moneyColumns = columns.filter(c => c.analysis.insights.hasMoney || c.pattern.isCurrency);
  const quantityColumns = columns.filter(c => 
    c.analysis.insights.hasQuantity || (c.pattern.isNumeric && !c.pattern.isCurrency)
  );
  const categoryColumns = columns.filter(c => c.pattern.isCategory);
  const entityColumns = columns.filter(c => 
    c.analysis.insights.hasPerson || c.analysis.insights.hasProduct || 
    (c.pattern.isCategory && c.pattern.uniqueCount > 5 && c.pattern.uniqueCount < 100)
  );
  const statusColumns = columns.filter(c => c.analysis.insights.hasStatus);
  const geoColumns = columns.filter(c => c.analysis.insights.hasPlace);
  
  // 1. Time-based suggestions
  if (dateColumns.length > 0) {
    const dateCol = dateColumns[0];
    
    // Timeline with money
    if (moneyColumns.length > 0) {
      const moneyCol = moneyColumns[0];
      suggestions.push({
        id: 'timeline-revenue',
        title: 'Revenue Timeline',
        description: `Track ${moneyCol.columnName} over time`,
        icon: '📈',
        category: 'timeline',
        priority: 10,
        query: `SELECT 
  DATE_TRUNC('month', ${dateCol.columnName}) as month,
  SUM(${moneyCol.columnName}) as total_revenue,
  COUNT(*) as transactions
FROM ${tableName}
GROUP BY month
ORDER BY month DESC`,
        visualization: {
          type: 'line',
          config: { xAxis: 'month', yAxis: 'total_revenue' }
        },
        requiredColumns: [dateCol.columnName, moneyCol.columnName],
        confidence: 0.95
      });
    }
    
    // Timeline with quantity
    if (quantityColumns.length > 0) {
      const qtyCol = quantityColumns[0];
      suggestions.push({
        id: 'timeline-quantity',
        title: 'Activity Over Time',
        description: `See ${qtyCol.columnName} trends`,
        icon: '📊',
        category: 'timeline',
        priority: 8,
        query: `SELECT 
  DATE_TRUNC('week', ${dateCol.columnName}) as week,
  SUM(${qtyCol.columnName}) as total,
  AVG(${qtyCol.columnName}) as average
FROM ${tableName}
GROUP BY week
ORDER BY week DESC
LIMIT 52`,
        visualization: {
          type: 'line',
          config: { xAxis: 'week', yAxis: 'total' }
        },
        requiredColumns: [dateCol.columnName, qtyCol.columnName],
        confidence: 0.85
      });
    }
    
    // Recent activity
    suggestions.push({
      id: 'recent-activity',
      title: 'Recent Activity',
      description: 'What happened in the last 30 days',
      icon: '🕐',
      category: 'exploration',
      priority: 6,
      query: `SELECT *
FROM ${tableName}
WHERE ${dateCol.columnName} >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ${dateCol.columnName} DESC
LIMIT 100`,
      visualization: { type: 'table' },
      requiredColumns: [dateCol.columnName],
      confidence: 0.8
    });
  }
  
  // 2. Ranking suggestions
  if (entityColumns.length > 0 && (moneyColumns.length > 0 || quantityColumns.length > 0)) {
    const entityCol = entityColumns[0];
    const valueCol = moneyColumns[0] || quantityColumns[0];
    
    suggestions.push({
      id: 'top-performers',
      title: `Top ${entityCol.columnName}`,
      description: `Ranked by ${valueCol.columnName}`,
      icon: '🏆',
      category: 'ranking',
      priority: 9,
      query: `SELECT 
  ${entityCol.columnName},
  SUM(${valueCol.columnName}) as total,
  COUNT(*) as occurrences,
  AVG(${valueCol.columnName}) as average
FROM ${tableName}
WHERE ${entityCol.columnName} IS NOT NULL
GROUP BY ${entityCol.columnName}
ORDER BY total DESC
LIMIT 20`,
      visualization: {
        type: 'bar',
        config: { xAxis: entityCol.columnName, yAxis: 'total' }
      },
      requiredColumns: [entityCol.columnName, valueCol.columnName],
      confidence: 0.9
    });
  }
  
  // 3. Distribution suggestions
  categoryColumns.forEach(catCol => {
    if (catCol.pattern.uniqueCount <= 10) {
      suggestions.push({
        id: `distribution-${catCol.columnName}`,
        title: `${catCol.columnName} Distribution`,
        description: `How ${catCol.columnName} values are spread`,
        icon: '🎯',
        category: 'distribution',
        priority: 7,
        query: `SELECT 
  ${catCol.columnName} as category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ${tableName}
WHERE ${catCol.columnName} IS NOT NULL
GROUP BY ${catCol.columnName}
ORDER BY count DESC`,
        visualization: {
          type: catCol.pattern.uniqueCount <= 5 ? 'pie' : 'bar',
          config: { 
            label: 'category', 
            value: 'count',
            showPercentage: true 
          }
        },
        requiredColumns: [catCol.columnName],
        confidence: 0.85
      });
    }
  });
  
  // 4. Status/Progress tracking
  if (statusColumns.length > 0) {
    const statusCol = statusColumns[0];
    suggestions.push({
      id: 'status-overview',
      title: 'Status Overview',
      description: 'Current state of items',
      icon: '🚦',
      category: 'distribution',
      priority: 7,
      query: `SELECT 
  ${statusCol.columnName} as status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ${tableName}
GROUP BY ${statusCol.columnName}
ORDER BY 
  CASE ${statusCol.columnName}
    WHEN 'active' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'completed' THEN 3
    ELSE 4
  END`,
      visualization: {
        type: 'bar',
        config: { horizontal: true }
      },
      requiredColumns: [statusCol.columnName],
      confidence: 0.8
    });
  }
  
  // 5. Geographic insights
  if (geoColumns.length > 0) {
    const geoCol = geoColumns[0];
    suggestions.push({
      id: 'geographic-distribution',
      title: 'Geographic Breakdown',
      description: `Analysis by ${geoCol.columnName}`,
      icon: '🗺️',
      category: 'distribution',
      priority: 6,
      query: `SELECT 
  ${geoCol.columnName} as location,
  COUNT(*) as count,
  ${moneyColumns.length > 0 ? `SUM(${moneyColumns[0].columnName}) as total_value,` : ''}
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ${tableName}
WHERE ${geoCol.columnName} IS NOT NULL
GROUP BY ${geoCol.columnName}
ORDER BY count DESC
LIMIT 25`,
      visualization: {
        type: 'bar',
        config: { 
          xAxis: 'location', 
          yAxis: moneyColumns.length > 0 ? 'total_value' : 'count' 
        }
      },
      requiredColumns: [geoCol.columnName],
      confidence: 0.8
    });
  }
  
  // 6. Data quality insights
  const columnsWithNulls = columns.filter(c => c.pattern.nullRatio > 0.01);
  if (columnsWithNulls.length > 0) {
    suggestions.push({
      id: 'data-completeness',
      title: 'Data Completeness Check',
      description: 'Find missing values in your data',
      icon: '🔍',
      category: 'quality',
      priority: 5,
      query: `SELECT 
  ${columnsWithNulls.map(c => 
    `SUM(CASE WHEN ${c.columnName} IS NULL THEN 1 ELSE 0 END) as "${c.columnName}_missing"`
  ).join(',\n  ')},
  COUNT(*) as total_rows
FROM ${tableName}`,
      visualization: { type: 'table' },
      requiredColumns: columnsWithNulls.map(c => c.columnName),
      confidence: 0.9
    });
  }
  
  // 7. Comparison suggestions
  if (dateColumns.length > 0 && (moneyColumns.length > 0 || quantityColumns.length > 0)) {
    const dateCol = dateColumns[0];
    const valueCol = moneyColumns[0] || quantityColumns[0];
    
    suggestions.push({
      id: 'period-comparison',
      title: 'Period Comparison',
      description: 'Compare this month vs last month',
      icon: '📊',
      category: 'comparison',
      priority: 8,
      query: `WITH monthly_data AS (
  SELECT 
    DATE_TRUNC('month', ${dateCol.columnName}) as month,
    SUM(${valueCol.columnName}) as total
  FROM ${tableName}
  WHERE ${dateCol.columnName} >= CURRENT_DATE - INTERVAL '2 months'
  GROUP BY month
)
SELECT 
  month,
  total,
  LAG(total) OVER (ORDER BY month) as previous_month,
  ROUND((total - LAG(total) OVER (ORDER BY month)) * 100.0 / 
    NULLIF(LAG(total) OVER (ORDER BY month), 0), 2) as percent_change
FROM monthly_data
ORDER BY month DESC`,
      visualization: {
        type: 'bar',
        config: { showComparison: true }
      },
      requiredColumns: [dateCol.columnName, valueCol.columnName],
      confidence: 0.85
    });
  }
  
  // 8. Universal exploration
  suggestions.push({
    id: 'data-sample',
    title: 'Explore Sample Data',
    description: 'Quick look at your data structure',
    icon: '👀',
    category: 'exploration',
    priority: 3,
    query: `SELECT *
FROM ${tableName}
LIMIT 100`,
    visualization: { type: 'table' },
    requiredColumns: [],
    confidence: 1.0
  });
  
  // Sort by priority and confidence
  return suggestions.sort((a, b) => {
    const priorityDiff = b.priority - a.priority;
    return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence;
  });
};

/**
 * Filters suggestions based on available columns
 */
export const filterSuggestions = (
  suggestions: SmartSuggestion[],
  availableColumns: string[]
): SmartSuggestion[] => {
  return suggestions.filter(suggestion =>
    suggestion.requiredColumns.every(col =>
      availableColumns.some(available => 
        available.toLowerCase() === col.toLowerCase()
      )
    )
  );
};