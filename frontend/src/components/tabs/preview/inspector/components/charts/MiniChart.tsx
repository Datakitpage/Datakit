import React from 'react';
import { motion } from 'framer-motion';
import { Download, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { InspectorMetrics } from '@/store/inspectorStore';
import { ChartContainer } from './ChartContainer';
import NivoHistogram from './NivoHistogram';
import NivoCategoricalChart from './NivoCategoricalChart';

interface MiniChartProps {
  column: InspectorMetrics['columnMetrics'][0];
  metrics: InspectorMetrics;
  onExport?: (format: string) => void;
  onViewDetails?: () => void;
}

const MiniChart: React.FC<MiniChartProps> = ({ 
  column, 
  metrics, 
  onExport,
}) => {
  console.log(`[EnhancedChart] Analyzing ${column.name}:`, {
    type: column.type,
    hasNumericStats: !!column.numericStats,
    hasHistogramData: !!column.histogramData,
    histogramLength: column.histogramData?.length || 0,
    uniqueCount: column.uniqueCount,
    nullCount: column.nullCount
  });

  const frequentValues = metrics.frequentValues.find(fv => fv.column === column.name);
  
  // Chart type indicator
  const getChartTypeIcon = () => {
    if (column.numericStats && column.histogramData && column.histogramData.length > 0) {
      return <BarChart3 className="h-3 w-3 text-primary" />;
    }
    if (frequentValues && frequentValues.values.length > 0) {
      return <PieChart className="h-3 w-3 text-secondary" />;
    }
    return <TrendingUp className="h-3 w-3 text-muted-foreground" />;
  };

  // Get chart insights
  const getChartInsights = () => {
    const insights = [];
    
    if (column.numericStats && column.histogramData) {
      const { mean, std, min, max } = column.numericStats;
      const range = max - min;
      const cv = std / mean; // coefficient of variation
      
      if (cv < 0.1) insights.push("Low variation");
      if (cv > 1) insights.push("High variation");
      if (std > range * 0.3) insights.push("Wide spread");
      
      // Find peak bin
      const peakBin = column.histogramData.reduce((max, bin) => 
        bin.count > max.count ? bin : max
      );
      insights.push(`Peak: ${peakBin.range}`);
    }
    
    if (frequentValues) {
      const topValue = frequentValues.values[0];
      if (topValue.percentage > 50) {
        insights.push(`Dominant: ${topValue.value} (${topValue.percentage.toFixed(1)}%)`);
      }
      if (frequentValues.values.length >= 5) {
        insights.push(`${frequentValues.values.length} categories`);
      }
    }
    
    return insights;
  };

  const insights = getChartInsights();

  // Priority 1: Numeric columns with histogram data
  if (column.numericStats && column.histogramData && column.histogramData.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getChartTypeIcon()}
            <span className="text-xs text-muted-foreground">Distribution</span>
          </div>
          <div className="flex items-center gap-1">
           
          </div>
        </div>
        
        <ChartContainer title="" height={170}>
          <NivoHistogram 
            data={column.histogramData}
            color="hsl(175, 100%, 36%)"
            exportable={!!onExport}
            onExport={onExport}
          />
        </ChartContainer>
        
        {insights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {insights.map((insight, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 bg-primary/10 text-primary/80 rounded"
              >
                {insight}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    );
  }
  
  // Priority 2: Any column with frequent values (including text!)
  if (frequentValues && frequentValues.values.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getChartTypeIcon()}
            <span className="text-xs text-muted-foreground">Top Values</span>
          </div>
          <div className="flex items-center gap-1">
           
         
          </div>
        </div>
        
        <ChartContainer title="" height={170}>
          <NivoCategoricalChart 
            data={frequentValues.values.slice(0, 7)}
            exportable={!!onExport}
            onExport={onExport}
          />
        </ChartContainer>
        
        {insights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {insights.map((insight, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 bg-secondary/10 text-secondary/80 rounded"
              >
                {insight}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    );
  }
  
  // Priority 3: Numeric stats fallback (for numbers without histograms)
  if (column.numericStats) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getChartTypeIcon()}
            <span className="text-xs text-muted-foreground">Statistics</span>
          </div>
        
        </div>
        
        <div className="p-3 bg-card/20 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min:</span>
              <span className="text-foreground font-mono">{column.numericStats.min.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max:</span>
              <span className="text-foreground font-mono">{column.numericStats.max.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mean:</span>
              <span className="text-foreground font-mono">{column.numericStats.mean.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Median:</span>
              <span className="text-foreground font-mono">{column.numericStats.median.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Priority 4: Text statistics for text columns
  if (column.textStats) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getChartTypeIcon()}
            <span className="text-xs text-muted-foreground">Text Statistics</span>
          </div>
         
        </div>
        
        <div className="p-3 bg-card/20 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Length:</span>
              <span className="text-foreground font-mono">{column.textStats.avgLength.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Length:</span>
              <span className="text-foreground font-mono">{column.textStats.maxLength}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empty:</span>
              <span className="text-foreground font-mono">{column.textStats.emptyStrings}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Chars:</span>
              <span className="text-foreground font-mono">{column.textStats.totalChars.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // Priority 5: Empty state with enhanced reasoning
  const getReason = () => {
    if (column.nullCount >= (column.uniqueCount * 0.9)) {
      return { type: 'no-data', message: 'Column is mostly empty (90%+ null values)' };
    }
    if (column.uniqueCount <= 1) {
      return { type: 'inappropriate', message: 'All values are the same - no distribution to show' };
    }
    if (column.uniqueCount === column.nullCount && column.nullCount > 0) {
      return { type: 'no-data', message: 'No valid data found for visualization' };
    }
    return { type: 'error', message: 'Chart generation failed - data may be too complex' };
  };

  const reason = getReason();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3"
    >
      <div className="p-3 bg-card/10 rounded-lg border border-yellow-500/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-yellow-400">⚠️ No Chart Available</span>
          </div>
        
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          {reason.message}
        </div>
        <div className="text-xs text-muted-foreground">
          Column: {column.name} • Type: {column.type} • Unique: {column.uniqueCount} • Nulls: {column.nullCount}
        </div>
      </div>
    </motion.div>
  );
};

export default MiniChart;