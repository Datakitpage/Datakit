import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface CategoricalData {
  value: string;
  count: number;
  percentage: number;
}

interface NivoCategoricalChartProps {
  data: CategoricalData[];
  colors?: string[];
  height?: number;
  interactive?: boolean;
  exportable?: boolean;
  onExport?: (format: string) => void;
  maxItems?: number;
}

const NivoCategoricalChart: React.FC<NivoCategoricalChartProps> = ({
  data,
  colors = [
    '#a855f7', // purple-500
    '#2dd4bf', // teal-400
    '#06b6d4', // cyan-500
    '#8b5cf6', // violet-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
  ],
  height = 180,
  interactive = true,
  exportable = false,
  onExport,
  maxItems = 7
}) => {
  // Limit data to maxItems and ensure we have data
  const limitedData = data.slice(0, maxItems);
  
  // Handle empty data case
  if (!limitedData || limitedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No categorical data available
      </div>
    );
  }

  const theme = {
    background: 'transparent',
    text: {
      fontSize: 12,
      fill: 'rgba(255, 255, 255, 0.9)',
    },
    axis: {
      domain: {
        line: {
          stroke: 'rgba(255, 255, 255, 0.1)',
          strokeWidth: 1,
        },
      },
      legend: {
        text: {
          fontSize: 12,
          fill: 'rgba(255, 255, 255, 0.8)',
        },
      },
      ticks: {
        line: {
          stroke: 'rgba(255, 255, 255, 0.1)',
          strokeWidth: 1,
        },
        text: {
          fontSize: 11,
          fill: 'rgba(255, 255, 255, 0.8)',
        },
      },
    },
    grid: {
      line: {
        stroke: 'rgba(255, 255, 255, 0.05)',
        strokeWidth: 1,
      },
    },
    tooltip: {
      container: {
        background: 'rgba(0, 0, 0, 0.95)',
        color: 'white',
        fontSize: 12,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      },
    },
  };

  const CustomTooltip = ({ id, value, data }: any) => (
    <div className="bg-black/95 border border-border rounded-lg p-3 shadow-xl">
      <div className="text-sm font-medium text-foreground mb-1 max-w-48 truncate">
        {data.value}
      </div>
      <div className="text-sm text-muted-foreground">
        Count: <span className="font-mono text-secondary">{value.toLocaleString()}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        {data.percentage.toFixed(1)}% of total
      </div>
    </div>
  );

  const getColor = (index: number) => colors[index % colors.length];

  const handleSVGExport = () => {
    // Always export as SVG directly
    exportChartAsSVG(limitedData, 'categorical');
  };

  const handlePNGExport = () => {
    // Create PNG from SVG using canvas
    exportChartAsPNG(limitedData, 'categorical');
  };

  const exportChartAsPNG = (chartData: CategoricalData[], type: string) => {
    const width = 600;
    const height = 400;
    const margin = { top: 30, right: 30, bottom: 60, left: 120 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxCount = Math.max(...chartData.map(d => d.count));
    const barHeight = chartHeight / chartData.length;

    const bars = chartData.map((item, i) => {
      const barWidth = (item.count / maxCount) * chartWidth;
      const y = i * barHeight;
      const color = getColor(i);
      
      return `
        <rect x="0" y="${y}" width="${barWidth}" height="${barHeight - 5}" fill="${color}" opacity="0.8"/>
        <text x="-10" y="${y + barHeight/2 + 5}" text-anchor="end" fill="rgba(255,255,255,0.8)" font-size="12">
          ${item.value.length > 15 ? item.value.substring(0, 15) + '...' : item.value}
        </text>
        <text x="${barWidth + 10}" y="${y + barHeight/2 + 5}" fill="rgba(255,255,255,0.8)" font-size="12">
          ${item.count} (${item.percentage.toFixed(1)}%)
        </text>
      `;
    }).join('');

    const svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: #1a1a1a;">
        <defs>
          <style>
            text { font-family: Arial, sans-serif; }
          </style>
        </defs>
        
        <g transform="translate(${margin.left}, ${margin.top})">
          ${bars}
          
          <!-- Axes -->
          <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          
          <!-- Title -->
          <text x="${chartWidth/2}" y="-10" text-anchor="middle" fill="white" font-size="16" font-weight="bold">
            Value Distribution
          </text>
          
          <!-- Axis labels -->
          <text x="${chartWidth/2}" y="${chartHeight + 45}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="14">
            Count
          </text>
        </g>
      </svg>
    `;

    // Convert SVG to PNG using canvas
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = width;
    canvas.height = height;

    img.onload = () => {
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `categorical_chart_${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
      }
    };

    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  };

  const exportChartAsSVG = (chartData: CategoricalData[], type: string) => {
    const width = 600;
    const height = 400;
    const margin = { top: 30, right: 30, bottom: 60, left: 120 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxCount = Math.max(...chartData.map(d => d.count));
    const barHeight = chartHeight / chartData.length;

    const bars = chartData.map((item, i) => {
      const barWidth = (item.count / maxCount) * chartWidth;
      const y = i * barHeight;
      const color = getColor(i);
      
      return `
        <rect x="0" y="${y}" width="${barWidth}" height="${barHeight - 5}" fill="${color}" opacity="0.8"/>
        <text x="-10" y="${y + barHeight/2 + 5}" text-anchor="end" fill="rgba(255,255,255,0.8)" font-size="12">
          ${item.value.length > 15 ? item.value.substring(0, 15) + '...' : item.value}
        </text>
        <text x="${barWidth + 10}" y="${y + barHeight/2 + 5}" fill="rgba(255,255,255,0.8)" font-size="12">
          ${item.count} (${item.percentage.toFixed(1)}%)
        </text>
      `;
    }).join('');

    const svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: #1a1a1a;">
        <defs>
          <style>
            text { font-family: Arial, sans-serif; }
          </style>
        </defs>
        
        <g transform="translate(${margin.left}, ${margin.top})">
          ${bars}
          
          <!-- Axes -->
          <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          
          <!-- Title -->
          <text x="${chartWidth/2}" y="-10" text-anchor="middle" fill="white" font-size="16" font-weight="bold">
            Value Distribution
          </text>
          
          <!-- Axis labels -->
          <text x="${chartWidth/2}" y="${chartHeight + 45}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="14">
            Count
          </text>
        </g>
      </svg>
    `;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `categorical_chart_${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full" style={{ height }}>
      {exportable && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={handlePNGExport}
            className="px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            PNG
          </button>
          <button
            onClick={handleSVGExport}
            className="px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            SVG
          </button>
        </div>
      )}
      
      <ResponsiveBar
        data={limitedData}
        keys={['count']}
        indexBy="value"
        margin={{ top: 20, right: 35, bottom: 25, left: 120 }}
        padding={0.2}
        layout="horizontal"
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={({ index }) => getColor(index)}
        theme={theme}
        borderRadius={3}
        borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 8,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: 20,
          format: (value) => value.toLocaleString(),
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 12,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: -90,
          format: (value: string) => value.length > 12 ? value.slice(0, 12) + '...' : value,
        }}
        enableGridY={false}
        enableGridX={true}
        enableLabel={false}
        isInteractive={interactive}
        tooltip={CustomTooltip}
        animate={true}
        motionConfig="gentle"
        role="application"
        ariaLabel="Categorical data distribution"
        barAriaLabel={function(e) {
          return e.id + ": " + e.formattedValue + " for " + e.indexValue;
        }}
      />
    </div>
  );
};

export default NivoCategoricalChart;