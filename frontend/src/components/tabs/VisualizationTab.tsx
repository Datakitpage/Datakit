import React, { useState, useEffect } from "react";
import {
  BarChart4,
  LineChart,
  PieChart,
  ScatterChart,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Settings,
  Copy,
  ArrowRight,
  Clock,
  Rows,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { selectHasFiles } from "@/store/selectors/appSelectors";
import { useChartsStore, ChartType } from "@/store/chartsStore";
import { Button } from "@/components/ui/Button";

import DuckDBTableSelector from "./visualization/DuckDBTableSelector";
import ChartCanvas from "./visualization/ChartCanvas";
import ChartConfigPanel from "./visualization/ChartConfigPanel";
import ExportModal from "./visualization/ExportModal";
import { useMosaicQuery } from "@/hooks/chart/useMosaicQuery";

interface DuckDBTable {
  name: string;
  rowCount?: number;
  isView: boolean;
  source: "local" | "motherduck";
  database?: string;
  schema?: { name: string; type: string }[];
}

/**
 * Compact chart type selector
 */
const ChartTypeRow: React.FC = () => {
  const { currentChart, updateCurrentChart } = useChartsStore();

  const chartTypes = [
    { type: "bar", icon: BarChart4, label: "Bar" },
    { type: "line", icon: LineChart, label: "Line" },
    { type: "area", icon: TrendingUp, label: "Area" },
    { type: "pie", icon: PieChart, label: "Pie" },
    { type: "scatter", icon: ScatterChart, label: "Scatter" },
  ];

  if (!currentChart) return null;

  return (
    <div className="flex gap-1">
      {chartTypes.map(({ type, icon: Icon, label }) => {
        const isActive = currentChart.type === type;

        return (
          <button
            key={type}
            className={`p-2 rounded border transition-colors cursor-pointer ${
              isActive
                ? "bg-primary/20 border-primary/30 text-primary"
                : "border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => updateCurrentChart({ type: type as ChartType })}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};

/**
 * Performance indicators for query execution
 */
const PerformanceIndicators: React.FC<{
  executionTime?: number;
  rowCount?: number;
  isExecuting?: boolean;
}> = ({ executionTime, rowCount, isExecuting }) => {
  if (!executionTime && !rowCount && !isExecuting) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-white/50">
      {isExecuting && (
        <div className="flex items-center gap-1">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
          <span>Querying...</span>
        </div>
      )}
      {executionTime && !isExecuting && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{executionTime}ms</span>
        </div>
      )}
      {rowCount && !isExecuting && (
        <div className="flex items-center gap-1">
          <Rows className="w-3 h-3" />
          <span>{rowCount.toLocaleString()} rows</span>
        </div>
      )}
    </div>
  );
};

/**
 * Main visualization component - updated to use DuckDB directly
 */
const VisualizationTab: React.FC = () => {
  const hasFiles = useAppStore(selectHasFiles);
  const { setActiveTab } = useAppStore();
  const { registeredTables } = useDuckDBStore();
  const {
    currentChart,
    createNewChart,
    loadChartsFromStorage,
    toggleExportModal,
    updateCurrentChart,
  } = useChartsStore();

  const [selectedTable, setSelectedTable] = useState<DuckDBTable | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [queryResult, setQueryResult] = useState<any>(null);

  const { isExecuting, progress, lastResult } = useMosaicQuery();

  // Load saved charts on mount
  useEffect(() => {
    loadChartsFromStorage();
  }, [loadChartsFromStorage]);

  // Auto-select first table if available
  useEffect(() => {
    if (!selectedTable && registeredTables.size > 0) {
      const firstTable = Array.from(registeredTables.keys())[0];
      setSelectedTable({
        name: firstTable,
        isView: false,
        source: "local",
      });
    }
  }, [registeredTables, selectedTable]);

  // Update chart data when query result changes
  useEffect(() => {
    if (lastResult && lastResult.data.length > 0) {
      if (!currentChart) {
        createNewChart("bar", lastResult.data, lastResult.query);
      } else {
        updateCurrentChart({
          data: lastResult.data,
          originalData: [...lastResult.data],
        });
      }
      setQueryResult(lastResult);
    }
  }, [lastResult, currentChart, createNewChart, updateCurrentChart]);

  const hasVisualizationData = currentChart?.data && currentChart.data.length > 0;

  // Show progress bar for long queries
  const showProgress = isExecuting && progress > 0;

  // No tables state
  if (registeredTables.size === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <BarChart4 className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Data Available
          </h3>
          <p className="text-white/70 mb-4">
            Import data files to create visualizations.
          </p>
          <Button variant="outline" onClick={() => setActiveTab("preview")}>
            Import Data
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Progress bar */}
      {showProgress && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-darkNav z-50">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Minimal Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-darkNav">
        <div className="flex items-center gap-4">
          {/* Left panel toggle */}
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className="p-1 hover:bg-white/10 rounded cursor-pointer"
            title={showLeftPanel ? "Hide panel" : "Show panel"}
          >
            {showLeftPanel ? (
              <ChevronLeft className="w-4 h-4 text-white/70" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/70" />
            )}
          </button>

          {/* Table selection */}
          <DuckDBTableSelector
            selectedTable={selectedTable}
            onTableChange={setSelectedTable}
          />

          {/* Chart type selection */}
          <ChartTypeRow />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          {/* Performance indicators */}
          <PerformanceIndicators
            executionTime={queryResult?.executionTime}
            rowCount={queryResult?.rowCount}
            isExecuting={isExecuting}
          />

          {hasVisualizationData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExportModal(true)}
            >
              <Copy className="w-4 h-4 mr-1" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Collapsible Left Panel */}
        {showLeftPanel && (
          <div className="w-72 border-r border-white/10 bg-darkNav/50 overflow-hidden flex flex-col">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-white">
                  Chart Configuration
                </span>
              </div>
            </div>

            {/* Panel content - now gets selected table */}
            <div className="flex-1 overflow-y-auto">
              <ChartConfigPanel selectedTable={selectedTable} />
            </div>
          </div>
        )}

        {/* Chart Canvas - Maximum Space */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedTable ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BarChart4 className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/70">Select a table to begin</p>
              </div>
            </div>
          ) : !hasVisualizationData && !isExecuting ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BarChart4 className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/70">
                  Configure your chart in the panel
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4">
              <ChartCanvas />
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal />
    </div>
  );
};

export default VisualizationTab;