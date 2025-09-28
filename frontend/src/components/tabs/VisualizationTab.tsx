import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart4,
  LineChart,
  PieChart,
  ScatterChart,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Settings,
  Copy,
  ArrowRight,
  Link2,
} from "lucide-react";

import { useAppStore } from "@/store/appStore";
import { selectHasFiles } from "@/store/selectors/appSelectors";
import { useChartsStore, ChartType } from "@/store/chartsStore";
import { Button } from "@/components/ui/Button";

import ChartCanvas from "./visualization/ChartCanvas";
import ChartConfigPanel from "./visualization/ChartConfigPanel";
import ExportModal from "./visualization/ExportModal";
import ChartGallery from "./visualization/ChartGallery";

// TODO: Postgres and motherduck should get in place later on depending on the future of this tab
//
interface DataSource {
  type: "file" | "postgresql";
  fileId: string;
  fileName: string;
  data: any[][];
  columns: string[];
  rowCount: number;
  // PostgreSQL specific fields
  postgresql?: {
    connectionId: string;
    schema: string;
    table: string;
  };
}

/**
 * Minimal compact dropdown for data source selection
 */
const DataSourceDropdown: React.FC<{
  selectedSource: DataSource | null;
  onSourceChange: (source: DataSource) => void;
}> = ({ selectedSource, onSourceChange }) => {
  const { files } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showPostgresNotification, setShowPostgresNotification] = useState(false);

  const dataSources = useMemo(() => {
    const sources: DataSource[] = [];
    
    // Add regular files with data
    files.forEach((file) => {
      // Regular CSV/Excel files with 2D array data
      if (file.data && Array.isArray(file.data) && file.data.length > 1 && file.data[0]) {
        sources.push({
          type: "file",
          fileId: file.id,
          fileName: file.fileName,
          data: file.data,
          columns: file.data[0],
          rowCount: file.data.length - 1,
        });
      }
      // PostgreSQL tables (remote tables with column metadata)
      else if (file.isRemote && file.remoteProvider === 'postgresql' && file.columnTypes) {
        sources.push({
          type: "postgresql",
          fileId: file.id,
          fileName: file.fileName,
          data: [], // Will be loaded on-demand
          columns: file.columnTypes.map(col => col.name),
          rowCount: file.rowCount || 0,
          postgresql: file.postgresql,
        });
      }
    });
    
    return sources;
  }, [files]);

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 bg-popover border border-border rounded text-sm hover:bg-accent/5 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedSource?.type === "postgresql" ? (
          <Link2 className="w-4 h-4 text-muted-foreground" />
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-foreground truncate">
          {selectedSource ? selectedSource.fileName : "Select file"}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded shadow-lg z-50 min-w-48">
          {dataSources.map((source) => (
            <button
              key={source.fileId}
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 cursor-pointer"
              onClick={() => {
                if (source.type === "postgresql") {
                  // Show notification for PostgreSQL tables
                  setShowPostgresNotification(true);
                  setIsOpen(false);
                  // Hide notification after 3 seconds
                  setTimeout(() => {
                    setShowPostgresNotification(false);
                  }, 3000);
                } else {
                  // Allow selection for regular files
                  onSourceChange(source);
                  setIsOpen(false);
                }
              }}
            >
              {source.type === "postgresql" ? (
                <Link2 className="w-3 h-3 text-primary" />
              ) : (
                <FileText className="w-3 h-3 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{source.fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {source.type === "postgresql" ? "PostgreSQL Table" : `${source.rowCount} rows`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* PostgreSQL notification */}
      {showPostgresNotification && (
        <div className="absolute top-full left-0 mt-1 bg-primary/90 text-primary-foreground text-sm px-3 py-2 rounded shadow-lg z-50 max-w-xs">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="font-medium">PostgreSQL Visualization</div>
              <div className="text-primary-foreground/80 text-xs">Coming soon! We're working on chart support for PostgreSQL tables.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
                : "border-border text-muted-foreground hover:bg-accent/5 hover:text-foreground"
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
 * Main visualization component - clean and minimal
 */
const VisualizationTab: React.FC = () => {
  const hasFiles = useAppStore(selectHasFiles);
  const { setActiveTab, activeFileId, setActiveFile, files } = useAppStore();
  const {
    currentChart,
    createNewChart,
    loadChartsFromStorage,
    toggleExportModal,
  } = useChartsStore();

  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSource | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<any[] | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);

  // Load saved charts on mount
  useEffect(() => {
    loadChartsFromStorage();
  }, [loadChartsFromStorage]);

  // Auto-select first file
  useEffect(() => {
    if (!selectedDataSource && files.length > 0) {
      // Only auto-select regular CSV/Excel files with data array
      let firstFileWithData = files.find(
        (file) => file.id === activeFileId && file.data && Array.isArray(file.data) && file.data.length > 1 && file.data[0]
      );
      
      // If active file doesn't have data, try to find any file with data
      if (!firstFileWithData) {
        firstFileWithData = files.find(
          (file) => file.data && Array.isArray(file.data) && file.data.length > 1 && file.data[0]
        );
      }
      
      if (firstFileWithData) {
        const source: DataSource = {
          type: "file",
          fileId: firstFileWithData.id,
          fileName: firstFileWithData.fileName,
          data: firstFileWithData.data,
          columns: firstFileWithData.data[0],
          rowCount: firstFileWithData.data.length - 1,
        };
        setSelectedDataSource(source);
        setSelectedColumns(source.columns.slice(0, 2));
      }
    }
  }, [files, selectedDataSource]);

  // Process data when source/columns change
  useEffect(() => {
    if (selectedDataSource?.data && selectedColumns.length > 0) {
      const headers = selectedDataSource.data[0];
      const rows = selectedDataSource.data.slice(1);

      const columnIndices = selectedColumns
        .map((col) => headers.indexOf(col))
        .filter((idx) => idx !== -1);

      const formattedData = rows.map((row) => {
        const obj: Record<string, any> = {};
        selectedColumns.forEach((column, index) => {
          const colIndex = columnIndices[index];
          if (colIndex !== -1) {
            const value = row[colIndex];
            obj[column] = isNaN(Number(value)) ? value : Number(value);
          }
        });
        return obj;
      });

      setFilteredData(formattedData);

      if (formattedData.length > 0 && !currentChart) {
        createNewChart("bar", formattedData);
      }
    } else {
      setFilteredData(null);
    }
  }, [selectedDataSource, selectedColumns, createNewChart, currentChart]);

  const hasVisualizationData = filteredData && filteredData.length > 0;

  // No files state
  if (!hasFiles) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <BarChart4 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Data Available
          </h3>
          <p className="text-muted-foreground mb-4">
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
      {/* CSS for chart styling */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .csv-grid-cell {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .csv-grid-header {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .csv-tooltip {
            background-color: color-mix(in srgb, var(--background) 90%, var(--primary) 10%);
            border: 1px solid var(--primary);
            border-radius: var(--radius);
            padding: 0.5rem;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            font-size: 0.75rem;
            max-width: 20rem;
            max-height: 15rem;
            overflow: auto;
            z-index: 9999;
          }
        `,
        }}
      />

      {/* Minimal Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-popover">
        <div className="flex items-center gap-4">
          {/* Left panel toggle */}
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className="p-1 hover:bg-accent/10 rounded cursor-pointer"
            title={showLeftPanel ? "Hide panel" : "Show panel"}
          >
            {showLeftPanel ? (
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Data source selection */}
          {/* // TODO: Do we need this? */}
          {/*  */}
          {/* <DataSourceDropdown
            selectedSource={selectedDataSource}
            onSourceChange={(file) => {
              setSelectedDataSource(file);
              setActiveFile(file.fileId);
            }}
          /> */}

          {/* Chart type selection */}
          <ChartTypeRow />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {hasVisualizationData && (
            <>
              <span className="text-xs text-muted-foreground">
                {filteredData?.length} points
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExportModal(true)}
              >
                <Copy className="w-4 h-4 mr-1" />
                Export
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Collapsible Left Panel */}
        {showLeftPanel && (
          <div className="w-72 border-r border-border bg-popover overflow-hidden flex flex-col">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Chart Configuration
                </span>
              </div>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              <ChartConfigPanel selectedDataSource={selectedDataSource} />
            </div>
          </div>
        )}

        {/* Chart Canvas - Maximum Space */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedDataSource ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">Select a data source to begin</p>
              </div>
            </div>
          ) : !hasVisualizationData ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BarChart4 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Select columns to visualize</p>
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
