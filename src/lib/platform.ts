/**
 * Platform Detection and Abstraction Layer
 *
 * This module provides a unified interface that works across:
 * - Web browsers (using DuckDB-WASM)
 * - Tauri desktop app (using native DuckDB via Rust)
 *
 * The same React components work in both environments!
 */

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Check if running in Tauri desktop environment
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * Check if running in a web browser
 */
export const isWeb = (): boolean => !isTauri();

/**
 * Get the current platform name
 */
export const getPlatform = (): 'tauri' | 'web' => {
  return isTauri() ? 'tauri' : 'web';
};

// ============================================================================
// Unified Data Types
// ============================================================================

export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface ViewDefinition {
  viewName: string;
  fileName: string;
  filePath?: string;
  fileType: string;
  schema: ColumnSchema[];
  totalRows: number;
  createdAt: number;
}

export interface QueryParams {
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  search?: string;
  searchColumns?: string[];
}

export interface PaginatedResult {
  data: Record<string, unknown>[];
  totalRows: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  queryTimeMs: number;
}

export interface ChangeRecord {
  id: string;
  viewName: string;
  rowId: number;
  column: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'update' | 'delete' | 'insert';
  timestamp: number;
  source: 'user' | 'ai';
}

// ============================================================================
// Unified Data Engine Interface
// ============================================================================

export interface DataEngine {
  // Lifecycle
  initialize(): Promise<boolean>;
  isReady(): boolean;

  // Views
  createViewFromFile(file: File | string, viewName?: string): Promise<ViewDefinition>;
  createViewFromData(viewName: string, data: Record<string, unknown>[], columns: string[]): Promise<ViewDefinition>;
  dropView(viewName: string): Promise<boolean>;
  listViews(): Promise<ViewDefinition[]>;
  getSchema(viewName: string): Promise<ColumnSchema[]>;

  // Queries
  queryView(viewName: string, params: QueryParams): Promise<PaginatedResult>;
  executeSQL(sql: string): Promise<Record<string, unknown>[] | null>;

  // Changes
  recordChange(
    viewName: string,
    rowId: number,
    column: string,
    oldValue: unknown,
    newValue: unknown,
    changeType: 'update' | 'delete' | 'insert',
    source: 'user' | 'ai'
  ): Promise<ChangeRecord>;
  getPendingChanges(viewName: string): Promise<ChangeRecord[]>;
  undoLastChange(viewName: string): Promise<ChangeRecord | null>;
  discardChanges(viewName: string): Promise<void>;
  commitChanges(viewName: string): Promise<boolean>;

  // Export
  exportView(viewName: string, format: 'csv' | 'parquet' | 'json'): Promise<Blob | string>;
}

// ============================================================================
// Platform-Specific Implementations
// ============================================================================

/**
 * Web implementation using DuckDB-WASM
 */
async function createWebEngine(): Promise<DataEngine> {
  // Dynamic import to avoid loading WASM in Tauri
  const { useDuckDBViewStore } = await import('@/store/duckDBViewStore');

  const store = useDuckDBViewStore.getState();
  let ready = false;

  return {
    async initialize() {
      const success = await store.initialize();
      ready = success;
      return success;
    },

    isReady() {
      return ready && store.isInitialized;
    },

    async createViewFromFile(file: File | string, viewName?: string) {
      if (typeof file === 'string') {
        throw new Error('Web engine requires File object, not path');
      }
      const result = await store.createViewFromFile(file, viewName);
      if (!result) throw new Error('Failed to create view');
      return {
        viewName: result.viewName,
        fileName: result.fileName,
        fileType: result.fileType,
        schema: result.schema,
        totalRows: result.totalRows,
        createdAt: result.createdAt,
      };
    },

    async createViewFromData(viewName: string, data: Record<string, unknown>[], columns: string[]) {
      const result = await store.createViewFromData(viewName, data, columns);
      if (!result) throw new Error('Failed to create view');
      return {
        viewName: result.viewName,
        fileName: result.fileName,
        fileType: result.fileType,
        schema: result.schema,
        totalRows: result.totalRows,
        createdAt: result.createdAt,
      };
    },

    async dropView(viewName: string) {
      return store.dropView(viewName);
    },

    async listViews() {
      const views = store.views;
      return Array.from(views.values()).map(v => ({
        viewName: v.viewName,
        fileName: v.fileName,
        fileType: v.fileType,
        schema: v.schema,
        totalRows: v.totalRows,
        createdAt: v.createdAt,
      }));
    },

    async getSchema(viewName: string) {
      const schema = await store.getViewSchema(viewName);
      return schema || [];
    },

    async queryView(viewName: string, params: QueryParams) {
      const result = await store.queryView(viewName, {
        page: params.page,
        pageSize: params.pageSize,
        sortColumn: params.sortColumn,
        sortDirection: params.sortDirection,
        search: params.search,
        searchColumns: params.searchColumns,
      });
      if (!result) throw new Error('Query failed');
      return {
        data: result.data,
        totalRows: result.totalRows,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        pageSize: result.pageSize,
        queryTimeMs: result.queryTime,
      };
    },

    async executeSQL(sql: string) {
      return store.executeSQL(sql);
    },

    async recordChange(viewName, rowId, column, oldValue, newValue, changeType, source) {
      store.recordChange({ viewName, rowId, column, oldValue, newValue, changeType, source });
      const changes = store.getPendingChanges(viewName);
      return changes[changes.length - 1];
    },

    async getPendingChanges(viewName: string) {
      return store.getPendingChanges(viewName);
    },

    async undoLastChange(viewName: string) {
      return store.undoLastChange(viewName);
    },

    async discardChanges(viewName: string) {
      store.discardChanges(viewName);
    },

    async commitChanges(viewName: string) {
      return store.commitChanges(viewName);
    },

    async exportView(viewName: string, format: 'csv' | 'parquet' | 'json') {
      // For web, we return a Blob that can be downloaded
      const data = await store.executeSQL(`SELECT * FROM "${viewName}"`);
      if (!data) throw new Error('Export failed');

      if (format === 'json') {
        return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      } else if (format === 'csv') {
        const columns = Object.keys(data[0] || {});
        const csv = [
          columns.join(','),
          ...data.map(row => columns.map(c => JSON.stringify(row[c] ?? '')).join(','))
        ].join('\n');
        return new Blob([csv], { type: 'text/csv' });
      }
      throw new Error('Parquet export not supported in web');
    },
  };
}

/**
 * Tauri implementation using native DuckDB
 */
async function createTauriEngine(): Promise<DataEngine> {
  const { getNativeDuckDB } = await import('./duckdb/native');
  const db = getNativeDuckDB();
  let ready = false;

  return {
    async initialize() {
      const success = await db.initialize();
      ready = success;
      return success;
    },

    isReady() {
      return ready;
    },

    async createViewFromFile(file: File | string, viewName?: string) {
      // Tauri can work with file paths directly!
      if (typeof file === 'string') {
        const result = await db.createViewFromFile(file, viewName);
        return {
          viewName: result.view_name,
          fileName: result.file_name,
          filePath: result.file_path || undefined,
          fileType: result.file_type,
          schema: result.schema,
          totalRows: result.total_rows,
          createdAt: result.created_at,
        };
      }

      // For File objects, we need to get the path (only works if dropped from Finder)
      // @ts-ignore - Tauri adds path property to dropped files
      const filePath = file.path;
      if (!filePath) {
        throw new Error('Cannot get file path. Drag file from Finder or use file picker.');
      }

      const result = await db.createViewFromFile(filePath, viewName);
      return {
        viewName: result.view_name,
        fileName: result.file_name,
        filePath: result.file_path || undefined,
        fileType: result.file_type,
        schema: result.schema,
        totalRows: result.total_rows,
        createdAt: result.created_at,
      };
    },

    async createViewFromData(viewName: string, data: Record<string, unknown>[], columns: string[]) {
      // For in-memory data, use SQL INSERT
      // First create the table structure
      const typedColumns = columns.map(col => {
        const val = data[0]?.[col];
        const type = typeof val === 'number'
          ? (Number.isInteger(val) ? 'BIGINT' : 'DOUBLE')
          : typeof val === 'boolean'
            ? 'BOOLEAN'
            : 'VARCHAR';
        return `"${col}" ${type}`;
      });

      await db.executeSQL(`CREATE TABLE "${viewName}" (_rowid BIGINT, ${typedColumns.join(', ')})`);

      // Insert data in batches
      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const values = batch.map((row, idx) => {
          const rowValues = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            return String(val);
          });
          return `(${i + idx + 1}, ${rowValues.join(', ')})`;
        }).join(', ');

        await db.executeSQL(`INSERT INTO "${viewName}" VALUES ${values}`);
      }

      const schema = await db.getSchema(viewName);

      return {
        viewName,
        fileName: `${viewName}.data`,
        fileType: 'memory',
        schema,
        totalRows: data.length,
        createdAt: Date.now(),
      };
    },

    async dropView(viewName: string) {
      return db.dropView(viewName);
    },

    async listViews() {
      const views = await db.listViews();
      return views.map(v => ({
        viewName: v.view_name,
        fileName: v.file_name,
        filePath: v.file_path || undefined,
        fileType: v.file_type,
        schema: v.schema,
        totalRows: v.total_rows,
        createdAt: v.created_at,
      }));
    },

    async getSchema(viewName: string) {
      return db.getSchema(viewName);
    },

    async queryView(viewName: string, params: QueryParams) {
      const result = await db.queryView(viewName, {
        page: params.page,
        page_size: params.pageSize,
        sort_column: params.sortColumn,
        sort_direction: params.sortDirection,
        search: params.search,
        search_columns: params.searchColumns,
      });
      return {
        data: result.data,
        totalRows: result.total_rows,
        totalPages: result.total_pages,
        currentPage: result.current_page,
        pageSize: result.page_size,
        queryTimeMs: result.query_time_ms,
      };
    },

    async executeSQL(sql: string) {
      return db.executeSQL(sql);
    },

    async recordChange(viewName, rowId, column, oldValue, newValue, changeType, source) {
      return db.recordChange(viewName, rowId, column, oldValue, newValue, changeType, source);
    },

    async getPendingChanges(viewName: string) {
      return db.getPendingChanges(viewName);
    },

    async undoLastChange(viewName: string) {
      return db.undoLastChange(viewName);
    },

    async discardChanges(viewName: string) {
      await db.discardChanges(viewName);
    },

    async commitChanges(viewName: string) {
      return db.commitChanges(viewName);
    },

    async exportView(viewName: string, format: 'csv' | 'parquet' | 'json') {
      // In Tauri, we use native file dialogs
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        filters: [{
          name: format.toUpperCase(),
          extensions: [format],
        }],
      });

      if (filePath) {
        await db.exportView(viewName, filePath, format);
        return filePath;
      }

      throw new Error('Export cancelled');
    },
  };
}

// ============================================================================
// Engine Factory
// ============================================================================

let engineInstance: DataEngine | null = null;

/**
 * Get the appropriate data engine for the current platform
 */
export async function getDataEngine(): Promise<DataEngine> {
  if (engineInstance) return engineInstance;

  if (isTauri()) {
    console.log('[Platform] Creating Tauri native engine');
    engineInstance = await createTauriEngine();
  } else {
    console.log('[Platform] Creating Web WASM engine');
    engineInstance = await createWebEngine();
  }

  return engineInstance;
}

/**
 * Reset the engine (useful for testing)
 */
export function resetEngine(): void {
  engineInstance = null;
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect } from 'react';

export function useDataEngine() {
  const [engine, setEngine] = useState<DataEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const eng = await getDataEngine();
        await eng.initialize();
        if (mounted) {
          setEngine(eng);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize data engine');
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return { engine, isLoading, error, platform: getPlatform() };
}

export default {
  isTauri,
  isWeb,
  getPlatform,
  getDataEngine,
  useDataEngine,
};
