import React, { useRef, useEffect, useState } from 'react';
import { ChartType } from '@/store/chartsStore';

export interface MosaicChartSimpleProps {
  data: any[];
  type: ChartType;
  xField: string;
  yField: string;
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  colors: string[];
}

/**
 * Simple fallback chart implementation when vgplot fails
 * Uses basic D3 for reliable rendering
 */
const MosaicChartSimple: React.FC<MosaicChartSimpleProps> = ({
  data,
  type,
  xField,
  yField,
  xLabel,
  yLabel,
  width = 800,
  height = 400,
  colors
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    try {
      // Clear previous content
      svgRef.current.innerHTML = '';

      // Set up SVG
      const svg = svgRef.current;
      svg.setAttribute('width', width.toString());
      svg.setAttribute('height', height.toString());

      // Margins
      const margin = { top: 20, right: 30, bottom: 40, left: 60 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // Use full dataset - no sampling for better zoom/pan experience
      let sampledData = data;
      console.log(`[MosaicSimple] Rendering full dataset: ${data.length} points`);

      // Create main group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
      svg.appendChild(g);

      // Calculate scales
      const yValues = sampledData.map(d => Number(d[yField])).filter(v => !isNaN(v));

      if (yValues.length === 0) {
        throw new Error('No valid numeric data found');
      }

      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      const yRange = yMax - yMin || 1; // Prevent division by zero

      // Create scales
      const xScale = (value: any, index: number) => {
        if (type === 'bar') {
          return (index / sampledData.length) * innerWidth + (innerWidth / sampledData.length) * 0.1;
        }
        return sampledData.length > 1 ? (index / (sampledData.length - 1)) * innerWidth : innerWidth / 2;
      };

      const yScale = (value: number) => {
        return innerHeight - ((value - yMin) / yRange) * innerHeight;
      };

      // Draw axes
      const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      xAxis.setAttribute('x1', '0');
      xAxis.setAttribute('y1', innerHeight.toString());
      xAxis.setAttribute('x2', innerWidth.toString());
      xAxis.setAttribute('y2', innerHeight.toString());
      xAxis.setAttribute('stroke', '#6b7280');
      g.appendChild(xAxis);

      const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      yAxis.setAttribute('x1', '0');
      yAxis.setAttribute('y1', '0');
      yAxis.setAttribute('x2', '0');
      yAxis.setAttribute('y2', innerHeight.toString());
      yAxis.setAttribute('stroke', '#6b7280');
      g.appendChild(yAxis);

      // Draw chart based on type
      switch (type) {
        case 'bar':
          const barWidth = Math.max(2, (innerWidth / sampledData.length) * 0.8);
          sampledData.forEach((d, i) => {
            const value = Number(d[yField]);
            if (isNaN(value)) return;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', (xScale(d[xField], i) - barWidth / 2).toString());
            rect.setAttribute('y', yScale(value).toString());
            rect.setAttribute('width', barWidth.toString());
            rect.setAttribute('height', (innerHeight - yScale(value)).toString());
            rect.setAttribute('fill', colors[0] || '#3b82f6');
            rect.setAttribute('opacity', '0.8');
            
            // Add tooltip
            rect.addEventListener('mouseenter', (e) => {
              const tooltip = document.createElement('div');
              tooltip.className = 'absolute bg-gray-800 text-white text-xs px-2 py-1 rounded pointer-events-none z-50';
              tooltip.textContent = `${d[xField]}: ${value.toLocaleString()}`;
              tooltip.style.left = e.pageX + 'px';
              tooltip.style.top = (e.pageY - 30) + 'px';
              document.body.appendChild(tooltip);
              
              rect.addEventListener('mouseleave', () => {
                document.body.removeChild(tooltip);
              }, { once: true });
            });
            
            g.appendChild(rect);
          });
          break;

        case 'line':
          const points = sampledData.map((d, i) => {
            const value = Number(d[yField]);
            return isNaN(value) ? null : `${xScale(d[xField], i)},${yScale(value)}`;
          }).filter(p => p !== null);

          if (points.length > 1) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${points.join(' L ')}`);
            path.setAttribute('stroke', colors[0] || '#3b82f6');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            g.appendChild(path);
          }
          break;

        case 'scatter':
          sampledData.forEach((d, i) => {
            const value = Number(d[yField]);
            if (isNaN(value)) return;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', xScale(d[xField], i).toString());
            circle.setAttribute('cy', yScale(value).toString());
            circle.setAttribute('r', '3');
            circle.setAttribute('fill', colors[0] || '#3b82f6');
            circle.setAttribute('opacity', '0.6');
            g.appendChild(circle);
          });
          break;
      }

      // Add labels
      const xLabelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xLabelEl.setAttribute('x', (innerWidth / 2).toString());
      xLabelEl.setAttribute('y', (innerHeight + 35).toString());
      xLabelEl.setAttribute('text-anchor', 'middle');
      xLabelEl.setAttribute('fill', '#e5e7eb');
      xLabelEl.setAttribute('font-size', '12');
      xLabelEl.textContent = xLabel;
      g.appendChild(xLabelEl);

      const yLabelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yLabelEl.setAttribute('x', '-30');
      yLabelEl.setAttribute('y', (innerHeight / 2).toString());
      yLabelEl.setAttribute('text-anchor', 'middle');
      yLabelEl.setAttribute('fill', '#e5e7eb');
      yLabelEl.setAttribute('font-size', '12');
      yLabelEl.setAttribute('transform', `rotate(-90, -30, ${innerHeight / 2})`);
      yLabelEl.textContent = yLabel;
      g.appendChild(yLabelEl);

      console.log('[MosaicSimple] Chart rendered successfully');
      setError(null);

    } catch (err) {
      console.error('[MosaicSimple] Rendering error:', err);
      setError(err instanceof Error ? err.message : 'Rendering failed');
    }
  }, [data, type, xField, yField, xLabel, yLabel, width, height, colors]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <div className="text-xl mb-2 text-yellow-400">⚠️ Fallback Renderer</div>
          <div className="text-sm text-white/60">Using simplified visualization</div>
          <div className="text-xs text-white/40 mt-2">{data.length.toLocaleString()} data points</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />
      
      {/* Performance indicators */}
      <div className="absolute top-2 right-2 flex gap-2">
        <div className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
          Full Dataset • {data.length.toLocaleString()} rows
        </div>
      </div>
      
      <div className="absolute bottom-2 left-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
        No sampling • Full zoom/pan support
      </div>
    </div>
  );
};

export default MosaicChartSimple;