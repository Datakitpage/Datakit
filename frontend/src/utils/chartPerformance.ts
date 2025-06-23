/**
 * Chart Performance Management System
 * Handles smart thresholds and optimal visualization strategies for datasets of any size
 */

export type DataSize = 'tiny' | 'small' | 'medium' | 'large' | 'very_large' | 'massive';
export type VisualizationStrategy = 'recharts' | 'aggregated_recharts' | 'mosaic_plot' | 'observable_plot' | 'canvas' | 'webgl' | 'server_aggregated';

export interface PerformanceThreshold {
  maxRows: number;
  strategy: VisualizationStrategy;
  aggregationLevel: number; // 1 = no aggregation, 10 = heavy aggregation
  warningLevel: 'none' | 'info' | 'warning' | 'critical';
  description: string;
  recommendations: string[];
}

export interface DataAggregationConfig {
  binCount: number;
  method: 'average' | 'sum' | 'count' | 'density';
  forceAggregation: boolean;
}

export interface PerformanceAnalysis {
  dataSize: DataSize;
  rowCount: number;
  threshold: PerformanceThreshold;
  aggregationConfig: DataAggregationConfig;
  renderingStrategy: VisualizationStrategy;
  estimatedRenderTime: number; // milliseconds
  memoryUsage: number; // MB
  recommendations: string[];
}

/**
 * Performance thresholds for different data sizes
 */
export const PERFORMANCE_THRESHOLDS: Record<DataSize, PerformanceThreshold> = {
  tiny: {
    maxRows: 1000,
    strategy: 'recharts',
    aggregationLevel: 1,
    warningLevel: 'none',
    description: 'Optimal performance with full interactive features',
    recommendations: [
      'All chart types available',
      'Full interactivity supported',
      'No performance limitations'
    ]
  },
  small: {
    maxRows: 10000,
    strategy: 'recharts',
    aggregationLevel: 1,
    warningLevel: 'info',
    description: 'Good performance with monitoring',
    recommendations: [
      'All chart types available',
      'Monitor for performance issues',
      'Consider data filtering for better UX'
    ]
  },
  medium: {
    maxRows: 100000,
    strategy: 'mosaic_plot',
    aggregationLevel: 2,
    warningLevel: 'info',
    description: 'Mosaic Plot for database-driven visualization with DuckDB optimization',
    recommendations: [
      'Switched to Mosaic Plot for scalable performance',
      'Database-pushed computation (binning, aggregation)',
      'Interactive cross-filtering capabilities',
      'Optimized for large dataset exploration'
    ]
  },
  large: {
    maxRows: 10000000,
    strategy: 'mosaic_plot',
    aggregationLevel: 5,
    warningLevel: 'warning',
    description: 'Mosaic Plot with database-side aggregation for million-record performance',
    recommendations: [
      'Database-side processing via DuckDB for optimal performance',
      'Automatic binning and aggregation for large datasets',
      'Cross-filtering across multiple views supported',
      'Optimized for million-row datasets'
    ]
  },
  very_large: {
    maxRows: 100000000,
    strategy: 'mosaic_plot',
    aggregationLevel: 10,
    warningLevel: 'critical',
    description: 'Mosaic Plot with heavy database-side aggregation for billion-record datasets',
    recommendations: [
      'Heavy database-side processing via DuckDB',
      'Automatic data sampling and binning',
      'Materialized views recommended for performance',
      'Optimized for billion-row datasets'
    ]
  },
  massive: {
    maxRows: Infinity,
    strategy: 'server_aggregated',
    aggregationLevel: 100,
    warningLevel: 'critical',
    description: 'Server-side aggregation required',
    recommendations: [
      'Data must be pre-aggregated on server',
      'Only summary statistics visualizations',
      'Consider data sampling strategies',
      'Use specialized big data visualization tools'
    ]
  }
};

/**
 * Analyze dataset and determine optimal visualization strategy
 */
export function analyzeDataPerformance(rowCount: number, columnCount: number = 2): PerformanceAnalysis {
  const dataSize = determineDataSize(rowCount);
  const threshold = PERFORMANCE_THRESHOLDS[dataSize];
  
  // Calculate aggregation configuration
  const aggregationConfig = calculateAggregationConfig(rowCount, dataSize);
  
  // Estimate rendering performance
  const estimatedRenderTime = estimateRenderTime(rowCount, threshold.strategy);
  const memoryUsage = estimateMemoryUsage(rowCount, columnCount, threshold.strategy);
  
  return {
    dataSize,
    rowCount,
    threshold,
    aggregationConfig,
    renderingStrategy: threshold.strategy,
    estimatedRenderTime,
    memoryUsage,
    recommendations: [
      ...threshold.recommendations,
      ...getDataSizeSpecificRecommendations(dataSize, rowCount)
    ]
  };
}

/**
 * Determine data size category based on row count
 */
export function determineDataSize(rowCount: number): DataSize {
  if (rowCount <= PERFORMANCE_THRESHOLDS.tiny.maxRows) return 'tiny';
  if (rowCount <= PERFORMANCE_THRESHOLDS.small.maxRows) return 'small';
  if (rowCount <= PERFORMANCE_THRESHOLDS.medium.maxRows) return 'medium';
  if (rowCount <= PERFORMANCE_THRESHOLDS.large.maxRows) return 'large';
  if (rowCount <= PERFORMANCE_THRESHOLDS.very_large.maxRows) return 'very_large';
  return 'massive';
}

/**
 * Calculate optimal aggregation configuration
 */
export function calculateAggregationConfig(rowCount: number, dataSize: DataSize): DataAggregationConfig {
  const threshold = PERFORMANCE_THRESHOLDS[dataSize];
  
  // Calculate optimal bin count for visualization
  let binCount: number;
  if (dataSize === 'tiny' || dataSize === 'small') {
    binCount = Math.min(rowCount, 1000); // No aggregation needed
  } else if (dataSize === 'medium') {
    binCount = 500; // Moderate aggregation
  } else if (dataSize === 'large') {
    binCount = 200; // Heavy aggregation
  } else if (dataSize === 'very_large') {
    binCount = 100; // Extreme aggregation
  } else {
    binCount = 50; // Maximum aggregation
  }
  
  return {
    binCount,
    method: dataSize === 'tiny' || dataSize === 'small' ? 'average' : 'density',
    forceAggregation: threshold.aggregationLevel > 1
  };
}

/**
 * Estimate rendering time based on data size and strategy
 */
export function estimateRenderTime(rowCount: number, strategy: VisualizationStrategy): number {
  const baseTime = {
    recharts: 0.01, // ms per row
    aggregated_recharts: 0.005,
    mosaic_plot: 0.001, // Database-pushed computation
    observable_plot: 0.003,
    canvas: 0.001,
    webgl: 0.0001,
    server_aggregated: 0.00001
  };
  
  return Math.min(rowCount * baseTime[strategy], 10000); // Cap at 10 seconds
}

/**
 * Estimate memory usage in MB
 */
export function estimateMemoryUsage(rowCount: number, columnCount: number, strategy: VisualizationStrategy): number {
  const bytesPerRow = {
    recharts: 200, // DOM overhead
    aggregated_recharts: 150,
    mosaic_plot: 30, // Database-pushed, minimal client memory
    observable_plot: 100, // SVG-based but optimized
    canvas: 50,
    webgl: 20,
    server_aggregated: 10
  };
  
  return (rowCount * columnCount * bytesPerRow[strategy]) / (1024 * 1024);
}

/**
 * Get data size specific recommendations
 */
export function getDataSizeSpecificRecommendations(dataSize: DataSize, rowCount: number): string[] {
  const recommendations: string[] = [];
  
  if (dataSize === 'medium') {
    recommendations.push(`${rowCount.toLocaleString()} rows will be aggregated into bins for visualization`);
  }
  
  if (dataSize === 'large') {
    recommendations.push(`Canvas rendering activated for ${rowCount.toLocaleString()} rows`);
    recommendations.push('Consider using density plots or heatmaps for better insights');
  }
  
  if (dataSize === 'very_large') {
    recommendations.push(`WebGL rendering required for ${rowCount.toLocaleString()} rows`);
    recommendations.push('Data will be heavily aggregated');
    recommendations.push('Consider statistical sampling instead of full dataset');
  }
  
  if (dataSize === 'massive') {
    recommendations.push(`${rowCount.toLocaleString()} rows require server-side processing`);
    recommendations.push('Only aggregated summary views available');
    recommendations.push('Consider using specialized big data tools');
  }
  
  return recommendations;
}

/**
 * Create aggregated data for visualization
 */
export function aggregateDataForVisualization(
  data: any[], 
  xField: string, 
  yField: string, 
  config: DataAggregationConfig
): any[] {
  if (!config.forceAggregation) return data;
  
  // Find min/max for binning
  const xValues = data.map(d => d[xField]).filter(v => v != null);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const binWidth = (xMax - xMin) / config.binCount;
  
  // Create bins
  const bins: Map<number, { sum: number; count: number; items: any[] }> = new Map();
  
  data.forEach(item => {
    const xValue = item[xField];
    if (xValue == null) return;
    
    const binIndex = Math.floor((xValue - xMin) / binWidth);
    const normalizedBinIndex = Math.min(binIndex, config.binCount - 1);
    
    if (!bins.has(normalizedBinIndex)) {
      bins.set(normalizedBinIndex, { sum: 0, count: 0, items: [] });
    }
    
    const bin = bins.get(normalizedBinIndex)!;
    bin.sum += item[yField] || 0;
    bin.count += 1;
    bin.items.push(item);
  });
  
  // Convert bins to aggregated data
  return Array.from(bins.entries()).map(([binIndex, bin]) => {
    const binStart = xMin + binIndex * binWidth;
    const binEnd = binStart + binWidth;
    
    return {
      [xField]: binStart + binWidth / 2, // Bin center
      [yField]: config.method === 'average' ? bin.sum / bin.count : 
                config.method === 'sum' ? bin.sum :
                config.method === 'count' ? bin.count :
                bin.count, // density
      _binStart: binStart,
      _binEnd: binEnd,
      _originalCount: bin.count,
      _aggregated: true
    };
  }).filter(item => item._originalCount > 0);
}

/**
 * Check if current browser can handle the dataset
 */
export function checkBrowserCapability(analysis: PerformanceAnalysis): {
  canRender: boolean;
  warnings: string[];
  blockingIssues: string[];
} {
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  
  // Memory checks
  if (analysis.memoryUsage > 500) {
    blockingIssues.push(`Estimated memory usage: ${analysis.memoryUsage.toFixed(0)}MB - May crash browser`);
  } else if (analysis.memoryUsage > 100) {
    warnings.push(`High memory usage: ${analysis.memoryUsage.toFixed(0)}MB`);
  }
  
  // Render time checks
  if (analysis.estimatedRenderTime > 5000) {
    warnings.push(`Slow rendering expected: ${(analysis.estimatedRenderTime / 1000).toFixed(1)}s`);
  }
  
  // Data size checks
  if (analysis.dataSize === 'massive') {
    blockingIssues.push('Dataset too large for client-side visualization');
  }
  
  return {
    canRender: blockingIssues.length === 0,
    warnings,
    blockingIssues
  };
}