import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, X, Maximize2, Download, Loader2, Info } from 'lucide-react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';
import { ResponsiveAreaBump } from '@nivo/bump';

import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useNotifications } from '@/hooks/useNotifications';

interface ChartConfig {
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'area' | 'heatmap';
  xAxis?: string;
  yAxis?: string | string[];
  groupBy?: string;
  colorScheme?: 'cyan' | 'purple' | 'gradient';
  enableArea?: boolean;
  enablePoints?: boolean;
  layout?: 'horizontal' | 'vertical';
}

interface AIVisualizationPanelProps {
  data: any[];
  config: ChartConfig;
  chartType?: string;
  sql: string;
  isLoading?: boolean;
  insights?: string[];
  title?: string;
  onClose?: () => void;
  onExpand?: () => void;
  onExport?: (format: 'png' | 'svg' | 'csv') => void;
  onToggle?: () => void;
}

// Nivo theme for DataKit's dark aesthetic
const datakitTheme = {
  background: 'transparent',
  textColor: '#ffffff',
  fontSize: 12,
  axis: {
    domain: {
      line: {
        stroke: 'rgba(255, 255, 255, 0.1)',
        strokeWidth: 1
      }
    },
    ticks: {
      line: {
        stroke: 'rgba(255, 255, 255, 0.1)',
        strokeWidth: 1
      },
      text: {
        fill: 'rgba(255, 255, 255, 0.7)',
        fontSize: 11
      }
    },
    legend: {
      text: {
        fill: 'rgba(255, 255, 255, 0.9)',
        fontSize: 12,
        fontWeight: 500
      }
    }
  },
  grid: {
    line: {
      stroke: 'rgba(255, 255, 255, 0.05)',
      strokeWidth: 1
    }
  },
  legends: {
    text: {
      fill: 'rgba(255, 255, 255, 0.9)',
      fontSize: 12
    }
  },
  tooltip: {
    container: {
      background: 'rgba(0, 0, 0, 0.9)',
      color: '#ffffff',
      fontSize: 12,
      borderRadius: 4,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      padding: '8px 12px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }
  }
};

// Color schemes
const colorSchemes = {
  cyan: ['#00bfa5', '#00e5cc', '#00a693', '#008f7a', '#007a68'],
  purple: ['#8b5cf6', '#a78bfa', '#7c3aed', '#6d28d9', '#5b21b6'],
  gradient: ['#00bfa5', '#4ac0c0', '#6bc1d6', '#8bc1ec', '#a78bfa']
};

const AIVisualizationPanel: React.FC<AIVisualizationPanelProps> = ({
  data,
  config,
  chartType,
  sql,
  isLoading,
  insights,
  title,
  onClose,
  onExpand,
  onExport,
  onToggle
}) => {
  const { showSuccess, showError } = useNotifications();
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    console.log('AIVisualizationPanel: Received data:', data);
    console.log('AIVisualizationPanel: Config:', config);
    console.log('AIVisualizationPanel: Chart type:', chartType);
    if (data && data.length > 0) {
      transformDataForChart();
    }
  }, [data, config, chartType]);

  const transformDataForChart = () => {
    try {
      // Convert Proxy objects to plain objects and handle BigInt
      const plainData = data.map(row => {
        // If it's a Proxy, convert to plain object
        if (row && typeof row === 'object') {
          const plainRow: any = {};
          for (const key in row) {
            let value = row[key];
            // Convert BigInt to number
            if (typeof value === 'bigint') {
              value = Number(value);
            }
            plainRow[key] = value;
          }
          return plainRow;
        }
        return row;
      });
      
      console.log('AIVisualizationPanel: Plain data:', plainData);
      
      let transformed;
      const type = chartType || config.type;
      switch (type) {
        case 'line':
        case 'area':
          transformed = transformLineData(plainData);
          break;
        case 'bar':
          transformed = transformBarData(plainData);
          break;
        case 'pie':
          transformed = transformPieData(plainData);
          break;
        case 'scatter':
          transformed = transformScatterData(plainData);
          break;
      }
      console.log('AIVisualizationPanel: Transformed data:', transformed);
      setChartData(transformed);
    } catch (error) {
      console.error('Error transforming data:', error);
      showError('Failed to transform data for visualization');
    }
  };

  const transformLineData = (plainData: any[]) => {
    if (!config.xAxis || !config.yAxis) return [];
    
    const yColumns = Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis];
    
    return yColumns.map(yCol => ({
      id: yCol,
      data: plainData.map(row => ({
        x: row[config.xAxis!],
        y: row[yCol]
      }))
    }));
  };

  const transformBarData = (plainData: any[]) => {
    if (!config.xAxis || !config.yAxis) return [];
    
    // Check if this is summary data (single row with multiple metrics)
    if (plainData.length === 1 && config.xAxis === 'metric' && config.yAxis === 'value') {
      // Transform single row to metric/value pairs
      const row = plainData[0];
      const metricData = Object.entries(row)
        .filter(([key, value]) => typeof value === 'number')
        .map(([key, value]) => ({
          metric: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: value,
          valueColor: 'hsl(175, 100%, 36%)'
        }));
      return metricData;
    }
    
    return plainData.map(row => ({
      [config.xAxis!]: row[config.xAxis!],
      [config.yAxis as string]: row[config.yAxis as string],
      [`${config.yAxis}Color`]: 'hsl(175, 100%, 36%)'
    }));
  };

  const transformPieData = (plainData: any[]) => {
    if (!config.xAxis || !config.yAxis) return [];
    
    return plainData.map(row => ({
      id: row[config.xAxis!],
      label: row[config.xAxis!],
      value: row[config.yAxis as string]
    }));
  };

  const transformScatterData = (plainData: any[]) => {
    if (!config.xAxis || !config.yAxis) return [];
    
    return [{
      id: 'data',
      data: plainData.map(row => ({
        x: row[config.xAxis!],
        y: row[config.yAxis as string]
      }))
    }];
  };

  const renderChart = () => {
    const type = chartType || config.type;
    console.log('AIVisualizationPanel renderChart: chartData:', chartData, 'type:', type);
    if (!chartData) return null;

    const colors = colorSchemes[config.colorScheme || 'cyan'];

    switch (type) {
      case 'line':
        return (
          <ResponsiveLine
            data={chartData}
            theme={datakitTheme}
            colors={colors}
            margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
            curve="monotoneX"
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: config.xAxis || 'X Axis',
              legendOffset: 36,
              legendPosition: 'middle'
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis || 'Y Axis',
              legendOffset: -40,
              legendPosition: 'middle'
            }}
            enablePoints={config.enablePoints !== false}
            pointSize={6}
            pointColor={{ from: 'color', modifiers: [] }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            enableArea={config.enableArea}
            areaOpacity={0.15}
            useMesh={true}
            animate={true}
            motionConfig="gentle"
          />
        );

      case 'bar':
        // Determine keys based on data structure
        const barKeys = config.xAxis === 'metric' && config.yAxis === 'value' 
          ? ['value'] 
          : [config.yAxis as string];
        const barIndexBy = config.xAxis === 'metric' && config.yAxis === 'value'
          ? 'metric'
          : config.xAxis!;
          
        return (
          <ResponsiveBar
            data={chartData}
            theme={datakitTheme}
            keys={barKeys}
            indexBy={barIndexBy}
            colors={colors}
            margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
            padding={0.3}
            layout={config.layout || 'vertical'}
            borderRadius={4}
            borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: config.layout === 'horizontal' ? 0 : -45,
              // TODO: LETS NOT SHOW FOR NOW SO WE FIGURE IT OUT LATER
              //
              // legend: config.layout === 'horizontal' 
              //   ? (Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis || 'Y Axis')
              //   : (config.xAxis || 'X Axis'),
              legendOffset: 36,
              legendPosition: 'middle'
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              // TODO: LETS NOT SHOW FOR NOW SO WE FIGURE IT OUT LATER
              //
              // legend: config.layout === 'horizontal' 
              //   ? (config.xAxis || 'X Axis')
              //   : (Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis || 'Y Axis'),
              legendOffset: -40,
              legendPosition: 'middle'
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{ from: 'color', modifiers: [['darker', 3]] }}
            animate={true}
            motionConfig="gentle"
          />
        );

      case 'pie':
        return (
          <ResponsivePie
            data={chartData}
            theme={datakitTheme}
            colors={colors}
            margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
            innerRadius={0.5}
            padAngle={0.7}
            cornerRadius={3}
            activeOuterRadiusOffset={8}
            borderWidth={1}
            borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
            arcLinkLabelsSkipAngle={10}
            arcLinkLabelsTextColor="#ffffff"
            arcLinkLabelsThickness={2}
            arcLinkLabelsColor={{ from: 'color' }}
            arcLabelsSkipAngle={10}
            arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 3]] }}
            animate={true}
            motionConfig="gentle"
          />
        );

      case 'scatter':
        return (
          <ResponsiveScatterPlot
            data={chartData}
            theme={datakitTheme}
            colors={colors}
            margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
            xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
            blendMode="multiply"
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: config.xAxis || 'X Axis',
              legendOffset: 36,
              legendPosition: 'middle'
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis || 'Y Axis',
              legendOffset: -40,
              legendPosition: 'middle'
            }}
            nodeSize={8}
            animate={true}
            motionConfig="gentle"
          />
        );

      default:
        return null;
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    }
  };

  return (
    <div className="h-full flex flex-col bg-popover/20 backdrop-blur-sm border border-border rounded-lg" data-viz-id="current-viz">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">
            {title || 'Visualization'}
          </h3>
        </div>
        
        <div className="flex items-center gap-1">
          <Tooltip placement="bottom" content="Export">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
            </Button>
          </Tooltip>
          
          {onExpand && (
            <Tooltip placement="bottom" content="Customize">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onExpand}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          
          <Tooltip  placement="bottom" content="Toggle">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggle || onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 relative min-h-0">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Generating visualization...</p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 p-4">
            <div className="nivo-chart w-full h-full">
              {renderChart()}
            </div>
          </div>
        )}
      </div>

      {/* Insights Panel */}
      {insights && insights.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-accent/5">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Insights</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {insights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-primary">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIVisualizationPanel;