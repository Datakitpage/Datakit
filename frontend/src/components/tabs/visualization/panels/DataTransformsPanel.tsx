import React, { useState } from "react";

import {
  ArrowUpDown,
  Filter,
  Calculator,
  RefreshCw,
  Plus,
  Trash,
} from "lucide-react";

import { useChartsStore, DataTransform } from "@/store/chartsStore";

import { Button } from "@/components/ui/Button";

/**
 * Component for configuring data transformations
 */
const DataTransforms: React.FC = () => {
  const {
    currentChart,
    applyDataTransform,
    resetTransforms,
    updateCurrentChart,
  } = useChartsStore();

  const [transformType, setTransformType] =
    useState<DataTransform["type"]>("none");

  // If no chart, show nothing
  if (!currentChart) return null;

  // Get available fields from current chart data
  const availableFields =
    currentChart.data && currentChart.data.length > 0
      ? Object.keys(currentChart.data[0])
      : [];

  // Current transforms list
  const currentTransforms = currentChart.transforms || [];

  // Function to render the appropriate form based on transform type
  const renderTransformForm = () => {
    switch (transformType) {
      case "filter":
        return (
          <FilterTransformForm
            fields={availableFields}
            onApply={applyDataTransform}
          />
        );
      case "sort":
        return (
          <SortTransformForm
            fields={availableFields}
            onApply={applyDataTransform}
          />
        );
      case "aggregate":
        return (
          <AggregateTransformForm
            fields={availableFields}
            onApply={applyDataTransform}
          />
        );
      default:
        return null;
    }
  };

  // Function to remove a transform
  const removeTransform = (index: number) => {
    const newTransforms = [...currentTransforms];
    newTransforms.splice(index, 1);

    // Apply remaining transforms to original data
    let transformedData = [...(currentChart.originalData || [])];
    for (const transform of newTransforms) {
      transformedData = applyTransform(transformedData, transform);
    }

    // Update chart with new transforms and data
    updateCurrentChart({
      transforms: newTransforms,
      data: transformedData,
    });
  };

  return (
    <div className="mt-2 pt-1">
      {/* Existing transforms list */}
      {currentTransforms.length > 0 && (
        <div className="mb-2">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
            Applied Transforms:
          </h4>
          <div className="space-y-2">
            {currentTransforms.map((transform, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-background rounded text-xs"
              >
                <div className="flex items-center">
                  {transform.type === "filter" && (
                    <Filter size={14} className="mr-1 text-primary" />
                  )}
                  {transform.type === "sort" && (
                    <ArrowUpDown size={14} className="mr-1 text-secondary" />
                  )}
                  {transform.type === "aggregate" && (
                    <Calculator size={14} className="mr-1 text-tertiary" />
                  )}
                  <span>{formatTransformDescription(transform)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => removeTransform(index)}
                >
                  <Trash size={12} />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetTransforms}
            className="mt-2 text-xs"
          >
            <RefreshCw size={12} className="mr-1" />
            Reset All Transforms
          </Button>
        </div>
      )}

      {/* Add new transform */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">
          Add Transformation:
        </label>
        <select
          value={transformType}
          onChange={(e) =>
            setTransformType(e.target.value as DataTransform["type"])
          }
          className="w-full p-2 bg-background border border-border rounded text-sm font-medium text-foreground"
        >
          <option value="none">Select a transformation...</option>
          <option value="filter">Filter Data</option>
          <option value="sort">Sort Data</option>
          <option value="aggregate">Aggregate Data</option>
        </select>
      </div>

      {/* Transform form */}
      {renderTransformForm()}
    </div>
  );
};

/**
 * Form for filtering data
 */
interface TransformFormProps {
  fields: string[];
  onApply: (transform: DataTransform) => void;
}

const FilterTransformForm: React.FC<TransformFormProps> = ({
  fields,
  onApply,
}) => {
  const [field, setField] = useState<string>(fields[0] || "");
  const [operator, setOperator] =
    useState<DataTransform["filterOperator"]>("=");
  const [value, setValue] = useState<string>("");

  const handleApply = () => {
    if (!field || !value) return;

    onApply({
      type: "filter",
      field,
      filterOperator: operator,
      filterValue: value,
    });

    // Reset form
    setValue("");
  };

  return (
    <div className="p-3 bg-background/50 rounded border border-border">
      <h4 className="text-xs font-medium mb-2">Filter Data</h4>

      <div className="space-y-2">
        <div>
          <label className="block text-xs mb-1">Field:</label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="w-full p-1.5 bg-popover border border-border rounded text-foreground text-xs"
          >
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1">Operator:</label>
          <select
            value={operator}
            onChange={(e) =>
              setOperator(e.target.value as DataTransform["filterOperator"])
            }
            className="w-full p-1.5 bg-popover border border-border rounded text-foreground text-xs"
          >
            <option value="=">=</option>
            <option value=">">{">"}</option>
            <option value="<">{"<"}</option>
            <option value=">=">{"≥"}</option>
            <option value="<=">{"≤"}</option>
            <option value="contains">Contains</option>
            <option value="startsWith">Starts with</option>
            <option value="endsWith">Ends with</option>
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1">Value:</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full p-1.5 bg-popover border border-border rounded text-foreground text-xs"
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={!field || !value}
          className="w-full mt-2"
        >
          <Plus size={12} className="mr-1" />
          Apply Filter
        </Button>
      </div>
    </div>
  );
};

/**
 * Form for sorting data
 */
const SortTransformForm: React.FC<TransformFormProps> = ({
  fields,
  onApply,
}) => {
  const [field, setField] = useState<string>(fields[0] || "");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");

  const handleApply = () => {
    if (!field) return;

    onApply({
      type: "sort",
      field,
      direction,
    });
  };

  return (
    <div className="p-3 bg-background/50 rounded border border-border">
      <h4 className="text-xs font-medium mb-2">Sort Data</h4>

      <div className="space-y-2">
        <div>
          <label className="block text-xs mb-1">Field:</label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="w-full p-1.5 bg-popover border border-border rounded text-foreground text-xs"
          >
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1">Direction:</label>
          <div className="flex border border-border rounded overflow-hidden">
            <button
              className={`flex-1 p-1.5 text-xs ${
                direction === "asc"
                  ? "bg-primary text-foreground"
                  : "bg-popover text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setDirection("asc")}
            >
              Ascending
            </button>
            <button
              className={`flex-1 p-1.5 text-xs ${
                direction === "desc"
                  ? "bg-primary text-foreground"
                  : "bg-popover text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setDirection("desc")}
            >
              Descending
            </button>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={!field}
          className="w-full mt-2"
        >
          <Plus size={12} className="mr-1" />
          Apply Sorting
        </Button>
      </div>
    </div>
  );
};

/**
 * Form for aggregating data
 */
const AggregateTransformForm: React.FC<TransformFormProps> = ({
  fields,
  onApply,
}) => {
  const [field, setField] = useState<string>(fields[0] || "");
  const [operation, setOperation] = useState<DataTransform["operation"]>("sum");
  const [groupBy, setGroupBy] = useState<string>(fields[0] || "");

  const handleApply = () => {
    if (!field || !groupBy) return;

    onApply({
      type: "aggregate",
      field,
      operation,
      groupBy,
    });
  };

  return (
    <div className="p-3 bg-background/50 rounded border border-border">
      <h4 className="text-xs font-medium mb-2">Aggregate Data</h4>

      <div className="space-y-2">
        <div>
          <label className="block text-xs mb-1">Value Field:</label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="w-full p-1.5 bg-popover border border-border rounded text-foreground text-xs"
          >
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1">Operation:</label>
          <select
            value={operation}
            onChange={(e) =>
              setOperation(e.target.value as DataTransform["operation"])
            }
            className="w-full p-1.5 bg-popover border border-border rounded text-foreground text-xs"
          >
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="min">Minimum</option>
            <option value="max">Maximum</option>
            <option value="count">Count</option>
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1">Group By:</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="w-full p-1.5 bg-popover border border-border rounded text-foreground text-xs"
          >
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={!field || !groupBy}
          className="w-full mt-2"
        >
          <Plus size={12} className="mr-1" />
          Apply Aggregation
        </Button>
      </div>
    </div>
  );
};

/**
 * Format a transform into a readable description
 */
function formatTransformDescription(transform: DataTransform): string {
  switch (transform.type) {
    case "filter":
      return `Filter where ${transform.field} ${transform.filterOperator} "${transform.filterValue}"`;
    case "sort":
      return `Sort by ${transform.field} (${
        transform.direction === "asc" ? "ascending" : "descending"
      })`;
    case "aggregate":
      return `${capitalize(transform.operation || "")} of ${
        transform.field
      } grouped by ${transform.groupBy}`;
    default:
      return "Unknown transformation";
  }
}

/**
 * Apply a transform to data (copied from store for reference)
 */
function applyTransform(data: any[], transform: DataTransform): any[] {
  if (!data.length) return data;

  switch (transform.type) {
    case "filter":
      if (!transform.field || transform.filterValue === undefined) return data;

      return data.filter((item) => {
        const value = item[transform.field!];
        const filterValue = transform.filterValue!;

        switch (transform.filterOperator) {
          case ">":
            return value > filterValue;
          case "<":
            return value < filterValue;
          case ">=":
            return value >= filterValue;
          case "<=":
            return value <= filterValue;
          case "contains":
            return String(value).includes(filterValue);
          case "startsWith":
            return String(value).startsWith(filterValue);
          case "endsWith":
            return String(value).endsWith(filterValue);
          default:
            return value == filterValue; // Loose equality for type conversion
        }
      });

    case "sort":
      if (!transform.field) return data;

      return [...data].sort((a, b) => {
        const valueA = a[transform.field!];
        const valueB = b[transform.field!];

        if (valueA < valueB) return transform.direction === "asc" ? -1 : 1;
        if (valueA > valueB) return transform.direction === "asc" ? 1 : -1;
        return 0;
      });

    case "aggregate":
      if (!transform.field || !transform.operation || !transform.groupBy) {
        return data;
      }

      // Group data by the groupBy field
      const groups: Record<string, any[]> = {};
      for (const item of data) {
        const groupKey = String(item[transform.groupBy!]);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
      }

      // Apply aggregation to each group
      return Object.entries(groups).map(([groupKey, items]) => {
        let result = 0;

        switch (transform.operation) {
          case "sum":
            result = items.reduce(
              (sum, item) => sum + Number(item[transform.field!]),
              0
            );
            break;
          case "avg":
            result =
              items.reduce(
                (sum, item) => sum + Number(item[transform.field!]),
                0
              ) / items.length;
            break;
          case "min":
            result = Math.min(
              ...items.map((item) => Number(item[transform.field!]))
            );
            break;
          case "max":
            result = Math.max(
              ...items.map((item) => Number(item[transform.field!]))
            );
            break;
          case "count":
            result = items.length;
            break;
        }

        // Create a new object with the group and result
        return {
          [transform.groupBy!]: groupKey,
          [transform.field!]: result,
        };
      });

    default:
      return data;
  }
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default DataTransforms;
