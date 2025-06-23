import React, { useRef, useEffect } from 'react';
import * as Plot from '@observablehq/plot';
import { ChartType } from '@/store/chartsStore';

export interface ObservablePlotChartProps {
  data: any[];
  type: ChartType;
  xField: string;
  yField: string;
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  colors: string[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

/**
 * Observable Plot renderer for medium to large datasets
 * Uses grammar of graphics approach with automatic optimization
 */
const ObservablePlotChart: React.FC<ObservablePlotChartProps> = ({
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

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    // Clear previous chart
    containerRef.current.innerHTML = '';

    let plot: SVGElement;

    try {
      // Configure chart based on type and data characteristics
      const plotConfig: any = {
        width,
        height,
        marginLeft: 80,
        marginBottom: 60,
        marginTop: 20,
        marginRight: 30,
        color: { scheme: "blues" }, // Default color scheme
        grid: true,
        style: {
          backgroundColor: "transparent",
          color: "white"
        }
      };

      // Create marks based on chart type
      const marks = [];

      switch (type) {
        case 'scatter':
          // For large scatter plots, use automatic density/hexbin
          if (data.length > 50000) {
            marks.push(
              Plot.hexbin({
                fill: "count",
                stroke: "white",
                strokeWidth: 0.5
              }, {
                x: xField,
                y: yField,
                fill: "count"
              })
            );
          } else if (data.length > 10000) {
            marks.push(
              Plot.density({
                fill: colors[0] || "#3b82f6",
                fillOpacity: 0.3,
                stroke: colors[0] || "#3b82f6",
                strokeWidth: 1
              }, {
                x: xField,
                y: yField
              })
            );
          } else {
            marks.push(
              Plot.dot(data, {
                x: xField,
                y: yField,
                fill: colors[0] || "#3b82f6",
                fillOpacity: 0.7,
                r: 3
              })
            );
          }
          break;

        case 'line':
          marks.push(
            Plot.line(data, {
              x: xField,
              y: yField,
              stroke: colors[0] || "#3b82f6",
              strokeWidth: 2,
              curve: "catmull-rom"
            })
          );
          break;

        case 'bar':
          // For large datasets, auto-bin the data
          if (data.length > 5000) {
            marks.push(
              Plot.rectY(data, 
                Plot.binX({
                  y: aggregation,
                  fill: "count"
                }, {
                  x: xField,
                  y: yField,
                  fill: colors[0] || "#3b82f6",
                  thresholds: Math.min(50, Math.sqrt(data.length))
                })
              )
            );
          } else {
            marks.push(
              Plot.barY(data, {
                x: xField,
                y: yField,
                fill: colors[0] || "#3b82f6"
              })
            );
          }
          break;

        case 'area':
          marks.push(
            Plot.areaY(data, {
              x: xField,
              y: yField,
              fill: colors[0] || "#3b82f6",
              fillOpacity: 0.7,
              stroke: colors[0] || "#3b82f6",
              curve: "catmull-rom"
            })
          );
          break;

        default:
          // Default to auto-density for unknown types
          marks.push(
            Plot.density({
              fill: colors[0] || "#3b82f6",
              fillOpacity: 0.3
            }, {
              x: xField,
              y: yField
            })
          );
      }

      // Add axes
      marks.push(
        Plot.axisX({
          label: xLabel,
          labelAnchor: "center",
          labelOffset: 40,
          color: "white"
        }),
        Plot.axisY({
          label: yLabel,
          labelAnchor: "center",
          labelOffset: -60,
          color: "white"
        })
      );

      // Create the plot
      plot = Plot.plot({
        ...plotConfig,
        marks
      });

      // Apply dark theme styles
      plot.style.backgroundColor = 'transparent';
      plot.querySelectorAll('text').forEach((text: any) => {
        text.style.fill = 'white';
      });
      plot.querySelectorAll('.tick line, .domain').forEach((line: any) => {
        line.style.stroke = 'rgba(255, 255, 255, 0.3)';
      });
      plot.querySelectorAll('.grid line').forEach((line: any) => {
        line.style.stroke = 'rgba(255, 255, 255, 0.1)';
      });

      containerRef.current.appendChild(plot);

    } catch (error) {
      console.error('Observable Plot rendering error:', error);
      
      // Fallback error display
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: ${height}px; 
            color: #ef4444;
            font-size: 14px;
            text-align: center;
            padding: 20px;
          ">
            <div>
              <div>⚠️ Observable Plot Error</div>
              <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
                ${error instanceof Error ? error.message : 'Unknown rendering error'}
              </div>
            </div>
          </div>
        `;
      }
    }

    // Cleanup function
    return () => {
      if (plot && containerRef.current?.contains(plot)) {
        containerRef.current.removeChild(plot);
      }
    };
  }, [data, type, xField, yField, xLabel, yLabel, width, height, colors, aggregation]);

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: height }}
      />
      
      {/* Performance indicator */}
      <div className="absolute top-2 right-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
        Observable Plot • {data.length.toLocaleString()} points
      </div>
      
      {/* Auto-optimization indicators */}
      {data.length > 50000 && type === 'scatter' && (
        <div className="absolute top-2 left-2 bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">
          🔍 Hexbin density applied
        </div>
      )}
      
      {data.length > 10000 && data.length <= 50000 && type === 'scatter' && (
        <div className="absolute top-2 left-2 bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">
          📊 Density visualization
        </div>
      )}
      
      {data.length > 5000 && type === 'bar' && (
        <div className="absolute top-2 left-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
          📈 Auto-binned ({Math.min(50, Math.sqrt(data.length)).toFixed(0)} bins)
        </div>
      )}
    </div>
  );
};

export default ObservablePlotChart;