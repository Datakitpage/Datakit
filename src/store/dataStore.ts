import { create } from "zustand";
import * as duckdb from "@duckdb/duckdb-wasm";
import { initializeDuckDB, cleanup } from "@/lib/duckdb/init";

export interface TableSchema {
  name: string;
  type: string;
}

export interface DataSource {
  id: string;
  name: string;
  tableName: string;
  schema: TableSchema[];
  rowCount: number;
  createdAt: string;
}

interface DataState {
  db: duckdb.AsyncDuckDB | null;
  connection: duckdb.AsyncDuckDBConnection | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;
  
  dataSources: DataSource[];
  activeDataSourceId: string | null;
  
  isImporting: boolean;
  importProgress: number;

  initialize: () => Promise<boolean>;
  importFile: (file: File) => Promise<DataSource | null>;
  executeQuery: (sql: string) => Promise<Record<string, unknown>[] | null>;
  getTableSchema: (tableName: string) => Promise<TableSchema[] | null>;
  getSampleData: (tableName: string, limit?: number) => Promise<Record<string, unknown>[] | null>;
  cleanupDB: () => Promise<void>;
}

function sanitizeTableName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^[0-9]/, "_$&")
    .toLowerCase();
}

export const useDataStore = create<DataState>((set, get) => ({
  db: null,
  connection: null,
  isInitializing: false,
  isInitialized: false,
  error: null,
  dataSources: [],
  activeDataSourceId: null,
  isImporting: false,
  importProgress: 0,

  initialize: async () => {
    const state = get();
    if (state.isInitialized) {
      console.log("[OpenSheet/Data] Already initialized");
      return true;
    }
    if (state.isInitializing) {
      console.log("[OpenSheet/Data] Already initializing...");
      return false;
    }

    console.log("[OpenSheet/Data] Starting DuckDB initialization...");
    set({ isInitializing: true, error: null });

    try {
      const { db, conn } = await initializeDuckDB();
      console.log("[OpenSheet/Data] DuckDB initialized successfully");
      set({
        db,
        connection: conn,
        isInitialized: true,
        isInitializing: false,
      });
      return true;
    } catch (err) {
      console.error("[OpenSheet/Data] DuckDB initialization failed:", err);
      set({
        error: err instanceof Error ? err.message : "Failed to initialize",
        isInitializing: false,
      });
      return false;
    }
  },

  importFile: async (file: File) => {
    console.log("[OpenSheet/Data] Starting import for:", file.name, "Size:", file.size, "Type:", file.type);
    
    const state = get();
    if (!state.connection) {
      console.log("[OpenSheet/Data] No connection, initializing...");
      const success = await get().initialize();
      if (!success) {
        console.error("[OpenSheet/Data] Failed to initialize DuckDB");
        return null;
      }
    }
    
    const conn = get().connection;
    const db = get().db;
    if (!conn || !db) {
      const errorMsg = "Database not initialized";
      console.error("[OpenSheet/Data]", errorMsg);
      set({ error: errorMsg });
      return null;
    }

    set({ isImporting: true, importProgress: 0, error: null });

    try {
      const tableName = sanitizeTableName(file.name);
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      console.log("[OpenSheet/Data] Table name:", tableName, "Extension:", fileExtension);

      set({ importProgress: 20 });

      // Read file content
      console.log("[OpenSheet/Data] Reading file content...");
      const arrayBuffer = await file.arrayBuffer();
      const content = new TextDecoder().decode(arrayBuffer);
      console.log("[OpenSheet/Data] File content length:", content.length, "chars");
      set({ importProgress: 40 });

      // Register file with DuckDB
      console.log("[OpenSheet/Data] Registering file with DuckDB...");
      await db.registerFileText(file.name, content);
      console.log("[OpenSheet/Data] File registered");
      set({ importProgress: 60 });

      // Create table from file
      let createSQL = "";
      if (fileExtension === "csv") {
        createSQL = "CREATE TABLE " + tableName + " AS SELECT * FROM read_csv_auto('" + file.name + "')";
      } else if (fileExtension === "json") {
        createSQL = "CREATE TABLE " + tableName + " AS SELECT * FROM read_json_auto('" + file.name + "')";
      } else if (fileExtension === "parquet") {
        createSQL = "CREATE TABLE " + tableName + " AS SELECT * FROM read_parquet('" + file.name + "')";
      } else {
        throw new Error("Unsupported file type: " + fileExtension);
      }

      console.log("[OpenSheet/Data] Creating table with SQL:", createSQL.substring(0, 100) + "...");
      await conn.query(createSQL);
      console.log("[OpenSheet/Data] Table created successfully");
      set({ importProgress: 80 });

      // Get schema and row count
      console.log("[OpenSheet/Data] Getting schema...");
      const schema = await get().getTableSchema(tableName);
      console.log("[OpenSheet/Data] Schema:", schema);
      
      const countResult = await conn.query("SELECT COUNT(*) as count FROM " + tableName);
      const countArray = countResult.toArray();
      const rowCount = Number(countArray[0]?.count || 0);
      console.log("[OpenSheet/Data] Row count:", rowCount);

      set({ importProgress: 100 });

      const dataSource: DataSource = {
        id: "ds-" + Date.now(),
        name: file.name,
        tableName,
        schema: schema || [],
        rowCount,
        createdAt: new Date().toISOString(),
      };

      console.log("[OpenSheet/Data] Import complete:", dataSource);

      set((state) => ({
        dataSources: [...state.dataSources, dataSource],
        activeDataSourceId: dataSource.id,
        isImporting: false,
        importProgress: 0,
      }));

      return dataSource;
    } catch (err) {
      console.error("[OpenSheet/Data] Import error:", err);
      set({
        error: err instanceof Error ? err.message : "Import failed",
        isImporting: false,
        importProgress: 0,
      });
      return null;
    }
  },

  executeQuery: async (sql: string) => {
    const conn = get().connection;
    if (!conn) {
      console.error("[OpenSheet/Data] No connection for query");
      return null;
    }

    try {
      console.log("[OpenSheet/Data] Executing query:", sql.substring(0, 100));
      const result = await conn.query(sql);
      const rows = result.toArray().map((row) => ({ ...row }));
      console.log("[OpenSheet/Data] Query returned", rows.length, "rows");
      return rows;
    } catch (err) {
      console.error("[OpenSheet/Data] Query error:", err);
      set({ error: err instanceof Error ? err.message : "Query failed" });
      return null;
    }
  },

  getTableSchema: async (tableName: string) => {
    const conn = get().connection;
    if (!conn) return null;

    try {
      const result = await conn.query("DESCRIBE " + tableName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DuckDB result row type
      return result.toArray().map((row: any) => ({
        name: row.column_name,
        type: row.column_type,
      }));
    } catch (err) {
      console.error("[OpenSheet/Data] Schema error:", err);
      return null;
    }
  },

  getSampleData: async (tableName: string, limit = 100) => {
    const conn = get().connection;
    if (!conn) return null;

    try {
      const result = await conn.query("SELECT * FROM " + tableName + " LIMIT " + limit);
      return result.toArray().map((row) => ({ ...row }));
    } catch (err) {
      console.error("[OpenSheet/Data] Sample data error:", err);
      return null;
    }
  },

  cleanupDB: async () => {
    cleanup();
    set({
      db: null,
      connection: null,
      isInitialized: false,
      dataSources: [],
      activeDataSourceId: null,
    });
  },
}));
