import React, { useState, useCallback } from "react";

import { useChartsStore, ChartType } from "@/store/chartsStore";
import { analyzeDataPerformance } from "@/utils/chartPerformance";
import { useChartDimensions } from "@/hooks/useResizeObserver";
import CanvasChart from "./canvas/CanvasChart";
import ObservablePlotChart from "./observable/ObservablePlotChart";
import MosaicChart from "./mosaic/MosaicChart";
import MosaicChartSQL from "./mosaic/MosaicChartSQL";
import MosaicChartVgplot from "./mosaic/MosaicChartVgplot";
import MosaicChartSimple from "./mosaic/MosaicChartSimple";
import MosaicChartCanvas from "./mosaic/MosaicChartCanvas";
import MosaicChartCanvasSimple from "./mosaic/MosaicChartCanvasSimple";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Label,
  ReferenceLine,
  Brush,
  ReferenceArea,
} from "recharts";

/**
 * Component that renders the appropriate chart based on the current configuration
 */
const ChartCanvas: React.FC = () => {
  const { currentChart, colorPalettes } = useChartsStore();
  
  // Get responsive chart dimensions (must be called before any conditional returns)
  const { ref: chartRef, width: chartWidth, height: chartHeight, isReady } = useChartDimensions(600, 400);
  
  // Zoom state management
  const [zoomState, setZoomState] = useState<{
    left?: string | number;
    right?: string | number;
    refAreaLeft?: string | number;
    refAreaRight?: string | number;
    top?: string | number;
    bottom?: string | number;
    animation?: boolean;
  }>({
    left: 'dataMin',
    right: 'dataMax',
    refAreaLeft: '',
    refAreaRight: '',
    top: 'dataMax+1',
    bottom: 'dataMin-1',
    animation: true,
  });

  // Zoom handler functions
  const getAxisYDomain = useCallback((from: number, to: number, ref: string, offset: number) => {
    const refData = currentChart?.data?.slice(from - 1, to);
    if (!refData || refData.length === 0) return [0, 0];
    
    let [bottom, top] = [refData[0][ref], refData[0][ref]];
    refData.forEach((d) => {
      if (d[ref] > top) top = d[ref];
      if (d[ref] < bottom) bottom = d[ref];
    });

    return [(bottom | 0) - offset, (top | 0) + offset];
  }, [currentChart?.data]);

  const zoom = useCallback(() => {
    let { refAreaLeft, refAreaRight } = zoomState;
    const { data } = currentChart || {};

    if (!data || refAreaLeft === refAreaRight || refAreaRight === '') {
      setZoomState(prev => ({
        ...prev,
        refAreaLeft: '',
        refAreaRight: '',
      }));
      return;
    }

    // xAxis domain
    if (refAreaLeft && refAreaRight && refAreaLeft > refAreaRight) 
      [refAreaLeft, refAreaRight] = [refAreaRight, refAreaLeft];

    // yAxis domain
    const yAxisField = currentChart?.yAxis?.field || currentChart?.yAxis?.dataKey;
    if (!yAxisField) return;

    const from = data.findIndex(d => d[currentChart.xAxis.field] === refAreaLeft);
    const to = data.findIndex(d => d[currentChart.xAxis.field] === refAreaRight);
    const [bottom, top] = getAxisYDomain(from, to, yAxisField, 1);

    setZoomState(prev => ({
      ...prev,
      refAreaLeft: '',
      refAreaRight: '',
      left: refAreaLeft,
      right: refAreaRight,
      bottom,
      top,
    }));
  }, [zoomState, currentChart, getAxisYDomain]);

  const zoomOut = useCallback(() => {
    setZoomState({
      left: 'dataMin',
      right: 'dataMax',
      refAreaLeft: '',
      refAreaRight: '',
      top: 'dataMax+1',
      bottom: 'dataMin-1',
      animation: true,
    });
  }, []);

  // Analyze performance to determine rendering strategy (must be done with hooks)
  const performanceAnalysis = currentChart?.data ? analyzeDataPerformance(currentChart.data.length, 2) : null;
  const shouldUseMosaic = performanceAnalysis?.renderingStrategy === 'mosaic_plot';
  const shouldUseCanvas = performanceAnalysis?.renderingStrategy === 'canvas';
  const shouldUseObservablePlot = performanceAnalysis?.renderingStrategy === 'observable_plot';

  // Debug logging (MUST be called every render to maintain hooks order)
  React.useEffect(() => {
    if (currentChart?.data && performanceAnalysis) {
      console.log(`[ChartCanvas] Data size: ${currentChart.data.length} rows`);
      console.log(`[ChartCanvas] Strategy: ${performanceAnalysis.renderingStrategy}`);
      console.log(`[ChartCanvas] Using: ${shouldUseCanvas ? 'Canvas' : shouldUseMosaic ? 'Mosaic' : shouldUseObservablePlot ? 'Observable Plot' : 'Recharts'}`);
    }
  }, [currentChart?.data?.length, performanceAnalysis?.renderingStrategy, shouldUseCanvas, shouldUseMosaic, shouldUseObservablePlot]);

  // Early returns after ALL hooks are called
  if (!currentChart || !currentChart.data || currentChart.data.length === 0) {
    return (
      <div ref={chartRef} className="h-full flex items-center justify-center bg-darkNav/20 rounded-lg border border-white/5">
        <div className="text-center p-8">
          <h3 className="text-lg font-medium text-white/80 mb-2">
            No Chart Data
          </h3>
          <p className="text-sm text-white/60">
            Configure your chart or run a query to visualize data.
          </p>
        </div>
      </div>
    );
  }

  // Don't render chart until dimensions are ready
  if (!isReady) {
    return (
      <div ref={chartRef} className="h-full w-full bg-darkNav/20 rounded-lg border border-white/5 flex items-center justify-center">
        <div className="text-white/60">Loading chart...</div>
      </div>
    );
  }

  // Get color palette
  const palette = colorPalettes[currentChart.palette] || colorPalettes.primary;

  // Common props for charts
  const commonProps = {
    data: currentChart.data,
    margin: { top: 20, right: 30, left: 20, bottom: 20 },
  };

  // Render the appropriate chart based on type
  return (
    <div ref={chartRef} className="h-full w-full bg-darkNav/20 rounded-lg border border-white/5 p-4">
      {/* Header with title and zoom controls */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-medium chart-title">
            {currentChart.title}
          </h3>
          {currentChart.description && (
            <p className="text-sm text-white/70 chart-description">
              {currentChart.description}
            </p>
          )}
        </div>
        
        {/* Zoom Controls - only show for charts that support zoom */}
        {currentChart.type !== 'pie' && (
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded border border-white/20 text-white/80 hover:text-white transition-colors"
              title="Reset zoom"
            >
              Reset Zoom
            </button>
            <div className="text-xs text-white/50">
              Drag to zoom
            </div>
          </div>
        )}
      </div>

      {/* Sampling Info */}
      {currentChart.samplingInfo && (
        <div className="mb-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
          <p className="text-xs text-blue-300">
            📊 {currentChart.samplingInfo.mode === 'fixed' ? 'Fixed' : 'Custom'} sampling: 
            {' '}{currentChart.samplingInfo.sampleSize?.toLocaleString()} of {currentChart.samplingInfo.totalRows?.toLocaleString()} rows 
            ({((currentChart.samplingInfo.samplingRatio || 0) * 100).toFixed(1)}%)
          </p>
        </div>
      )}

      <div className="h-[calc(100%-80px)]">
        {shouldUseCanvas && currentChart.type !== 'pie' ? (
          /* High-performance Canvas renderer for massive datasets (1M+) */
          <div className="w-full h-full">
            <CanvasChart
              data={currentChart.data}
              type={currentChart.type}
              xField={(() => {
                // Auto-detect actual field names from data structure
                const sampleRow = currentChart.data[0] || {};
                const aggregation = currentChart.query?.includes('SUM') ? 'sum' : 
                                  currentChart.query?.includes('AVG') ? 'avg' :
                                  currentChart.query?.includes('COUNT') ? 'count' : 'sum';
                return sampleRow.hasOwnProperty('dimension') ? 'dimension' : currentChart.xAxis.field;
              })()}
              yField={(() => {
                const sampleRow = currentChart.data[0] || {};
                const aggregation = currentChart.query?.includes('SUM') ? 'sum' : 
                                  currentChart.query?.includes('AVG') ? 'avg' :
                                  currentChart.query?.includes('COUNT') ? 'count' : 'sum';
                return sampleRow.hasOwnProperty(`${aggregation}_value`) ? `${aggregation}_value` : currentChart.yAxis.field;
              })()}
              xLabel={currentChart.xAxis.label}
              yLabel={currentChart.yAxis.label}
              width={chartWidth - 32}
              height={chartHeight - 120}
              colors={palette}
              showGrid={currentChart.showGrid}
              onZoom={(zoomBounds) => {
                console.log('Canvas zoom:', zoomBounds);
                // Could trigger new query for zoomed data in the future
              }}
            />
          </div>
        ) : shouldUseMosaic && currentChart.type !== 'pie' ? (
          /* Canvas-based vgplot implementation optimized for large datasets */
          <div className="w-full h-full">
            <MosaicChartCanvasSimple
              data={currentChart.data}
              type={currentChart.type}
              xField={currentChart.xAxis.field}
              yField={currentChart.yAxis.field}
              xLabel={currentChart.xAxis.label}
              yLabel={currentChart.yAxis.label}
              tableName={currentChart.query ? extractTableName(currentChart.query) : 'data'}
              width={chartWidth - 32}
              height={chartHeight - 120}
              colors={palette}
              aggregation={currentChart.query?.includes('SUM') ? 'sum' : 
                          currentChart.query?.includes('AVG') ? 'avg' :
                          currentChart.query?.includes('COUNT') ? 'count' : 'sum'}
            />
          </div>
        ) : shouldUseObservablePlot && currentChart.type !== 'pie' ? (
          /* Observable Plot for medium datasets (5K-50K) */
          <div className="w-full h-full">
            <ObservablePlotChart
              data={currentChart.data}
              type={currentChart.type}
              xField={currentChart.xAxis.field}
              yField={currentChart.yAxis.field}
              xLabel={currentChart.xAxis.label}
              yLabel={currentChart.yAxis.label}
              width={chartWidth - 32}
              height={chartHeight - 120}
              colors={palette}
              aggregation={currentChart.query?.includes('SUM') ? 'sum' : 
                          currentChart.query?.includes('AVG') ? 'avg' :
                          currentChart.query?.includes('COUNT') ? 'count' : 'sum'}
            />
          </div>
        ) : (
          /* Traditional Recharts renderer for smaller datasets (<5K) */
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(currentChart.type, palette)}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  // Helper function to render the appropriate chart
  function renderChart(type: ChartType, colors: string[]) {
    const { xAxis, yAxis, showGrid, showLegend, colorBy, stackedData } =
      currentChart;

    const xAxisConfig =
      currentChart.showXAxisLabel !== false ? (
        <XAxis
          dataKey={xAxis.dataKey || xAxis.field}
          name={xAxis.label}
          stroke="#ffffff60"
          scale={xAxis.scale || "auto"}
          domain={xAxis.domain || [zoomState.left, zoomState.right]}
          allowDataOverflow={true}
        >
          <Label
            value={xAxis.label}
            position="bottom"
            offset={10}
            fill="#ffffff90"
            style={{ textAnchor: "middle" }}
          />
        </XAxis>
      ) : (
        <XAxis
          dataKey={xAxis.dataKey || xAxis.field}
          name={xAxis.label}
          stroke="#ffffff60"
          scale={xAxis.scale || "auto"}
          domain={xAxis.domain || [zoomState.left, zoomState.right]}
          allowDataOverflow={true}
        />
      );

    const yAxisConfig =
      currentChart.showYAxisLabel !== false ? (
        <YAxis
          name={yAxis.label}
          stroke="#ffffff60"
          scale={yAxis.scale || "auto"}
          domain={yAxis.domain || [zoomState.bottom, zoomState.top]}
          allowDataOverflow={true}
        >
          <Label
            value={yAxis.label}
            position="left"
            angle={-90}
            offset={-10}
            fill="#ffffff90"
            style={{ textAnchor: "middle" }}
          />
        </YAxis>
      ) : (
        <YAxis
          name={yAxis.label}
          stroke="#ffffff60"
          scale={yAxis.scale || "auto"}
          domain={yAxis.domain || [zoomState.bottom, zoomState.top]}
          allowDataOverflow={true}
        />
      );

    // Common elements
    const gridConfig = showGrid ? (
      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
    ) : null;
    const tooltipConfig = (
      <Tooltip
        contentStyle={{
          backgroundColor: "#1f2937",
          borderColor: "#ffffff20",
          borderRadius: "4px",
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        }}
        cursor={{ stroke: "#ffffff40", strokeWidth: 1 }}
        labelStyle={{
          color: "#ffffff",
          fontWeight: "bold",
          marginBottom: "5px",
        }}
      />
    );

    const legendConfig = showLegend ? (
      <Legend
        verticalAlign="bottom"
        height={36}
        formatter={(value) => <span style={{ color: "#fff" }}>{value}</span>}
      />
    ) : null;

    // Add reference line at y=0 for charts that may have negative values
    const referenceLineConfig =
      type !== "pie" ? <ReferenceLine y={0} stroke="#ffffff40" /> : null;

    // Reference area for zoom selection
    const referenceAreaConfig = zoomState.refAreaLeft && zoomState.refAreaRight ? (
      <ReferenceArea
        x1={zoomState.refAreaLeft}
        x2={zoomState.refAreaRight}
        strokeOpacity={0.3}
        fill="#8884d8"
        fillOpacity={0.1}
      />
    ) : null;

    switch (type) {
      case "bar":
        return (
          <BarChart 
            {...commonProps}
            onMouseDown={(e) => {
              if (e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaLeft: e.activeLabel }));
              }
            }}
            onMouseMove={(e) => {
              if (zoomState.refAreaLeft && e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaRight: e.activeLabel }));
              }
            }}
            onMouseUp={zoom}
          >
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}
            {referenceLineConfig}
            {referenceAreaConfig}

            {!stackedData ? (
              <Bar
                dataKey={yAxis.dataKey || yAxis.field}
                name={yAxis.label}
                fill={colors[0]}
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              >
                {colorBy &&
                  currentChart.data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        colors[
                          Math.abs(hashCode(String(entry[colorBy]))) %
                            colors.length
                        ]
                      }
                    />
                  ))}
              </Bar>
            ) : (
              // Handle stacked bar chart
              currentChart.data.length > 0 &&
              Object.keys(currentChart.data[0])
                .filter(
                  (key) =>
                    key !== xAxis.field &&
                    typeof currentChart.data[0][key] === "number"
                )
                .map((dataKey, index) => (
                  <Bar
                    key={dataKey}
                    dataKey={dataKey}
                    name={formatFieldLabel(dataKey)}
                    fill={colors[index % colors.length]}
                    stackId="stack"
                    radius={index === 0 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    animationDuration={1000}
                    animationBegin={index * 150}
                  />
                ))
            )}
          </BarChart>
        );

      case "line":
        return (
          <LineChart 
            {...commonProps}
            onMouseDown={(e) => {
              if (e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaLeft: e.activeLabel }));
              }
            }}
            onMouseMove={(e) => {
              if (zoomState.refAreaLeft && e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaRight: e.activeLabel }));
              }
            }}
            onMouseUp={zoom}
          >
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}
            {referenceLineConfig}
            {referenceAreaConfig}

            {!stackedData ? (
              <Line
                type="monotone"
                dataKey={yAxis.dataKey || yAxis.field}
                name={yAxis.label}
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ r: 4, fill: colors[0] }}
                activeDot={{ r: 6 }}
                animationDuration={1500}
              />
            ) : (
              // Handle multiple lines
              currentChart.data.length > 0 &&
              Object.keys(currentChart.data[0])
                .filter(
                  (key) =>
                    key !== xAxis.field &&
                    typeof currentChart.data[0][key] === "number"
                )
                .map((dataKey, index) => (
                  <Line
                    key={dataKey}
                    type="monotone"
                    dataKey={dataKey}
                    name={formatFieldLabel(dataKey)}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: colors[index % colors.length] }}
                    activeDot={{ r: 6 }}
                    animationDuration={1500}
                    animationBegin={index * 150}
                  />
                ))
            )}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart 
            {...commonProps}
            onMouseDown={(e) => {
              if (e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaLeft: e.activeLabel }));
              }
            }}
            onMouseMove={(e) => {
              if (zoomState.refAreaLeft && e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaRight: e.activeLabel }));
              }
            }}
            onMouseUp={zoom}
          >
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}
            {referenceLineConfig}
            {referenceAreaConfig}

            {!stackedData ? (
              <>
                <defs>
                  <linearGradient
                    id="colorGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={colors[0]} stopOpacity={0.8} />
                    <stop
                      offset="95%"
                      stopColor={colors[0]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey={yAxis.dataKey || yAxis.field}
                  name={yAxis.label}
                  stroke={colors[0]}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGradient)"
                  animationDuration={1500}
                />
              </>
            ) : (
              // Handle stacked areas
              currentChart.data.length > 0 &&
              Object.keys(currentChart.data[0])
                .filter(
                  (key) =>
                    key !== xAxis.field &&
                    typeof currentChart.data[0][key] === "number"
                )
                .map((dataKey, index) => {
                  const color = colors[index % colors.length];
                  const gradientId = `colorGradient-${index}`;

                  return (
                    <React.Fragment key={dataKey}>
                      <defs>
                        <linearGradient
                          id={gradientId}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={color}
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor={color}
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey={dataKey}
                        name={formatFieldLabel(dataKey)}
                        stroke={color}
                        fill={`url(#${gradientId})`}
                        stackId="stack"
                        animationDuration={1500}
                        animationBegin={index * 150}
                      />
                    </React.Fragment>
                  );
                })
            )}
          </AreaChart>
        );

      case "pie":
        // For pie charts, we need to transform the data if it's not already in the right format
        const pieData = preparePieData(
          currentChart.data,
          yAxis.field,
          xAxis.field
        );

        return (
          <PieChart {...commonProps}>
            {tooltipConfig}
            {legendConfig}
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius="80%"
              innerRadius="0%"
              fill="#8884d8"
              nameKey="name"
              dataKey="value"
              label={renderCustomizedLabel}
              animationDuration={1500}
              animationBegin={200}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
          </PieChart>
        );

      case "scatter":
        return (
          <ScatterChart 
            {...commonProps}
            onMouseDown={(e) => {
              if (e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaLeft: e.activeLabel }));
              }
            }}
            onMouseMove={(e) => {
              if (zoomState.refAreaLeft && e?.activeLabel) {
                setZoomState(prev => ({ ...prev, refAreaRight: e.activeLabel }));
              }
            }}
            onMouseUp={zoom}
          >
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}
            {referenceAreaConfig}

            <Scatter
              name={`${xAxis.label} vs ${yAxis.label}`}
              data={currentChart.data}
              fill={colors[0]}
              animationDuration={1500}
            >
              {colorBy
                ? // Color points by a category
                  currentChart.data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        colors[
                          Math.abs(hashCode(String(entry[colorBy]))) %
                            colors.length
                        ]
                      }
                    />
                  ))
                : // Use a single color
                  currentChart.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[0]} />
                  ))}
            </Scatter>
          </ScatterChart>
        );

      default:
        return (
          <div className="h-full flex items-center justify-center text-white/70">
            <p>Chart type not supported</p>
          </div>
        );
    }
  }
};

/**
 * Helper to prepare data for pie chart
 */
function preparePieData(
  data: any[],
  valueField: string,
  nameField: string
): any[] {
  // If we have simple data with name/value fields, use it directly
  if (data.every((item) => item.name && item.value !== undefined)) {
    return data;
  }

  // Convert data to pie format
  return data.map((item) => ({
    name: String(item[nameField]),
    value: Number(item[valueField]),
  }));
}

/**
 * Custom label renderer for pie chart
 */
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 0.8;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Only show label if segment is large enough
  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

/**
 * Simple hash function to generate consistent colors
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/**
 * Helper to format a field name as a readable label
 */
function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Extract table name from SQL query for Mosaic integration
 */
function extractTableName(query: string): string {
  const match = query.match(/FROM\s+"?([^"\s]+)"?/i);
  return match ? match[1] : 'unknown_table';
}

export default ChartCanvas;
