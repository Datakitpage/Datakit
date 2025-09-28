import React from 'react';
import { HistogramBin } from '@/lib/duckdb/inspector/types';

interface MiniHistogramProps {
  data?: HistogramBin[];
  width?: number;
  height?: number;
  color?: string;
  showOutliers?: boolean;
}

const MiniHistogram: React.FC<MiniHistogramProps> = ({
  data,
  width = 100,
  height = 24,
  color = '#00BFA5',
  showOutliers = true,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-[10px] text-muted-foreground/60">
        No chart data
      </div>
    );
  }

  // Validate data structure - be more flexible with the data format
  const validData = data.filter(bin => {
    // Handle different possible data structures
    const freq = bin.frequency ?? bin.count ?? bin.value ?? 0;
    return typeof freq === 'number' && freq >= 0;
  }).map(bin => ({
    ...bin,
    frequency: bin.frequency ?? bin.count ?? bin.value ?? 0
  }));
  
  if (validData.length === 0) {
    console.warn('[MiniHistogram] No valid data found:', data);
    return null; // Don't show anything instead of "Invalid data"
  }

  // Calculate max frequency for scaling
  const maxFreq = Math.max(...validData.map(d => d.frequency));
  if (maxFreq === 0) {
    return null; // Don't show anything for empty data
  }
  
  // Calculate bar width based on number of bins
  const barWidth = Math.max(2, Math.floor(width / validData.length) - 1);
  const spacing = 1;

  // Detect outliers (bins with very low frequency compared to median)
  const sortedFreqs = [...validData.map(d => d.frequency)].sort((a, b) => a - b);
  const medianFreq = sortedFreqs[Math.floor(sortedFreqs.length / 2)];
  const outlierThreshold = medianFreq * 0.1; // Consider < 10% of median as outlier
  

  return (
    <svg width={width} height={height} className="inline-block mini-histogram">
      {validData.map((bin, i) => {
        const barHeight = maxFreq > 0 ? (bin.frequency / maxFreq) * (height - 2) : 0;
        const x = i * (barWidth + spacing);
        const y = height - barHeight - 1;
        const isOutlier = showOutliers && bin.frequency < outlierThreshold && bin.frequency > 0;
        
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={isOutlier ? `${color}66` : color}
            opacity={isOutlier ? 0.4 : 0.8}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
};

export default MiniHistogram;