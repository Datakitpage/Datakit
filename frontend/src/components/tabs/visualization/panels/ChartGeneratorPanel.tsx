import React, { useState, useEffect } from "react";
import { ArrowRight, RefreshCw, Code, Eye, AlertTriangle, Zap, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useMosaicQuery, QueryOptions } from "@/hooks/chart/useMosaicQuery";
import { useChartsStore } from "@/store/chartsStore";
import { useDuckDBStore } from "@/store/duckDBStore";
import { 
  analyzeDataPerformance, 
  checkBrowserCapability, 
  aggregateDataForVisualization,
  type PerformanceAnalysis 
} from "@/utils/chartPerformance";

interface DuckDBTable {
  name: string;
  rowCount?: number;
  isView: boolean;
  source: "local" | "motherduck";
  database?: string;
  schema?: { name: string; type: string }[];
}

interface ChartGeneratorProps {
  selectedTable?: DuckDBTable | null;
  onGenerateChart?: (generateFn: () => void, isExecuting: boolean, canGenerate: boolean, performanceAnalysis: any) => void;
}

const ChartGenerator: React.FC<ChartGeneratorProps> = ({ selectedTable, onGenerateChart }) => {
  const { createNewChart, updateCurrentChart, currentChart } = useChartsStore();
  const { getTableSchema } = useDuckDBStore();
  const { executeQuery, generateSQL, isExecuting, error, progress } = useMosaicQuery();

  const [fields, setFields] = useState<{ name: string; type: string }[]>([]);
  const [dimension, setDimension] = useState<string>("");
  const [measure, setMeasure] = useState<string>("");
  const [aggregation, setAggregation] = useState<
    "sum" | "avg" | "min" | "max" | "count"
  >("sum");
  const [limit, setLimit] = useState<number>(100);
  const [samplingMode, setSamplingMode] = useState<"fixed" | "smart" | "custom">("fixed");
  const [customSampleSize, setCustomSampleSize] = useState<number>(10000);
  const [samplingType, setSamplingType] = useState<"random" | "systematic">("random");
  const [showSQL, setShowSQL] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [performanceAnalysis, setPerformanceAnalysis] = useState<PerformanceAnalysis | null>(null);

  // Get field type for selected measure
  const measureField = fields.find((f) => f.name === measure);
  const measureType = measureField?.type || "";

  // Get valid aggregations for the selected measure field
  const validAggregations = getValidAggregationsForType(measureType);

  // Load schema when table changes
  useEffect(() => {
    const loadSchema = async () => {
      if (selectedTable?.name) {
        // Try to use cached schema first
        if (selectedTable.schema) {
          setFields(selectedTable.schema);
          autoSelectFields(selectedTable.schema);
        } else {
          // Fetch schema from DuckDB
          const schema = await getTableSchema(selectedTable.name);
          if (schema) {
            setFields(schema);
            autoSelectFields(schema);
          }
        }
      }
    };

    loadSchema();
  }, [selectedTable, getTableSchema]);

  // Auto-select reasonable dimension and measure
  const autoSelectFields = (schema: { name: string; type: string }[]) => {
    // Auto-select a reasonable dimension
    const dimensionField = schema.find(
      (f) =>
        !isNumericType(f.type) ||
        f.name.toLowerCase().includes("id") ||
        f.name.toLowerCase().includes("date") ||
        f.name.toLowerCase().includes("category") ||
        f.name.toLowerCase().includes("name")
    );

    // Auto-select a measure
    const measureField = schema.find(
      (f) =>
        (isNumericType(f.type) || isDateType(f.type)) &&
        f.name !== dimensionField?.name &&
        !f.name.toLowerCase().includes("id")
    );

    if (dimensionField) setDimension(dimensionField.name);
    if (measureField) {
      setMeasure(measureField.name);
      // Set appropriate default aggregation
      const validAggs = getValidAggregationsForType(measureField.type);
      if (validAggs.includes("sum")) {
        setAggregation("sum");
      } else if (validAggs.includes("count")) {
        setAggregation("count");
      } else {
        setAggregation(validAggs[0] as any);
      }
    }
  };

  // Update aggregation when measure changes
  useEffect(() => {
    if (measure && validAggregations.length > 0) {
      if (!validAggregations.includes(aggregation)) {
        if (validAggregations.includes("sum")) {
          setAggregation("sum");
        } else if (validAggregations.includes("count")) {
          setAggregation("count");
        } else {
          setAggregation(validAggregations[0] as any);
        }
      }
    }
  }, [measure, validAggregations, aggregation]);

  // Generate SQL when parameters change
  useEffect(() => {
    if (selectedTable?.name && dimension && measure) {
      const queryOptions: QueryOptions = {
        table: selectedTable.name,
        dimension,
        measure,
        aggregation,
        limit: samplingMode === "fixed" ? limit : samplingMode === "custom" ? customSampleSize : undefined,
        source: selectedTable.source,
        database: selectedTable.database,
        samplingMode,
        samplingType,
        tableRowCount: selectedTable.rowCount,
      };

      const sql = generateSQL(queryOptions);
      setGeneratedSQL(sql);
    }
  }, [selectedTable, dimension, measure, aggregation, limit, samplingMode, customSampleSize, samplingType, generateSQL]);

  // Analyze performance when table changes
  useEffect(() => {
    if (selectedTable?.rowCount) {
      const analysis = analyzeDataPerformance(selectedTable.rowCount, fields.length);
      setPerformanceAnalysis(analysis);
      
      // Auto-adjust sampling mode based on performance analysis
      if (analysis.dataSize === 'large' || analysis.dataSize === 'very_large' || analysis.dataSize === 'massive') {
        if (samplingMode === 'fixed') {
          setSamplingMode('smart');
        }
      }
    } else {
      setPerformanceAnalysis(null);
    }
  }, [selectedTable?.rowCount, fields.length, samplingMode]);

  const handleGenerateChart = async () => {
    if (!selectedTable?.name || !dimension || !measure) return;

    // Performance safety check
    if (performanceAnalysis) {
      const browserCheck = checkBrowserCapability(performanceAnalysis);
      
      if (!browserCheck.canRender) {
        alert(`Cannot render chart: ${browserCheck.blockingIssues.join(', ')}`);
        return;
      }
    }

    const queryOptions: QueryOptions = {
      table: selectedTable.name,
      dimension,
      measure,
      aggregation,
      limit: samplingMode === "fixed" ? limit : samplingMode === "custom" ? customSampleSize : undefined,
      source: selectedTable.source,
      database: selectedTable.database,
      samplingMode,
      samplingType,
      tableRowCount: selectedTable.rowCount,
    };

    try {
      const result = await executeQuery(queryOptions);
      
      // Apply performance-based data aggregation if needed
      let processedData = result.data;
      if (performanceAnalysis?.threshold.aggregationLevel > 1 && result.data.length > 10000) {
        processedData = aggregateDataForVisualization(
          result.data,
          dimension,
          measure,
          performanceAnalysis.aggregationConfig
        );
        console.log(`[Performance] Aggregated ${result.data.length} rows to ${processedData.length} bins`);
      }
      
      // Create or update chart with the result
      if (!currentChart) {
        createNewChart("bar", processedData, result.query, result.samplingInfo);
      } else {
        updateCurrentChart({
          data: processedData,
          originalData: [...result.data], // Keep original for reference
          query: result.query,
          samplingInfo: result.samplingInfo,
        });
      }
    } catch (err) {
      // Error is already handled by the hook
      console.error("Failed to generate chart:", err);
    }
  };
  
  // Notify parent about generate chart function and state
  useEffect(() => {
    if (onGenerateChart) {
      const canGenerate = !isExecuting && 
                         !!dimension && 
                         !!measure && 
                         !(performanceAnalysis && !checkBrowserCapability(performanceAnalysis).canRender);
      
      onGenerateChart(handleGenerateChart, isExecuting, canGenerate, performanceAnalysis);
    }
  }, [onGenerateChart, handleGenerateChart, isExecuting, dimension, measure, performanceAnalysis]);



  if (!selectedTable) {
    return (
      <div className="p-2 text-center">
        <p className="text-xs text-white/50">Select a table to configure charts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table info */}
      <div className="p-2 bg-darkNav/30 rounded text-xs">
        <div className="flex items-center justify-between">
          <span className="text-white/50">Table:</span>
          <span className="text-primary font-medium">{selectedTable.name}</span>
        </div>
        {selectedTable.rowCount && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-white/50">Total Rows:</span>
            <span className="text-white/70">{selectedTable.rowCount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Performance Analysis */}
      {performanceAnalysis && (
        <div className="space-y-2">
          {/* Performance Overview */}
          <div className={`p-2 rounded border ${
            performanceAnalysis.threshold.warningLevel === 'none' ? 'bg-green-500/10 border-green-500/20' :
            performanceAnalysis.threshold.warningLevel === 'info' ? 'bg-blue-500/10 border-blue-500/20' :
            performanceAnalysis.threshold.warningLevel === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20' :
            'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {performanceAnalysis.threshold.warningLevel === 'none' && <Zap className="w-3 h-3 text-green-400" />}
              {performanceAnalysis.threshold.warningLevel === 'info' && <TrendingUp className="w-3 h-3 text-blue-400" />}
              {performanceAnalysis.threshold.warningLevel === 'warning' && <AlertTriangle className="w-3 h-3 text-yellow-400" />}
              {performanceAnalysis.threshold.warningLevel === 'critical' && <AlertTriangle className="w-3 h-3 text-red-400" />}
              <span className={`text-xs font-medium ${
                performanceAnalysis.threshold.warningLevel === 'none' ? 'text-green-300' :
                performanceAnalysis.threshold.warningLevel === 'info' ? 'text-blue-300' :
                performanceAnalysis.threshold.warningLevel === 'warning' ? 'text-yellow-300' :
                'text-red-300'
              }`}>
                Performance: {performanceAnalysis.dataSize.toUpperCase()} dataset ({performanceAnalysis.rowCount.toLocaleString()} rows)
              </span>
            </div>
            <p className={`text-xs mt-1 ${
              performanceAnalysis.threshold.warningLevel === 'none' ? 'text-green-200' :
              performanceAnalysis.threshold.warningLevel === 'info' ? 'text-blue-200' :
              performanceAnalysis.threshold.warningLevel === 'warning' ? 'text-yellow-200' :
              'text-red-200'
            }`}>
              {performanceAnalysis.threshold.description}
            </p>
            
            {/* Performance Metrics */}
            {(performanceAnalysis.threshold.warningLevel === 'warning' || performanceAnalysis.threshold.warningLevel === 'critical') && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  Render Strategy: <span className="font-mono">{performanceAnalysis.renderingStrategy}</span>
                </div>
                <div>
                  Memory: <span className="font-mono">{performanceAnalysis.memoryUsage.toFixed(0)}MB</span>
                </div>
              </div>
            )}
          </div>

          {/* Performance Recommendations */}
          {performanceAnalysis.recommendations.length > 0 && (
            <div className="p-2 bg-blue-500/5 rounded border border-blue-500/10">
              <p className="text-xs font-medium text-blue-300 mb-1">💡 Recommendations:</p>
              <ul className="text-xs text-blue-200 space-y-1">
                {performanceAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Browser Capability Check */}
          {(() => {
            const browserCheck = checkBrowserCapability(performanceAnalysis);
            if (browserCheck.warnings.length > 0 || browserCheck.blockingIssues.length > 0) {
              return (
                <div className="p-2 bg-orange-500/10 rounded border border-orange-500/20">
                  <p className="text-xs font-medium text-orange-300 mb-1">⚠️ Browser Capability:</p>
                  {browserCheck.blockingIssues.map((issue, index) => (
                    <p key={index} className="text-xs text-red-300">🚫 {issue}</p>
                  ))}
                  {browserCheck.warnings.map((warning, index) => (
                    <p key={index} className="text-xs text-orange-200">⚠️ {warning}</p>
                  ))}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-3">
        {/* X-Axis selection */}
        <div>
          <label className="block text-xs font-medium mb-1">X-Axis (Dimension)</label>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
          >
            <option value="">Select field...</option>
            {fields.map((field) => (
              <option key={`dim-${field.name}`} value={field.name}>
                {field.name} ({getFieldTypeLabel(field.type)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Y-Axis selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Y-Axis (Measure)
            </label>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
            >
              <option value="">Select field...</option>
              {fields
                .filter((f) => isNumericType(f.type) || isDateType(f.type))
                .map((field) => (
                  <option key={`measure-${field.name}`} value={field.name}>
                    {field.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Aggregation selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Aggregation
            </label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as any)}
              className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
              disabled={validAggregations.length <= 1}
            >
              {validAggregations.map((agg) => (
                <option key={agg} value={agg}>
                  {getAggregationLabel(agg)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Sampling */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Data Sampling
          </label>
          
          {/* Sampling Mode Selection */}
          <div className="space-y-2">
            <select
              value={samplingMode}
              onChange={(e) => setSamplingMode(e.target.value as "fixed" | "smart" | "custom")}
              className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
            >
              <option value="fixed">Fixed Limits (Traditional)</option>
              <option value="smart">Smart Sample (Recommended for Large Data)</option>
              <option value="custom">Custom Sample Size</option>
            </select>

            {/* Fixed Limits - Traditional approach */}
            {samplingMode === "fixed" && (
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
              >
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="50">Top 50</option>
                <option value="100">Top 100</option>
                <option value="500">Top 500</option>
                <option value="1000">Top 1000</option>
              </select>
            )}

            {/* Smart Sampling - For large datasets */}
            {samplingMode === "smart" && (
              <div className="space-y-2">
                <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <p className="text-xs text-blue-300">
                    📊 Smart sampling will automatically determine optimal sample size based on table size and chart type
                  </p>
                  {selectedTable?.rowCount && selectedTable.rowCount > 100000 && (
                    <p className="text-xs text-yellow-300 mt-1">
                      ⚡ Large dataset detected ({selectedTable.rowCount.toLocaleString()} rows) - sampling recommended
                    </p>
                  )}
                </div>
                <select
                  value={samplingType}
                  onChange={(e) => setSamplingType(e.target.value as "random" | "systematic")}
                  className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
                >
                  <option value="random">Random Sampling</option>
                  <option value="systematic">Systematic Sampling</option>
                </select>
              </div>
            )}

            {/* Custom Sample Size */}
            {samplingMode === "custom" && (
              <div className="space-y-2">
                <input
                  type="number"
                  value={customSampleSize}
                  onChange={(e) => setCustomSampleSize(Math.max(1, Number(e.target.value)))}
                  placeholder="Enter sample size..."
                  min="1"
                  max="1000000"
                  className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={samplingType}
                    onChange={(e) => setSamplingType(e.target.value as "random" | "systematic")}
                    className="w-full p-2 bg-background/50 border border-white/10 rounded text-white text-xs"
                  >
                    <option value="random">Random</option>
                    <option value="systematic">Systematic</option>
                  </select>
                  <div className="text-xs text-white/50 p-2">
                    {selectedTable?.rowCount && (
                      <span>{((customSampleSize / selectedTable.rowCount) * 100).toFixed(1)}% of data</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SQL Preview Toggle */}
        <div>
          <button
            onClick={() => setShowSQL(!showSQL)}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 cursor-pointer"
          >
            {showSQL ? <Eye size={12} /> : <Code size={12} />}
            {showSQL ? "Hide" : "Show"} Generated SQL
          </button>
        </div>

        {/* SQL Preview */}
        {showSQL && generatedSQL && (
          <div className="p-2 bg-darkNav rounded border border-white/10">
            <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono">
              {generatedSQL}
            </pre>
          </div>
        )}

        {/* Performance Warning for Large Datasets */}
        {selectedTable?.rowCount && selectedTable.rowCount > 1000000 && samplingMode === "fixed" && (
          <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
            <p className="text-xs text-yellow-300">
              ⚠️ Large dataset detected ({selectedTable.rowCount.toLocaleString()} rows)
            </p>
            <p className="text-xs text-yellow-200 mt-1">
              Consider using Smart Sample for better performance and representative results.
            </p>
          </div>
        )}

        {/* Smart Sampling Explanation */}
        {samplingMode === "smart" && selectedTable?.rowCount && (
          <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
            <p className="text-xs text-green-300">
              ✨ Smart sampling will analyze ~{calculateSmartSampleSize(selectedTable.rowCount).toLocaleString()} rows
            </p>
            <p className="text-xs text-green-200 mt-1">
              This provides statistically significant results while maintaining fast performance.
            </p>
          </div>
        )}

        {/* Description of what will happen */}
        {measure && dimension && (
          <div className="p-2 bg-primary/5 rounded-md text-xs text-white/80 border border-white/5">
            {getAggregationDescription(
              aggregation,
              measure,
              dimension,
              measureType
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-400 text-xs p-2 bg-red-400/10 rounded border border-red-400/20">
          {error}
        </div>
      )}
    </div>
  );
};

// Helper function to determine if a type is numeric
function isNumericType(type: string): boolean {
  const numericTypes = [
    "int",
    "integer",
    "double",
    "float",
    "numeric",
    "decimal",
    "bigint",
    "number",
  ];
  return numericTypes.some((t) => type.toLowerCase().includes(t));
}

// Helper function to determine if a type is date/time
function isDateType(type: string): boolean {
  const dateTypes = ["date", "datetime", "timestamp", "time"];
  return dateTypes.some((t) => type.toLowerCase().includes(t));
}

// Get valid aggregations based on field type
function getValidAggregationsForType(type: string): string[] {
  if (isDateType(type)) {
    return ["min", "max", "count"];
  }
  if (isNumericType(type)) {
    return ["sum", "avg", "min", "max", "count"];
  }
  return ["count"];
}

// Get user-friendly field type label
function getFieldTypeLabel(type: string): string {
  if (isNumericType(type)) return "number";
  if (isDateType(type)) return "date";
  return "text";
}

// Get user-friendly aggregation labels
function getAggregationLabel(agg: string): string {
  switch (agg) {
    case "sum":
      return "Sum";
    case "avg":
      return "Average";
    case "min":
      return "Minimum";
    case "max":
      return "Maximum";
    case "count":
      return "Count";
    default:
      return agg;
  }
}

// Enhanced aggregation description
function getAggregationDescription(
  aggregation: string,
  measure: string,
  dimension: string,
  measureType: string
): string {
  const isDate = isDateType(measureType);

  switch (aggregation) {
    case "sum":
      return `Total sum of "${measure}" grouped by "${dimension}"`;
    case "avg":
      return `Average "${measure}" grouped by "${dimension}"`;
    case "min":
      return isDate
        ? `Earliest "${measure}" date for each "${dimension}"`
        : `Minimum "${measure}" value for each "${dimension}"`;
    case "max":
      return isDate
        ? `Latest "${measure}" date for each "${dimension}"`
        : `Maximum "${measure}" value for each "${dimension}"`;
    case "count":
      return `Count of records for each "${dimension}"`;
    default:
      return "";
  }
}

// Calculate optimal sample size for smart sampling (same logic as in useMosaicQuery)
function calculateSmartSampleSize(tableRowCount: number): number {
  if (tableRowCount <= 1000) return tableRowCount;
  if (tableRowCount <= 10000) return Math.min(5000, Math.floor(tableRowCount * 0.8));
  if (tableRowCount <= 100000) return Math.min(10000, Math.floor(tableRowCount * 0.3));
  if (tableRowCount <= 1000000) return Math.min(25000, Math.floor(tableRowCount * 0.1));
  return Math.min(50000, Math.floor(Math.sqrt(tableRowCount) * 100));
}

export default ChartGenerator;