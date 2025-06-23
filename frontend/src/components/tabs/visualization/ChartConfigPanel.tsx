import React, { useState, useCallback } from "react";
import { RefreshCw, ArrowRight, AlertTriangle, TrendingUp, RotateCcw } from "lucide-react";

import { useChartsStore } from "@/store/chartsStore";
import { checkBrowserCapability } from "@/utils/chartPerformance";

import { Button } from "@/components/ui/Button";
import DataTransforms from "./panels/DataTransformsPanel";
import ChartGenerator from "./panels/ChartGeneratorPanel";
import ChartStylePanel from "./panels/ChartStylePanel";

interface DuckDBTable {
  name: string;
  rowCount?: number;
  isView: boolean;
  source: "local" | "motherduck";
  database?: string;
  schema?: { name: string; type: string }[];
}

interface ChartConfigPanelProps {
  selectedTable?: DuckDBTable | null;
}

/**
 * Component for configuring chart settings
 */
const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({ selectedTable }) => {
  const { currentChart, updateCurrentChart } = useChartsStore();

  const [activeTab, setActiveTab] = useState<"data" | "style" | "transforms">(
    "data"
  );

  // State for generate chart functionality
  const [generateChartFn, setGenerateChartFn] = useState<(() => void) | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);
  const [performanceAnalysis, setPerformanceAnalysis] = useState<any>(null);

  // Callback to receive generate chart functionality from ChartGenerator
  const handleGenerateChartCallback = useCallback((
    generateFn: () => void,
    isExecuting: boolean,
    canGen: boolean,
    perfAnalysis: any
  ) => {
    setGenerateChartFn(() => generateFn);
    setIsGenerating(isExecuting);
    setCanGenerate(canGen);
    setPerformanceAnalysis(perfAnalysis);
  }, []);

  if (!selectedTable) {
    return (
      <div className="p-4 text-center h-full flex flex-col justify-center">
        <h3 className="text-sm font-medium mb-2 text-white/70">No Table Selected</h3>
        <p className="text-xs text-white/50">Select a table to configure charts</p>
      </div>
    );
  }

  if (!currentChart) {
    return (
      <div className="p-4 h-full flex flex-col">
        <h3 className="text-sm font-medium mb-2 text-white/70">Ready to Create Chart</h3>
        <p className="text-xs text-white/50 mb-4">
          Configure your data mapping below to generate a chart from{" "}
          <span className="text-primary">{selectedTable.name}</span>
        </p>
        
        {/* Chart Generator Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          <ChartGenerator selectedTable={selectedTable} onGenerateChart={handleGenerateChartCallback} />
        </div>

        {/* Generate Chart Footer */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={`flex-1 ${
                performanceAnalysis?.threshold.warningLevel === 'critical' ? 'border-red-500/50 hover:border-red-500/70' :
                performanceAnalysis?.threshold.warningLevel === 'warning' ? 'border-yellow-500/50 hover:border-yellow-500/70' :
                ''
              }`}
              onClick={() => generateChartFn && generateChartFn()}
              disabled={!canGenerate || !generateChartFn}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={14} className="mr-1.5 animate-spin" />
                  {performanceAnalysis?.dataSize === 'large' || performanceAnalysis?.dataSize === 'very_large' ? 
                    'Processing Large Dataset...' : 
                    'Querying...'
                  }
                </>
              ) : (
                <>
                  {performanceAnalysis?.threshold.warningLevel === 'critical' ? (
                    <>
                      <AlertTriangle size={14} className="mr-1.5 text-red-400" />
                      High Performance Mode
                    </>
                  ) : performanceAnalysis?.threshold.warningLevel === 'warning' ? (
                    <>
                      <TrendingUp size={14} className="mr-1.5 text-yellow-400" />
                      Generate Chart (Optimized)
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} className="mr-1.5" />
                      Generate Chart
                    </>
                  )}
                </>
              )}
            </Button>

            {/* Reset Chart Settings Icon Button */}
            <Button
              variant="ghost"
              size="sm"
              className="px-3"
              onClick={() => {
                // Reset to initial state based on current data - this would apply when we have a chart
                // For now when no chart exists, we don't show this button
              }}
              title="Reset Chart Settings"
            >
              <RotateCcw size={14} />
            </Button>
          </div>

          {/* Performance blocked message */}
          {performanceAnalysis && !canGenerate && !isGenerating && (
            <div className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/20">
              <p className="text-xs text-red-300 font-medium">🚫 Chart generation blocked</p>
              <p className="text-xs text-red-200 mt-1">
                Dataset too large for browser visualization. Consider using server-side aggregation or sampling.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Title and description inputs */}
      <div className="space-y-3 mb-3">
        <div>
          <label className="block text-xs font-medium mb-1">Chart Title</label>
          <input
            type="text"
            value={currentChart.title}
            onChange={(e) => updateCurrentChart({ title: e.target.value })}
            className="w-full p-2 bg-background border border-white/10 rounded text-white text-sm"
            placeholder="Enter chart title"
          />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-white/10 mb-3">
        <button
          className={`px-3 py-1.5 text-sm flex items-center cursor-pointer ${
            activeTab === "data"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-white/70 hover:text-white/90"
          }`}
          onClick={() => setActiveTab("data")}
        >
          Data
        </button>
        <button
          className={`px-3 py-1.5 text-sm flex items-center cursor-pointer ${
            activeTab === "style"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-white/70 hover:text-white/90"
          }`}
          onClick={() => setActiveTab("style")}
        >
          Style
        </button>
        <button
          className={`px-3 py-1.5 text-sm flex items-center cursor-pointer ${
            activeTab === "transforms"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-white/70 hover:text-white/90"
          }`}
          onClick={() => setActiveTab("transforms")}
        >
          Transform
        </button>
      </div>

      {/* Tab content - scrollable area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* Data mapping tab - now with selected table */}
        {activeTab === "data" && <ChartGenerator selectedTable={selectedTable} onGenerateChart={handleGenerateChartCallback} />}

        {/* Style & Colors tab */}
        {activeTab === "style" && <ChartStylePanel />}

        {/* Transforms tab */}
        {activeTab === "transforms" && <DataTransforms />}
      </div>

      {/* Action buttons */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex gap-2">
          {/* Generate Chart Button */}
          <Button
            variant="outline"
            className={`flex-1 ${
              performanceAnalysis?.threshold.warningLevel === 'critical' ? 'border-red-500/50 hover:border-red-500/70' :
              performanceAnalysis?.threshold.warningLevel === 'warning' ? 'border-yellow-500/50 hover:border-yellow-500/70' :
              ''
            }`}
            onClick={() => generateChartFn && generateChartFn()}
            disabled={!canGenerate || !generateChartFn}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="mr-1.5 animate-spin" />
                {performanceAnalysis?.dataSize === 'large' || performanceAnalysis?.dataSize === 'very_large' ? 
                  'Processing Large Dataset...' : 
                  'Querying...'
                }
              </>
            ) : (
              <>
                {performanceAnalysis?.threshold.warningLevel === 'critical' ? (
                  <>
                    <AlertTriangle size={14} className="mr-1.5 text-red-400" />
                    High Performance Mode
                  </>
                ) : performanceAnalysis?.threshold.warningLevel === 'warning' ? (
                  <>
                    <TrendingUp size={14} className="mr-1.5 text-yellow-400" />
                    Generate Chart (Optimized)
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} className="mr-1.5" />
                    Generate Chart
                  </>
                )}
              </>
            )}
          </Button>

          {/* Reset Chart Settings Icon Button */}
          {currentChart && (
            <Button
              variant="ghost"
              size="sm"
              className="px-3"
              onClick={() => {
                // Reset to initial state based on current data
                if (currentChart && currentChart.data) {
                  const xAxisField = currentChart.xAxis.field;
                  const yAxisField = currentChart.yAxis.field;

                  updateCurrentChart({
                    title: `${
                      currentChart.type.charAt(0).toUpperCase() +
                      currentChart.type.slice(1)
                    } Chart`,
                    xAxis: {
                      field: xAxisField,
                      label: formatFieldLabel(xAxisField),
                      dataKey: xAxisField,
                    },
                    yAxis: {
                      field: yAxisField,
                      label: formatFieldLabel(yAxisField),
                      dataKey: yAxisField,
                    },
                    showLegend: true,
                    showGrid: true,
                    palette: "primary",
                    colorBy: undefined,
                    description: "",
                    transforms: [],
                  });
                }
              }}
              title="Reset Chart Settings"
            >
              <RotateCcw size={14} />
            </Button>
          )}
        </div>

        {/* Performance blocked message */}
        {performanceAnalysis && !canGenerate && !isGenerating && (
          <div className="mt-2 p-2 bg-red-500/10 rounded border border-red-500/20">
            <p className="text-xs text-red-300 font-medium">🚫 Chart generation blocked</p>
            <p className="text-xs text-red-200 mt-1">
              Dataset too large for browser visualization. Consider using server-side aggregation or sampling.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Helper to format a field name as a readable label
 */
function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default ChartConfigPanel;