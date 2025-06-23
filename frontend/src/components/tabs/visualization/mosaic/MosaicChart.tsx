import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChartType } from '@/store/chartsStore';
import { useDuckDBStore } from '@/store/duckDBStore';

// Debounce utility for smooth interactions
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Import Mosaic components
import { Coordinator, Selection, Param } from '@uwdata/mosaic-core';
import { sql } from '@uwdata/mosaic-sql';
import * as vg from '@uwdata/vgplot';

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

interface BrushSelection {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface ProgressiveQuery {
  sql: string;
  bounds: BrushSelection;
  timestamp: number;
}

/**
 * Mosaic Chart renderer for scalable database-driven visualization
 * Pushes computation to DuckDB for optimal performance with large datasets
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  
  const [coordinator, setCoordinator] = useState<any>(null);
  const [selection, setSelection] = useState<any>(null);
  const [brushSelection, setBrushSelection] = useState<BrushSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressiveData, setProgressiveData] = useState<any[]>(data);
  const [queryQueue, setQueryQueue] = useState<ProgressiveQuery[]>([]);
  
  const { connection, executeQuery } = useDuckDBStore();

  // Debug: Log the field names being passed
  React.useEffect(() => {
    console.log('[Mosaic] Chart props:', {
      xField,
      yField,
      xLabel,
      yLabel,
      tableName,
      dataLength: data.length,
      sampleData: data.slice(0, 2)
    });
  }, [xField, yField, xLabel, yLabel, tableName, data.length]);

  // Initialize Mosaic coordinator
  useEffect(() => {
    if (!connection) return;

    try {
      // Initialize Mosaic coordinator with DuckDB connection
      const coord = new Coordinator();
      const sel = new Selection();
      
      // Configure vgplot to use our coordinator
      vg.coordinator(coord);
      
      setCoordinator(coord);
      setSelection(sel);
      
      console.log('Mosaic initialized with DuckDB connection for table:', tableName);

    } catch (error) {
      console.error('Failed to initialize Mosaic:', error);
    }

    return () => {
      // Cleanup coordinator
      coordinator?.dispose?.();
    };
  }, [connection, tableName]);

  // Progressive query execution with debouncing
  const executeProgressiveQuery = React.useCallback(async (bounds: BrushSelection) => {
    if (!connection || !tableName || !bounds) return;

    try {
      // First check which columns actually exist in the table
      const schemaQuery = `PRAGMA table_info("${tableName}")`;
      const schemaResult = await executeQuery(schemaQuery);
      const columns = schemaResult?.toArray().map((row: any) => row.name) || [];
      
      console.log('[Mosaic] Available columns:', columns);
      console.log('[Mosaic] Requested fields:', { xField, yField });
      
      // Check if the requested fields exist
      if (!columns.includes(xField) || !columns.includes(yField)) {
        console.warn('[Mosaic] Requested fields not found in table. Available:', columns);
        return;
      }

      // Generate progressive query for the selected region
      const queryStr = `
        SELECT 
          "${xField}" as x,
          "${yField}" as y,
          COUNT(*) as density
        FROM "${tableName}"
        WHERE "${xField}" BETWEEN ${bounds.x1} AND ${bounds.x2}
          AND "${yField}" BETWEEN ${bounds.y1} AND ${bounds.y2}
        GROUP BY "${xField}", "${yField}"
        ORDER BY density DESC
        LIMIT 1000
      `;

      console.log('[Mosaic] Executing progressive query:', queryStr);
      console.log('[Mosaic] Bounds:', bounds);
      
      const result = await executeQuery(queryStr);
      const newData = result?.toArray() || [];
      
      console.log('[Mosaic] Progressive query result:', newData.length, 'rows');
      setProgressiveData(newData);
      
      // Trigger cross-filter callback
      if (onCrossFilter) {
        onCrossFilter({
          bounds,
          data: newData,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error('[Mosaic] Progressive query failed:', error);
      console.error('[Mosaic] Error details:', { xField, yField, tableName, bounds });
    }
  }, [connection, tableName, xField, yField, executeQuery, onCrossFilter]);

  // Debounced progressive query execution with optimized timing
  const debouncedProgressiveQuery = React.useCallback(
    debounce((bounds: BrushSelection) => {
      executeProgressiveQuery(bounds);
    }, 100), // Reduced to 100ms for more responsive zoom interactions
    [executeProgressiveQuery]
  );

  // Calculate data bounds for scaling - handle aggregated data format
  const dataBounds = React.useMemo(() => {
    if (!data || data.length === 0) return null;
    
    console.log('[Mosaic] Calculating bounds from data sample:', data.slice(0, 3));
    
    // For large datasets, sample for bounds calculation to prevent stack overflow
    const sampleSize = Math.min(1000, data.length);
    const sampleData = data.length > sampleSize ? 
      data.filter((_, i) => i % Math.ceil(data.length / sampleSize) === 0) : 
      data;
    
    // Handle both raw data and aggregated data formats
    const xValues = sampleData.map(d => {
      // Try different field access patterns
      const value = d[xField] || d.dimension || d.x || 0;
      return Number(value);
    }).filter(v => !isNaN(v));
    
    const yValues = sampleData.map(d => {
      // Try different field access patterns for aggregated data
      const value = d[yField] || d.sum_value || d.avg_value || d.count_value || d.value || d.y || 0;
      return Number(value);
    }).filter(v => !isNaN(v));
    
    console.log('[Mosaic] Bounds calculation:', {
      xValues: xValues.slice(0, 5),
      yValues: yValues.slice(0, 5),
      xField,
      yField
    });
    
    if (xValues.length === 0 || yValues.length === 0) {
      console.warn('[Mosaic] No valid numeric values found for bounds');
      return null;
    }
    
    const bounds = {
      xMin: Math.min(...xValues),
      xMax: Math.max(...xValues),
      yMin: Math.min(...yValues),
      yMax: Math.max(...yValues)
    };
    
    console.log('[Mosaic] Calculated bounds:', bounds);
    return bounds;
  }, [data.length, xField, yField]); // Remove 'data' itself to prevent circular deps

  // Scale functions
  const xScale = React.useCallback((value: number) => {
    if (!dataBounds) return 0;
    return 80 + ((value - dataBounds.xMin) / (dataBounds.xMax - dataBounds.xMin)) * (width - 110);
  }, [dataBounds, width]);

  const yScale = React.useCallback((value: number) => {
    if (!dataBounds) return 0;
    return 20 + (height - 80) - ((value - dataBounds.yMin) / (dataBounds.yMax - dataBounds.yMin)) * (height - 100);
  }, [dataBounds, height]);

  // Inverse scale functions
  const xInverse = React.useCallback((pixel: number) => {
    if (!dataBounds) return 0;
    const ratio = (pixel - 80) / (width - 110);
    return dataBounds.xMin + ratio * (dataBounds.xMax - dataBounds.xMin);
  }, [dataBounds, width]);

  const yInverse = React.useCallback((pixel: number) => {
    if (!dataBounds) return 0;
    const ratio = 1 - (pixel - 20) / (height - 100);
    return dataBounds.yMin + ratio * (dataBounds.yMax - dataBounds.yMin);
  }, [dataBounds, height]);

  // Render chart using vgplot
  useEffect(() => {
    if (!containerRef.current || !coordinator || !dataBounds) return;

    // Clear previous chart
    containerRef.current.innerHTML = '';

    try {
      // Render interactive canvas-based Mosaic chart with progressive querying
      console.log('Creating Mosaic chart for table:', tableName, 'with', data.length, 'rows');
      
      const canvas = canvasRef.current;
      if (!canvas || !dataBounds) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set up high DPI canvas
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background with visible debugging
      ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
      ctx.fillRect(0, 0, width, height);
      
      // Draw plot area background
      ctx.fillStyle = 'rgba(40, 40, 40, 0.3)';
      ctx.fillRect(80, 20, width - 110, height - 80);

      // Draw axes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // X-axis
      ctx.moveTo(80, height - 60);
      ctx.lineTo(width - 30, height - 60);
      // Y-axis
      ctx.moveTo(80, 20);
      ctx.lineTo(80, height - 60);
      ctx.stroke();

      // Draw data points with progressive detail
      const currentData = progressiveData.length > 0 ? progressiveData : data.slice(0, 10000);
      
      console.log('[Mosaic] Rendering data:', {
        currentDataLength: currentData.length,
        samplePoint: currentData[0],
        dataBounds,
        xField,
        yField,
        type
      });
      
      switch (type) {
        case 'scatter':
          ctx.fillStyle = colors[0] || '#3b82f6';
          let scatterPoints = 0;
          currentData.forEach(point => {
            const x = xScale(Number(point[xField]));
            const y = yScale(Number(point[yField]));
            
            if (x >= 80 && x <= width - 30 && y >= 20 && y <= height - 60) {
              ctx.fillRect(x - 1, y - 1, 2, 2);
              scatterPoints++;
            }
          });
          console.log('[Mosaic] Drew', scatterPoints, 'scatter points');
          break;

        case 'bar':
          // For bar charts with categorical data (e.g., Brand vs Price)
          console.log('[Mosaic] Bar chart data sample:', currentData.slice(0, 5));
          
          const barData = currentData.slice(0, 50); // Show top 50 bars
          const barWidth = Math.max(4, (width - 110) / Math.max(barData.length, 1) * 0.8);
          
          ctx.fillStyle = colors[0] || '#3b82f6';
          
          let barsDrawn = 0;
          barData.forEach((point, i) => {
            // For aggregated data from the query: {Brand: "Nike", Price: 12500, count: 150}
            const measureValue = point[yField] || point.sum_value || point.avg_value || point.count_value || 0;
            const dimensionValue = point[xField] || point.dimension || `Item ${i}`;
            
            const x = 80 + (i / Math.max(barData.length, 1)) * (width - 110);
            const value = Number(measureValue);
            
            if (!isNaN(value) && value > 0 && dataBounds && dataBounds.yMax > dataBounds.yMin) {
              // Calculate bar height as proportion of the available space
              const valueRange = dataBounds.yMax - dataBounds.yMin;
              const normalizedValue = (value - dataBounds.yMin) / valueRange;
              const barHeight = normalizedValue * (height - 80);
              
              const barY = height - 60 - barHeight;
              
              console.log('[Mosaic] Drawing bar', i, ':', { 
                x, 
                value, 
                barHeight, 
                barY,
                dimensionValue,
                normalizedValue 
              });
              
              // Draw the bar
              ctx.fillRect(x - barWidth/2, barY, barWidth, Math.max(2, barHeight));
              barsDrawn++;
              
              // Add category labels
              if (barData.length <= 20) {
                ctx.fillStyle = 'white';
                ctx.font = '10px system-ui';
                ctx.textAlign = 'center';
                
                // Value on top of bar
                ctx.fillText(value.toLocaleString(), x, barY - 5);
                
                // Category label below x-axis
                const labelText = String(dimensionValue).substring(0, 8); // Truncate long labels
                ctx.fillText(labelText, x, height - 40);
                
                ctx.fillStyle = colors[0] || '#3b82f6';
              }
            }
          });
          
          console.log('[Mosaic] Drew', barsDrawn, 'bars out of', barData.length, 'data points');
          break;

        case 'line':
          ctx.strokeStyle = colors[0] || '#3b82f6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          
          const sortedData = [...currentData].sort((a, b) => Number(a[xField]) - Number(b[xField]));
          let started = false;
          
          sortedData.forEach(point => {
            const x = xScale(Number(point[xField]));
            const y = yScale(Number(point[yField]));
            
            if (x >= 80 && x <= width - 30 && y >= 20 && y <= height - 60) {
              if (!started) {
                ctx.moveTo(x, y);
                started = true;
              } else {
                ctx.lineTo(x, y);
              }
            }
          });
          ctx.stroke();
          break;
      }

      // Draw labels
      ctx.fillStyle = 'white';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(xLabel, width / 2, height - 20);
      
      ctx.save();
      ctx.translate(20, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();

      // Draw data info for debugging
      ctx.fillStyle = 'yellow';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Data: ${currentData.length} rows`, 90, 40);
      ctx.fillText(`Bounds: ${dataBounds ? 'OK' : 'NULL'}`, 90, 60);
      
      if (currentData.length === 0) {
        ctx.fillStyle = 'red';
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('NO DATA TO RENDER', width / 2, height / 2);
      }

      // Draw brush selection if active
      if (brushSelection && isDragging) {
        const overlay = overlayRef.current;
        if (overlay) {
          const overlayCtx = overlay.getContext('2d');
          if (overlayCtx) {
            overlayCtx.clearRect(0, 0, width, height);
            overlayCtx.strokeStyle = '#3b82f6';
            overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            overlayCtx.lineWidth = 2;
            
            const x1 = xScale(brushSelection.x1);
            const y1 = yScale(brushSelection.y1);
            const x2 = xScale(brushSelection.x2);
            const y2 = yScale(brushSelection.y2);
            
            overlayCtx.fillRect(
              Math.min(x1, x2),
              Math.min(y1, y2),
              Math.abs(x2 - x1),
              Math.abs(y2 - y1)
            );
            overlayCtx.strokeRect(
              Math.min(x1, x2),
              Math.min(y1, y2),
              Math.abs(x2 - x1),
              Math.abs(y2 - y1)
            );
          }
        }
      }
      
      console.log('Interactive Mosaic chart rendered with', currentData.length, 'points');

    } catch (error) {
      console.error('Mosaic rendering error:', error);
      
      // Fallback to informative placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'flex items-center justify-center h-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded border border-blue-500/20';
      placeholder.innerHTML = `
        <div class="text-center p-8">
          <div class="text-2xl mb-4">🚀</div>
          <div class="text-white font-medium mb-2">Mosaic Chart Ready</div>
          <div class="text-white/60 text-sm mb-4">
            Database-driven visualization for ${data.length.toLocaleString()} rows
          </div>
          <div class="text-xs text-blue-300 bg-blue-500/10 px-3 py-1 rounded">
            Table: ${tableName} • ${type.toUpperCase()} chart • ${xField} × ${yField}
          </div>
          <div class="text-xs text-white/40 mt-4">
            Install Mosaic packages to activate scalable rendering
          </div>
        </div>
      `;
      
      containerRef.current.appendChild(placeholder);

    } 
    // catch (error) {
    //   console.error('Mosaic Chart error:', error);
      
    //   if (containerRef.current) {
    //     containerRef.current.innerHTML = `
    //       <div class="flex items-center justify-center h-full text-red-400 text-center p-8">
    //         <div>
    //           <div class="text-xl mb-2">⚠️</div>
    //           <div class="font-medium mb-2">Mosaic Rendering Error</div>
    //           <div class="text-sm opacity-80">${error instanceof Error ? error.message : 'Unknown error'}</div>
    //         </div>
    //       </div>
    //     `;
    //   }
    // }

  }, [coordinator, type, xField, yField, xLabel, yLabel, tableName, width, height, colors, aggregation, data.length, progressiveData.length, isDragging]); // Simplified deps

  // Mouse event handlers for smooth drag interactions and zoom
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Only start drag in chart area
    if (x >= 80 && x <= width - 30 && y >= 20 && y <= height - 60) {
      const dataX = xInverse(x);
      const dataY = yInverse(y);
      
      setBrushSelection({
        x1: dataX,
        y1: dataY,
        x2: dataX,
        y2: dataY
      });
      setIsDragging(true);
      
      // Prevent default to avoid text selection during drag
      e.preventDefault();
    }
  }, [width, height, xInverse, yInverse]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !brushSelection) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Constrain to chart area
    const constrainedX = Math.max(80, Math.min(width - 30, x));
    const constrainedY = Math.max(20, Math.min(height - 60, y));
    
    const dataX = xInverse(constrainedX);
    const dataY = yInverse(constrainedY);
    
    const updatedSelection = {
      ...brushSelection,
      x2: dataX,
      y2: dataY
    };
    
    setBrushSelection(updatedSelection);
    
    // Trigger progressive query during drag with enhanced validation
    const xRange = Math.abs(updatedSelection.x2 - updatedSelection.x1);
    const yRange = Math.abs(updatedSelection.y2 - updatedSelection.y1);
    
    // More responsive threshold for smoother interactions
    if (xRange > 0.001 && yRange > 0.001 && 
        updatedSelection.x1 !== updatedSelection.x2 && 
        updatedSelection.y1 !== updatedSelection.y2) {
      console.log('[Mosaic] Triggering progressive query with bounds:', updatedSelection);
      debouncedProgressiveQuery(updatedSelection);
    }
  }, [isDragging, brushSelection, xInverse, yInverse, debouncedProgressiveQuery, width, height]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && brushSelection) {
      // Calculate selection area to determine if this is a zoom or just a click
      const xRange = Math.abs(brushSelection.x2 - brushSelection.x1);
      const yRange = Math.abs(brushSelection.y2 - brushSelection.y1);
      
      if (xRange > 0.1 && yRange > 0.1) {
        // Significant selection - execute final zoom query
        executeProgressiveQuery(brushSelection);
        console.log('[Mosaic] Zoom selection completed:', brushSelection);
        
        // Keep selection visible longer for zoom feedback
        setTimeout(() => {
          setBrushSelection(null);
          const overlay = overlayRef.current;
          if (overlay) {
            const ctx = overlay.getContext('2d');
            ctx?.clearRect(0, 0, width, height);
          }
        }, 3000);
      } else {
        // Small selection or click - clear immediately
        setBrushSelection(null);
        const overlay = overlayRef.current;
        if (overlay) {
          const ctx = overlay.getContext('2d');
          ctx?.clearRect(0, 0, width, height);
        }
      }
    }
    
    setIsDragging(false);
  }, [isDragging, brushSelection, executeProgressiveQuery, width, height]);

  const handleDoubleClick = useCallback(() => {
    // Reset to full dataset on double-click
    setProgressiveData(data);
    setBrushSelection(null);
    setIsDragging(false);
    
    console.log('[Mosaic] Reset to full dataset');
    
    if (onCrossFilter) {
      onCrossFilter({ reset: true, data: data });
    }
  }, [data, onCrossFilter]);

  // Wheel zoom handler for smooth zoom experience
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (!dataBounds) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Only zoom in chart area
    if (x >= 80 && x <= width - 30 && y >= 20 && y <= height - 60) {
      const centerX = xInverse(x);
      const centerY = yInverse(y);
      
      // Zoom factor based on wheel delta
      const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
      
      // Calculate current visible range
      const currentXRange = dataBounds.xMax - dataBounds.xMin;
      const currentYRange = dataBounds.yMax - dataBounds.yMin;
      
      // Calculate new range
      const newXRange = currentXRange * zoomFactor;
      const newYRange = currentYRange * zoomFactor;
      
      // Center the zoom on cursor position
      const newBounds = {
        x1: centerX - newXRange / 2,
        x2: centerX + newXRange / 2,
        y1: centerY - newYRange / 2,
        y2: centerY + newYRange / 2
      };
      
      // Trigger progressive query for the zoomed area
      console.log('[Mosaic] Wheel zoom:', newBounds);
      debouncedProgressiveQuery(newBounds);
    }
  }, [dataBounds, width, height, xInverse, yInverse, debouncedProgressiveQuery]);

  return (
    <div className="relative w-full h-full">
      {/* Main chart canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      
      {/* Interaction overlay canvas */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        width={width}
        height={height}
      />
      
      {/* Container for legacy vgplot fallback */}
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: height, display: 'none' }}
      />
      
      {/* Performance indicators */}
      <div className="absolute top-2 right-2 bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">
        Mosaic • {progressiveData.length.toLocaleString()} / {data.length.toLocaleString()} rows
      </div>
      
      <div className="absolute top-2 left-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
        🦆 Progressive Querying
      </div>
      
      {/* Interaction hints */}
      <div className="absolute bottom-2 left-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
        Drag to zoom • Scroll to zoom • Double-click to reset
      </div>
      
      {/* Cross-filtering status */}
      {isDragging && (
        <div className="absolute bottom-2 right-2 bg-yellow-500/20 text-yellow-300 text-xs px-2 py-1 rounded animate-pulse">
          🔍 Querying selection...
        </div>
      )}
      
      {onCrossFilter && !isDragging && (
        <div className="absolute bottom-2 right-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
          🔗 Cross-filtering enabled
        </div>
      )}
    </div>
  );
};

export default MosaicChart;