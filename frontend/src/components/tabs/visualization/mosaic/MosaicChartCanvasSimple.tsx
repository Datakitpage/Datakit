import React, { useRef, useEffect, useState } from 'react';
import { ChartType } from '@/store/chartsStore';
import * as vg from '@uwdata/vgplot';

export interface MosaicChartCanvasSimpleProps {
  data: any[];
  type: ChartType;
  xField: string;
  yField: string;
  xLabel: string;
  yLabel: string;
  tableName: string;
  width?: number;
  height?: number;
  colors: string[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

/**
 * Simple vgplot canvas implementation that works with client-side data
 * This version bypasses database queries and works directly with the data array
 */
const MosaicChartCanvasSimple: React.FC<MosaicChartCanvasSimpleProps> = ({
  data,
  type,
  xField,
  yField,
  xLabel,
  yLabel,
  width = 800,
  height = 400,
  colors,
  aggregation = 'sum'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = '';

      console.log('[MosaicCanvasSimple] Rendering with client data:', {
        type,
        dataLength: data.length,
        sampleRow: data[0]
      });

      // Determine actual field names from the data
      const sampleRow = data[0] || {};
      const actualXField = sampleRow.hasOwnProperty('dimension') ? 'dimension' : xField;
      const actualYField = sampleRow.hasOwnProperty(`${aggregation}_value`) ? `${aggregation}_value` : yField;

      console.log('[MosaicCanvasSimple] Using fields:', { actualXField, actualYField });

      // For very large datasets, use intelligent sampling
      let renderData = data;
      if (data.length > 100000) {
        const sampleSize = Math.min(25000, Math.max(5000, Math.floor(data.length / 40)));
        const step = Math.ceil(data.length / sampleSize);
        renderData = data.filter((_, i) => i % step === 0);
        console.log(`[MosaicCanvasSimple] Sampled ${renderData.length} from ${data.length} for performance`);
      }

      // Create vgplot chart with proper error handling
      let plot;

      switch (type) {
        case 'bar':
          plot = vg.plot(
            vg.barY(renderData, {
              x: actualXField,
              y: actualYField,
              fill: colors[0] || '#3b82f6',
              tip: true,
            }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.grid(true)
          );
          break;

        case 'scatter':
          plot = vg.plot(
            vg.dot(renderData, {
              x: actualXField,
              y: actualYField,
              fill: colors[0] || '#3b82f6',
              fillOpacity: 0.6,
              r: 3,
              tip: true,
            }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.grid(true)
          );
          break;

        case 'line':
          plot = vg.plot(
            vg.lineY(renderData, {
              x: actualXField,
              y: actualYField,
              stroke: colors[0] || '#3b82f6',
              strokeWidth: 2,
              tip: true,
            }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.grid(true)
          );
          break;

        case 'area':
          plot = vg.plot(
            vg.areaY(renderData, {
              x: actualXField,
              y: actualYField,
              fill: colors[0] || '#3b82f6',
              fillOpacity: 0.6,
              stroke: colors[0] || '#3b82f6',
              strokeWidth: 2,
              tip: true,
            }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.grid(true)
          );
          break;

        default:
          throw new Error(`Chart type ${type} not supported`);
      }

      // Render the plot
      if (plot) {
        containerRef.current.appendChild(plot);
        console.log('[MosaicCanvasSimple] Chart rendered successfully');
      }

      setError(null);
    } catch (err) {
      console.error('[MosaicCanvasSimple] Rendering error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render chart');
      
      // Show error state
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full">
            <div class="text-center p-8">
              <div class="text-xl mb-2 text-red-400">⚠️ Rendering Error</div>
              <div class="text-sm text-white/60">${err instanceof Error ? err.message : 'Unknown error'}</div>
            </div>
          </div>
        `;
      }
    }
  }, [data, type, xField, yField, xLabel, yLabel, width, height, colors, aggregation]);

  return (
    <div className="relative w-full h-full">
      {/* Chart container */}
      <div 
        ref={containerRef}
        className="w-full h-full [&_svg]:w-full [&_svg]:h-full"
        style={{ 
          minHeight: height,
          '--vgplot-background': 'transparent',
          '--vgplot-foreground': '#ffffff',
          '--vgplot-grid': '#ffffff20',
          '--vgplot-axis': '#ffffff60',
        } as React.CSSProperties}
      />

      {/* Performance indicators */}
      <div className="absolute top-2 left-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
        vgplot • {data.length.toLocaleString()} rows {data.length > 100000 ? `• ~${Math.floor(data.length / 40).toLocaleString()} rendered` : ''}
      </div>

      <div className="absolute bottom-2 left-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
        Client-side rendering • Fast interactions
      </div>

      <div className="absolute top-2 right-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
        🎯 Optimized vgplot
      </div>

      {/* Error overlay */}
      {error && (
        <div className="absolute bottom-2 right-2 bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded max-w-xs">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default MosaicChartCanvasSimple;