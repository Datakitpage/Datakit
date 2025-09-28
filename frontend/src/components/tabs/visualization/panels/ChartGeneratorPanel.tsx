import React, { useState, useEffect } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

import { useChartGeneration } from "@/hooks/chart/useChartGeneration";
import { useSchemaInfo } from "@/hooks/query/useSchemaInfo";
import { useAppStore } from "@/store/appStore";

import { selectTableName } from "@/store/selectors/appSelectors";

const ChartGenerator: React.FC = () => {
  const tableName = useAppStore(selectTableName);
  const { tableSchema } = useSchemaInfo(tableName);

  const { generateChart, isGenerating, error } = useChartGeneration();

  const [fields, setFields] = useState<{ name: string; type: string }[]>([]);
  const [dimension, setDimension] = useState<string>("");
  const [measure, setMeasure] = useState<string>("");
  const [aggregation, setAggregation] = useState<
    "sum" | "avg" | "min" | "max" | "count"
  >("sum");

  // Get field type for selected measure
  const measureField = fields.find((f) => f.name === measure);
  const measureType = measureField?.type || "";

  // Get valid aggregations for the selected measure field
  const validAggregations = getValidAggregationsForType(measureType);

  // Load schema when table changes
  useEffect(() => {
    if (tableName) {
      if (tableSchema) {
        setFields(tableSchema);

        // Auto-select a reasonable dimension and measure
        const dimensionField = tableSchema.find(
          (f) =>
            !isNumericType(f.type) ||
            f.name.toLowerCase().includes("id") ||
            f.name.toLowerCase().includes("date") ||
            f.name.toLowerCase().includes("category")
        );

        const measureField = tableSchema.find(
          (f) =>
            (isNumericType(f.type) || isDateType(f.type)) &&
            f.name !== dimensionField?.name
        );

        if (dimensionField) setDimension(dimensionField.name);
        if (measureField) {
          setMeasure(measureField.name);
          // Set appropriate default aggregation based on field type
          const validAggs = getValidAggregationsForType(measureField.type);
          if (validAggs.includes("sum")) {
            setAggregation("sum");
          } else if (validAggs.includes("count")) {
            setAggregation("count");
          } else {
            setAggregation(validAggs[0] as any);
          }
        }
      }
    }
  }, [tableName, tableSchema]);

  // Update aggregation when measure changes
  useEffect(() => {
    if (measure && validAggregations.length > 0) {
      // If current aggregation is not valid for new field type, switch to a valid one
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

  const handleGenerateChart = async () => {
    if (tableName && dimension && measure) {
      await generateChart({
        tableName,
        dimension,
        measure,
        aggregation,
        limit: 50,
      });
    }
  };

  if (!tableName) return null;

  return (
    <div className="space-y-3">
      {/* Form fields with more vertical layout */}
      <div className="space-y-3">
        {/* X-Axis selection */}
        <div>
          <label className="block text-xs font-medium mb-1">X-Axis Field</label>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="w-full p-2 bg-background/50 border border-border rounded text-foreground text-xs"
          >
            <option value="">Select field...</option>
            {fields.map((field) => (
              <option key={`dim-${field.name}`} value={field.name}>
                {field.name} ({getFieldTypeLabel(field.type)})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Categories to group your data by
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Y-Axis selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Y-Axis Field
            </label>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="w-full p-2 bg-background/50 border border-border rounded text-foreground text-xs"
            >
              <option value="">Select field...</option>
              {fields
                .filter((f) => isNumericType(f.type) || isDateType(f.type))
                .map((field) => (
                  <option key={`measure-${field.name}`} value={field.name}>
                    {field.name} ({getFieldTypeLabel(field.type)})
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {isDateType(measureType)
                ? "Date fields for time analysis"
                : "Numeric values to measure"}
            </p>
          </div>

          {/* Aggregation selection */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Aggregation
            </label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as any)}
              className="w-full p-2 bg-background/50 border border-border rounded text-foreground text-xs"
              disabled={validAggregations.length <= 1}
            >
              {validAggregations.map((agg) => (
                <option key={agg} value={agg}>
                  {getAggregationLabel(agg)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {getAggregationHelpText(measureType)}
            </p>
          </div>
        </div>

        {/* Description of what will happen */}
        {measure && dimension && (
          <div className="mt-2 p-2 bg-accent/5 rounded-md text-xs text-muted-foreground border border-border">
            {getAggregationDescription(
              aggregation,
              measure,
              dimension,
              measureType
            )}
            <p className="mt-1 text-muted-foreground">
              Using all {tableName} data for visualization
            </p>
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
        disabled={isGenerating || !dimension || !measure}
      >
        {isGenerating ? (
          <>
            <RefreshCw size={14} className="mr-1.5" />
            Processing...
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
    return ["min", "max", "count"]; // Only meaningful aggregations for dates
  }
  if (isNumericType(type)) {
    return ["sum", "avg", "min", "max", "count"];
  }
  return ["count"]; // For text fields
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

// Get help text for aggregation based on field type
function getAggregationHelpText(measureType: string): string {
  if (isDateType(measureType)) {
    return "Date aggregations: earliest, latest, or count";
  }
  if (isNumericType(measureType)) {
    return "How to calculate the numeric values";
  }
  return "How to aggregate the values";
}

// Enhanced aggregation description with type awareness
function getAggregationDescription(
  aggregation: string,
  measure: string,
  dimension: string,
  measureType: string
): string {
  const isDate = isDateType(measureType);

  switch (aggregation) {
    case "sum":
      return `This chart will show the total sum of "${measure}" for each "${dimension}" category.`;
    case "avg":
      return `This chart will show the average "${measure}" for each "${dimension}" category.`;
    case "min":
      return isDate
        ? `This chart will show the earliest "${measure}" date for each "${dimension}" category.`
        : `This chart will show the minimum "${measure}" value for each "${dimension}" category.`;
    case "max":
      return isDate
        ? `This chart will show the latest "${measure}" date for each "${dimension}" category.`
        : `This chart will show the maximum "${measure}" value for each "${dimension}" category.`;
    case "count":
      return `This chart will show the count of items in each "${dimension}" category.`;
    default:
      return "";
  }
}

export default ChartGenerator;
