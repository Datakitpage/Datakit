import React, { useState, useEffect } from "react";
import { ArrowRight, RefreshCw, Code, Eye } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useMosaicQuery, QueryOptions } from "@/hooks/chart/useMosaicQuery";
import { useChartsStore } from "@/store/chartsStore";
import { useDuckDBStore } from "@/store/duckDBStore";

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
}

const ChartGenerator: React.FC<ChartGeneratorProps> = ({ selectedTable }) => {
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
  const [showSQL, setShowSQL] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");

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
        limit,
        source: selectedTable.source,
        database: selectedTable.database,
      };

      const sql = generateSQL(queryOptions);
      setGeneratedSQL(sql);
    }
  }, [selectedTable, dimension, measure, aggregation, limit, generateSQL]);

  const handleGenerateChart = async () => {
    if (!selectedTable?.name || !dimension || !measure) return;

    const queryOptions: QueryOptions = {
      table: selectedTable.name,
      dimension,
      measure,
      aggregation,
      limit,
      source: selectedTable.source,
      database: selectedTable.database,
    };

    try {
      const result = await executeQuery(queryOptions);
      
      // Create or update chart with the result
      if (!currentChart) {
        createNewChart("bar", result.data, result.query);
      } else {
        updateCurrentChart({
          data: result.data,
          originalData: [...result.data],
          query: result.query,
        });
      }
    } catch (err) {
      // Error is already handled by the hook
      console.error("Failed to generate chart:", err);
    }
  };

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

        {/* Limit selection */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Limit Results
          </label>
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

      {/* Action button */}
      <Button
        variant="outline"
        className="w-full mt-2"
        onClick={handleGenerateChart}
        disabled={isExecuting || !dimension || !measure}
      >
        {isExecuting ? (
          <>
            <RefreshCw size={14} className="mr-1.5 animate-spin" />
            Querying... {progress > 0 && `${progress}%`}
          </>
        ) : (
          <>
            <ArrowRight size={14} className="mr-1.5" />
            Generate Chart
          </>
        )}
      </Button>
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

export default ChartGenerator;