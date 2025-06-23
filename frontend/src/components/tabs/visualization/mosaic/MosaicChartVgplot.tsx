import React, { useRef, useEffect, useState } from 'react';
import { ChartType } from '@/store/chartsStore';
import { useDuckDBStore } from '@/store/duckDBStore';

// Import vgplot and components
import * as vg from '@uwdata/vgplot';

export interface MosaicChartVgplotProps {
  tableName: string;
  type: ChartType;
  xField: string;
  yField: string;
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  colors: string[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  limit?: number;
  onCrossFilter?: (selection: unknown) => void;
}

/**
 * Proper vgplot implementation using grammar of graphics
 * Leverages database-pushed computation and built-in interactors
 */
const MosaicChartVgplot: React.FC<MosaicChartVgplotProps> = ({
  tableName,
  type,
  xField,
  yField,
  xLabel,
  yLabel,
  width = 800,
  height = 400,
  colors,
  aggregation = 'sum',
  limit = 10000,
  onCrossFilter
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<any>(null);
  
  const { connection } = useDuckDBStore();

  // Initialize vgplot with DuckDB connection
  useEffect(() => {
    const initializeVgplot = async () => {
      if (!connection || isInitialized) return;

      try {
        console.log('[VgPlot] Initializing with DuckDB connection');
        
        // Create coordinator and configure with DuckDB
        const coordinator = vg.coordinator();
        coordinator.databaseClient(connection);
        
        // Create selection for interactivity
        const sel = vg.Selection.intersect();
        setSelection(sel);
        
        setIsInitialized(true);
        setError(null);
        
        console.log('[VgPlot] Successfully initialized');
      } catch (err) {
        console.error('[VgPlot] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize vgplot');
      }
    };

    initializeVgplot();
  }, [connection]);

  // Create and render the chart
  useEffect(() => {
    if (!containerRef.current || !isInitialized || !tableName) return;

    // Clear previous chart
    containerRef.current.innerHTML = '';

    try {
      console.log('[VgPlot] Creating chart:', { type, tableName, xField, yField });

      // Create data source reference
      const data = vg.from(tableName);
      
      // Build aggregation expression if needed
      const yExpr = aggregation !== 'count' 
        ? vg[aggregation](yField)
        : vg.count();

      // Create appropriate mark based on chart type
      let mark;
      const commonProps = {
        x: xField,
        y: yExpr,
        fill: colors[0] || vg.steelblue,
        tip: true // Enable tooltips
      };

      switch (type) {
        case 'bar':
          mark = vg.barY(data, {
            ...commonProps,
            sort: { y: '-y' }, // Sort by value descending
          });
          break;

        case 'line':
          mark = vg.lineY(data, {
            ...commonProps,
            stroke: colors[0] || vg.steelblue,
            strokeWidth: 2,
            marker: true,
            // M4 optimization will be applied automatically for large datasets
          });
          break;

        case 'area':
          mark = vg.areaY(data, {
            ...commonProps,
            fillOpacity: 0.3,
            stroke: colors[0] || vg.steelblue,
            strokeWidth: 2,
          });
          break;

        case 'scatter':
          // Use hexbin for large datasets, dots for small
          const hexThreshold = 5000;
          mark = limit > hexThreshold
            ? vg.hexbin(data, {
                x: xField,
                y: yField,
                r: vg.count(),
                fill: vg.count(),
                tip: true,
              })
            : vg.dot(data, {
                x: xField,
                y: yField,
                fill: colors[0] || vg.steelblue,
                fillOpacity: 0.6,
                r: 3,
                tip: true,
              });
          break;

        default:
          throw new Error(`Chart type ${type} not supported`);
      }

      // Create plot with mark and attributes
      const plotSpec = [
        mark,
        vg.width(width),
        vg.height(height),
        vg.marginLeft(60),
        vg.marginBottom(40),
        vg.xLabel(xLabel),
        vg.yLabel(yLabel),
        vg.xGrid(true),
        vg.yGrid(true),
        // Add pan/zoom interactor
        vg.panZoom({ x: true, y: true }),
        // Add highlight interactor for selection
        vg.highlight({ by: selection }),
        // Style overrides for dark theme
        vg.style({
          backgroundColor: 'transparent',
          color: '#ffffff',
        }),
      ];

      // Add toggle interactor for bar and scatter charts
      if (type === 'bar' || type === 'scatter') {
        plotSpec.push(vg.toggle({ as: selection }));
      }

      // Add interval brush for line and area charts
      if (type === 'line' || type === 'area') {
        plotSpec.push(vg.intervalX({ as: selection }));
      }

      // Create and render the plot
      const plot = vg.plot(...plotSpec);
      containerRef.current.appendChild(plot);
      
      // Apply custom styles for dark theme
      const style = document.createElement('style');
      style.textContent = `
        .vgplot {
          background: transparent !important;
        }
        .vgplot text {
          fill: #e5e7eb !important;
        }
        .vgplot .tick line,
        .vgplot .domain {
          stroke: #4b5563 !important;
        }
        .vgplot-tooltip {
          background: #1f2937 !important;
          border: 1px solid #374151 !important;
          color: #f3f4f6 !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
          font-size: 12px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
        }
        .vgplot .grid line {
          stroke: #374151 !important;
          stroke-dasharray: 2,2 !important;
        }
        /* Highlight selected elements */
        .vgplot .selected {
          fill-opacity: 1 !important;
          stroke-width: 2 !important;
        }
        .vgplot .non-selected {
          fill-opacity: 0.3 !important;
        }
      `;
      containerRef.current.appendChild(style);
      
      // Set up selection listener
      if (selection && onCrossFilter) {
        selection.addEventListener('change', () => {
          const value = selection.value();
          console.log('[VgPlot] Selection changed:', value);
          onCrossFilter(value);
        });
      }
      
      console.log('[VgPlot] Chart rendered successfully');

    } catch (err) {
      console.error('[VgPlot] Rendering error:', err);
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
  }, [isInitialized, type, xField, yField, xLabel, yLabel, tableName, width, height, colors, aggregation, limit, selection, onCrossFilter]);

  return (
    <div className="relative w-full h-full bg-darkNav/20 rounded-lg">
      {/* Main chart container */}
      <div 
        ref={containerRef}
        className="w-full h-full p-4"
        style={{ minHeight: height }}
      />
      
      {/* Performance indicators */}
      <div className="absolute top-2 right-2 flex gap-2">
        <div className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">
          vgplot • {tableName}
        </div>
        <div className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
          🚀 Database-Powered
        </div>
      </div>
      
      {/* Interaction hints based on chart type */}
      <div className="absolute bottom-2 left-2 flex gap-2">
        <div className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
          Drag to pan • Scroll to zoom
        </div>
        {(type === 'bar' || type === 'scatter') && (
          <div className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
            Click to select
          </div>
        )}
        {(type === 'line' || type === 'area') && (
          <div className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
            Drag to brush
          </div>
        )}
      </div>
      
      {/* Loading state */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="text-white">Initializing vgplot engine...</div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute bottom-12 right-2 bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded max-w-xs">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default MosaicChartVgplot;