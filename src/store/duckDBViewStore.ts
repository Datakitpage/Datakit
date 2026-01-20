import { create } from 'zustand';
import * as duckdb from '@duckdb/duckdb-wasm';
import { initializeDuckDB, cleanup } from '@/lib/duckdb/init';

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
}

export interface ChangeRecord {
  id: string;
  viewName: string;
  rowId: number;
  column: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'update' | 'insert' | 'delete';
  timestamp: number;
  source: 'user' | 'ai';
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

  // Loading states
  isLoading: boolean;
  loadingMessage: string;

  // Actions - Core
  initialize: () => Promise<boolean>;
  cleanup: () => Promise<void>;
  resetError: () => void;

  // Actions - Views
  createViewFromFile: (file: File, viewName?: string) => Promise<ViewDefinition | null>;
  createViewFromData: (viewName: string, data: Record<string, unknown>[], columns: string[]) => Promise<ViewDefinition | null>;
  dropView: (viewName: string) => Promise<boolean>;
  getViewSchema: (viewName: string) => Promise<ColumnSchema[] | null>;
  setActiveView: (viewName: string | null) => void;

  // Actions - Queries
  queryView: (viewName: string, params: QueryParams) => Promise<PaginatedResult | null>;
  executeSQL: (sql: string) => Promise<Record<string, unknown>[] | null>;

  // Actions - Changes
  recordChange: (change: Omit<ChangeRecord, 'id' | 'timestamp'>) => void;
  undoLastChange: (viewName: string) => ChangeRecord | null;
  discardChanges: (viewName: string) => void;
  commitChanges: (viewName: string) => Promise<boolean>;
  getPendingChanges: (viewName: string) => ChangeRecord[];

  // Utilities
  buildPaginatedSQL: (viewName: string, params: QueryParams) => string;
  sanitizeTableName: (fileName: string) => string;
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
  isLoading: false,
  loadingMessage: '',

  // Initialize DuckDB
  initialize: async () => {
    const state = get();
    if (state.isInitialized) return true;
    if (state.isInitializing) return false;

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
  createViewFromFile: async (file: File, customViewName?: string) => {
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
      } else {
        // For binary files like parquet
        const buffer = await file.arrayBuffer();
        await db.registerFileBuffer(registeredFileName, new Uint8Array(buffer));
      }

      // Drop existing view/table if exists
      try {
        await conn.query(`DROP VIEW IF EXISTS "${viewName}"`);
        await conn.query(`DROP TABLE IF EXISTS "${viewName}"`);
      } catch (e) {
        // Ignore errors
      }

      // Create VIEW (not TABLE) based on file type
      let createViewSQL: string;
      switch (fileExt) {
        case 'csv':
          createViewSQL = `CREATE VIEW "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_csv_auto('${registeredFileName}')`;
          break;
        case 'json':
          createViewSQL = `CREATE VIEW "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_json_auto('${registeredFileName}')`;
          break;
        case 'parquet':
          createViewSQL = `CREATE VIEW "${viewName}" AS SELECT row_number() OVER () as _rowid, * FROM read_parquet('${registeredFileName}')`;
          break;
        default:
          // For txt files, create a single column view
          createViewSQL = `CREATE VIEW "${viewName}" AS SELECT row_number() OVER () as _rowid, column0 as content FROM read_csv_auto('${registeredFileName}', header=false)`;
      }

      console.log('[DuckDBView] Creating view:', createViewSQL);
      await conn.query(createViewSQL);

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
      };

      // Update state
      set(state => {
        const newViews = new Map(state.views);
        newViews.set(viewName, viewDef);
        return {
          views: newViews,
          activeViewName: viewName,
          isLoading: false,
          loadingMessage: '',
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
    let conn = get().connection;

    if (!conn) {
      const success = await get().initialize();
      if (!success) return null;
      conn = get().connection;
      if (!conn) return null;
    }

    if (data.length === 0) {
      set({ error: 'No data provided' });
      return null;
    }

    set({ isLoading: true, loadingMessage: 'Creating view from data...', error: null });

    try {
      // Drop existing
      await conn.query(`DROP TABLE IF EXISTS "${viewName}"`);

      // Infer types from first row
      const types = columns.map(col => {
        const val = data[0][col];
        if (typeof val === 'number') return Number.isInteger(val) ? 'BIGINT' : 'DOUBLE';
        if (typeof val === 'boolean') return 'BOOLEAN';
        return 'VARCHAR';
      });

      // Create table (we need TABLE for data, VIEW for lazy file reading)
      const columnDefs = columns.map((col, i) => `"${col}" ${types[i]}`).join(', ');
      await conn.query(`CREATE TABLE "${viewName}" (_rowid BIGINT, ${columnDefs})`);

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

        await conn.query(`INSERT INTO "${viewName}" VALUES ${values}`);
      }

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
        return {
          views: newViews,
          activeViewName: viewName,
          isLoading: false,
          loadingMessage: '',
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
        return {
          views: newViews,
          pendingChanges: newPendingChanges,
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
      return result.toArray().map((row: any) => ({
        name: row.column_name,
        type: row.column_type,
      }));
    } catch (err) {
      console.error('[DuckDBView] Failed to get schema:', err);
      return null;
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
          case 'IN':
            const values = Array.isArray(f.value) ? f.value : [f.value];
            const inList = values.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
            conditions.push(`"${f.column}" IN (${inList})`);
            break;
          case 'LIKE':
          case 'ILIKE':
            conditions.push(`"${f.column}" ${f.operator} '${f.value}'`);
            break;
          default:
            const val = typeof f.value === 'string' ? `'${f.value}'` : f.value;
            conditions.push(`"${f.column}" ${f.operator} ${val}`);
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
      return result.toArray().map((row: any) => ({ ...row }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Query failed';
      console.error('[DuckDBView] SQL execution failed:', err);
      set({ error: errorMsg });
      return null;
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
          '${JSON.stringify(change.oldValue).replace(/'/g, "''")}',
          '${JSON.stringify(change.newValue).replace(/'/g, "''")}',
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
      // Apply changes to the underlying table/view
      for (const change of changes) {
        if (change.changeType === 'update') {
          // For updates, we modify the source table
          const newVal = typeof change.newValue === 'string'
            ? `'${change.newValue.replace(/'/g, "''")}'`
            : change.newValue;

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

      // Clear pending changes
      set(state => {
        const newPendingChanges = new Map(state.pendingChanges);
        newPendingChanges.delete(viewName);
        return {
          pendingChanges: newPendingChanges,
          isLoading: false,
          loadingMessage: '',
        };
      });

      console.log('[DuckDBView] Changes committed successfully');
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
}));
