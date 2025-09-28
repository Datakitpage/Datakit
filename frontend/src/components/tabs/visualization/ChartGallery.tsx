import React, { useState, useEffect } from "react";
import { useChartsStore, ChartConfig } from "@/store/chartsStore";
import { useAppStore } from "@/store/appStore";
import {
  BarChart4,
  LineChart,
  PieChart,
  ScatterChart,
  TrendingUp,
  Copy,
  Trash,
  Plus,
  Star,
  BookOpen,
  Save,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Component for displaying saved charts and templates
 */
const ChartGallery: React.FC = () => {
  const {
    savedCharts,
    chartTemplates,
    loadChart,
    duplicateChart,
    deleteChart,
    loadChartsFromStorage,
  } = useChartsStore();

  const { data: queryData } = useAppStore();

  const [activeTab, setActiveTab] = useState<"saved" | "templates">("saved");
  const [filter, setFilter] = useState<string>("");

  // Load charts from storage on mount
  useEffect(() => {
    loadChartsFromStorage();
  }, [loadChartsFromStorage]);

  // Get charts to display based on active tab and filter
  const chartsToShow = activeTab === "saved" ? savedCharts : chartTemplates;

  const filteredCharts = filter
    ? chartsToShow.filter(
        (chart) =>
          chart.title.toLowerCase().includes(filter.toLowerCase()) ||
          chart.type.toLowerCase().includes(filter.toLowerCase()) ||
          (chart.description &&
            chart.description.toLowerCase().includes(filter.toLowerCase()))
      )
    : chartsToShow;

  // Handle loading a chart
  const handleLoadChart = (chart: ChartConfig) => {
    // For a template, we need to create a new chart based on the template
    if (chart.isTemplate) {
      // Convert the 2D array to an array of objects
      if (queryData && queryData.length > 0) {
        const headers = queryData[0];
        const rows = queryData.slice(1);

        const formattedData = rows.map((row) => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            // Try to convert to number if possible
            const value = row[index];
            obj[header] = isNaN(Number(value)) ? value : Number(value);
          });
          return obj;
        });

        // Create a new chart with the template settings but new data
        const newChart = {
          ...chart,
          id: `chart-${Date.now()}`,
          title: chart.title.replace("Template", "").trim(),
          isTemplate: false,
          timestamp: Date.now(),
        };

        // Load with data
        loadChart(newChart.id, formattedData);
      }
    } else {
      // For a saved chart, we might need to reload the data
      loadChart(chart.id);
    }
  };

  // Get icon for chart type
  const getChartIcon = (type: string) => {
    switch (type) {
      case "bar":
        return <BarChart4 size={24} />;
      case "line":
        return <LineChart size={24} />;
      case "area":
        return <TrendingUp size={24} />;
      case "pie":
        return <PieChart size={24} />;
      case "scatter":
        return <ScatterChart size={24} />;
      default:
        return <BarChart4 size={24} />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-medium mb-4">Chart Gallery</h3>

        {/* Filter input */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search charts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full p-2 pl-8 bg-background border border-border rounded text-foreground"
          />
          <Filter size={16} className="absolute left-2 top-2.5 text-muted-foreground" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            className={`px-3 py-2 text-sm ${
              activeTab === "saved"
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("saved")}
          >
            <Save size={14} className="inline mr-1" />
            Saved Charts
          </button>
          <button
            className={`px-3 py-2 text-sm ${
              activeTab === "templates"
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("templates")}
          >
            <BookOpen size={14} className="inline mr-1" />
            Templates
          </button>
        </div>
      </div>

      {/* Chart grid */}
      <div className="flex-1 overflow-auto p-4">
        {filteredCharts.length === 0 ? (
          <div className="text-center p-8 bg-popover/20 rounded-lg border border-border">
            <div className="text-muted-foreground mb-3">
              <BarChart4 size={48} className="inline-block" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Charts Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {activeTab === "saved"
                ? "You haven't saved any charts yet. Create and save a chart to see it here."
                : filter
                ? "No templates match your search."
                : "No chart templates available."}
            </p>
            {activeTab === "saved" && (
              <Button variant="primary">
                <Plus size={16} className="mr-1" />
                Create New Chart
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCharts.map((chart) => (
              <div
                key={chart.id}
                className="bg-popover/30 rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-all"
              >
                {/* Chart preview (placeholder) */}
                <div
                  className="h-32 bg-background p-3 flex items-center justify-center cursor-pointer"
                  onClick={() => handleLoadChart(chart)}
                >
                  <div className="text-primary/70 flex flex-col items-center">
                    {getChartIcon(chart.type)}
                    <span className="mt-2 text-xs capitalize">
                      {chart.type} Chart
                    </span>
                  </div>
                </div>

                {/* Chart info */}
                <div className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium truncate" title={chart.title}>
                        {chart.title}
                      </h4>
                      {chart.description && (
                        <p
                          className="text-xs text-muted-foreground mt-1 line-clamp-2"
                          title={chart.description}
                        >
                          {chart.description}
                        </p>
                      )}
                    </div>

                    {chart.isTemplate && (
                      <div className="flex-shrink-0">
                        <Star size={16} className="text-secondary" />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                      {chart.isTemplate
                        ? "Template"
                        : new Date(chart.timestamp).toLocaleDateString()}
                    </div>

                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => duplicateChart(chart.id)}
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </Button>

                      {!chart.isTemplate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => deleteChart(chart.id)}
                          title="Delete"
                        >
                          <Trash size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {activeTab === "saved" && (
        <div className="p-3 border-t border-border bg-popover/50">
          <Button variant="primary" className="w-full">
            <Plus size={16} className="mr-1" />
            Create New Chart
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChartGallery;
