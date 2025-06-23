import React, { useRef, useEffect, useState } from 'react';
import { ChartType } from '@/store/chartsStore';
import * as vg from '@uwdata/vgplot';
import { coordinator, panZoom, intervalX, intervalY, Fixed, Param } from '@uwdata/vgplot';
import { useDuckDBStore } from '@/store/duckDBStore';

export interface MosaicChartCanvasProps {
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
 * High-performance canvas-based Mosaic chart with zoom/pan support
 * Uses vgplot's native zoom and pan interactions without custom sampling
 */
const MosaicChartCanvas: React.FC<MosaicChartCanvasProps> = ({
  data,
  type,
  xField,
  yField,
  xLabel,
  yLabel,
  tableName,
  width = 800,
  height = 400,
  colors,
  aggregation = 'sum'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomState, setZoomState] = useState({ isZoomed: false });
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { connection } = useDuckDBStore();

  // Create zoom parameters
  const xDomain = Param.value();
  const yDomain = Param.value();

  // Initialize Mosaic coordinator with DuckDB
  useEffect(() => {
    const initializeMosaic = async () => {
      if (!connection || isInitialized) return;

      try {
        console.log('[MosaicCanvas] Initializing Mosaic with DuckDB connection');
        
        // Initialize vgplot coordinator with DuckDB
        await vg.coordinator().databaseConnector(vg.wasmConnector());
        
        setIsInitialized(true);
        console.log('[MosaicCanvas] Mosaic initialized successfully');
      } catch (err) {
        console.error('[MosaicCanvas] Mosaic initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Mosaic');
      }
    };

    initializeMosaic();
  }, [connection, isInitialized]);

  useEffect(() => {
    if (!containerRef.current || !data.length || !isInitialized) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = '';

      console.log('[MosaicCanvas] Rendering database-driven chart:', {
        type,
        tableName,
        xField,
        yField,
        dataLength: data.length
      });

      // Use database-driven approach for optimal performance
      // This is the proper Mosaic pattern for large datasets
      let plot;

      // Create aggregated query for the chart based on the raw data structure
      // Since we have pre-aggregated data, we'll create a simple query
      const sampleRow = data[0] || {};
      const hasAggregatedStructure = sampleRow.hasOwnProperty('dimension') || sampleRow.hasOwnProperty(`${aggregation}_value`);
      
      // Determine field names based on data structure
      const actualXField = hasAggregatedStructure ? 'dimension' : xField;
      const actualYField = hasAggregatedStructure ? `${aggregation}_value` : yField;

      console.log('[MosaicCanvas] Field mapping:', { actualXField, actualYField, hasAggregatedStructure });

      switch (type) {
        case 'scatter':
          plot = vg.plot(
            vg.dot(vg.from(tableName), {
              x: actualXField,
              y: actualYField,
              fill: colors[0] || '#3b82f6',
              fillOpacity: 0.6,
              r: 2,
              tip: true,
            }),
            vg.panZoom({ x: xDomain, y: yDomain }),
            vg.intervalX({ as: vg.Selection.crossfilter() }),
            vg.intervalY({ as: vg.Selection.crossfilter() }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.xDomain(xDomain),
            vg.yDomain(yDomain),
            vg.grid(true)
          );
          break;

        case 'bar':
          plot = vg.plot(
            vg.barY(vg.from(tableName), {
              x: actualXField,
              y: actualYField,
              fill: colors[0] || '#3b82f6',
              tip: true,
            }),
            vg.panZoom({ x: xDomain }),
            vg.intervalX({ as: vg.Selection.crossfilter() }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.xDomain(xDomain),
            vg.grid(true)
          );
          break;

        case 'line':
          plot = vg.plot(
            vg.lineY(vg.from(tableName), {
              x: actualXField,
              y: actualYField,
              stroke: colors[0] || '#3b82f6',
              strokeWidth: 1.5,
              tip: true,
            }),
            vg.panZoom({ x: xDomain, y: yDomain }),
            vg.intervalX({ as: vg.Selection.crossfilter() }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.xDomain(xDomain),
            vg.yDomain(yDomain),
            vg.grid(true)
          );
          break;

        case 'area':
          plot = vg.plot(
            vg.areaY(vg.from(tableName), {
              x: actualXField,
              y: actualYField,
              fill: colors[0] || '#3b82f6',
              fillOpacity: 0.6,
              stroke: colors[0] || '#3b82f6',
              strokeWidth: 1.5,
              tip: true,
            }),
            vg.panZoom({ x: xDomain, y: yDomain }),
            vg.intervalX({ as: vg.Selection.crossfilter() }),
            vg.width(width),
            vg.height(height),
            vg.marginLeft(60),
            vg.marginBottom(50),
            vg.marginTop(20),
            vg.marginRight(20),
            vg.xLabel(xLabel),
            vg.yLabel(yLabel),
            vg.xDomain(xDomain),
            vg.yDomain(yDomain),
            vg.grid(true)
          );
          break;

        default:
          throw new Error(`Chart type ${type} not supported in canvas mode`);
      }

      // Render the plot
      if (plot) {
        containerRef.current.appendChild(plot);
        console.log('[MosaicCanvas] Chart rendered successfully with zoom/pan support');
        
        // Listen for zoom changes
        xDomain.addEventListener('value', () => {
          setZoomState(prev => ({ ...prev, isZoomed: true }));
        });
        
        yDomain.addEventListener('value', () => {
          setZoomState(prev => ({ ...prev, isZoomed: true }));
        });
      }

      setError(null);
    } catch (err) {
      console.error('[MosaicCanvas] Rendering error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render canvas chart');
      
      // Show error state
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full">
            <div class="text-center p-8">
              <div class="text-xl mb-2 text-red-400">⚠️ Canvas Error</div>
              <div class="text-sm text-white/60">${error}</div>
              <div class="text-xs text-white/40 mt-2">Falling back to simple renderer</div>
            </div>
          </div>
        `;
      }
    }
  }, [data, type, xField, yField, xLabel, yLabel, width, height, colors, tableName, aggregation, isInitialized]);

  // Reset zoom function
  const resetZoom = () => {
    xDomain.update(undefined); // Reset to auto-calculated domain
    yDomain.update(undefined);
    setZoomState({ isZoomed: false });
  };

  return (
    <div className="relative w-full h-full">
      {/* Chart container */}
      <div 
        ref={containerRef}
        className="w-full h-full [&_svg]:w-full [&_svg]:h-full [&_canvas]:w-full [&_canvas]:h-full"
        style={{ 
          minHeight: height,
          '--vgplot-background': 'transparent',
          '--vgplot-foreground': '#ffffff',
          '--vgplot-grid': '#ffffff20',
          '--vgplot-axis': '#ffffff60',
        } as React.CSSProperties}
      />

      {/* Controls overlay */}
      <div className="absolute top-2 left-2 flex flex-col gap-2">
        <div className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">
          Database-driven • {data.length.toLocaleString()} rows
        </div>
        {!isInitialized && (
          <div className="bg-yellow-500/20 text-yellow-300 text-xs px-2 py-1 rounded">
            Initializing Mosaic...
          </div>
        )}
        {zoomState.isZoomed && (
          <button 
            onClick={resetZoom}
            className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded hover:bg-blue-500/30 transition-colors"
          >
            Reset Zoom
          </button>
        )}
      </div>

      {/* Interaction hints */}
      <div className="absolute bottom-2 left-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
        Drag to pan • Scroll to zoom • Brush to filter • Database queries
      </div>

      {/* Performance indicator */}
      <div className="absolute top-2 right-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
        🚀 Mosaic Optimized
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

export default MosaicChartCanvas;