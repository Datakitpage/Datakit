import React from "react";

import { useChartsStore, ChartType } from "@/store/chartsStore";

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
} from "recharts";

/**
 * Component that renders the appropriate chart based on the current configuration
 */
const ChartCanvas: React.FC = () => {
  const { currentChart, colorPalettes } = useChartsStore();

  if (!currentChart || !currentChart.data || currentChart.data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-popover/20 rounded-lg border border-border">
        <div className="text-center p-8">
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Chart Data
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure your chart or run a query to visualize data.
          </p>
        </div>
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
    <div className="h-full w-full bg-popover/20 rounded-lg border border-border p-4">
      <h3 className="text-lg font-medium mb-2 chart-title">
        {currentChart.title}
      </h3>
      {currentChart.description && (
        <p className="text-sm text-muted-foreground mb-4 chart-description">
          {currentChart.description}
        </p>
      )}

      <div className="h-[calc(100%-60px)]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(currentChart.type, palette)}
        </ResponsiveContainer>
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
          domain={xAxis.domain || ["auto", "auto"]}
          allowDataOverflow={!!xAxis.domain}
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
          domain={xAxis.domain || ["auto", "auto"]}
          allowDataOverflow={!!xAxis.domain}
        />
      );

    const yAxisConfig =
      currentChart.showYAxisLabel !== false ? (
        <YAxis
          name={yAxis.label}
          stroke="#ffffff60"
          scale={yAxis.scale || "auto"}
          domain={yAxis.domain || ["auto", "auto"]}
          allowDataOverflow={!!yAxis.domain}
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
          domain={yAxis.domain || ["auto", "auto"]}
          allowDataOverflow={!!yAxis.domain}
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

    switch (type) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}
            {referenceLineConfig}

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
          <LineChart {...commonProps}>
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}
            {referenceLineConfig}

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
          <AreaChart {...commonProps}>
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}
            {referenceLineConfig}

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
          <ScatterChart {...commonProps}>
            {gridConfig}
            {xAxisConfig}
            {yAxisConfig}
            {tooltipConfig}
            {legendConfig}

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
          <div className="h-full flex items-center justify-center text-muted-foreground">
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

export default ChartCanvas;
