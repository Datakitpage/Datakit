import type { TableSchema } from "@/store/dataStore";

interface WidgetSuggestion {
  type: "metric" | "chart" | "table";
  title: string;
  config: {
    sql: string;
    chartType?: "bar" | "line" | "pie";
    dataSourceId?: string;
  };
}

function getColumnCategory(col: TableSchema): "numeric" | "categorical" | "temporal" | "text" {
  const type = col.type.toLowerCase();
  const name = col.name.toLowerCase();

  if (
    type.includes("date") ||
    type.includes("time") ||
    type.includes("timestamp") ||
    name.includes("date") ||
    name.includes("time") ||
    name.includes("created") ||
    name.includes("updated")
  ) {
    return "temporal";
  }

  if (
    type.includes("int") ||
    type.includes("float") ||
    type.includes("double") ||
    type.includes("decimal") ||
    type.includes("numeric") ||
    type.includes("real")
  ) {
    return "numeric";
  }

  if (type.includes("bool") || type.includes("enum")) {
    return "categorical";
  }

  return "text";
}

function isLikelyCategorical(name: string): boolean {
  const hints = ["category", "type", "status", "state", "country", "city", "region", "department", "team", "group", "class", "tier", "level", "grade", "segment", "channel", "source", "gender"];
  return hints.some(h => name.toLowerCase().includes(h));
}

function isLikelyMetric(name: string): boolean {
  const hints = ["amount", "total", "sum", "count", "price", "cost", "revenue", "sales", "profit", "quantity", "value", "rate", "score", "avg", "average", "percent", "ratio", "balance"];
  return hints.some(h => name.toLowerCase().includes(h));
}

function formatTitle(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function generateAutoWidgets(
  schema: TableSchema[],
  tableName: string
): WidgetSuggestion[] {
  const suggestions: WidgetSuggestion[] = [];

  const numericCols = schema.filter(c => getColumnCategory(c) === "numeric");
  const temporalCols = schema.filter(c => getColumnCategory(c) === "temporal");
  const textCols = schema.filter(c => getColumnCategory(c) === "text" || getColumnCategory(c) === "categorical");

  const categoryCol = textCols.find(c => isLikelyCategorical(c.name)) || textCols[0];
  const metricCols = numericCols.filter(c => isLikelyMetric(c.name));
  const dateCol = temporalCols[0];

  // 1. Row count metric
  suggestions.push({
    type: "metric",
    title: "Total Records",
    config: { sql: "SELECT COUNT(*) as value FROM " + tableName },
  });

  // 2. Metrics for numeric columns
  const metricsToAdd = metricCols.length > 0 ? metricCols.slice(0, 2) : numericCols.slice(0, 2);
  for (const col of metricsToAdd) {
    suggestions.push({
      type: "metric",
      title: "Total " + formatTitle(col.name),
      config: { sql: "SELECT SUM(" + col.name + ") as value FROM " + tableName },
    });
  }

  // 3. Bar chart for category + numeric
  if (categoryCol && numericCols.length > 0) {
    const measureCol = metricCols[0] || numericCols[0];
    suggestions.push({
      type: "chart",
      title: formatTitle(measureCol.name) + " by " + formatTitle(categoryCol.name),
      config: {
        sql: "SELECT " + categoryCol.name + " as category, SUM(" + measureCol.name + ") as value FROM " + tableName + " GROUP BY " + categoryCol.name + " ORDER BY value DESC LIMIT 10",
        chartType: "bar",
      },
    });
  }

  // 4. Line chart for date + numeric
  if (dateCol && numericCols.length > 0) {
    const measureCol = metricCols[0] || numericCols[0];
    suggestions.push({
      type: "chart",
      title: formatTitle(measureCol.name) + " Over Time",
      config: {
        sql: "SELECT DATE_TRUNC('day', " + dateCol.name + ") as date, SUM(" + measureCol.name + ") as value FROM " + tableName + " GROUP BY 1 ORDER BY 1",
        chartType: "line",
      },
    });
  }

  // 5. Pie chart for distribution
  if (textCols.length > 1) {
    const col = textCols.find(c => c !== categoryCol) || textCols[0];
    suggestions.push({
      type: "chart",
      title: formatTitle(col.name) + " Distribution",
      config: {
        sql: "SELECT " + col.name + " as category, COUNT(*) as value FROM " + tableName + " GROUP BY " + col.name + " ORDER BY value DESC LIMIT 8",
        chartType: "pie",
      },
    });
  }

  // 6. Data table
  suggestions.push({
    type: "table",
    title: formatTitle(tableName),
    config: { sql: "SELECT * FROM " + tableName + " LIMIT 100" },
  });

  return suggestions;
}
