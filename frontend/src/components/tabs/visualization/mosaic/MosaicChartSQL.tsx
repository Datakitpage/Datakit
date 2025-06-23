import React, { useRef, useEffect, useState } from 'react';
import { ChartType } from '@/store/chartsStore';
import { useDuckDBStore } from '@/store/duckDBStore';

// Import Mosaic components
import * as vg from '@uwdata/vgplot';
import { Coordinator } from '@uwdata/mosaic-core';
import { DuckDBClient } from '@uwdata/mosaic-sql';

export interface MosaicChartSQLProps {
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
  samplingMode?: 'fixed' | 'custom';
  onCrossFilter?: (selection: unknown) => void;
}

/**
 * SQL-based Mosaic Chart for true scalable visualization
 * Pushes all computation to DuckDB for optimal performance
 */
const MosaicChartSQL: React.FC<MosaicChartSQLProps> = ({
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
  samplingMode = 'fixed',
  onCrossFilter
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  
  const { connection, executeQuery } = useDuckDBStore();

  // Get table row count
  useEffect(() => {
    const getRowCount = async () => {
      if (!connection || !tableName) return;
      
      try {
        const result = await executeQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = result?.toArray()[0]?.count || 0;
        setRowCount(count);
        console.log(`[MosaicSQL] Table ${tableName} has ${count} rows`);
      } catch (err) {
        console.error('[MosaicSQL] Error getting row count:', err);
      }
    };
    
    getRowCount();
  }, [connection, tableName, executeQuery]);

  // Initialize Mosaic coordinator with DuckDB
  useEffect(() => {
    const initializeMosaic = async () => {
      if (!connection || isInitialized) return;

      try {
        console.log('[MosaicSQL] Initializing with DuckDB connection');
        
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
        
        console.log('[MosaicSQL] Successfully initialized with DuckDB');
      } catch (err) {
        console.error('[MosaicSQL] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Mosaic');
      }
    };

    initializeMosaic();
  }, [connection, isInitialized]);

  // Create and render the chart using SQL queries
  useEffect(() => {
    if (!containerRef.current || !coordinator || !isInitialized || !tableName) return;

    // Clear previous chart
    containerRef.current.innerHTML = '';

    try {
      console.log('[MosaicSQL] Creating SQL-based chart:', { type, tableName, xField, yField, rowCount });

      let plot;
      
      // Common chart options with dark theme
      const commonOptions = {
        width,
        height,
        marginLeft: 60,
        marginBottom: 40,
        marginTop: 20,
        marginRight: 20,
        style: {
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
        },
        grid: true,
        inset: 0.5,
      };

      // Create SQL table reference
      const table = vg.table(tableName);

      // Create the appropriate chart type with SQL queries
      switch (type) {
        case 'bar':
          // Aggregate data in DuckDB for bar charts
          plot = vg.plot(
            {
              ...commonOptions,
              x: { label: xLabel, tickRotate: -45 },
              y: { label: yLabel, grid: true },
              marks: [
                vg.barY(
                  vg.from(table, {
                    // Group by dimension and aggregate measure
                    query: `
                      SELECT 
                        "${xField}" as ${xField},
                        ${aggregation.toUpperCase()}("${yField}") as ${yField}
                      FROM $table
                      GROUP BY "${xField}"
                      ORDER BY ${yField} DESC
                      LIMIT ${limit}
                    `
                  }),
                  {
                    x: xField,
                    y: yField,
                    fill: colors[0] || '#3b82f6',
                    tip: true,
                  }
                ),
              ],
            }
          );
          break;

        case 'line':
          // For line charts, we need ordered data
          plot = vg.plot(
            {
              ...commonOptions,
              x: { label: xLabel },
              y: { label: yLabel, grid: true },
              marks: [
                vg.lineY(
                  vg.from(table, {
                    query: `
                      SELECT 
                        "${xField}" as ${xField},
                        ${aggregation.toUpperCase()}("${yField}") as ${yField}
                      FROM $table
                      GROUP BY "${xField}"
                      ORDER BY "${xField}"
                      LIMIT ${limit}
                    `
                  }),
                  {
                    x: xField,
                    y: yField,
                    stroke: colors[0] || '#3b82f6',
                    strokeWidth: 2,
                    tip: true,
                    marker: true,
                  }
                ),
              ],
            }
          );
          break;

        case 'scatter':
          // For scatter plots, use sampling for large datasets
          const sampleSize = rowCount && rowCount > 100000 ? 50000 : limit;
          
          plot = vg.plot(
            {
              ...commonOptions,
              x: { label: xLabel },
              y: { label: yLabel },
              color: { 
                scheme: 'blues', 
                type: 'linear',
                label: 'Density'
              },
              marks: [
                // Use hexbin for large datasets
                rowCount && rowCount > 10000
                  ? vg.hexbin(
                      vg.from(table, {
                        query: `
                          SELECT 
                            "${xField}" as ${xField},
                            "${yField}" as ${yField}
                          FROM $table
                          WHERE "${xField}" IS NOT NULL 
                            AND "${yField}" IS NOT NULL
                          ${rowCount > 100000 ? `USING SAMPLE ${sampleSize}` : ''}
                          LIMIT ${sampleSize}
                        `
                      }),
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
                      vg.from(table, {
                        query: `
                          SELECT 
                            "${xField}" as ${xField},
                            "${yField}" as ${yField}
                          FROM $table
                          WHERE "${xField}" IS NOT NULL 
                            AND "${yField}" IS NOT NULL
                          LIMIT ${limit}
                        `
                      }),
                      {
                        x: xField,
                        y: yField,
                        fill: colors[0] || '#3b82f6',
                        fillOpacity: 0.6,
                        r: 3,
                        tip: true,
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
                  vg.from(table, {
                    query: `
                      SELECT 
                        "${xField}" as ${xField},
                        ${aggregation.toUpperCase()}("${yField}") as ${yField}
                      FROM $table
                      GROUP BY "${xField}"
                      ORDER BY "${xField}"
                      LIMIT ${limit}
                    `
                  }),
                  {
                    x: xField,
                    y: yField,
                    fill: colors[0] || '#3b82f6',
                    fillOpacity: 0.3,
                    stroke: colors[0] || '#3b82f6',
                    strokeWidth: 2,
                    tip: true,
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
        
        // Add custom styling for dark theme
        const style = document.createElement('style');
        style.textContent = `
          .vgplot {
            background: transparent !important;
          }
          .vgplot text {
            fill: #ffffff !important;
          }
          .vgplot .tick line {
            stroke: #ffffff40 !important;
          }
          .vgplot .domain {
            stroke: #ffffff60 !important;
          }
          .vgplot-tooltip {
            background: #1f2937 !important;
            border: 1px solid #ffffff20 !important;
            color: #ffffff !important;
            border-radius: 4px !important;
            padding: 8px !important;
            font-size: 12px !important;
          }
        `;
        containerRef.current.appendChild(style);
        
        console.log('[MosaicSQL] Chart rendered successfully');
      }

    } catch (err) {
      console.error('[MosaicSQL] Rendering error:', err);
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
  }, [coordinator, isInitialized, type, xField, yField, xLabel, yLabel, tableName, width, height, colors, aggregation, limit, rowCount, error]);

  return (
    <div className="relative w-full h-full bg-darkNav/20 rounded-lg">
      {/* Main chart container */}
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: height }}
      />
      
      {/* Performance indicators */}
      <div className="absolute top-2 right-2 flex gap-2">
        {rowCount && (
          <div className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">
            {rowCount > limit ? `Showing top ${limit.toLocaleString()} of ` : ''}{rowCount.toLocaleString()} rows
          </div>
        )}
        <div className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
          🚀 SQL-Powered
        </div>
      </div>
      
      {/* Interaction hints */}
      <div className="absolute bottom-2 left-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
        Drag to pan • Scroll to zoom • Click to filter
      </div>
      
      {/* Loading state */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="text-white">Initializing SQL visualization engine...</div>
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

export default MosaicChartSQL;