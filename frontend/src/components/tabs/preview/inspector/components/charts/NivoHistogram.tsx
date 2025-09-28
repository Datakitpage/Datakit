import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface HistogramData {
  bin: string;
  count: number;
  range: string;
  binStart: number;
  binEnd: number;
}

interface NivoHistogramProps {
  data: HistogramData[];
  color?: string;
  height?: number;
  interactive?: boolean;
  exportable?: boolean;
  onExport?: (format: string) => void;
}

const NivoHistogram: React.FC<NivoHistogramProps> = ({ 
  data, 
  color = '#2dd4bf', // primary color
  height = 180,
  interactive = true,
  exportable = false,
  onExport
}) => {
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
      <div className="text-sm font-medium text-foreground mb-1">
        Range: {data.range}
      </div>
      <div className="text-sm text-muted-foreground">
        Count: <span className="font-mono text-primary">{value.toLocaleString()}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {data.binStart} → {data.binEnd}
      </div>
    </div>
  );

  const handleSVGExport = () => {
    // Always export as SVG directly
    exportChartAsSVG(data, 'histogram');
  };

  const handlePNGExport = () => {
    // Create PNG from SVG using canvas
    exportChartAsPNG(data, 'histogram');
  };

  const exportChartAsPNG = (chartData: HistogramData[], type: string) => {
    const width = 600;
    const height = 400;
    const margin = { top: 30, right: 30, bottom: 60, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxCount = Math.max(...chartData.map(d => d.count));
    const barWidth = chartWidth / chartData.length;

    const bars = chartData.map((bin, i) => {
      const barHeight = (bin.count / maxCount) * chartHeight;
      const x = i * barWidth;
      const y = chartHeight - barHeight;
      
      return `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}" fill="#2dd4bf" opacity="0.8" stroke="#2dd4bf" stroke-width="1"/>`;
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
          <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          
          <!-- Title -->
          <text x="${chartWidth/2}" y="-10" text-anchor="middle" fill="white" font-size="16" font-weight="bold">
            Data Distribution
          </text>
          
          <!-- Axis labels -->
          <text x="${chartWidth/2}" y="${chartHeight + 45}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="14">
            Value Range
          </text>
          <text x="-60" y="${chartHeight/2}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="14" transform="rotate(-90, -60, ${chartHeight/2})">
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
            link.download = `histogram_chart_${Date.now()}.png`;
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

  const exportChartAsSVG = (chartData: HistogramData[], type: string) => {
    const width = 600;
    const height = 400;
    const margin = { top: 30, right: 30, bottom: 60, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxCount = Math.max(...chartData.map(d => d.count));
    const barWidth = chartWidth / chartData.length;

    const bars = chartData.map((bin, i) => {
      const barHeight = (bin.count / maxCount) * chartHeight;
      const x = i * barWidth;
      const y = chartHeight - barHeight;
      
      return `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}" fill="#2dd4bf" opacity="0.8" stroke="#2dd4bf" stroke-width="1"/>`;
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
          <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          
          <!-- Title -->
          <text x="${chartWidth/2}" y="-10" text-anchor="middle" fill="white" font-size="16" font-weight="bold">
            Data Distribution
          </text>
          
          <!-- Axis labels -->
          <text x="${chartWidth/2}" y="${chartHeight + 45}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="14">
            Value Range
          </text>
          <text x="-60" y="${chartHeight/2}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="14" transform="rotate(-90, -60, ${chartHeight/2})">
            Count
          </text>
        </g>
      </svg>
    `;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `histogram_${Date.now()}.svg`;
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
        data={data}
        keys={['count']}
        indexBy="bin"
        margin={{ top: 20, right: 25, bottom: 60, left: 65 }}
        padding={0.1}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={[color]}
        theme={theme}
        borderRadius={2}
        borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 12,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: 45,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 12,
          tickRotation: 0,
          legend: null,
          legendPosition: 'middle',
          legendOffset: -50,
        }}
        enableGridY={true}
        enableGridX={false}
        enableLabel={false}
        isInteractive={interactive}
        tooltip={CustomTooltip}
        animate={true}
        motionConfig="gentle"
        role="application"
        ariaLabel="Data distribution histogram"
        barAriaLabel={function(e) {
          return e.id + ": " + e.formattedValue + " in range: " + e.indexValue;
        }}
      />
    </div>
  );
};

export default NivoHistogram;