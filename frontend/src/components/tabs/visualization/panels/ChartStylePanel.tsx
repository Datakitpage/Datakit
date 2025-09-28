import React from 'react';
import { useChartsStore } from '@/store/chartsStore';

/**
 * Component for configuring chart visual styles
 */
const ChartStylePanel: React.FC = () => {
  const { currentChart, updateCurrentChart, colorPalettes } = useChartsStore();

  if (!currentChart) return null;

  return (
    <div className="space-y-4">
  

      {/* Color palette selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Color Palette</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(colorPalettes).map(([name, colors]) => (
            <button
              key={name}
              className={`p-2 border rounded flex items-center cursor-pointer ${
                currentChart.palette === name
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => updateCurrentChart({ palette: name })}
            >
              <div className="flex mr-2">
                {colors.slice(0, 3).map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-8 first:rounded-l last:rounded-r"
                    style={{
                      backgroundColor: color,
                      marginLeft: i > 0 ? -4 : 0,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs capitalize">{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart element visibility options */}
      <div className="bg-popover/30 p-3 rounded">
        <h4 className="text-sm font-medium mb-2">Display Options</h4>

        <div className="space-y-2.5">
          {/* Legend visibility */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-legend"
              checked={currentChart.showLegend}
              onChange={(e) =>
                updateCurrentChart({ showLegend: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="show-legend" className="text-sm">
              Show Legend
            </label>
          </div>

          {/* Grid lines visibility */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-grid"
              checked={currentChart.showGrid}
              onChange={(e) =>
                updateCurrentChart({ showGrid: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="show-grid" className="text-sm">
              Show Grid Lines
            </label>
          </div>

          {/* X-Axis label visibility - new option */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-x-label"
              checked={currentChart.showXAxisLabel !== false}
              onChange={(e) =>
                updateCurrentChart({ showXAxisLabel: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="show-x-label" className="text-sm">
              Show X-Axis Label
            </label>
          </div>

          {/* Y-Axis label visibility - new option */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-y-label"
              checked={currentChart.showYAxisLabel !== false}
              onChange={(e) =>
                updateCurrentChart({ showYAxisLabel: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="show-y-label" className="text-sm">
              Show Y-Axis Label
            </label>
          </div>

          {/* Data stacking option (for applicable chart types) */}
          {["bar", "area", "line"].includes(currentChart.type) && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="stacked-data"
                checked={currentChart.stackedData}
                onChange={(e) =>
                  updateCurrentChart({ stackedData: e.target.checked })
                }
                className="mr-2"
              />
              <label htmlFor="stacked-data" className="text-sm">
                Stack Data Series
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Axis styling options */}
      <div className="bg-popover/30 p-3 rounded">
        <h4 className="text-sm font-medium mb-2">Axis Styling</h4>

        {/* X-Axis label */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">
            X-Axis Label Text
          </label>
          <input
            type="text"
            value={currentChart.xAxis.label}
            onChange={(e) =>
              updateCurrentChart({
                xAxis: { ...currentChart.xAxis, label: e.target.value },
              })
            }
            className="w-full p-2 bg-background border border-border rounded text-foreground text-sm"
            placeholder="X-Axis Label"
          />
        </div>

        {/* Y-Axis label */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Y-Axis Label Text
          </label>
          <input
            type="text"
            value={currentChart.yAxis.label}
            onChange={(e) =>
              updateCurrentChart({
                yAxis: { ...currentChart.yAxis, label: e.target.value },
              })
            }
            className="w-full p-2 bg-background border border-border rounded text-foreground text-sm"
            placeholder="Y-Axis Label"
          />
        </div>
      </div>
    </div>
  );
};

export default ChartStylePanel;