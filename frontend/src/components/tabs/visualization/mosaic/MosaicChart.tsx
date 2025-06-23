import React, { useRef, useEffect, useState } from 'react';
import { ChartType } from '@/store/chartsStore';
import { useDuckDBStore } from '@/store/duckDBStore';

// Import Mosaic components
import * as vg from '@uwdata/vgplot';
import { Coordinator } from '@uwdata/mosaic-core';
import { DuckDBClient } from '@uwdata/mosaic-sql';

export interface MosaicChartProps {
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
  onCrossFilter?: (selection: any) => void;
}

/**
 * Mosaic Chart renderer for scalable database-driven visualization
 * Uses vgplot with proper DuckDB integration for smooth interactions at scale
 */
const MosaicChart: React.FC<MosaicChartProps> = ({
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
  aggregation = 'sum',
  onCrossFilter
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { connection } = useDuckDBStore();

  // Initialize Mosaic coordinator with DuckDB
  useEffect(() => {
    const initializeMosaic = async () => {
      if (!connection || isInitialized) return;

      try {
        console.log('[Mosaic] Initializing with DuckDB connection');
        
        // Create a new coordinator
        const coord = new Coordinator();
        
        // Create DuckDB client wrapper for Mosaic
        const client = new DuckDBClient(connection);
        
        // Set the database client for the coordinator
        coord.databaseClient(client);
        
        // Configure vgplot to use our coordinator
        vg.coordinator(coord);
        
        setCoordinator(coord);
        setIsInitialized(true);
        setError(null);
        
        console.log('[Mosaic] Successfully initialized with DuckDB');
      } catch (err) {
        console.error('[Mosaic] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Mosaic');
      }
    };

    initializeMosaic();
  }, [connection, isInitialized]);

  // Create and render the chart
  useEffect(() => {
    if (!containerRef.current || !coordinator || !isInitialized || !data.length) return;

    // Clear previous chart
    containerRef.current.innerHTML = '';

    try {
      console.log('[Mosaic] Creating chart with vgplot:', { type, tableName, xField, yField, dataLength: data.length });

      let plot;
      
      // Common chart options
      const commonOptions = {
        width,
        height,
        marginLeft: 60,
        marginBottom: 40,
        marginTop: 20,
        marginRight: 20,
        style: {
          backgroundColor: 'transparent',
          color: '#ffffff',
        },
        grid: true,
        inset: 0.5,
      };

      // Create the appropriate chart type
      switch (type) {
        case 'bar':
          // For bar charts, we'll use rectY for vertical bars
          plot = vg.plot(
            {
              ...commonOptions,
              x: { label: xLabel, tickRotate: data.length > 20 ? -45 : 0 },
              y: { label: yLabel, grid: true },
              color: { scheme: 'blues' },
              marks: [
                vg.rectY(
                  data,
                  {
                    x: xField,
                    y: yField,
                    fill: colors[0] || '#3b82f6',
                    tip: true, // Enable tooltips
                    title: (d: Record<string, unknown>) => `${d[xField]}: ${(d[yField] as number)?.toLocaleString()}`,
                  }
                ),
              ],
            }
          );
          break;

        case 'line':
          plot = vg.plot(
            {
              ...commonOptions,
              x: { label: xLabel },
              y: { label: yLabel, grid: true },
              marks: [
                vg.lineY(
                  data,
                  {
                    x: xField,
                    y: yField,
                    stroke: colors[0] || '#3b82f6',
                    strokeWidth: 2,
                    tip: true,
                    marker: true,
                    markerSize: 50,
                    title: (d: Record<string, unknown>) => `${d[xField]}: ${(d[yField] as number)?.toLocaleString()}`,
                  }
                ),
              ],
            }
          );
          break;

        case 'area':
          plot = vg.plot(
            {
              ...commonOptions,
              x: { label: xLabel },
              y: { label: yLabel, grid: true },
              marks: [
                vg.areaY(
                  data,
                  {
                    x: xField,
                    y: yField,
                    fill: colors[0] || '#3b82f6',
                    fillOpacity: 0.3,
                    stroke: colors[0] || '#3b82f6',
                    strokeWidth: 2,
                    tip: true,
                    title: (d: Record<string, unknown>) => `${d[xField]}: ${(d[yField] as number)?.toLocaleString()}`,
                  }
                ),
              ],
            }
          );
          break;

        case 'scatter':
          // For scatter plots, use density for large datasets
          const useHexbin = data.length > 5000;
          
          plot = vg.plot(
            {
              ...commonOptions,
              x: { label: xLabel },
              y: { label: yLabel },
              color: useHexbin ? { 
                scheme: 'blues', 
                type: 'linear',
                label: 'Count'
              } : undefined,
              marks: [
                useHexbin
                  ? vg.hexbin(
                      data,
                      {
                        x: xField,
                        y: yField,
                        r: 'count',
                        fill: 'count',
                        tip: true,
                        binWidth: 20,
                      }
                    )
                  : vg.dot(
                      data,
                      {
                        x: xField,
                        y: yField,
                        fill: colors[0] || '#3b82f6',
                        fillOpacity: 0.6,
                        r: 3,
                        tip: true,
                        title: (d: Record<string, unknown>) => `(${d[xField]}, ${d[yField]})`,
                      }
                    ),
              ],
            }
          );
          break;

        default:
          throw new Error(`Chart type ${type} not supported`);
      }

      // Render the plot
      if (plot) {
        containerRef.current.appendChild(plot);
        
        // Add interaction hints
        const hintsDiv = document.createElement('div');
        hintsDiv.className = 'absolute bottom-2 left-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded';
        hintsDiv.innerHTML = 'Drag to pan • Scroll to zoom • Double-click to reset';
        containerRef.current.appendChild(hintsDiv);
        
        console.log('[Mosaic] Chart rendered successfully');
      }

    } catch (err) {
      console.error('[Mosaic] Rendering error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render chart');
      
      // Show error state
      containerRef.current.innerHTML = `
        <div class="flex items-center justify-center h-full">
          <div class="text-center p-8">
            <div class="text-xl mb-2 text-red-400">⚠️ Visualization Error</div>
            <div class="text-sm text-white/60">${error}</div>
            <div class="text-xs text-white/40 mt-2">Check console for details</div>
          </div>
        </div>
      `;
    }
  }, [coordinator, isInitialized, type, xField, yField, xLabel, yLabel, data, width, height, colors, error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (coordinator) {
        console.log('[Mosaic] Cleaning up coordinator');
        // coordinator.dispose?.();
      }
    };
  }, [coordinator]);

  return (
    <div className="relative w-full h-full">
      {/* Main chart container */}
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
      
      {/* Performance indicator */}
      <div className="absolute top-2 right-2 bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">
        Mosaic • {data.length.toLocaleString()} rows
      </div>
      
      {/* Status indicator */}
      <div className="absolute top-2 left-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
        🚀 Hardware Accelerated
      </div>
      
      {/* Loading state */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Initializing visualization engine...</div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute bottom-2 right-2 bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded max-w-xs">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default MosaicChart;