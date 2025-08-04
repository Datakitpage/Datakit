import type { PyodideInterface } from "pyodide";

export type CellType = 'code' | 'markdown' | 'prompt';

export interface PythonCell {
  id: string;
  type: CellType;
  code: string; // For code cells, this is Python code; for markdown cells, this is markdown content; for prompt cells, this is the user's natural language prompt
  output: CellOutput[];
  executionCount: number | null;
  isExecuting: boolean;
  isEditing?: boolean; // For markdown cells, tracks if currently editing
  isInputCollapsed?: boolean; // Whether the cell input is collapsed
  isOutputCollapsed?: boolean; // Whether the cell output is collapsed
  // Prompt-specific properties
  isProcessing?: boolean; // For prompt cells, tracks if AI is processing
  generatedCode?: string; // For prompt cells, stores the AI-generated code
  aiResponse?: string; // For prompt cells, stores the full AI response
  createdAt: Date;
  updatedAt: Date;
}

export interface CellOutput {
  id: string;
  type: 'text' | 'html' | 'image' | 'error' | 'dataframe' | 'plot';
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface PythonScript {
  id: string;
  name: string;
  cells: PythonCell[];
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  tags?: string[];
}

export interface PythonPackage {
  name: string;
  version: string;
  isInstalled: boolean;
  isInstalling: boolean;
  description?: string;
}

export interface PythonExecutionResult {
  output: CellOutput[];
  error?: string;
  executionTime: number;
  variables?: Record<string, any>;
}

export interface DataFrameInfo {
  shape: [number, number];
  columns: string[];
  dtypes: Record<string, string>;
  memory_usage?: number;
  preview: any[][];
}

export interface PyodideState {
  pyodide: PyodideInterface | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;
  installedPackages: Map<string, string>;
  standardPackages: string[];
}

export interface DuckDBBridge {
  queryToPandas: (sql: string) => Promise<any>;
  pandasToTable: (df: any, tableName: string) => Promise<void>;
  getTableNames: () => string[];
  getTableSchema: (tableName: string) => Promise<any>;
}

// Template categories
export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'data_analysis' | 'visualization' | 'ml' | 'hf' | 'stats' | 'utils';
  code: string;
  tags: string[];
  requiredPackages?: string[];
}

// Chart configuration for Python plots
export interface PythonChartConfig {
  type: 'matplotlib' | 'plotly' | 'seaborn';
  width?: number;
  height?: number;
  dpi?: number;
  format?: 'png' | 'svg' | 'html';
}