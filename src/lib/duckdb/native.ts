/**
 * Native DuckDB interface for Tauri desktop app
 *
 * This module provides the same interface as the WASM version but calls
 * into the Rust backend via Tauri IPC for 10x better performance.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types (matching Rust backend)
// ============================================================================

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ViewDefinition {
  view_name: string;
  file_name: string;
  file_path: string | null;
  file_type: string;
  schema: ColumnSchema[];
  total_rows: number;
  created_at: number;
}

export interface QueryParams {
  page: number;
  page_size: number;
  sort_column?: string;
  sort_direction?: string;
  search?: string;
  search_columns?: string[];
}

export interface PaginatedResult {
  data: Record<string, unknown>[];
  total_rows: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  query_time_ms: number;
}

export interface ChangeRecord {
  id: string;
  view_name: string;
  row_id: number;
  column: string;
  old_value: unknown;
  new_value: unknown;
  change_type: 'update' | 'delete' | 'insert';
  timestamp: number;
  source: 'user' | 'ai';
}

// ============================================================================
// Native DuckDB Client
// ============================================================================

export class NativeDuckDB {
  private initialized = false;

  /**
   * Initialize the native DuckDB connection
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      await invoke<boolean>('init_database');
      this.initialized = true;
      console.log('[NativeDuckDB] Initialized native DuckDB backend');
      return true;
    } catch (error) {
      console.error('[NativeDuckDB] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Create a view from a file path (native file system access!)
   */
  async createViewFromFile(filePath: string, viewName?: string): Promise<ViewDefinition> {
    return invoke<ViewDefinition>('create_view_from_file', {
      filePath,
      viewName,
    });
  }

  /**
   * Query a view with pagination, sorting, and search
   */
  async queryView(viewName: string, params: QueryParams): Promise<PaginatedResult> {
    return invoke<PaginatedResult>('query_view', {
      viewName,
      params: {
        page: params.page,
        page_size: params.page_size,
        sort_column: params.sort_column,
        sort_direction: params.sort_direction,
        search: params.search,
        search_columns: params.search_columns,
      },
    });
  }

  /**
   * Execute raw SQL query
   */
  async executeSQL(sql: string): Promise<Record<string, unknown>[]> {
    return invoke<Record<string, unknown>[]>('execute_sql', { sql });
  }

  /**
   * Record a cell edit
   */
  async recordChange(
    viewName: string,
    rowId: number,
    column: string,
    oldValue: unknown,
    newValue: unknown,
    changeType: 'update' | 'delete' | 'insert',
    source: 'user' | 'ai'
  ): Promise<ChangeRecord> {
    return invoke<ChangeRecord>('record_change', {
      viewName,
      rowId,
      column,
      oldValue,
      newValue,
      changeType,
      source,
    });
  }

  /**
   * Get pending changes for a view
   */
  async getPendingChanges(viewName: string): Promise<ChangeRecord[]> {
    return invoke<ChangeRecord[]>('get_pending_changes', { viewName });
  }

  /**
   * Undo the last change
   */
  async undoLastChange(viewName: string): Promise<ChangeRecord | null> {
    return invoke<ChangeRecord | null>('undo_last_change', { viewName });
  }

  /**
   * Discard all changes for a view
   */
  async discardChanges(viewName: string): Promise<boolean> {
    return invoke<boolean>('discard_changes', { viewName });
  }

  /**
   * Commit changes to the view
   */
  async commitChanges(viewName: string): Promise<boolean> {
    return invoke<boolean>('commit_changes', { viewName });
  }

  /**
   * Export view to file
   */
  async exportView(
    viewName: string,
    outputPath: string,
    format: 'csv' | 'parquet' | 'json'
  ): Promise<boolean> {
    return invoke<boolean>('export_view', {
      viewName,
      outputPath,
      format,
    });
  }

  /**
   * Get schema for a view
   */
  async getSchema(viewName: string): Promise<ColumnSchema[]> {
    return invoke<ColumnSchema[]>('get_schema', { viewName });
  }

  /**
   * Drop a view
   */
  async dropView(viewName: string): Promise<boolean> {
    return invoke<boolean>('drop_view', { viewName });
  }

  /**
   * List all views
   */
  async listViews(): Promise<ViewDefinition[]> {
    return invoke<ViewDefinition[]>('list_views');
  }
}

// Singleton instance
let nativeDuckDB: NativeDuckDB | null = null;

export function getNativeDuckDB(): NativeDuckDB {
  if (!nativeDuckDB) {
    nativeDuckDB = new NativeDuckDB();
  }
  return nativeDuckDB;
}

export default NativeDuckDB;
