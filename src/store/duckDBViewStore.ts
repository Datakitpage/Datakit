import { create } from 'zustand';
import * as duckdb from '@duckdb/duckdb-wasm';
import { initializeDuckDB, cleanup } from '@/lib/duckdb/init';

// Replacer function for JSON.stringify to handle BigInt (DuckDB returns BIGINT as JS BigInt)
const bigIntReplacer = (_: string, v: unknown): unknown =>
  typeof v === 'bigint' ? Number(v) : v;

// Helper to serialize values that may contain BigInt
const serializeValue = (value: unknown): string => {
  return JSON.stringify(value, bigIntReplacer);
};

// Helper to format a value for SQL based on column type
const formatValueForSQL = (value: unknown, colType: string): string => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  const upperType = colType.toUpperCase();

  // Check if it's a numeric type
  const isNumericType = /^(TINYINT|SMALLINT|INT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINT|UINTEGER|UBIGINT|FLOAT|REAL|DOUBLE|DECIMAL|NUMERIC|INT8|INT16|INT32|INT64|INT128|UINT8|UINT16|UINT32|UINT64|UINT128|FLOAT4|FLOAT8)/.test(upperType);

  // Check if it's a boolean type
  const isBooleanType = /^(BOOLEAN|BOOL)/.test(upperType);

  if (isNumericType) {
    // For numeric types, return the value without quotes
    const numStr = String(value).trim();
    // Handle empty string as NULL
    if (numStr === '') return 'NULL';
    return numStr;
  }

  if (isBooleanType) {
    // For boolean, convert to true/false
    const boolStr = String(value).toLowerCase().trim();
    if (boolStr === 'true' || boolStr === '1' || boolStr === 'yes') return 'TRUE';
    if (boolStr === 'false' || boolStr === '0' || boolStr === 'no') return 'FALSE';
    return 'NULL';
  }

  // For all other types (VARCHAR, DATE, TIME, TIMESTAMP, etc.), use string format
  const strVal = String(value).replace(/'/g, "''");
  return `'${strVal}'`;
};

// Types
export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface ViewDefinition {
  viewName: string;
  fileName: string;
  fileType: 'csv' | 'json' | 'parquet' | 'xlsx' | 'txt';
  schema: ColumnSchema[];
  totalRows: number;
  createdAt: number;
  registeredFileName?: string;
  /** User-specified column type overrides (column name -> DuckDB type) */
  typeOverrides?: Record<string, string>;
}

export interface ChangeRecord {
  id: string;
  viewName: string;
  rowId: number;
  column: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'update' | 'insert' | 'delete' | 'add_column';
  timestamp: number;
  source: 'user' | 'ai';
  // For schema changes
  columnType?: string;
  // For formula-based changes
  formula?: string;
  isFormulaResult?: boolean;
}

export interface FilterCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
  value: unknown;
}

export interface QueryParams {
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  filters?: FilterCondition[];
  search?: string;
  searchColumns?: string[];
}

export interface PaginatedResult {
  data: Record<string, unknown>[];
  totalRows: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  queryTime: number;
}

export interface SQLValidationResult {
  valid: boolean;
  error?: string;
  errorType?: 'syntax' | 'schema' | 'permission' | 'unknown';
  suggestion?: string;
  sql: string;
}

// Committed version - represents a checkpoint in data history
export interface CommittedVersion {
  id: string;
  timestamp: number;
  changes: ChangeRecord[];
  description: string;
}

interface DuckDBViewState {
  // Connection state
  db: duckdb.AsyncDuckDB | null;
  connection: duckdb.AsyncDuckDBConnection | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;

  // View registry
  views: Map<string, ViewDefinition>;
  activeViewName: string | null;

  // Change tracking
  pendingChanges: Map<string, ChangeRecord[]>;
  changeHistory: ChangeRecord[];

  // Version history for committed changes
  committedVersions: Map<string, CommittedVersion[]>;
  currentVersionIndex: Map<string, number>;

  // Data freshness counter — incremented when underlying data is replaced (e.g. pull from remote)
  dataVersion: Map<string, number>;

  // Loading states
  isLoading: boolean;
  loadingMessage: string;

  // Actions - Core
  initialize: () => Promise<boolean>;
  cleanup: () => Promise<void>;
  resetError: () => void;

  // Actions - Views
  createViewFromFile: (file: File, viewName?: string, typeOverrides?: Record<string, string>) => Promise<ViewDefinition | null>;
  createViewFromData: (viewName: string, data: Record<string, unknown>[], columns: string[]) => Promise<ViewDefinition | null>;
  dropView: (viewName: string) => Promise<boolean>;
  getViewSchema: (viewName: string) => Promise<ColumnSchema[] | null>;
  refreshViewSchema: (viewName: string) => Promise<boolean>;
  setActiveView: (viewName: string | null) => void;
  /** Change a column's type by re-importing from source with type override */
  changeColumnType: (viewName: string, columnName: string, newType: string, file: File) => Promise<boolean>;

  // Actions - Queries
  queryView: (viewName: string, params: QueryParams) => Promise<PaginatedResult | null>;
  executeSQL: (sql: string) => Promise<Record<string, unknown>[] | null>;
  validateSQL: (sql: string) => Promise<SQLValidationResult>;

  // Actions - Changes
  recordChange: (change: Omit<ChangeRecord, 'id' | 'timestamp'>) => void;
  undoLastChange: (viewName: string) => ChangeRecord | null;
  discardChanges: (viewName: string) => void;
  commitChanges: (viewName: string) => Promise<boolean>;
  getPendingChanges: (viewName: string) => ChangeRecord[];
  // Schema changes - auto-committed as versions
  addColumnWithVersion: (viewName: string, columnName: string, columnType: string) => Promise<boolean>;

  // Actions - Version navigation
  undoVersion: (viewName: string) => Promise<boolean>;
  redoVersion: (viewName: string) => Promise<boolean>;
  canUndoVersion: (viewName: string) => boolean;
  canRedoVersion: (viewName: string) => boolean;
  getVersionInfo: (viewName: string) => { current: number; total: number; description: string | null };
  clearCommittedVersions: (viewName: string) => void;

  // Utilities
  buildPaginatedSQL: (viewName: string, params: QueryParams) => string;
  sanitizeTableName: (fileName: string) => string;

  // Export
  exportView: (viewName: string, format: 'csv' | 'json' | 'parquet' | 'xlsx', fileName?: string) => Promise<Blob | null>;
}

export const useDuckDBViewStore = create<DuckDBViewState>((set, get) => ({
  // Initial state
  db: null,
  connection: null,
  isInitializing: false,
  isInitialized: false,
  error: null,
  views: new Map(),
  activeViewName: null,
  pendingChanges: new Map(),
  changeHistory: [],
  committedVersions: new Map(),
  currentVersionIndex: new Map(),
  dataVersion: new Map(),
  isLoading: false,
  loadingMessage: '',

  // Initialize DuckDB
  initialize: async () => {
    const state = get();
    console.log('[DuckDBView] initialize() called:', {
      isInitialized: state.isInitialized,
      isInitializing: state.isInitializing,
      hasConnection: !!state.connection
    });

    if (state.isInitialized) {
      console.log('[DuckDBView] Already initialized, returning true');
      return true;
    }

    // If already initializing, wait for it to complete instead of returning false
    if (state.isInitializing) {
      console.log('[DuckDBView] Already initializing, waiting...');
      // Poll until initialization completes (max 30 seconds)
      const maxWait = 30000;
      const pollInterval = 100;
      let waited = 0;
      while (waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        waited += pollInterval;
        const currentState = get();
        console.log('[DuckDBView] Polling:', { waited, isInitialized: currentState.isInitialized, isInitializing: currentState.isInitializing });
        if (currentState.isInitialized) {
          console.log('[DuckDBView] Initialization completed while waiting');
          return true;
        }
        if (!currentState.isInitializing) {
          // Initialization failed or was cancelled
          console.log('[DuckDBView] Initialization stopped without completing');
          return currentState.isInitialized;
        }
      }
      console.error('[DuckDBView] Timeout waiting for initialization');
      return false;
    }

    console.log('[DuckDBView] Starting new initialization...');
    set({ isInitializing: true, error: null, loadingMessage: 'Initializing DuckDB...' });

    try {
      const { db, conn } = await initializeDuckDB();

      set({
        db,
        connection: conn,
        isInitialized: true,
        isInitializing: false,
        isLoading: false,
        loadingMessage: '',
      });

      console.log('[DuckDBView] Initialized successfully');
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize DuckDB';
      console.error('[DuckDBView] Initialization failed:', err);
      set({
        error: errorMsg,
        isInitializing: false,
        isLoading: false,
        loadingMessage: '',
      });
      return false;
    }
  },

  // Cleanup
  cleanup: async () => {
    const { connection, db } = get();

    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.warn('[DuckDBView] Error closing connection:', e);
      }
    }

    if (db) {
      try {
        await db.terminate();
      } catch (e) {
        console.warn('[DuckDBView] Error terminating db:', e);
      }
    }

    cleanup();

    set({
      db: null,
      connection: null,
      isInitialized: false,
      views: new Map(),
      activeViewName: null,
      pendingChanges: new Map(),
      changeHistory: [],
      committedVersions: new Map(),
      currentVersionIndex: new Map(),
    });
  },

  resetError: () => set({ error: null }),

  // Sanitize table name
  sanitizeTableName: (fileName: string) => {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .toLowerCase()
      .slice(0, 64);
  },

  // Create VIEW from file (lazy loading, not loading into memory)
  createViewFromFile: async (file: File, customViewName?: string, typeOverrides?: Record<string, string>) => {
    let conn = get().connection;
    let db = get().db;

    if (!conn || !db) {
      const success = await get().initialize();
      if (!success) return null;
      conn = get().connection;
      db = get().db;
      if (!conn || !db) return null;
    }

    const viewName = customViewName || get().sanitizeTableName(file.name);
    const fileExt = file.name.split('.').pop()?.toLowerCase() as ViewDefinition['fileType'];

    set({ isLoading: true, loadingMessage: `Creating view for ${file.name}...`, error: null });

    try {
      // Register file with DuckDB
      const registeredFileName = `view_${Date.now()}_${file.name}`;

      // For text-based files, register as text
      if (['csv', 'json', 'txt'].includes(fileExt)) {
        const content = await file.text();
        await db.registerFileText(registeredFileName, content);
      } else if (fileExt === 'xlsx') {
        // xlsx files need conversion to CSV since DuckDB WASM can't read xlsx
        const { parseXlsxFile } = await import('@/lib/xlsx');
        const xlsxResult = await parseXlsxFile(file);
        await db.registerFileText(registeredFileName, xlsxResult.csvContent);
      } else {
        // For binary files like parquet
        const buffer = await file.arrayBuffer();
        await db.registerFileBuffer(registeredFileName, new Uint8Array(buffer));
      }

      // Drop existing view/table if exists (separate try-catch to ensure both run)
      try {
        await conn.query(`DROP TABLE IF EXISTS "${viewName}"`);
      } catch {
        // Ignore - table might not exist
      }
      try {
        await conn.query(`DROP VIEW IF EXISTS "${viewName}"`);
      } catch {
        // Ignore - view might not exist
      }

      // Build type hints for read_csv if we have overrides
      // Format: types={'column_name': 'VARCHAR', ...}
      let typeHintsSQL = '';
      if (typeOverrides && Object.keys(typeOverrides).length > 0 && fileExt === 'csv') {
        const typeEntries = Object.entries(typeOverrides)
          .map(([col, type]) => `'${col}': '${type}'`)
          .join(', ');
        typeHintsSQL = `, types={${typeEntries}}`;
      }

      // Create TABLE (not VIEW) based on file type - must be table for UPDATE support
      // Let DuckDB auto-detect types for proper numeric/date handling
      let createTableSQL: string;
      switch (fileExt) {
        case 'csv':
          // Use read_csv with optional type hints instead of read_csv_auto when we have overrides
          if (typeHintsSQL) {
            createTableSQL = `CREATE TABLE "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_csv('${registeredFileName}', auto_detect=true${typeHintsSQL})`;
          } else {
            createTableSQL = `CREATE TABLE "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_csv_auto('${registeredFileName}')`;
          }
          break;
        case 'json':
          createTableSQL = `CREATE TABLE "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_json_auto('${registeredFileName}')`;
          break;
        case 'parquet':
          createTableSQL = `CREATE TABLE "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_parquet('${registeredFileName}')`;
          break;
        case 'xlsx':
          // xlsx has been pre-converted to CSV during registration
          createTableSQL = `CREATE TABLE "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_csv_auto('${registeredFileName}')`;
          break;
        default:
          // For txt files, create a single column table
          createTableSQL = `CREATE TABLE "${viewName}" AS SELECT row_number() OVER () as _rowid, column0 as content FROM read_csv_auto('${registeredFileName}', header=false, all_varchar=true)`;
      }

      console.log('[DuckDBView] Creating table:', createTableSQL);
      await conn.query(createTableSQL);

      // Create delta table for tracking changes
      const deltaTableName = `${viewName}_delta`;
      await conn.query(`DROP TABLE IF EXISTS "${deltaTableName}"`);
      await conn.query(`
        CREATE TABLE "${deltaTableName}" (
          id VARCHAR PRIMARY KEY,
          row_id BIGINT,
          column_name VARCHAR,
          old_value VARCHAR,
          new_value VARCHAR,
          change_type VARCHAR,
          timestamp BIGINT,
          source VARCHAR
        )
      `);

      // Get schema
      const schemaResult = await conn.query(`DESCRIBE "${viewName}"`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DuckDB result row type
      const schema: ColumnSchema[] = schemaResult.toArray().map((row: any) => ({
        name: row.column_name,
        type: row.column_type,
        nullable: row.null === 'YES',
      }));

      // Get row count (may be slow for very large files, consider sampling)
      let totalRows = 0;
      try {
        const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM "${viewName}"`);
        totalRows = Number(countResult.toArray()[0]?.cnt || 0);
      } catch (e) {
        console.warn('[DuckDBView] Could not get row count:', e);
      }

      const viewDef: ViewDefinition = {
        viewName,
        fileName: file.name,
        fileType: fileExt,
        schema,
        totalRows,
        createdAt: Date.now(),
        registeredFileName,
        typeOverrides,
      };

      // Update state
      set(state => {
        const newViews = new Map(state.views);
        newViews.set(viewName, viewDef);
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(viewName, (newDataVersion.get(viewName) || 0) + 1);
        return {
          views: newViews,
          activeViewName: viewName,
          isLoading: false,
          loadingMessage: '',
          dataVersion: newDataVersion,
        };
      });

      console.log('[DuckDBView] View created:', viewDef);
      return viewDef;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create view';
      console.error('[DuckDBView] Failed to create view:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return null;
    }
  },

  // Create VIEW from in-memory data
  createViewFromData: async (viewName: string, data: Record<string, unknown>[], columns: string[]) => {
    console.log('[DuckDBView] createViewFromData called:', { viewName, dataLength: data.length, columns: columns.length });

    // Wait for connection to be available (handles race with preload)
    const maxWait = 30000;
    const pollInterval = 100;
    let waited = 0;
    let conn = get().connection;

    while (!conn && waited < maxWait) {
      const state = get();
      console.log('[DuckDBView] Waiting for connection:', {
        waited,
        hasConnection: !!state.connection,
        isInitializing: state.isInitializing,
        isInitialized: state.isInitialized
      });

      // If not initializing and not initialized, start initialization
      if (!state.isInitializing && !state.isInitialized) {
        console.log('[DuckDBView] Starting initialization from createViewFromData...');
        const success = await get().initialize();
        if (!success) {
          console.log('[DuckDBView] initialize() failed');
          return null;
        }
      }

      conn = get().connection;
      if (conn) break;

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waited += pollInterval;
    }

    if (!conn) {
      console.error('[DuckDBView] Timeout waiting for connection');
      return null;
    }

    console.log('[DuckDBView] Connection available, proceeding...');

    if (data.length === 0) {
      set({ error: 'No data provided' });
      return null;
    }

    set({ isLoading: true, loadingMessage: 'Creating view from data...', error: null });

    try {
      const db = get().db;
      if (!db) {
        console.error('[DuckDBView] No database instance');
        return null;
      }

      // Drop existing
      await conn.query(`DROP TABLE IF EXISTS "${viewName}"`);

      // FAST PATH: Use JSON registration + read_json_auto (orders of magnitude faster than INSERT)
      const startTime = performance.now();
      const jsonFileName = `${viewName}_data.json`;

      // Register JSON data directly with DuckDB
      console.log('[DuckDBView] Serializing data to JSON...');
      const jsonData = JSON.stringify(data, bigIntReplacer);
      console.log('[DuckDBView] JSON size:', (jsonData.length / 1024 / 1024).toFixed(2), 'MB');

      await db.registerFileText(jsonFileName, jsonData);

      // Create table from JSON with row numbers
      console.log('[DuckDBView] Creating table from JSON...');
      const createSQL = `CREATE TABLE "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_json_auto('${jsonFileName}')`;
      await conn.query(createSQL);

      const loadTime = performance.now() - startTime;
      console.log('[DuckDBView] Data loaded in', loadTime.toFixed(0), 'ms');

      // Create delta table
      const deltaTableName = `${viewName}_delta`;
      await conn.query(`DROP TABLE IF EXISTS "${deltaTableName}"`);
      await conn.query(`
        CREATE TABLE "${deltaTableName}" (
          id VARCHAR PRIMARY KEY,
          row_id BIGINT,
          column_name VARCHAR,
          old_value VARCHAR,
          new_value VARCHAR,
          change_type VARCHAR,
          timestamp BIGINT,
          source VARCHAR
        )
      `);

      // Get schema
      const schemaResult = await conn.query(`DESCRIBE "${viewName}"`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DuckDB result row type
      const schema: ColumnSchema[] = schemaResult.toArray().map((row: any) => ({
        name: row.column_name,
        type: row.column_type,
      }));

      const viewDef: ViewDefinition = {
        viewName,
        fileName: `${viewName}.data`,
        fileType: 'csv',
        schema,
        totalRows: data.length,
        createdAt: Date.now(),
      };

      set(state => {
        const newViews = new Map(state.views);
        newViews.set(viewName, viewDef);
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(viewName, (newDataVersion.get(viewName) || 0) + 1);
        return {
          views: newViews,
          activeViewName: viewName,
          isLoading: false,
          loadingMessage: '',
          dataVersion: newDataVersion,
        };
      });

      return viewDef;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create view';
      console.error('[DuckDBView] Failed to create view from data:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return null;
    }
  },

  // Drop a view
  dropView: async (viewName: string) => {
    const conn = get().connection;
    if (!conn) return false;

    try {
      await conn.query(`DROP VIEW IF EXISTS "${viewName}"`);
      await conn.query(`DROP TABLE IF EXISTS "${viewName}"`);
      await conn.query(`DROP TABLE IF EXISTS "${viewName}_delta"`);

      set(state => {
        const newViews = new Map(state.views);
        newViews.delete(viewName);
        const newPendingChanges = new Map(state.pendingChanges);
        newPendingChanges.delete(viewName);
        const newCommittedVersions = new Map(state.committedVersions);
        newCommittedVersions.delete(viewName);
        const newVersionIndex = new Map(state.currentVersionIndex);
        newVersionIndex.delete(viewName);
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.delete(viewName);
        return {
          views: newViews,
          pendingChanges: newPendingChanges,
          committedVersions: newCommittedVersions,
          currentVersionIndex: newVersionIndex,
          dataVersion: newDataVersion,
          activeViewName: state.activeViewName === viewName ? null : state.activeViewName,
        };
      });

      return true;
    } catch (err) {
      console.error('[DuckDBView] Failed to drop view:', err);
      return false;
    }
  },

  // Get view schema
  getViewSchema: async (viewName: string) => {
    const conn = get().connection;
    if (!conn) return null;

    try {
      const result = await conn.query(`DESCRIBE "${viewName}"`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DuckDB result row type
      return result.toArray().map((row: any) => ({
        name: row.column_name,
        type: row.column_type,
      }));
    } catch (err) {
      console.error('[DuckDBView] Failed to get schema:', err);
      return null;
    }
  },

  // Refresh view schema (useful after ALTER TABLE)
  refreshViewSchema: async (viewName: string) => {
    const conn = get().connection;
    const views = get().views;
    const viewDef = views.get(viewName);

    if (!conn || !viewDef) return false;

    try {
      // Get fresh schema from database
      const result = await conn.query(`DESCRIBE "${viewName}"`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DuckDB result row type
      const newSchema: ColumnSchema[] = result.toArray().map((row: any) => ({
        name: row.column_name,
        type: row.column_type,
      }));

      // Update the view definition with new schema
      const updatedViews = new Map(views);
      updatedViews.set(viewName, {
        ...viewDef,
        schema: newSchema,
      });

      set({ views: updatedViews });
      console.log('[DuckDBView] Schema refreshed for', viewName, '- columns:', newSchema.length);
      return true;
    } catch (err) {
      console.error('[DuckDBView] Failed to refresh schema:', err);
      return false;
    }
  },

  setActiveView: (viewName: string | null) => {
    set({ activeViewName: viewName });
  },

  // Build paginated SQL
  buildPaginatedSQL: (viewName: string, params: QueryParams) => {
    const { page, pageSize, sortColumn, sortDirection, filters, search, searchColumns } = params;

    let sql = `SELECT * FROM "${viewName}"`;
    const conditions: string[] = [];

    // Add filters
    if (filters && filters.length > 0) {
      filters.forEach(f => {
        switch (f.operator) {
          case 'IS NULL':
            conditions.push(`"${f.column}" IS NULL`);
            break;
          case 'IS NOT NULL':
            conditions.push(`"${f.column}" IS NOT NULL`);
            break;
          case 'IN': {
            const values = Array.isArray(f.value) ? f.value : [f.value];
            const inList = values.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
            conditions.push(`"${f.column}" IN (${inList})`);
            break;
          }
          case 'LIKE':
          case 'ILIKE':
            conditions.push(`"${f.column}" ${f.operator} '${f.value}'`);
            break;
          default: {
            const val = typeof f.value === 'string' ? `'${f.value}'` : f.value;
            conditions.push(`"${f.column}" ${f.operator} ${val}`);
          }
        }
      });
    }

    // Add search
    if (search && search.trim()) {
      const searchTerm = search.replace(/'/g, "''");
      const cols = searchColumns && searchColumns.length > 0
        ? searchColumns
        : get().views.get(viewName)?.schema.map(s => s.name).filter(n => n !== '_rowid') || [];

      if (cols.length > 0) {
        const searchConditions = cols.map(col => `CAST("${col}" AS VARCHAR) ILIKE '%${searchTerm}%'`);
        conditions.push(`(${searchConditions.join(' OR ')})`);
      }
    }

    // Add WHERE clause
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (sortColumn) {
      sql += ` ORDER BY "${sortColumn}" ${sortDirection || 'ASC'}`;
    } else {
      sql += ` ORDER BY _rowid ASC`;
    }

    // Add LIMIT/OFFSET
    const offset = page * pageSize;
    sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    return sql;
  },

  // Query view with pagination
  queryView: async (viewName: string, params: QueryParams) => {
    const conn = get().connection;
    if (!conn) {
      const success = await get().initialize();
      if (!success || !get().connection) return null;
    }

    const connection = get().connection!;

    set({ isLoading: true, loadingMessage: 'Querying data...' });

    try {
      const startTime = performance.now();

      // Build and execute main query
      const sql = get().buildPaginatedSQL(viewName, params);
      console.log('[DuckDBView] Executing query:', sql);

      const result = await connection.query(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DuckDB result row type
      const data = result.toArray().map((row: any) => ({ ...row }));

      // Get total count (for pagination)
      let totalRows = get().views.get(viewName)?.totalRows || 0;

      // If we have filters/search, we need to count matching rows
      if ((params.filters && params.filters.length > 0) || params.search) {
        try {
          let countSQL = `SELECT COUNT(*) as cnt FROM "${viewName}"`;
          const conditions: string[] = [];

          if (params.filters) {
            params.filters.forEach(f => {
              if (f.operator === 'IS NULL') {
                conditions.push(`"${f.column}" IS NULL`);
              } else if (f.operator === 'IS NOT NULL') {
                conditions.push(`"${f.column}" IS NOT NULL`);
              } else {
                const val = typeof f.value === 'string' ? `'${f.value}'` : f.value;
                conditions.push(`"${f.column}" ${f.operator} ${val}`);
              }
            });
          }

          if (params.search) {
            const searchTerm = params.search.replace(/'/g, "''");
            const cols = params.searchColumns ||
              get().views.get(viewName)?.schema.map(s => s.name).filter(n => n !== '_rowid') || [];
            if (cols.length > 0) {
              const searchConditions = cols.map(col => `CAST("${col}" AS VARCHAR) ILIKE '%${searchTerm}%'`);
              conditions.push(`(${searchConditions.join(' OR ')})`);
            }
          }

          if (conditions.length > 0) {
            countSQL += ` WHERE ${conditions.join(' AND ')}`;
          }

          const countResult = await connection.query(countSQL);
          totalRows = Number(countResult.toArray()[0]?.cnt || 0);
        } catch (e) {
          console.warn('[DuckDBView] Count query failed:', e);
        }
      }

      const queryTime = performance.now() - startTime;

      set({ isLoading: false, loadingMessage: '' });

      return {
        data,
        totalRows,
        totalPages: Math.ceil(totalRows / params.pageSize),
        currentPage: params.page,
        pageSize: params.pageSize,
        queryTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Query failed';
      console.error('[DuckDBView] Query failed:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return null;
    }
  },

  // Execute raw SQL
  executeSQL: async (sql: string) => {
    const conn = get().connection;
    if (!conn) {
      const success = await get().initialize();
      if (!success || !get().connection) return null;
    }

    try {
      const result = await get().connection!.query(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DuckDB result row type
      return result.toArray().map((row: any) => ({ ...row }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Query failed';
      console.error('[DuckDBView] SQL execution failed:', err);
      set({ error: errorMsg });
      return null;
    }
  },

  // Validate SQL using EXPLAIN (does not execute the query)
  validateSQL: async (sql: string): Promise<SQLValidationResult> => {
    const conn = get().connection;
    if (!conn) {
      const success = await get().initialize();
      if (!success || !get().connection) {
        return {
          valid: false,
          error: 'Database not initialized',
          errorType: 'unknown',
          sql,
        };
      }
    }

    try {
      // Use EXPLAIN to validate the SQL without executing it
      // This will catch syntax errors, invalid column references, etc.
      await get().connection!.query(`EXPLAIN ${sql}`);

      return {
        valid: true,
        sql,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Validation failed';

      // Categorize the error for better user feedback
      let errorType: SQLValidationResult['errorType'] = 'unknown';
      let suggestion: string | undefined;

      const lowerError = errorMsg.toLowerCase();

      if (lowerError.includes('syntax error') || lowerError.includes('parser')) {
        errorType = 'syntax';
        suggestion = 'Check your SQL syntax. Make sure keywords and quotes are correct.';
      } else if (
        lowerError.includes('does not exist') ||
        lowerError.includes('not found') ||
        lowerError.includes('unknown column') ||
        lowerError.includes('no such column') ||
        lowerError.includes('column') && lowerError.includes('not')
      ) {
        errorType = 'schema';
        // Try to extract the problematic column/table name
        const columnMatch = errorMsg.match(/column[:\s]+"?([^"\s,]+)"?/i) ||
                          errorMsg.match(/"([^"]+)" does not exist/i);
        if (columnMatch) {
          suggestion = `Column "${columnMatch[1]}" was not found. Check the column name for typos.`;
        } else {
          suggestion = 'A table or column name was not found. Check for typos in names.';
        }
      } else if (
        lowerError.includes('permission') ||
        lowerError.includes('access denied') ||
        lowerError.includes('not allowed')
      ) {
        errorType = 'permission';
        suggestion = 'This operation is not allowed.';
      }

      console.log('[DuckDBView] SQL validation failed:', { sql, error: errorMsg, errorType });

      return {
        valid: false,
        error: errorMsg,
        errorType,
        suggestion,
        sql,
      };
    }
  },

  // Record a change
  recordChange: (change) => {
    const changeRecord: ChangeRecord = {
      ...change,
      id: `change_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    };

    set(state => {
      const viewChanges = state.pendingChanges.get(change.viewName) || [];
      const newPendingChanges = new Map(state.pendingChanges);
      newPendingChanges.set(change.viewName, [...viewChanges, changeRecord]);

      return {
        pendingChanges: newPendingChanges,
        changeHistory: [...state.changeHistory, changeRecord],
      };
    });

    // Also insert into delta table
    const conn = get().connection;
    if (conn) {
      const deltaTableName = `${change.viewName}_delta`;
      const sql = `
        INSERT INTO "${deltaTableName}" VALUES (
          '${changeRecord.id}',
          ${change.rowId},
          '${change.column}',
          '${serializeValue(change.oldValue).replace(/'/g, "''")}',
          '${serializeValue(change.newValue).replace(/'/g, "''")}',
          '${change.changeType}',
          ${changeRecord.timestamp},
          '${change.source}'
        )
      `;
      conn.query(sql).catch(err => {
        console.warn('[DuckDBView] Failed to insert into delta table:', err);
      });
    }
  },

  // Undo last change
  undoLastChange: (viewName: string) => {
    const changes = get().pendingChanges.get(viewName) || [];
    if (changes.length === 0) return null;

    const lastChange = changes[changes.length - 1];

    set(state => {
      const viewChanges = state.pendingChanges.get(viewName) || [];
      const newChanges = viewChanges.slice(0, -1);
      const newPendingChanges = new Map(state.pendingChanges);

      if (newChanges.length === 0) {
        newPendingChanges.delete(viewName);
      } else {
        newPendingChanges.set(viewName, newChanges);
      }

      return { pendingChanges: newPendingChanges };
    });

    // Remove from delta table
    const conn = get().connection;
    if (conn) {
      const deltaTableName = `${viewName}_delta`;
      conn.query(`DELETE FROM "${deltaTableName}" WHERE id = '${lastChange.id}'`).catch(err => {
        console.warn('[DuckDBView] Failed to delete from delta table:', err);
      });
    }

    return lastChange;
  },

  // Discard all changes for a view
  discardChanges: (viewName: string) => {
    set(state => {
      const newPendingChanges = new Map(state.pendingChanges);
      newPendingChanges.delete(viewName);
      return { pendingChanges: newPendingChanges };
    });

    // Clear delta table
    const conn = get().connection;
    if (conn) {
      const deltaTableName = `${viewName}_delta`;
      conn.query(`DELETE FROM "${deltaTableName}"`).catch(err => {
        console.warn('[DuckDBView] Failed to clear delta table:', err);
      });
    }
  },

  // Commit changes - apply to source or export
  commitChanges: async (viewName: string) => {
    const conn = get().connection;
    if (!conn) return false;

    const changes = get().pendingChanges.get(viewName) || [];
    if (changes.length === 0) return true;

    set({ isLoading: true, loadingMessage: 'Committing changes...' });

    try {
      // Get the view schema to properly format values
      const viewDef = get().views.get(viewName);
      const schema = viewDef?.schema || [];

      // Helper to get column type from schema
      const getColumnType = (columnName: string): string => {
        const column = schema.find(col => col.name === columnName);
        return column?.type || 'VARCHAR';
      };

      // Apply changes to the underlying table/view
      for (const change of changes) {
        if (change.changeType === 'update') {
          // For updates, we modify the source table with proper type handling
          const colType = getColumnType(change.column);
          const newVal = formatValueForSQL(change.newValue, colType);

          await conn.query(`
            UPDATE "${viewName}"
            SET "${change.column}" = ${newVal}
            WHERE _rowid = ${change.rowId}
          `);
        } else if (change.changeType === 'delete') {
          await conn.query(`
            DELETE FROM "${viewName}"
            WHERE _rowid = ${change.rowId}
          `);
        }
      }

      // Clear delta table
      const deltaTableName = `${viewName}_delta`;
      await conn.query(`DELETE FROM "${deltaTableName}"`);

      // Save this commit as a new version before clearing pending changes
      const versionId = `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const changeCount = changes.length;
      const description = changeCount === 1
        ? `Edit ${changes[0].column}`
        : `${changeCount} changes`;

      const newVersion: CommittedVersion = {
        id: versionId,
        timestamp: Date.now(),
        changes: [...changes], // Save a copy of the changes
        description,
      };

      // Clear pending changes and save version
      set(state => {
        const newPendingChanges = new Map(state.pendingChanges);
        newPendingChanges.delete(viewName);

        // Add to committed versions
        const existingVersions = state.committedVersions.get(viewName) || [];
        const currentIdx = state.currentVersionIndex.get(viewName) ?? existingVersions.length;

        // If we're not at the latest version, truncate future versions
        const truncatedVersions = existingVersions.slice(0, currentIdx);
        const newVersions = [...truncatedVersions, newVersion];

        const newCommittedVersions = new Map(state.committedVersions);
        newCommittedVersions.set(viewName, newVersions);

        const newVersionIndex = new Map(state.currentVersionIndex);
        newVersionIndex.set(viewName, newVersions.length);

        return {
          pendingChanges: newPendingChanges,
          committedVersions: newCommittedVersions,
          currentVersionIndex: newVersionIndex,
          isLoading: false,
          loadingMessage: '',
        };
      });

      console.log('[DuckDBView] Changes committed successfully, version saved:', versionId);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Commit failed';
      console.error('[DuckDBView] Commit failed:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return false;
    }
  },

  // Get pending changes for a view
  getPendingChanges: (viewName: string) => {
    return get().pendingChanges.get(viewName) || [];
  },

  // Add column and create a version for it (schema change)
  addColumnWithVersion: async (viewName: string, columnName: string, columnType: string) => {
    const conn = get().connection;
    if (!conn) return false;

    set({ isLoading: true, loadingMessage: 'Adding column...' });

    try {
      // Execute ALTER TABLE to add the column
      const sql = `ALTER TABLE "${viewName}" ADD COLUMN "${columnName}" ${columnType} DEFAULT NULL`;
      await conn.query(sql);

      // Refresh the schema
      await get().refreshViewSchema(viewName);

      // Create a version for this schema change
      const versionId = `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const schemaChange: ChangeRecord = {
        id: `change_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        viewName,
        rowId: -1, // Not applicable for schema changes
        column: columnName,
        oldValue: null, // Column didn't exist before
        newValue: columnType,
        changeType: 'add_column',
        timestamp: Date.now(),
        source: 'user',
        columnType,
      };

      const newVersion: CommittedVersion = {
        id: versionId,
        timestamp: Date.now(),
        changes: [schemaChange],
        description: `Add column "${columnName}"`,
      };

      // Save version
      set(state => {
        const existingVersions = state.committedVersions.get(viewName) || [];
        const currentIdx = state.currentVersionIndex.get(viewName) ?? existingVersions.length;

        // If we're not at the latest version, truncate future versions
        const truncatedVersions = existingVersions.slice(0, currentIdx);
        const newVersions = [...truncatedVersions, newVersion];

        const newCommittedVersions = new Map(state.committedVersions);
        newCommittedVersions.set(viewName, newVersions);

        const newVersionIndex = new Map(state.currentVersionIndex);
        newVersionIndex.set(viewName, newVersions.length);

        return {
          committedVersions: newCommittedVersions,
          currentVersionIndex: newVersionIndex,
          isLoading: false,
          loadingMessage: '',
        };
      });

      console.log('[DuckDBView] Column added and version saved:', versionId);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add column';
      console.error('[DuckDBView] Add column failed:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return false;
    }
  },

  // Export view data to file
  exportView: async (viewName: string, format: 'csv' | 'json' | 'parquet' | 'xlsx', fileName?: string) => {
    const conn = get().connection;
    const db = get().db;
    if (!conn || !db) return null;

    set({ isLoading: true, loadingMessage: `Exporting to ${format.toUpperCase()}...` });

    try {
      const exportFileName = fileName || `${viewName}_export.${format}`;

      if (format === 'csv') {
        // Export to CSV using DuckDB
        const result = await conn.query(`
          SELECT * EXCLUDE (_rowid) FROM "${viewName}"
        `);
        const rows = result.toArray();

        if (rows.length === 0) {
          set({ isLoading: false, loadingMessage: '' });
          return new Blob([''], { type: 'text/csv' });
        }

        // Get column names (excluding _rowid)
        const columns = Object.keys(rows[0]).filter(k => k !== '_rowid');

        // Build CSV
        const csvLines: string[] = [];
        csvLines.push(columns.map(c => `"${c}"`).join(','));

        for (const row of rows) {
          const values = columns.map(col => {
            const val = (row as Record<string, unknown>)[col];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
            return String(val);
          });
          csvLines.push(values.join(','));
        }

        set({ isLoading: false, loadingMessage: '' });
        return new Blob([csvLines.join('\n')], { type: 'text/csv' });

      } else if (format === 'json') {
        // Export to JSON
        const result = await conn.query(`
          SELECT * EXCLUDE (_rowid) FROM "${viewName}"
        `);
        const rows = result.toArray().map((row: unknown) => {
          const obj = row as Record<string, unknown>;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _rowid destructured to exclude from export
          const { _rowid, ...rest } = obj;
          return rest;
        });

        set({ isLoading: false, loadingMessage: '' });
        return new Blob([JSON.stringify(rows, bigIntReplacer, 2)], { type: 'application/json' });

      } else if (format === 'parquet') {
        // Export to Parquet using DuckDB's COPY TO
        // For WASM, we use copyFileToBuffer
        const tempFile = `${exportFileName}`;
        await conn.query(`
          COPY (SELECT * EXCLUDE (_rowid) FROM "${viewName}")
          TO '${tempFile}' (FORMAT PARQUET)
        `);

        // Read the file back as a buffer
        const buffer = await db.copyFileToBuffer(tempFile);

        set({ isLoading: false, loadingMessage: '' });
        // Use slice to create a copy with proper ArrayBuffer type
        return new Blob([buffer.slice().buffer], { type: 'application/octet-stream' });

      } else if (format === 'xlsx') {
        // Export to Excel using xlsx library
        const result = await conn.query(`
          SELECT * EXCLUDE (_rowid) FROM "${viewName}"
        `);
        const rows = result.toArray().map((row: unknown) => {
          const obj = row as Record<string, unknown>;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _rowid destructured to exclude from export
          const { _rowid, ...rest } = obj;
          return rest;
        });

        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        const { createXlsxBlob } = await import('@/lib/xlsx');
        const blob = createXlsxBlob(rows, columns);

        set({ isLoading: false, loadingMessage: '' });
        return blob;
      }

      set({ isLoading: false, loadingMessage: '' });
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed';
      console.error('[DuckDBView] Export failed:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return null;
    }
  },

  // Version navigation - check if can undo
  canUndoVersion: (viewName: string) => {
    const currentIdx = get().currentVersionIndex.get(viewName) ?? 0;
    return currentIdx > 0;
  },

  // Version navigation - check if can redo
  canRedoVersion: (viewName: string) => {
    const versions = get().committedVersions.get(viewName) || [];
    const currentIdx = get().currentVersionIndex.get(viewName) ?? versions.length;
    return currentIdx < versions.length;
  },

  // Get version info for UI
  getVersionInfo: (viewName: string) => {
    const versions = get().committedVersions.get(viewName) || [];
    const currentIdx = get().currentVersionIndex.get(viewName) ?? versions.length;
    const currentVersion = currentIdx > 0 ? versions[currentIdx - 1] : null;

    return {
      current: currentIdx,
      total: versions.length,
      description: currentVersion?.description ?? null,
    };
  },

  // Clear committed versions for a view (after successful sync to remote)
  clearCommittedVersions: (viewName: string) => {
    set(state => {
      const newCommittedVersions = new Map(state.committedVersions);
      newCommittedVersions.delete(viewName);
      const newVersionIndex = new Map(state.currentVersionIndex);
      newVersionIndex.delete(viewName);
      return {
        committedVersions: newCommittedVersions,
        currentVersionIndex: newVersionIndex,
      };
    });
  },

  // Undo a committed version - apply inverse changes
  undoVersion: async (viewName: string) => {
    const conn = get().connection;
    if (!conn) return false;

    const versions = get().committedVersions.get(viewName) || [];
    const currentIdx = get().currentVersionIndex.get(viewName) ?? versions.length;

    if (currentIdx <= 0) return false;

    // Get the version to undo (the one we're currently at)
    const versionToUndo = versions[currentIdx - 1];
    if (!versionToUndo) return false;

    set({ isLoading: true, loadingMessage: 'Reverting changes...' });

    try {
      // Get the view schema to properly format values
      const viewDef = get().views.get(viewName);
      const schema = viewDef?.schema || [];

      // Helper to get column type from schema
      const getColumnType = (columnName: string): string => {
        const column = schema.find(col => col.name === columnName);
        return column?.type || 'VARCHAR';
      };

      // Apply inverse changes (in reverse order)
      for (let i = versionToUndo.changes.length - 1; i >= 0; i--) {
        const change = versionToUndo.changes[i];

        if (change.changeType === 'update') {
          // Restore old value with proper type handling
          const colType = getColumnType(change.column);
          const oldVal = formatValueForSQL(change.oldValue, colType);

          await conn.query(`
            UPDATE "${viewName}"
            SET "${change.column}" = ${oldVal}
            WHERE _rowid = ${change.rowId}
          `);
        } else if (change.changeType === 'delete') {
          // Re-insert deleted row - oldValue contains the full row data
          const rowData = change.oldValue as Record<string, unknown>;
          if (rowData && typeof rowData === 'object') {
            // Get columns excluding _rowid and internal markers
            const columns = Object.keys(rowData).filter(
              col => col !== '_rowid' && !col.startsWith('_')
            );

            if (columns.length > 0) {
              const values = columns.map(col => {
                const colType = getColumnType(col);
                return formatValueForSQL(rowData[col], colType);
              });

              // Re-insert with the ORIGINAL _rowid to preserve position
              // Use the rowId from the change record which is the original _rowid
              const originalRowId = change.rowId;

              await conn.query(`
                INSERT INTO "${viewName}" (_rowid, ${columns.map(c => `"${c}"`).join(', ')})
                VALUES (${originalRowId}, ${values.join(', ')})
              `);

              console.log('[DuckDBView] Re-inserted deleted row with original _rowid:', originalRowId);
            }
          }
        } else if (change.changeType === 'add_column') {
          // Drop the column that was added
          await conn.query(`ALTER TABLE "${viewName}" DROP COLUMN "${change.column}"`);
          console.log('[DuckDBView] Dropped column:', change.column);
        }
      }

      // Refresh schema after undo (especially for schema changes)
      await get().refreshViewSchema(viewName);

      // Update version index
      set(state => {
        const newVersionIndex = new Map(state.currentVersionIndex);
        newVersionIndex.set(viewName, currentIdx - 1);
        return {
          currentVersionIndex: newVersionIndex,
          isLoading: false,
          loadingMessage: '',
        };
      });

      console.log('[DuckDBView] Version undone:', versionToUndo.id);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Undo version failed';
      console.error('[DuckDBView] Undo version failed:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return false;
    }
  },

  // Redo a committed version - re-apply changes
  redoVersion: async (viewName: string) => {
    const conn = get().connection;
    if (!conn) return false;

    const versions = get().committedVersions.get(viewName) || [];
    const currentIdx = get().currentVersionIndex.get(viewName) ?? versions.length;

    if (currentIdx >= versions.length) return false;

    // Get the version to redo
    const versionToRedo = versions[currentIdx];
    if (!versionToRedo) return false;

    set({ isLoading: true, loadingMessage: 'Re-applying changes...' });

    try {
      // Get the view schema to properly format values
      const viewDef = get().views.get(viewName);
      const schema = viewDef?.schema || [];

      // Helper to get column type from schema
      const getColumnType = (columnName: string): string => {
        const column = schema.find(col => col.name === columnName);
        return column?.type || 'VARCHAR';
      };

      // Re-apply changes in original order
      for (const change of versionToRedo.changes) {
        if (change.changeType === 'update') {
          const colType = getColumnType(change.column);
          const newVal = formatValueForSQL(change.newValue, colType);

          await conn.query(`
            UPDATE "${viewName}"
            SET "${change.column}" = ${newVal}
            WHERE _rowid = ${change.rowId}
          `);
        } else if (change.changeType === 'delete') {
          await conn.query(`
            DELETE FROM "${viewName}"
            WHERE _rowid = ${change.rowId}
          `);
        } else if (change.changeType === 'add_column') {
          // Re-add the column
          const colType = change.columnType || 'VARCHAR';
          await conn.query(`ALTER TABLE "${viewName}" ADD COLUMN "${change.column}" ${colType} DEFAULT NULL`);
          console.log('[DuckDBView] Re-added column:', change.column);
        }
      }

      // Refresh schema after redo (especially for schema changes)
      await get().refreshViewSchema(viewName);

      // Update version index
      set(state => {
        const newVersionIndex = new Map(state.currentVersionIndex);
        newVersionIndex.set(viewName, currentIdx + 1);
        return {
          currentVersionIndex: newVersionIndex,
          isLoading: false,
          loadingMessage: '',
        };
      });

      console.log('[DuckDBView] Version redone:', versionToRedo.id);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Redo version failed';
      console.error('[DuckDBView] Redo version failed:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return false;
    }
  },

  // Change a column's type by re-importing from source with type override
  changeColumnType: async (viewName: string, columnName: string, newType: string, file: File) => {
    const views = get().views;
    const viewDef = views.get(viewName);

    if (!viewDef) {
      console.error('[DuckDBView] View not found:', viewName);
      return false;
    }

    set({ isLoading: true, loadingMessage: `Changing ${columnName} to ${newType}...` });

    try {
      // Merge new type override with existing ones
      const existingOverrides = viewDef.typeOverrides || {};
      const newOverrides: Record<string, string> = {
        ...existingOverrides,
        [columnName]: newType,
      };

      console.log('[DuckDBView] Re-importing with type overrides:', newOverrides);

      // Re-create the view with the new type overrides
      // This will drop the existing table and create a new one with the overridden types
      const result = await get().createViewFromFile(file, viewName, newOverrides);

      if (result) {
        console.log('[DuckDBView] Column type changed successfully:', columnName, '->', newType);
        set({ isLoading: false, loadingMessage: '' });
        return true;
      } else {
        set({ isLoading: false, loadingMessage: '', error: 'Failed to re-import with new type' });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to change column type';
      console.error('[DuckDBView] Change column type failed:', err);
      set({ error: errorMsg, isLoading: false, loadingMessage: '' });
      return false;
    }
  },
}));
