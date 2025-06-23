import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ChartType } from '@/store/chartsStore';

export interface CanvasChartProps {
  data: any[];
  type: ChartType;
  xField: string;
  yField: string;
  xLabel: string;
  yLabel: string;
  width: number;
  height: number;
  colors: string[];
  showGrid?: boolean;
  onZoom?: (zoomState: { xMin: number; xMax: number; yMin: number; yMax: number }) => void;
}

interface ChartDimensions {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  plotWidth: number;
  plotHeight: number;
}

interface ZoomState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
  dragEnd: { x: number; y: number } | null;
}

/**
 * High-performance Canvas-based chart renderer for massive datasets
 * Can handle 100K+ data points smoothly using Canvas instead of DOM/SVG
 */
const CanvasChart: React.FC<CanvasChartProps> = ({
  data,
  type,
  xField,
  yField,
  xLabel,
  yLabel,
  width,
  height,
  colors,
  showGrid = true,
  onZoom
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [zoomState, setZoomState] = useState<ZoomState | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Calculate chart dimensions
  const dimensions: ChartDimensions = {
    width,
    height,
    margin: { top: 20, right: 30, bottom: 60, left: 80 },
    plotWidth: width - 80 - 30, // left + right margins
    plotHeight: height - 20 - 60 // top + bottom margins
  };

  // Calculate data bounds with performance optimization for large datasets
  const dataBounds = React.useMemo(() => {
    if (!data || data.length === 0) return null;

    // For very large datasets, sample for bounds calculation to prevent stack overflow
    const sampleSize = Math.min(10000, data.length);
    const sampleData = data.length > sampleSize ? 
      data.filter((_, i) => i % Math.ceil(data.length / sampleSize) === 0) : 
      data;

    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    // Use iterative approach instead of map/spread to avoid stack overflow
    for (let i = 0; i < sampleData.length; i++) {
      const xVal = Number(sampleData[i][xField]);
      const yVal = Number(sampleData[i][yField]);
      
      if (!isNaN(xVal)) {
        if (xVal < xMin) xMin = xVal;
        if (xVal > xMax) xMax = xVal;
      }
      
      if (!isNaN(yVal)) {
        if (yVal < yMin) yMin = yVal;
        if (yVal > yMax) yMax = yVal;
      }
    }

    // Fallback if no valid data found
    if (xMin === Infinity) xMin = 0;
    if (xMax === -Infinity) xMax = 1;
    if (yMin === Infinity) yMin = 0;
    if (yMax === -Infinity) yMax = 1;

    return { xMin, xMax, yMin, yMax };
  }, [data, xField, yField]);

  // Current zoom bounds (use data bounds if no zoom)
  const currentBounds = zoomState || dataBounds;

  // Scale functions
  const xScale = useCallback((value: number) => {
    if (!currentBounds) return 0;
    return dimensions.margin.left + 
      ((value - currentBounds.xMin) / (currentBounds.xMax - currentBounds.xMin)) * dimensions.plotWidth;
  }, [currentBounds, dimensions]);

  const yScale = useCallback((value: number) => {
    if (!currentBounds) return 0;
    return dimensions.margin.top + dimensions.plotHeight - 
      ((value - currentBounds.yMin) / (currentBounds.yMax - currentBounds.yMin)) * dimensions.plotHeight;
  }, [currentBounds, dimensions]);

  // Inverse scale functions for mouse interactions
  const xInverse = useCallback((pixel: number) => {
    if (!currentBounds) return 0;
    const ratio = (pixel - dimensions.margin.left) / dimensions.plotWidth;
    return currentBounds.xMin + ratio * (currentBounds.xMax - currentBounds.xMin);
  }, [currentBounds, dimensions]);

  const yInverse = useCallback((pixel: number) => {
    if (!currentBounds) return 0;
    const ratio = 1 - (pixel - dimensions.margin.top) / dimensions.plotHeight;
    return currentBounds.yMin + ratio * (currentBounds.yMax - currentBounds.yMin);
  }, [currentBounds, dimensions]);

  // Draw grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!showGrid || !currentBounds) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Vertical grid lines
    const xTicks = 10;
    for (let i = 0; i <= xTicks; i++) {
      const x = dimensions.margin.left + (i / xTicks) * dimensions.plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, dimensions.margin.top);
      ctx.lineTo(x, dimensions.margin.top + dimensions.plotHeight);
      ctx.stroke();
    }

    // Horizontal grid lines
    const yTicks = 10;
    for (let i = 0; i <= yTicks; i++) {
      const y = dimensions.margin.top + (i / yTicks) * dimensions.plotHeight;
      ctx.beginPath();
      ctx.moveTo(dimensions.margin.left, y);
      ctx.lineTo(dimensions.margin.left + dimensions.plotWidth, y);
      ctx.stroke();
    }
  }, [showGrid, currentBounds, dimensions]);

  // Draw axes
  const drawAxes = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!currentBounds) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.font = '12px system-ui';

    // X-axis
    ctx.beginPath();
    ctx.moveTo(dimensions.margin.left, dimensions.margin.top + dimensions.plotHeight);
    ctx.lineTo(dimensions.margin.left + dimensions.plotWidth, dimensions.margin.top + dimensions.plotHeight);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(dimensions.margin.left, dimensions.margin.top);
    ctx.lineTo(dimensions.margin.left, dimensions.margin.top + dimensions.plotHeight);
    ctx.stroke();

    // X-axis labels - handle both numeric and categorical data
    const xTicks = 5;
    
    // Check if we have categorical data (strings) vs numeric
    const firstXValue = data?.[0]?.[currentBounds ? 'dimension' : 'x']; // Use 'dimension' for aggregated data
    const isCategorical = typeof firstXValue === 'string';
    
    if (isCategorical && data && data.length > 1000) {
      // For large categorical datasets, show sample category names
      const maxLabels = Math.min(5, Math.floor(dimensions.plotWidth / 100));
      const step = Math.floor(data.length / maxLabels);
      
      for (let i = 0; i < maxLabels; i++) {
        const dataIndex = i * step;
        if (dataIndex < data.length) {
          const label = String(data[dataIndex].dimension || '').substring(0, 10); // Truncate long labels
          const x = dimensions.margin.left + (i / (maxLabels - 1)) * dimensions.plotWidth;
          const y = dimensions.margin.top + dimensions.plotHeight + 20;
          
          ctx.textAlign = 'center';
          ctx.fillText(label, x, y);
        }
      }
    } else {
      // Numeric labels (original logic)
      for (let i = 0; i <= xTicks; i++) {
        const value = currentBounds.xMin + (i / xTicks) * (currentBounds.xMax - currentBounds.xMin);
        const x = dimensions.margin.left + (i / xTicks) * dimensions.plotWidth;
        const y = dimensions.margin.top + dimensions.plotHeight + 20;
        
        ctx.textAlign = 'center';
        ctx.fillText(value.toFixed(1), x, y);
      }
    }

    // Y-axis labels
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const value = currentBounds.yMin + (i / yTicks) * (currentBounds.yMax - currentBounds.yMin);
      const x = dimensions.margin.left - 10;
      const y = dimensions.margin.top + dimensions.plotHeight - (i / yTicks) * dimensions.plotHeight;
      
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(value.toFixed(1), x, y);
    }

    // Axis titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xLabel, dimensions.margin.left + dimensions.plotWidth / 2, height - 20);

    ctx.save();
    ctx.translate(20, dimensions.margin.top + dimensions.plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }, [currentBounds, dimensions, xLabel, yLabel, height]);

  // Draw scatter plot with performance optimizations
  const drawScatter = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!data || data.length === 0) return;

    const pointSize = Math.max(0.5, Math.min(3, 2000 / Math.sqrt(data.length)));
    ctx.fillStyle = colors[0] || '#3b82f6';

    // For massive datasets (>100k), use density-based rendering
    if (data.length > 100000) {
      // Create a density grid for performance
      const gridSize = 2; // pixels per grid cell
      const gridWidth = Math.ceil(dimensions.plotWidth / gridSize);
      const gridHeight = Math.ceil(dimensions.plotHeight / gridSize);
      const densityGrid = new Array(gridWidth * gridHeight).fill(0);
      
      // Count points in each grid cell
      for (let i = 0; i < data.length; i++) {
        const point = data[i];
        const x = xScale(Number(point[xField]));
        const y = yScale(Number(point[yField]));
        
        if (x >= dimensions.margin.left && x <= dimensions.margin.left + dimensions.plotWidth &&
            y >= dimensions.margin.top && y <= dimensions.margin.top + dimensions.plotHeight) {
          const gridX = Math.floor((x - dimensions.margin.left) / gridSize);
          const gridY = Math.floor((y - dimensions.margin.top) / gridSize);
          const gridIndex = gridY * gridWidth + gridX;
          
          if (gridIndex >= 0 && gridIndex < densityGrid.length) {
            densityGrid[gridIndex]++;
          }
        }
      }
      
      // Draw density grid
      const maxDensity = Math.max(...densityGrid);
      for (let i = 0; i < densityGrid.length; i++) {
        if (densityGrid[i] > 0) {
          const gridX = i % gridWidth;
          const gridY = Math.floor(i / gridWidth);
          const alpha = Math.min(1, densityGrid[i] / maxDensity);
          
          ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.8})`;
          ctx.fillRect(
            dimensions.margin.left + gridX * gridSize,
            dimensions.margin.top + gridY * gridSize,
            gridSize,
            gridSize
          );
        }
      }
    } else {
      // Traditional point rendering for smaller datasets
      const batchSize = 5000;
      
      for (let batch = 0; batch < Math.ceil(data.length / batchSize); batch++) {
        ctx.beginPath();
        
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, data.length);
        
        for (let i = start; i < end; i++) {
          const point = data[i];
          const x = xScale(Number(point[xField]));
          const y = yScale(Number(point[yField]));
          
          // Only draw if point is within visible area
          if (x >= dimensions.margin.left && x <= dimensions.margin.left + dimensions.plotWidth &&
              y >= dimensions.margin.top && y <= dimensions.margin.top + dimensions.plotHeight) {
            ctx.moveTo(x + pointSize, y);
            ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
          }
        }
        
        ctx.fill();
      }
    }
  }, [data, xField, yField, xScale, yScale, colors, dimensions]);

  // Draw line chart
  const drawLine = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!data || data.length === 0) return;

    ctx.strokeStyle = colors[0] || '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    let started = false;
    
    // Sort data by x value for line chart
    const sortedData = [...data].sort((a, b) => Number(a[xField]) - Number(b[xField]));
    
    for (let i = 0; i < sortedData.length; i++) {
      const point = sortedData[i];
      const x = xScale(Number(point[xField]));
      const y = yScale(Number(point[yField]));
      
      if (x >= dimensions.margin.left && x <= dimensions.margin.left + dimensions.plotWidth &&
          y >= dimensions.margin.top && y <= dimensions.margin.top + dimensions.plotHeight) {
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    
    ctx.stroke();
  }, [data, xField, yField, xScale, yScale, colors, dimensions]);

  // Draw bar chart with intelligent aggregation for large datasets
  const drawBar = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!data || data.length === 0) return;

    ctx.fillStyle = colors[0] || '#3b82f6';
    
    // For very large datasets, we need to aggregate bars
    if (data.length > 1000) {
      // Create bins for bar aggregation
      const maxBars = Math.min(100, dimensions.plotWidth / 10); // Max 100 bars or 1 bar per 10 pixels
      const sortedData = [...data].sort((a, b) => Number(b[yField]) - Number(a[yField]));
      const topData = sortedData.slice(0, maxBars);
      
      console.log(`[Canvas Bar] Aggregating ${data.length} bars into top ${topData.length} bars`);
      
      const barWidth = Math.max(2, dimensions.plotWidth / topData.length * 0.8);
      const baseline = yScale(0);
      
      // Draw top bars only
      for (let i = 0; i < topData.length; i++) {
        const point = topData[i];
        const x = dimensions.margin.left + (i / topData.length) * dimensions.plotWidth + (barWidth / 2);
        const y = yScale(Number(point[yField]));
        const height = Math.abs(baseline - y);
        
        // Add slight transparency for better visualization
        ctx.fillStyle = `${colors[0] || '#3b82f6'}CC`;
        ctx.fillRect(x - barWidth / 2, Math.min(y, baseline), barWidth, height);
        
        // Add value labels for top bars if there's space
        if (topData.length <= 20 && height > 20) {
          ctx.fillStyle = 'white';
          ctx.font = '10px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(
            Number(point[yField]).toLocaleString(), 
            x, 
            Math.min(y, baseline) - 5
          );
        }
      }
      
      // Add aggregation info
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(
        `Showing top ${topData.length} of ${data.length.toLocaleString()} items`,
        dimensions.margin.left + 10,
        dimensions.margin.top + 20
      );
      
    } else {
      // Original logic for smaller datasets
      const barWidth = Math.max(1, dimensions.plotWidth / data.length * 0.8);
      const baseline = yScale(0);

      for (let i = 0; i < data.length; i++) {
        const point = data[i];
        const x = xScale(Number(point[xField])) - barWidth / 2;
        const y = yScale(Number(point[yField]));
        const height = Math.abs(baseline - y);
        
        ctx.fillRect(x, Math.min(y, baseline), barWidth, height);
      }
    }
  }, [data, xField, yField, xScale, yScale, colors, dimensions]);

  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentBounds) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Draw chart elements
    drawGrid(ctx);
    drawAxes(ctx);

    // Draw chart based on type
    switch (type) {
      case 'scatter':
        drawScatter(ctx);
        break;
      case 'line':
        drawLine(ctx);
        break;
      case 'bar':
        drawBar(ctx);
        break;
      default:
        drawScatter(ctx); // Default to scatter
    }
  }, [width, height, currentBounds, drawGrid, drawAxes, drawScatter, drawLine, drawBar, type]);

  // Mouse interaction handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setZoomState(prev => prev ? {
      ...prev,
      isDragging: true,
      dragStart: { x, y },
      dragEnd: { x, y }
    } : null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update drag selection
    if (zoomState?.isDragging && zoomState.dragStart) {
      setZoomState(prev => prev ? {
        ...prev,
        dragEnd: { x, y }
      } : null);
      
      // Draw selection rectangle on overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.strokeStyle = '#3b82f6';
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
          ctx.beginPath();
          ctx.rect(
            Math.min(zoomState.dragStart.x, x),
            Math.min(zoomState.dragStart.y, y),
            Math.abs(x - zoomState.dragStart.x),
            Math.abs(y - zoomState.dragStart.y)
          );
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Show tooltip
    if (!zoomState?.isDragging) {
      // Find nearest data point for tooltip
      const dataX = xInverse(x);
      const dataY = yInverse(y);
      
      setTooltip({
        x,
        y,
        content: `${xLabel}: ${dataX.toFixed(2)}, ${yLabel}: ${dataY.toFixed(2)}`
      });
    }
  }, [zoomState, width, height, xInverse, yInverse, xLabel, yLabel]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (zoomState?.isDragging && zoomState.dragStart && zoomState.dragEnd) {
      const { dragStart, dragEnd } = zoomState;
      
      // Calculate zoom bounds
      const xMin = xInverse(Math.min(dragStart.x, dragEnd.x));
      const xMax = xInverse(Math.max(dragStart.x, dragEnd.x));
      const yMin = yInverse(Math.max(dragStart.y, dragEnd.y)); // Y is inverted
      const yMax = yInverse(Math.min(dragStart.y, dragEnd.y));
      
      // Only zoom if selection is large enough
      if (Math.abs(dragEnd.x - dragStart.x) > 20 && Math.abs(dragEnd.y - dragStart.y) > 20) {
        setZoomState({ xMin, xMax, yMin, yMax, isDragging: false, dragStart: null, dragEnd: null });
        onZoom?.({ xMin, xMax, yMin, yMax });
      }
    }

    // Clear overlay
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx?.clearRect(0, 0, width, height);
    }

    setZoomState(prev => prev ? { ...prev, isDragging: false, dragStart: null, dragEnd: null } : null);
  }, [zoomState, xInverse, yInverse, width, height, onZoom]);

  const handleDoubleClick = useCallback(() => {
    // Reset zoom
    setZoomState(null);
    onZoom?.(dataBounds!);
  }, [dataBounds, onZoom]);

  // Render effect
  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
      <canvas
        ref={overlayRef}
        width={width}
        height={height}
        className="absolute inset-0 pointer-events-none"
      />
      
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-gray-800 text-white text-xs p-2 rounded pointer-events-none z-10"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 30,
            transform: tooltip.x > width - 150 ? 'translateX(-100%)' : 'none'
          }}
        >
          {tooltip.content}
        </div>
      )}
      
      {/* Performance indicator */}
      <div className="absolute top-2 right-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
        Canvas Mode • {data.length.toLocaleString()} points
      </div>
    </div>
  );
};

export default CanvasChart;