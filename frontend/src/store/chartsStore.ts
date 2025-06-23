
import { create } from 'zustand';
import { get as getFromIndexDB, set as setToIndexDB, keys, del } from 'idb-keyval';

// Chart types supported by the system
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'column' | 'donut' | 'radar' | 'heatmap';

// Interface for axis configuration
export interface AxisConfig {
  field: string;
  label: string;
  dataKey?: string;
  scale?: 'linear' | 'log' | 'time';
  domain?: [number, number];
}

// Interface for data transformation
export interface DataTransform {
  type: 'none' | 'aggregate' | 'filter' | 'sort';
  field?: string;
  operation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  groupBy?: string;
  direction?: 'asc' | 'desc';
  filterValue?: string;
  filterOperator?: '=' | '>' | '<' | '>=' | '<=' | 'contains' | 'startsWith' | 'endsWith';
}

// Interface for saved chart configuration
export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  description?: string;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  colorBy?: string;
  showLegend: boolean;
  showGrid: boolean;
  stackedData?: boolean;
  palette: string;
  transforms: DataTransform[];
  timestamp: number;
  query?: string;
  isTemplate?: boolean;
}

// Interface for the current chart being edited
export interface CurrentChart extends ChartConfig {
  data: any[];
  isModified: boolean;
  originalData?: any[];
  showXAxisLabel?: boolean;
  showYAxisLabel?: boolean;
  samplingInfo?: {
    mode: "fixed" | "smart" | "custom";
    sampleSize?: number;
    totalRows?: number;
    samplingRatio?: number;
  };
}

// Interface for the charts store state
interface ChartsState {
  // Current chart being edited/viewed
  currentChart: CurrentChart | null;
  
  // Saved chart configurations
  savedCharts: ChartConfig[];
  
  // Available chart templates
  chartTemplates: ChartConfig[];
  
  // Available color palettes
  colorPalettes: Record<string, string[]>;
  
  // UI state
  isSaveModalOpen: boolean;
  isTemplateGalleryOpen: boolean;
  isExportModalOpen: boolean;
  
  // Actions
  setCurrentChart: (chart: CurrentChart | null) => void;
  updateCurrentChart: (updates: Partial<CurrentChart>) => void;
  saveCurrentChart: (asTemplate?: boolean) => void;
  createNewChart: (type: ChartType, data: any[], query?: string, samplingInfo?: { mode: "fixed" | "smart" | "custom"; sampleSize?: number; totalRows?: number; samplingRatio?: number; }) => void;
  deleteChart: (id: string) => void;
  loadChart: (id: string, data?: any[]) => void;
  duplicateChart: (id: string) => void;
  
  // Transform data
  applyDataTransform: (transform: DataTransform) => void;
  resetTransforms: () => void;
  
  // Modal controls
  toggleSaveModal: (isOpen?: boolean) => void;
  toggleTemplateGallery: (isOpen?: boolean) => void;
  toggleExportModal: (isOpen?: boolean) => void;
  
  // Load and save from storage
  loadChartsFromStorage: () => Promise<void>;
  saveChartToStorage: (chart: ChartConfig) => Promise<void>;
  deleteChartFromStorage: (id: string) => Promise<void>;
}

// Default color palettes with enhanced variety and accessibility
const defaultPalettes = {
  primary: ['#00d2c3', '#13a19a', '#138c9a', '#137e9a', '#136e9a'],
  secondary: ['#a54fff', '#9845db', '#803ab6', '#682f92', '#50246d'],
  tertiary: ['#00dfa8', '#00c7a2', '#00ae9b', '#009595', '#007b8e'],
  contrast: ['#00d2c3', '#a54fff', '#00dfa8', '#ff4f80', '#ffe500'],
  grayscale: ['#2a2c39', '#444655', '#5f6171', '#7a7c8d', '#9597a8'],
  // Add more palettes
  sunset: ['#ff7e5f', '#feb47b', '#ffcda5', '#4cbfff', '#4f81c7'],
  forest: ['#2c9c91', '#55a630', '#80b918', '#aacc00', '#bfd200'],
  berry: ['#5b2a86', '#7785ac', '#9ac6c5', '#a5e6ba', '#cfffb0']
};

// Default chart templates
const defaultTemplates: ChartConfig[] = [
  {
    id: 'template-bar-basic',
    title: 'Basic Bar Chart',
    type: 'bar',
    description: 'A simple bar chart showing categorical data',
    xAxis: { field: 'category', label: 'Category' },
    yAxis: { field: 'value', label: 'Value' },
    showLegend: true,
    showGrid: true,
    palette: 'primary',
    transforms: [],
    timestamp: Date.now(),
    isTemplate: true
  },
  {
    id: 'template-line-trend',
    title: 'Time Series Trend',
    type: 'line',
    description: 'Line chart for visualizing trends over time',
    xAxis: { field: 'date', label: 'Date', scale: 'time' },
    yAxis: { field: 'value', label: 'Value' },
    showLegend: true,
    showGrid: true,
    palette: 'secondary',
    transforms: [],
    timestamp: Date.now(),
    isTemplate: true
  },
  {
    id: 'template-pie-distribution',
    title: 'Distribution Pie Chart',
    type: 'pie',
    description: 'Pie chart for showing the distribution of categories',
    xAxis: { field: 'category', label: 'Category' },
    yAxis: { field: 'value', label: 'Value' },
    showLegend: true,
    showGrid: false,
    palette: 'tertiary',
    transforms: [],
    timestamp: Date.now(),
    isTemplate: true
  },
  {
    id: 'template-scatter-correlation',
    title: 'Correlation Scatter Plot',
    type: 'scatter',
    description: 'Scatter plot for examining correlations between variables',
    xAxis: { field: 'x', label: 'X Axis' },
    yAxis: { field: 'y', label: 'Y Axis' },
    colorBy: 'group',
    showLegend: true,
    showGrid: true,
    palette: 'contrast',
    transforms: [],
    timestamp: Date.now(),
    isTemplate: true
  },
  {
    id: 'template-area-cumulative',
    title: 'Cumulative Area Chart',
    type: 'area',
    description: 'Area chart for showing cumulative values over time',
    xAxis: { field: 'date', label: 'Date' },
    yAxis: { field: 'value', label: 'Cumulative Value' },
    showLegend: true,
    showGrid: true,
    stackedData: true,
    palette: 'sunset',
    transforms: [],
    timestamp: Date.now(),
    isTemplate: true
  }
];

/**
 * Zustand store for managing chart state
 */
export const useChartsStore = create<ChartsState>((set, get) => ({
  currentChart: null,
  savedCharts: [],
  chartTemplates: defaultTemplates,
  colorPalettes: defaultPalettes,
  
  isSaveModalOpen: false,
  isTemplateGalleryOpen: false,
  isExportModalOpen: false,

  showXAxisLabel: false,
  showYAxisLabel: false,
  
  setCurrentChart: (chart) => set({ currentChart: chart }),
  
  updateCurrentChart: (updates) => {
    const { currentChart } = get();
    if (!currentChart) return;
    
    set({
      currentChart: {
        ...currentChart,
        ...updates,
        isModified: true
      }
    });
  },
  
  saveCurrentChart: async (asTemplate = false) => {
    const { currentChart, savedCharts } = get();
    if (!currentChart) return;
    
    // Prepare chart config for saving (omit data and isModified)
    const chartToSave: ChartConfig = {
      id: currentChart.id,
      title: currentChart.title,
      type: currentChart.type,
      description: currentChart.description,
      xAxis: currentChart.xAxis,
      yAxis: currentChart.yAxis,
      colorBy: currentChart.colorBy,
      showLegend: currentChart.showLegend,
      showGrid: currentChart.showGrid,
      stackedData: currentChart.stackedData,
      palette: currentChart.palette,
      transforms: currentChart.transforms || [],
      timestamp: Date.now(),
      query: currentChart.query,
      isTemplate: asTemplate
    };
    
    // Update existing or add new
    const existingIndex = savedCharts.findIndex(c => c.id === chartToSave.id);
    let updatedCharts;
    
    if (existingIndex >= 0) {
      updatedCharts = [...savedCharts];
      updatedCharts[existingIndex] = chartToSave;
    } else {
      updatedCharts = [...savedCharts, chartToSave];
    }
    
    // Save to storage
    await get().saveChartToStorage(chartToSave);
    
    set({ 
      savedCharts: updatedCharts,
      currentChart: { ...currentChart, isModified: false },
      isSaveModalOpen: false
    });
  },
  
  createNewChart: (type, data, query, samplingInfo) => {
    const id = `chart-${Date.now()}`;
    
    // Automatically determine reasonable defaults for x and y axes
    const xAxisField = getDefaultXAxisField(data);
    const yAxisField = getDefaultYAxisField(data, xAxisField);
    
    const newChart: CurrentChart = {
      id,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Chart`,
      type,
      xAxis: {
        field: xAxisField,
        label: formatFieldLabel(xAxisField),
        dataKey: xAxisField
      },
      yAxis: {
        field: yAxisField,
        label: formatFieldLabel(yAxisField),
        dataKey: yAxisField
      },
      showLegend: true,
      showXAxisLabel: false,
      showYAxisLabel: false,
      showGrid: true,
      palette: 'primary',
      transforms: [],
      timestamp: Date.now(),
      query,
      data,
      originalData: [...data], // Keep a copy of the original data for resets
      isModified: true,
      samplingInfo
    };
    
    set({ currentChart: newChart });
  },
  
  deleteChart: async (id) => {
    const { savedCharts, currentChart } = get();
    
    // Remove from saved charts
    const updatedCharts = savedCharts.filter(c => c.id !== id);
    set({ savedCharts: updatedCharts });
    
    // If the current chart is being deleted, set to null
    if (currentChart && currentChart.id === id) {
      set({ currentChart: null });
    }
    
    // Remove from storage
    await get().deleteChartFromStorage(id);
  },
  
  loadChart: async (id, data) => {
    const { savedCharts } = get();
    const chartToLoad = savedCharts.find(c => c.id === id);
    
    if (chartToLoad) {
      // If we have data provided, use it, otherwise need to execute query
      if (data) {
        set({
          currentChart: {
            ...chartToLoad,
            data,
            originalData: [...data],
            isModified: false
          }
        });
      } else {
        // In a real implementation, we might re-execute the query here
        // For now, we'll just show an empty chart
        set({
          currentChart: {
            ...chartToLoad,
            data: [],
            originalData: [],
            isModified: false
          }
        });
      }
    }
  },
  
  duplicateChart: (id) => {
    const { savedCharts } = get();
    const chartToDuplicate = savedCharts.find(c => c.id === id);
    
    if (chartToDuplicate) {
      const newId = `chart-${Date.now()}`;
      const duplicatedChart: ChartConfig = {
        ...chartToDuplicate,
        id: newId,
        title: `Copy of ${chartToDuplicate.title}`,
        timestamp: Date.now(),
        isTemplate: false
      };
      
      set({
        savedCharts: [...savedCharts, duplicatedChart]
      });
      
      // Save to storage
      get().saveChartToStorage(duplicatedChart);
    }
  },
  
  applyDataTransform: (transform) => {
    const { currentChart } = get();
    if (!currentChart || !currentChart.originalData) return;
    
    // Add the transform to the list
    const newTransforms = [...(currentChart.transforms || []), transform];
    
    // Apply all transforms in sequence
    let transformedData = [...currentChart.originalData];
    for (const t of newTransforms) {
      transformedData = applyTransform(transformedData, t);
    }
    
    // Update the chart
    set({
      currentChart: {
        ...currentChart,
        transforms: newTransforms,
        data: transformedData,
        isModified: true
      }
    });
  },
  
  resetTransforms: () => {
    const { currentChart } = get();
    if (!currentChart || !currentChart.originalData) return;
    
    set({
      currentChart: {
        ...currentChart,
        transforms: [],
        data: [...currentChart.originalData],
        isModified: true
      }
    });
  },
  
  toggleSaveModal: (isOpen) => {
    if (isOpen !== undefined) {
      set({ isSaveModalOpen: isOpen });
    } else {
      set(state => ({ isSaveModalOpen: !state.isSaveModalOpen }));
    }
  },
  
  toggleTemplateGallery: (isOpen) => {
    if (isOpen !== undefined) {
      set({ isTemplateGalleryOpen: isOpen });
    } else {
      set(state => ({ isTemplateGalleryOpen: !state.isTemplateGalleryOpen }));
    }
  },
  
  toggleExportModal: (isOpen) => {
    if (isOpen !== undefined) {
      set({ isExportModalOpen: isOpen });
    } else {
      set(state => ({ isExportModalOpen: !state.isExportModalOpen }));
    }
  },
  
  loadChartsFromStorage: async () => {
    try {
      // Get all keys from IndexedDB
      const allKeys = await keys();
      const chartKeys = allKeys.filter(k => String(k).startsWith('chart:'));
      
      // Load all charts
      const chartPromises = chartKeys.map(async key => {
        const chart = await getFromIndexDB(key);
        return chart;
      });
      
      const loadedCharts = await Promise.all(chartPromises);
      
      // Split into templates and regular charts
      const templates = loadedCharts.filter(chart => chart.isTemplate);
      const regularCharts = loadedCharts.filter(chart => !chart.isTemplate);
      
      set({
        savedCharts: regularCharts,
        chartTemplates: [...defaultTemplates, ...templates]
      });
    } catch (err) {
      console.error('Error loading charts from storage:', err);
    }
  },
  
  saveChartToStorage: async (chart) => {
    try {
      await setToIndexDB(`chart:${chart.id}`, chart);
    } catch (err) {
      console.error('Error saving chart to storage:', err);
    }
  },
  
  deleteChartFromStorage: async (id) => {
    try {
      await del(`chart:${id}`);
    } catch (err) {
      console.error('Error deleting chart from storage:', err);
    }
  }
}));

/**
 * Apply a data transformation to the dataset
 */
function applyTransform(data: any[], transform: DataTransform): any[] {
  if (!data.length) return data;
  
  switch (transform.type) {
    case 'filter':
      if (!transform.field || transform.filterValue === undefined) return data;
      
      return data.filter(item => {
        const value = item[transform.field!];
        const filterValue = transform.filterValue!;
        
        switch (transform.filterOperator) {
          case '>': return value > filterValue;
          case '<': return value < filterValue;
          case '>=': return value >= filterValue;
          case '<=': return value <= filterValue;
          case 'contains': return String(value).includes(filterValue);
          case 'startsWith': return String(value).startsWith(filterValue);
          case 'endsWith': return String(value).endsWith(filterValue);
          default: return value == filterValue; // Loose equality for type conversion
        }
      });
      
    case 'sort':
      if (!transform.field) return data;
      
      return [...data].sort((a, b) => {
        const valueA = a[transform.field!];
        const valueB = b[transform.field!];
        
        if (valueA < valueB) return transform.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return transform.direction === 'asc' ? 1 : -1;
        return 0;
      });
      
    case 'aggregate':
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
          case 'sum':
            result = items.reduce((sum, item) => sum + Number(item[transform.field!]), 0);
            break;
          case 'avg':
            result = items.reduce((sum, item) => sum + Number(item[transform.field!]), 0) / items.length;
            break;
          case 'min':
            result = Math.min(...items.map(item => Number(item[transform.field!])));
            break;
          case 'max':
            result = Math.max(...items.map(item => Number(item[transform.field!])));
            break;
          case 'count':
            result = items.length;
            break;
        }
        
        // Create a new object with the group and result
        return {
          [transform.groupBy!]: groupKey,
          [transform.field!]: result
        };
      });
      
    default:
      return data;
  }
}

/**
 * Helper to format a field name as a readable label
 */
function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Helper to determine a reasonable default x-axis field
 * Prefers date fields, then categorical fields, then the first field
 */
function getDefaultXAxisField(data: any[]): string {
  if (!data || data.length === 0) return '';
  
  const sample = data[0];
  const fields = Object.keys(sample);
  
  // Look for date-like fields
  const dateField = fields.find(field => 
    field.toLowerCase().includes('date') || 
    field.toLowerCase().includes('time') ||
    field.toLowerCase().includes('day') ||
    field.toLowerCase().includes('month') ||
    field.toLowerCase().includes('year'));
  
  if (dateField) return dateField;
  
  // Look for common category fields
  const categoryField = fields.find(field => 
    field.toLowerCase().includes('category') ||
    field.toLowerCase().includes('type') ||
    field.toLowerCase().includes('group') ||
    field.toLowerCase().includes('name') ||
    field.toLowerCase().includes('id'));
  
  if (categoryField) return categoryField;
  
  // Default to first field
  return fields[0] || '';
}

/**
 * Helper to determine a reasonable default y-axis field
 * Prefers numeric fields that are not the x-axis
 */
function getDefaultYAxisField(data: any[], xAxisField: string): string {
  if (!data || data.length === 0) return '';
  
  const sample = data[0];
  const fields = Object.keys(sample);
  
  // Look for numeric fields
  const numericField = fields.find(field => 
    field !== xAxisField && 
    typeof sample[field] === 'number');
  
  if (numericField) return numericField;
  
  // Look for fields with numeric values
  const potentialNumericField = fields.find(field => 
    field !== xAxisField && 
    !isNaN(Number(sample[field])));
  
  if (potentialNumericField) return potentialNumericField;
  
  // Default to a field that's not the x-axis
  return fields.find(field => field !== xAxisField) || fields[0] || '';
}