import { create } from "zustand";
import * as duckdb from "@duckdb/duckdb-wasm";

import { cleanup, initializeDuckDB } from "@/lib/duckdb/init";
import { isDevelopment } from "@/lib/duckdb/config";

import { executePaginatedQuery } from "@/lib/duckdb/query";

import {
  discoverAllTables,
  getTableSchema,
  detectTableModifyingSQL,
  getObjectType,
} from "@/lib/duckdb/ingestion/tables";
import { analyzeTxtFile } from "@/lib/duckdb/ingestion/analyzeTextFile";
import {
  createCsvViewWithFallback,
  importCsvWithFallback,
} from "@/lib/duckdb/ingestion/csv/utils";

import { PaginatedQueryResult } from "@/lib/duckdb/types";
import { ColumnType } from "@/types/csv";
import { PostgreSQLConnection, PostgreSQLTable } from "@/types/postgres";

import { SAMPLE_EMPLOYEES_DATA } from "./constants";
import {
  createJsonViewWithFallback,
  importJsonWithFallback,
} from "@/lib/duckdb/ingestion/json/utils";
import {
  addLimitIfMissing,
  hasLimitClause,
} from "@/lib/duckdb/query/pagination";

interface DuckDBState {
  // DB state
  db: duckdb.AsyncDuckDB | null;
  connection: duckdb.AsyncDuckDBConnection | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;

  // Table registry - maps raw names to escaped names
  registeredTables: Map<string, string>;

  // Sample table state
  hasSampleTable: boolean;
  sampleTableName: string;

  // Progress tracking
  isLoading: boolean;
  processingProgress: number;
  processingStatus: string;

  // Schema cache for performance
  schemaCache: Map<string, { name: string; type: string }[]>;
  lastSchemaCacheUpdate: number;

  // Auto-detection
  lastTableRefresh: number;

  // MotherDuck state
  motherDuckClient: unknown | null;
  motherDuckConnected: boolean;
  motherDuckConnecting: boolean;
  motherDuckError: string | null;
  motherDuckDatabases: Array<{ name: string; shared: boolean }>;
  selectedMotherDuckDatabase: string | null;
  motherDuckSchemas: Map<string, { name: string; type: string }[]>;

  // PostgreSQL state - Bridge to postgresStore
  postgresConnections: Map<string, PostgreSQLConnection>;
  postgresActiveConnections: Set<string>;
  postgresVirtualTables: Map<string, {
    connectionId: string;
    schemaName: string;
    tableName: string;
    tableType: 'table' | 'view';
    columns: Array<{ name: string; type: string }>;
    isImported: boolean;
    localTableName?: string;
    estimatedSize?: number;
  }>;
  postgresError: string | null;
  postgresSchemas: Map<string, Array<{ name: string; type: string; tableType: 'table' | 'view' }>>;
  postgresAutoImportThreshold: number; // Size in bytes for auto-import

  // Actions
  initialize: () => Promise<boolean>;
  createSampleTable: () => Promise<void>;
  createTable: (
    tableName: string,
    headers: string[],
    columnTypes: ColumnType[]
  ) => Promise<string>;
  insertData: (
    tableName: string,
    data: string[][],
    onProgress?: (progress: number) => void
  ) => Promise<boolean>;
  loadData: (
    data: string[][],
    headers: string[],
    fileName: string,
    columnTypes: ColumnType[],
    onProgress?: (progress: number) => void
  ) => Promise<string>;
  executeQuery: (sql: string) => Promise<duckdb.ResultStreamBatch | null>;
  getAvailableTables: () => string[];
  getTableSchema: (
    tableName: string
  ) => Promise<{ name: string; type: string }[] | null>;
  getObjectType: (objectName: string) => Promise<"table" | "view" | null>;
  refreshSchemaCache: () => Promise<void>;
  resetError: () => void;
  cleanupDB: () => Promise<void>;
  dropTable: (tableName: string) => Promise<boolean>;
  dropView: (viewName: string) => Promise<boolean>;
  dropTableOrView: (objectName: string) => Promise<boolean>;
  importFileDirectlyStreaming: (
    fileHandle: FileSystemFileHandle,
    fileName: string,
    fileSize: number
  ) => Promise<{
    tableName: string;
    rowCount: number | boolean;
    convertedToCsv?: boolean;
    isDatabaseFile?: boolean;
  }>;
  importFileDirectly: (
    file: File
  ) => Promise<{ tableName: string; rowCount: number; isDatabaseFile?: boolean }>;
  executePaginatedQuery: (
    sql: string,
    page: number,
    pageSize: number,
    applyPagination?: boolean,
    countTotalRows?: boolean
  ) => Promise<PaginatedQueryResult | null>;
  executeChartQuery: (
    tableName: string,
    dimension: string,
    measure: string,
    aggregation?: "sum" | "avg" | "min" | "max" | "count",
    limit?: number,
    filters?: { field: string; operator: string; value: string }[]
  ) => Promise<any[]>;
  refreshAllTables: () => Promise<void>;
  autoDetectTableChanges: (executedSQL: string) => Promise<void>;

  connectToMotherDuck: (token: string) => Promise<void>;
  disconnectFromMotherDuck: () => Promise<void>;
  executeMotherDuckQuery: (sql: string, databaseName?: string) => Promise<any>;
  refreshMotherDuckSchemas: (databaseName: string) => Promise<void>;
  getAllAvailableTables: () => Array<{
    name: string;
    source: "local" | "motherduck";
    database?: string;
  }>;
  extractTableReferences: (
    sql: string
  ) => Array<{ name: string; database?: string }>;
  transformQueryForExecution: (sql: string) => string;
  isMotherDuckQuery: (sql: string) => {
    isMotherDuck: boolean;
    targetDatabase?: string;
    localTables: string[];
    motherDuckTables: Array<{ name: string; database: string }>;
    isHybrid: boolean;
  };
  listAttachedDatabases: () => Promise<Array<{ name: string; tables: number }>>;
  detachDatabase: (databaseName: string) => Promise<void>;

  // PostgreSQL bridge actions
  connectToPostgreSQL: (connectionId: string) => Promise<void>;
  disconnectFromPostgreSQL: (connectionId: string) => Promise<void>;
  addVirtualPostgreSQLTable: (connectionId: string, table: PostgreSQLTable, columns?: Array<{ name: string; type: string }>) => void;
  removeVirtualPostgreSQLTable: (tableKey: string) => void;
  refreshPostgreSQLVirtualSchemas: (connectionId: string) => Promise<void>;
  executePostgreSQLQuery: (sql: string, connectionId: string) => Promise<any>;
  getAllAvailableTablesWithPostgreSQL: () => Array<{
    name: string;
    source: "local" | "motherduck" | "postgresql";
    database?: string;
    connectionId?: string;
    isVirtual?: boolean;
  }>;
  isPostgreSQLQuery: (sql: string) => {
    isPostgreSQL: boolean;
    targetConnection?: string;
    localTables: string[];
    postgreSQLTables: Array<{ name: string; connectionId: string; schemaName: string }>;
    isHybrid: boolean;
  };
  setPostgreSQLAutoImportThreshold: (bytes: number) => void;
  importPostgreSQLTableData: (tableKey: string, forceImport?: boolean) => Promise<void>;

  // Cloud storage methods for Parquet-first approach
  exportTableToParquet: (tableName: string) => Promise<{
    parquetBuffer: ArrayBuffer;
    schema: Array<{ cid: number; name: string; type: string; notnull: boolean; dflt_value: any; pk: number }>;
    rowCount: number;
  }>;
  importParquetWithSchema: (
    parquetFile: File, 
    preservedSchema?: Array<{ cid: number; name: string; type: string; notnull: boolean; dflt_value: any; pk: number }>
  ) => Promise<{ tableName: string; rowCount: number; schemaApplied: boolean; }>;
  importCloudFileStreaming: (
    cloudFile: File,
    fileName: string,
    fileSize: number,
    preservedSchema?: Array<{ cid: number; name: string; type: string; notnull: boolean; dflt_value: any; pk: number }>,
    onProgress?: (progress: number, status: string) => void
  ) => Promise<{ tableName: string; rowCount: number; schemaApplied: boolean; streamingUsed: boolean; }>;
  ensureTableExists: (expectedTableName: string) => Promise<string | null>;
}

export const useDuckDBStore = create<DuckDBState>((set, get) => ({
  // Initial state
  db: null,
  connection: null,
  isInitializing: false,
  isInitialized: false,
  error: null,
  registeredTables: new Map(),
  hasSampleTable: false,
  sampleTableName: "employees_sample",
  isLoading: false,
  processingProgress: 0,
  processingStatus: "",
  schemaCache: new Map(),
  lastSchemaCacheUpdate: 0,
  lastTableRefresh: 0,
  motherDuckClient: null,
  motherDuckConnected: false,
  motherDuckConnecting: false,
  motherDuckError: null,
  motherDuckDatabases: [],
  selectedMotherDuckDatabase: null,
  motherDuckSchemas: new Map(),

  // PostgreSQL initial state - Bridge to postgresStore
  postgresConnections: new Map(),
  postgresActiveConnections: new Set(),
  postgresVirtualTables: new Map(),
  postgresError: null,
  postgresSchemas: new Map(),
  postgresAutoImportThreshold: 10 * 1024 * 1024, // 10MB default threshold

  // Initialize DuckDB and create sample table
  initialize: async () => {
    if (get().isInitialized || get().isInitializing) {
      return get().isInitialized;
    }

    set({ isInitializing: true, error: null });

    try {
      const { db, conn } = await initializeDuckDB();

      set({
        db,
        connection: conn,
        isInitialized: true,
        isInitializing: false,
      });

      console.log(
        `[DuckDBStore] DuckDB initialized successfully in ${
          isDevelopment ? "development" : "production"
        } mode`
      );

      // Create sample table immediately after initialization
      await get().createSampleTable();

      return true;
    } catch (err) {
      console.error("[DuckDBStore] Failed to initialize DuckDB:", err);
      set({
        error: `Failed to initialize DuckDB: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isInitializing: false,
      });
      return false;
    }
  },

  // Create sample employees table
  createSampleTable: async () => {
    const { connection, isInitialized, sampleTableName } = get();

    if (!connection || !isInitialized) {
      throw new Error("DuckDB is not initialized");
    }

    try {
      console.log(`[DuckDBStore] Creating sample table: ${sampleTableName}`);

      // Create the sample table
      const escapedTableName = `"${sampleTableName}"`;
      const createTableSQL = `
        CREATE TABLE ${escapedTableName} (
          id INTEGER,
          name VARCHAR,
          department VARCHAR,
          salary INTEGER
        )
      `;

      await connection.query(createTableSQL);

      // Insert sample data
      const values = SAMPLE_EMPLOYEES_DATA.map(
        (row) => `(${row[0]}, '${row[1]}', '${row[2]}', ${row[3]})`
      ).join(", ");

      const insertSQL = `
        INSERT INTO ${escapedTableName} (id, name, department, salary)
        VALUES ${values}
      `;

      await connection.query(insertSQL);

      // Register the sample table
      const newTables = new Map(get().registeredTables);
      newTables.set(sampleTableName, escapedTableName);

      set({
        registeredTables: newTables,
        hasSampleTable: true,
      });

      console.log(
        `[DuckDBStore] Sample table '${sampleTableName}' created with ${SAMPLE_EMPLOYEES_DATA.length} rows`
      );

      // Refresh schema cache
      await get().refreshSchemaCache();
    } catch (err) {
      console.error(`[DuckDBStore] Failed to create sample table:`, err);
      throw err;
    }
  },

  // Refresh schema cache for all tables
  refreshSchemaCache: async () => {
    const { connection, registeredTables } = get();
    if (!connection) return;

    try {
      const newCache = new Map();

      // Create a snapshot of current tables to avoid race conditions
      const tablesToProcess = Array.from(registeredTables.entries());

      for (const [tableName, escapedName] of tablesToProcess) {
        try {
          const schemaQuery = `PRAGMA table_info(${escapedName})`;
          const result = await connection.query(schemaQuery);
          const schema = result.toArray().map((col) => ({
            name: col.name,
            type: col.type,
          }));
          newCache.set(tableName, schema);
        } catch (err) {
          console.warn(
            `[DuckDBStore] Failed to get schema for ${tableName}:`,
            err
          );
        }
      }

      // Only update state once with all the new schemas
      set((state) => ({
        schemaCache: new Map([...state.schemaCache, ...newCache]),
        lastSchemaCacheUpdate: Date.now(),
      }));

      console.log(
        `[DuckDBStore] Schema cache refreshed for ${newCache.size} tables`
      );
    } catch (err) {
      console.error(`[DuckDBStore] Failed to refresh schema cache:`, err);
    }
  },

  // Create a table with the given schema
  createTable: async (tableName, headers, columnTypes) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        throw new Error("DuckDB is not initialized");
      }
    }

    try {
      set({ isLoading: true, processingStatus: "Creating table structure..." });
      console.log(`[DuckDBStore] Creating table: ${tableName}`);
      console.log(`[DuckDBStore] Headers:`, headers);
      console.log(`[DuckDBStore] Column types:`, columnTypes);

      // Convert ColumnType to DuckDB type
      const duckDBTypeFromColumnType = (colType: ColumnType): string => {
        switch (colType) {
          case ColumnType.Number:
            return "DOUBLE";
          case ColumnType.Boolean:
            return "BOOLEAN";
          case ColumnType.Date:
            return "VARCHAR";
          case ColumnType.Array:
          case ColumnType.Object:
            return "TEXT";
          default:
            return "VARCHAR";
        }
      };

      // Generate column definitions with proper escaping
      const columnDefs = headers
        .map((header, index) => {
          const type =
            index < columnTypes.length
              ? duckDBTypeFromColumnType(columnTypes[index])
              : "VARCHAR";
          return `"${header.replace(/"/g, '""')}" ${type}`;
        })
        .join(", ");

      console.log(`[DuckDBStore] Column definitions:`, columnDefs);

      // Drop table if exists (with proper escaping)
      const escapedTableName = `"${tableName}"`;
      const dropQuery = `DROP TABLE IF EXISTS ${escapedTableName}`;
      console.log(`[DuckDBStore] Executing:`, dropQuery);
      await get().connection!.query(dropQuery);

      // Create the table (with proper escaping)
      const createQuery = `CREATE TABLE ${escapedTableName} (${columnDefs})`;
      console.log(`[DuckDBStore] Executing:`, createQuery);
      await get().connection!.query(createQuery);

      // Register the table with proper escaping
      const newTables = new Map(get().registeredTables);
      newTables.set(tableName, escapedTableName);
      set({ registeredTables: newTables });

      // Verify table creation
      const verifyQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
      console.log(`[DuckDBStore] Verifying table creation:`, verifyQuery);
      const verifyResult = await get().connection!.query(verifyQuery);
      const tables = verifyResult.toArray();
      console.log(`[DuckDBStore] Verification result:`, tables);

      if (tables.length === 0) {
        throw new Error(`Table "${tableName}" was not created successfully`);
      }

      set({ isLoading: false });
      console.log(`[DuckDBStore] Table created successfully`);

      // Refresh schema cache
      await get().refreshSchemaCache();

      return escapedTableName;
    } catch (err) {
      console.error(`[DuckDBStore] Failed to create table:`, err);
      set({
        error: `Failed to create table: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
      });
      throw err;
    }
  },

  // Insert data into a table
  insertData: async (tableName, data, onProgress) => {
    const { connection, isInitialized, registeredTables } = get();

    if (!connection || !isInitialized) {
      throw new Error("DuckDB is not initialized");
    }

    // Get the properly escaped table name
    const escapedTableName =
      registeredTables.get(tableName) || `"${tableName}"`;

    try {
      console.log(`[DuckDBStore] Starting data insertion for ${tableName}`);
      console.log(`[DuckDBStore] Total rows to insert: ${data.length}`);

      set({
        isLoading: true,
        processingStatus: `Inserting data into ${tableName}...`,
      });

      // Get table schema
      const schemaQuery = `PRAGMA table_info(${escapedTableName})`;
      console.log(`[DuckDBStore] Getting schema:`, schemaQuery);
      const schema = await connection.query(schemaQuery);
      const columnNames = schema.toArray().map((col) => col.name);
      console.log(`[DuckDBStore] Column names:`, columnNames);

      // Process in smaller batches to prevent blocking
      const batchSize = 1000;
      const totalBatches = Math.ceil(data.length / batchSize);
      let totalInserted = 0;

      console.log(
        `[DuckDBStore] Processing ${totalBatches} batches of size ${batchSize}`
      );

      for (let i = 0; i < data.length; i += batchSize) {
        const currentBatch = Math.floor(i / batchSize) + 1;
        console.log(
          `[DuckDBStore] Processing batch ${currentBatch}/${totalBatches} (rows ${
            i + 1
          }-${Math.min(i + batchSize, data.length)})`
        );

        const batch = data.slice(i, i + batchSize);

        // Format values for SQL with proper escaping
        const values = batch
          .map((row, rowIndex) => {
            try {
              // Format each value based on the column
              const formattedValues = row.map((val, colIndex) => {
                if (val === null || val === undefined || val === "") {
                  return "NULL";
                }

                // Simple type handling without relying on schema type names
                // Check if it's a number
                const num = Number(val);
                if (!isNaN(num) && val.trim() !== "") {
                  return val; // Numeric value (no quotes)
                }

                // Check if it's a boolean
                const lowerVal = val.toLowerCase();
                if (lowerVal === "true" || lowerVal === "false") {
                  return lowerVal.toUpperCase();
                }

                // Default to string with proper escaping
                return `'${val.replace(/'/g, "''")}'`;
              });

              return `(${formattedValues.join(", ")})`;
            } catch (rowErr) {
              console.error(
                `[DuckDBStore] Error formatting row ${i + rowIndex}:`,
                rowErr
              );
              throw rowErr;
            }
          })
          .join(",\n");

        if (values.length > 0) {
          const columns = columnNames.map((c) => `"${c}"`).join(", ");
          const insertSQL = `INSERT INTO ${escapedTableName} (${columns}) VALUES ${values}`;

          try {
            // Execute the insert
            await connection.query(insertSQL);
            totalInserted += batch.length;

            // Log progress every 10 batches or on last batch
            if (currentBatch % 10 === 0 || currentBatch === totalBatches) {
              console.log(
                `[DuckDBStore] Successfully inserted ${totalInserted} rows (${(
                  (totalInserted / data.length) *
                  100
                ).toFixed(1)}%)`
              );
            }

            // Update progress
            if (onProgress) {
              const progress = Math.min((i + batch.length) / data.length, 1);
              onProgress(progress);
              set({ processingProgress: progress });
            }

            // Yield control to browser after each batch
            await new Promise((resolve) => {
              requestAnimationFrame(resolve);
            });
          } catch (insertErr) {
            console.error(
              `[DuckDBStore] Error inserting batch ${currentBatch}:`,
              insertErr
            );
            console.error(
              `[DuckDBStore] Failed SQL:`,
              insertSQL.substring(0, 500) + "..."
            );
            throw insertErr;
          }
        }
      }

      // Verify final row count
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
        console.log(`[DuckDBStore] Verifying final count:`, countQuery);
        const countResult = await connection.query(countQuery);
        const count = countResult.toArray()[0].count;
        console.log(
          `[DuckDBStore] Successfully inserted ${count} rows into ${tableName} (expected: ${data.length})`
        );

        if (count !== data.length) {
          console.warn(
            `[DuckDBStore] Row count mismatch! Expected: ${data.length}, Actual: ${count}`
          );
        }
      } catch (countErr) {
        console.warn(`[DuckDBStore] Failed to get final row count:`, countErr);
      }

      set({ isLoading: false, processingProgress: 0, processingStatus: "" });
      console.log(`[DuckDBStore] Data insertion completed`);

      // Refresh schema cache
      await get().refreshSchemaCache();

      return true;
    } catch (err) {
      console.error(`[DuckDBStore] Failed to insert data into DuckDB:`, err);
      set({
        error: `Failed to insert data: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
        processingProgress: 0,
        processingStatus: "",
      });
      throw err;
    }
  },

  // Load data from a file into DuckDB
  loadData: async (data, headers, fileName, columnTypes, onProgress) => {
    try {
      // Initialize DB if needed
      if (!get().isInitialized) {
        await get().initialize();
      }

      console.log(`[DuckDBStore] Starting loadData`);
      console.log(`[DuckDBStore] File: ${fileName}`);
      console.log(
        `[DuckDBStore] Data size: ${data.length} rows x ${headers.length} columns`
      );

      // Generate table name with proper escaping
      const rawTableName = fileName
        ? `${fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_")}`
        : "imported_data";

      console.log(`[DuckDBStore] Generated table name: ${rawTableName}`);

      // Create table structure
      await get().createTable(rawTableName, headers, columnTypes);

      // Insert data
      await get().insertData(rawTableName, data, onProgress);

      console.log(`[DuckDBStore] Data loading completed successfully`);
      console.log(`[DuckDBStore] Table name for queries: "${rawTableName}"`);

      return rawTableName;
    } catch (err) {
      console.error(`[DuckDBStore] Failed to load data:`, err);
      throw err;
    }
  },

  registerTableManually: async (
    tableName: string,
    escapedTableName: string,
    options: any
  ) => {
    console.log(
      `[DuckDBStore] Manually registering: ${tableName} -> ${escapedTableName}`
    );

    const currentTables = new Map(get().registeredTables);
    currentTables.set(tableName, escapedTableName);

    set({
      registeredTables: currentTables,
      lastTableRefresh: Date.now(),
      ...options,
    });
  },

  executeQuery: async (sql) => {
    const { connection, isInitialized, registeredTables } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        set({ error: "DuckDB is not initialized" });
        return null;
      }
    }

    try {
      console.log(`[DuckDBStore] Executing query:`, sql);
      set({ isLoading: true, error: null });

      // POSTGRESQL DETECTION: Check if query references PostgreSQL tables
      const postgresTablePattern = /"([^"]+)"\."([^"]+)"/g;
      const postgresMatches = [...sql.matchAll(postgresTablePattern)];
      
      console.log(`[DuckDBStore] Query analysis:`, {
        sql: sql,
        matches: postgresMatches.length,
        patterns: postgresMatches.map(match => ({ schema: match[1], table: match[2] }))
      });
      
      if (postgresMatches.length > 0) {
        // This looks like a PostgreSQL query, try to route it
        console.log(`[DuckDBStore] Detected PostgreSQL table references:`, postgresMatches);
        
        // Find the connection for these tables
        const { postgresVirtualTables, postgresActiveConnections } = get();
        console.log(`[DuckDBStore] Available PostgreSQL state:`, {
          virtualTables: Array.from(postgresVirtualTables.entries()),
          activeConnections: Array.from(postgresActiveConnections)
        });
        
        let targetConnectionId = null;
        
        for (const [schemaName, tableName] of postgresMatches) {
          // Look for a matching virtual table
          for (const [tableKey, table] of postgresVirtualTables) {
            if (table.schemaName === schemaName && table.tableName === tableName) {
              targetConnectionId = table.connectionId;
              break;
            }
          }
          if (targetConnectionId) break;
        }
        
        if (targetConnectionId && postgresActiveConnections.has(targetConnectionId)) {
          console.log(`[DuckDBStore] Routing query to PostgreSQL connection: ${targetConnectionId}`);
          
          try {
            // Route to PostgreSQL service
            const { postgreSQLService } = await import('@/lib/api/postgresService');
            const result = await postgreSQLService.executeQuery(targetConnectionId, {
              sql: sql, // Use original SQL, not processed
              timeout: 30000,
            });
            
            set({ isLoading: false });
            
            if (result.success && result.data) {
              // Convert PostgreSQL result to DuckDB-like format
              const headers = result.columns?.map(col => col.name) || [];
              const rows = result.data || [];
              
              // Create a mock DuckDB result structure
              const mockResult = {
                toArray: () => rows,
                columns: headers,
                columnNames: headers,
                numCols: headers.length,
                numRows: rows.length,
              };
              
              console.log(`[DuckDBStore] PostgreSQL query executed successfully: ${rows.length} rows`);
              return mockResult;
            } else {
              throw new Error(result.error?.message || 'PostgreSQL query execution failed');
            }
          } catch (pgError) {
            console.error(`[DuckDBStore] PostgreSQL query execution failed:`, pgError);
            set({
              error: `PostgreSQL query error: ${
                pgError instanceof Error ? pgError.message : String(pgError)
              }`,
              isLoading: false,
            });
            return null;
          }
        }
      }

      // PRE-PROCESSING: Replace unquoted table names with quoted ones (for DuckDB)
      let processedSQL = sql;

      // Log available tables for debugging
      try {
        const tablesQuery = `SELECT name FROM sqlite_master WHERE type='table'`;
        const tablesResult = await get().connection!.query(tablesQuery);
        const tables = tablesResult.toArray();
        console.log(`[DuckDBStore] Available tables:`, tables);

        // Get all known table names
        const knownTableNames = Array.from(registeredTables.keys());

        // Replace unquoted table names with quoted versions
        for (const tableName of knownTableNames) {
          const tableNameRegex = new RegExp(
            `\\b${tableName}\\b(?=(?:[^"]*"[^"]*")*[^"]*$)`,
            "g"
          );
          const escapedName =
            registeredTables.get(tableName) || `"${tableName}"`;
          processedSQL = processedSQL.replace(tableNameRegex, escapedName);
        }

        if (processedSQL !== sql) {
          console.log(`[DuckDBStore] Processed SQL query:`, processedSQL);
        }
      } catch (tablesErr) {
        console.error(`[DuckDBStore] Could not list tables:`, tablesErr);
      }

      const result = await connection.query(processedSQL);
      set({ isLoading: false });
      console.log(`[DuckDBStore] Query executed successfully`);
      return result;
    } catch (err) {
      console.error(`[DuckDBStore] Query execution error:`, err);
      set({
        error: `Query execution error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
      });
      return null;
    }
  },

  getAvailableTables: () => {
    return Array.from(get().registeredTables.keys());
  },

  getObjectType: async (
    objectName: string
  ): Promise<"table" | "view" | null> => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      return null;
    }

    return await getObjectType(connection, objectName);
  },

  getTableSchema: async (tableName) => {
    const { connection, isInitialized, registeredTables, schemaCache, postgresVirtualTables } = get();

    if (!connection || !isInitialized) {
      return null;
    }

    // Check cache first
    if (schemaCache.has(tableName)) {
      return schemaCache.get(tableName)!;
    }

    try {
      // Check if this is a PostgreSQL virtual table
      let isPostgreSQLTable = false;
      let postgresTableInfo = null;
      
      // Check if tableName matches PostgreSQL format (schema.table)
      if (tableName.includes('.')) {
        // Look for matching PostgreSQL virtual table
        for (const [tableKey, table] of postgresVirtualTables) {
          const virtualTableName = `${table.schemaName}.${table.tableName}`;
          if (virtualTableName === tableName) {
            isPostgreSQLTable = true;
            postgresTableInfo = table;
            break;
          }
        }
      }

      let schema;
      
      if (isPostgreSQLTable && postgresTableInfo) {
        // For PostgreSQL tables, use the stored column information
        schema = postgresTableInfo.columns || [];
        console.log(`[DuckDBStore] Using cached PostgreSQL schema for ${tableName}`, schema);
      } else {
        // For local tables, use PRAGMA table_info
        const escapedTableName =
          registeredTables.get(tableName) || `"${tableName}"`;
        const schemaQuery = `PRAGMA table_info(${escapedTableName})`;
        const result = await connection.query(schemaQuery);
        schema = result.toArray().map((col) => ({
          name: col.name,
          type: col.type,
        }));
      }

      // Update cache using functional update to avoid race conditions
      set((state) => ({
        schemaCache: new Map(state.schemaCache).set(tableName, schema),
      }));

      return schema;
    } catch (err) {
      console.error(
        `[DuckDBStore] Failed to get schema for ${tableName}:`,
        err
      );
      return null;
    }
  },

  resetError: () => set({ error: null }),

  cleanupDB: async () => {
    const { db, connection } = get();

    if (connection) {
      await connection.close();
    }

    if (db) {
      await db.terminate();
    }

    cleanup();

    set({
      db: null,
      connection: null,
      isInitialized: false,
      registeredTables: new Map(),
      hasSampleTable: false,
      schemaCache: new Map(),
      lastSchemaCacheUpdate: 0,
    });
  },

  dropTable: async (tableName: string) => {
    const { connection } = get();
    
    if (!connection) {
      console.error('[DuckDBStore] Cannot drop table: no connection');
      return false;
    }

    try {
      // Create a sanitized table name for the query
      const escapedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
      
      const dropQuery = `DROP TABLE IF EXISTS "${escapedTableName}"`;
      
      if (isDevelopment) {
        console.log(`[DuckDBStore] Dropping table: ${dropQuery}`);
      }

      await connection.query(dropQuery);

      // Remove from registered tables
      const registeredTables = new Map(get().registeredTables);
      for (const [rawName, registeredName] of registeredTables) {
        if (registeredName === escapedTableName || registeredName === `"${escapedTableName}"`) {
          registeredTables.delete(rawName);
          break;
        }
      }

      // Update state
      set({ 
        registeredTables,
        lastSchemaCacheUpdate: 0  // Force schema cache refresh
      });

      if (isDevelopment) {
        console.log(`[DuckDBStore] Successfully dropped table: ${escapedTableName}`);
      }

      return true;
    } catch (error) {
      console.error(`[DuckDBStore] Failed to drop table ${tableName}:`, error);
      set({ error: `Failed to drop table: ${error}` });
      return false;
    }
  },

  dropView: async (viewName: string) => {
    const { connection } = get();
    
    if (!connection) {
      console.error('[DuckDBStore] Cannot drop view: no connection');
      return false;
    }

    try {
      // Create a sanitized view name for the query
      const escapedViewName = viewName.replace(/[^a-zA-Z0-9_]/g, '_');
      
      const dropQuery = `DROP VIEW IF EXISTS "${escapedViewName}"`;
      
      if (isDevelopment) {
        console.log(`[DuckDBStore] Dropping view: ${dropQuery}`);
      }

      await connection.query(dropQuery);

      // Remove from registered tables (views are also in this registry)
      const registeredTables = new Map(get().registeredTables);
      for (const [rawName, registeredName] of registeredTables) {
        if (registeredName === escapedViewName || registeredName === `"${escapedViewName}"`) {
          registeredTables.delete(rawName);
          break;
        }
      }

      // Update state
      set({ 
        registeredTables,
        lastSchemaCacheUpdate: 0  // Force schema cache refresh
      });

      if (isDevelopment) {
        console.log(`[DuckDBStore] Successfully dropped view: ${escapedViewName}`);
      }

      return true;
    } catch (error) {
      console.error(`[DuckDBStore] Failed to drop view ${viewName}:`, error);
      set({ error: `Failed to drop view: ${error}` });
      return false;
    }
  },

  dropTableOrView: async (objectName: string) => {
    const { connection } = get();
    
    if (!connection) {
      console.error('[DuckDBStore] Cannot drop table/view: no connection');
      return false;
    }

    try {
      // Create a sanitized name for the query
      const rawName = objectName.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // First check what type of object this is (table or view)
      const objectType = await get().getObjectType(rawName);
      
      if (objectType === 'table') {
        return await get().dropTable(rawName);
      } else if (objectType === 'view') {
        return await get().dropView(rawName);
      } else {
        // Object doesn't exist or unknown type - try both as fallback
        if (isDevelopment) {
          console.log(`[DuckDBStore] Object type unknown for ${rawName}, attempting cleanup`);
        }
        
        // Try dropping as table first, then as view
        const tableDropped = await get().dropTable(rawName);
        const viewDropped = await get().dropView(rawName);
        
        return tableDropped || viewDropped;
      }
    } catch (error) {
      console.error(`[DuckDBStore] Failed to drop table/view ${objectName}:`, error);
      set({ error: `Failed to drop table/view: ${error}` });
      return false;
    }
  },

  importFileDirectlyStreaming: async (
    fileHandle: FileSystemFileHandle,
    fileName: string,
    fileSize: number
  ) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection || !get().db) {
        throw new Error("DuckDB is not initialized");
      }
    }

    const fileExt = fileName.split(".").pop()?.toLowerCase();
    const fileSizeMB = fileSize / (1024 * 1024);

    try {
      set({
        isLoading: true,
        error: null,
        processingStatus: "Preparing to import file...",
        processingProgress: 0.1,
      });

      console.log(
        `[DuckDBStore] Hybrid import: ${fileName} (${fileSizeMB.toFixed(2)}MB)`
      );

      // Get the File object
      const file = await fileHandle.getFile();

      set({
        processingStatus: "Analyzing file for optimal import strategy...",
        processingProgress: 0.2,
      });

      // DuckDB database files - attach directly
      if (fileExt === "duckdb" || fileExt === "db") {
        set({ processingStatus: "Attaching DuckDB database file..." });

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        let attachName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        
        // Check if database with this name already exists and generate unique name if needed
        const existingTables = Array.from(get().registeredTables.keys());
        const attachedDatabases = new Set(
          existingTables
            .filter(name => name.includes('.'))
            .map(name => name.split('.')[0])
        );
        
        if (attachedDatabases.has(attachName)) {
          // Add timestamp to make it unique
          attachName = `${attachName}_${Date.now()}`;
          console.log(`[DuckDBStore] Database name conflict, using unique name: ${attachName}`);
        }

        const conn = await get().db!.connect();

        try {
          // Register the file with DuckDB
          const registeredFileName = `attach_${Date.now()}.${fileExt}`;
          await get().db!.registerFileHandle(
            registeredFileName,
            file,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            true
          );

          set({
            processingStatus: `Attaching database as '${attachName}'...`,
            processingProgress: 0.4,
          });

          // Try to detach if it already exists (shouldn't happen with unique names, but just in case)
          try {
            await conn.query(`DETACH ${attachName}`);
            console.log(`[DuckDBStore] Detached existing database: ${attachName}`);
          } catch (e) {
            // Database doesn't exist, which is expected
          }
          
          // Attach the database file
          const attachQuery = `ATTACH '${registeredFileName}' AS ${attachName} (READ_ONLY)`;
          console.log(`[DuckDBStore] Attaching database: ${attachQuery}`);
          await conn.query(attachQuery);

          set({
            processingStatus: "Discovering tables in attached database...",
            processingProgress: 0.6,
          });

          // List all tables in the attached database
          const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_catalog = '${attachName}'
            AND table_type = 'BASE TABLE'
          `;
          const tablesResult = await conn.query(tablesQuery);
          const tables = tablesResult.toArray();

          console.log(`[DuckDBStore] Found ${tables.length} tables in attached database:`, tables);

          // Register each table from the attached database
          const newTables = new Map(get().registeredTables);
          const originalBaseName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
          
          for (const table of tables) {
            const tableName = table.table_name;
            // Register with the actual attached database name
            const qualifiedName = `${attachName}.${tableName}`;
            newTables.set(qualifiedName, `"${attachName}"."${tableName}"`);
            console.log(`[DuckDBStore] Registered table: ${qualifiedName}`);
            
            // Also register with the original base name for user convenience
            if (attachName !== originalBaseName) {
              const originalQualifiedName = `${originalBaseName}.${tableName}`;
              newTables.set(originalQualifiedName, `"${attachName}"."${tableName}"`);
              console.log(`[DuckDBStore] Registered table alias: ${originalQualifiedName} -> ${attachName}.${tableName}`);
            }
          }

          await conn.close();

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `Attached database: ${tables.length} table(s) available`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();

          return {
            tableName: attachName,
            rowCount: tables.length,
            isDatabaseFile: true,
            attachedTables: tables.map(t => t.table_name),
            fileSizeMB: fileSizeMB,
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      // TXT files - analyze and convert to CSV
      if (fileExt === "txt") {
        set({ processingStatus: "Analyzing TXT file structure..." });

        const analysis = await analyzeTxtFile(file);
        console.log(`[DuckDBStore] TXT analysis:`, analysis);

        // If it's delimited (any delimiter), import directly
        if (analysis.format === "delimited_direct" && analysis.separator) {
          const delimiterName =
            {
              ",": "comma",
              "\t": "tab",
              "|": "pipe",
              ";": "semicolon",
              " ": "space",
            }[analysis.separator] || "custom";

          set({
            processingStatus: `TXT file is ${delimiterName}-delimited, importing directly...`,
          });

          const baseName = fileName.replace(/\.[^/.]+$/, "");
          const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
          const escapedTableName = `"${rawTableName}"`;

          // Clean up any existing table or view
          await get().dropTableOrView(rawTableName);

          const conn = await get().db!.connect();

          try {
            const registeredFileName = `import_${Date.now()}.csv`; // Always register as .csv for DuckDB
            await get().db!.registerFileHandle(
              registeredFileName,
              file,
              duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
              false
            );

            set({
              processingStatus: `Creating table from ${delimiterName}-delimited TXT...`,
            });

            // Try multiple approaches with the detected delimiter
            let success = false;

            // Approach 1: Explicit delimiter with strict_mode=false
            try {
              const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                header=true, 
                delim='${analysis.separator}',
                quote='"',
                escape='"',
                strict_mode=false,
                auto_detect=true,
                parallel=false
              )`;

              console.log(
                `[DuckDBStore] Trying ${delimiterName}-delimited import:`,
                createTableQuery
              );
              await conn.query(createTableQuery);
              success = true;
            } catch (err1) {
              console.log(`[DuckDBStore] Strict approach failed:`, err1);

              // Approach 2: Very permissive
              try {
                await get().connection!.query(
                  `DROP TABLE IF EXISTS ${escapedTableName}`
                );
                const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                  header=true, 
                  delim='${analysis.separator}',
                  strict_mode=false,
                  ignore_errors=true,
                  auto_detect=true,
                  parallel=false
                )`;

                console.log(
                  `[DuckDBStore] Trying permissive ${delimiterName}-delimited import:`,
                  createTableQuery
                );
                await conn.query(createTableQuery);
                success = true;
              } catch (err2) {
                console.log(`[DuckDBStore] Permissive approach failed:`, err2);

                // Approach 3: Force all varchar
                try {
                  await get().connection!.query(
                    `DROP TABLE IF EXISTS ${escapedTableName}`
                  );
                  const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                    header=true, 
                    delim='${analysis.separator}',
                    strict_mode=false,
                    ignore_errors=true,
                    all_varchar=true,
                    parallel=false
                  )`;

                  console.log(
                    `[DuckDBStore] Trying varchar-only ${delimiterName}-delimited import:`,
                    createTableQuery
                  );
                  await conn.query(createTableQuery);
                  success = true;
                } catch (err3) {
                  console.log(`[DuckDBStore] All approaches failed:`, err3);
                  throw new Error(
                    `Failed to import ${delimiterName}-delimited TXT file: ${
                      err3 instanceof Error ? err3.message : String(err3)
                    }`
                  );
                }
              }
            }

            if (!success) {
              throw new Error(
                `Failed to import ${delimiterName}-delimited TXT file`
              );
            }

            await conn.close();

            // Count rows and get column info
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            const count = countResult.toArray()[0].count;

            const columnsQuery = `PRAGMA table_info(${escapedTableName})`;
            const columnsResult = await get().connection!.query(columnsQuery);
            const columns = columnsResult.toArray();

            console.log(
              `[DuckDBStore] Successfully imported ${count} rows with ${columns.length} columns from ${delimiterName}-delimited TXT:`,
              columns.map((c) => c.name)
            );

            const newTables = new Map(get().registeredTables);
            newTables.set(rawTableName, escapedTableName);

            set({
              registeredTables: newTables,
              isLoading: false,
              processingStatus: `TXT imported: ${(
                fileSizeMB || fileSize
              ).toFixed(2)}MB table with ${count} rows, ${
                columns.length
              } columns (${delimiterName}-delimited)`,
              processingProgress: 1.0,
            });

            await get().refreshSchemaCache();
            return {
              tableName: rawTableName,
              rowCount: count,
              columnCount: columns.length,
              isView: false,
              convertedToCsv: false,
              fileSizeMB: fileSizeMB || fileSize,
              instantImport: false,
              txtFormat: "delimited_direct",
              delimiter: analysis.separator,
              delimiterName: delimiterName,
            };
          } catch (err) {
            await conn.close();
            throw err;
          }
        }

        // For single-column format, do the conversion as before
        set({ processingStatus: "Converting single-column TXT to CSV..." });

        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        // Single column format - each line becomes a row
        const csvData =
          "line_content\n" +
          lines
            .map((line) => {
              const escaped = line.trim().replace(/"/g, '""');
              return escaped.includes(",") ? `"${escaped}"` : escaped;
            })
            .join("\n");

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const csvFile = new File([csvData], `${baseName}_converted.csv`, {
          type: "text/csv",
        });

        const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        const escapedTableName = `"${rawTableName}"`;

        // Clean up any existing table or view
        await get().dropTableOrView(rawTableName);

        const conn = await get().db!.connect();

        try {
          const registeredFileName = `import_${Date.now()}.csv`;
          await get().db!.registerFileHandle(
            registeredFileName,
            csvFile,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            false
          );

          set({ processingStatus: "Creating table from single-column TXT..." });
          const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', header=true, auto_detect=true)`;
          await conn.query(createTableQuery);
          await conn.close();

          // Count rows
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;

          console.log(
            `[DuckDBStore] Successfully imported ${count} rows from single-column TXT conversion`
          );

          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `TXT converted: ${(
              fileSizeMB || fileSize
            ).toFixed(2)}MB table with ${count} rows (single-column)`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();
          return {
            tableName: rawTableName,
            rowCount: count,
            isView: false,
            convertedToCsv: true,
            fileSizeMB: fileSizeMB || fileSize,
            instantImport: false,
            txtFormat: "single_column",
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      // Excel files - handle with size limits and convert to CSV
      if (fileExt === "xlsx" || fileExt === "xls") {
        const MAX_EXCEL_SIZE = 100;
        if (fileSizeMB > MAX_EXCEL_SIZE) {
          throw new Error(
            `Excel files over ${MAX_EXCEL_SIZE}MB are not supported due to browser memory limitations. ` +
              `Current file: ${fileSizeMB.toFixed(
                2
              )}MB. Please convert to CSV or Parquet format.`
          );
        }

        set({ processingStatus: "Converting Excel file to CSV..." });
        const XLSX = await import("xlsx");
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
          type: "array",
        });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const csvFile = new File([csvData], `${baseName}_converted.csv`, {
          type: "text/csv",
        });

        const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        const escapedTableName = `"${rawTableName}"`;

        // Clean up any existing table or view
        await get().dropTableOrView(rawTableName);

        const conn = await get().db!.connect();

        try {
          const registeredFileName = `import_${Date.now()}.csv`;
          await get().db!.registerFileHandle(
            registeredFileName,
            csvFile,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            false
          );

          set({
            processingStatus: "Creating table from converted Excel data...",
          });
          const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', strict_mode=false)`;
          await conn.query(createTableQuery);
          await conn.close();

          // Count rows for Excel tables
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;

          console.log(
            `[DuckDBStore] Successfully imported ${count} rows from Excel conversion`
          );

          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `Excel converted: ${fileSizeMB.toFixed(
              2
            )}MB table with ${count} rows`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();
          return {
            tableName: rawTableName,
            rowCount: count,
            isView: false,
            convertedToCsv: true,
            fileSizeMB: fileSizeMB,
            instantImport: false,
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      // For all other file types - use HYBRID approach based on file size
      const rawTableName = fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_]/g, "_");
      const escapedTableName = `"${rawTableName}"`;

      // Clean up any existing table/view - check what type exists first
      try {
        const objectType = await get().getObjectType(rawTableName);
        if (objectType === 'table') {
          await get().connection!.query(`DROP TABLE IF EXISTS ${escapedTableName}`);
        } else if (objectType === 'view') {
          await get().connection!.query(`DROP VIEW IF EXISTS ${escapedTableName}`);
        }
      } catch (cleanupError) {
        console.warn(`[DuckDBStore] Error during cleanup for ${rawTableName}:`, cleanupError);
        // Fallback to both commands if object type detection fails
        try {
          await get().connection!.query(`DROP TABLE IF EXISTS ${escapedTableName}`);
        } catch (e) {
          try {
            await get().connection!.query(`DROP VIEW IF EXISTS ${escapedTableName}`);
          } catch (e2) {
            console.warn(`[DuckDBStore] Both cleanup attempts failed for ${rawTableName}`);
          }
        }
      }
      set({ processingProgress: 0.3 });

      const conn = await get().db!.connect();

      try {
        const registeredFileName = `hybrid_${Date.now()}.${fileExt}`;

        console.log(
          `[DuckDBStore] Registering file: ${registeredFileName} (${fileSizeMB.toFixed(
            2
          )}MB)`
        );

        // Register the file with DuckDB
        await get().db!.registerFileHandle(
          registeredFileName,
          file,
          duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
          true
        );

        set({ processingProgress: 0.5 });
        console.log(`[DuckDBStore] File registered successfully`);

        // HYBRID APPROACH: Table for ≤500MB, View for >500MB
        const useTableApproach = fileSizeMB <= 500;

        let createQuery = "";
        const queryType = useTableApproach ? "TABLE" : "VIEW";

        if (fileExt === "csv") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating CSV table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating CSV TABLE for files ≤500MB`);

            await importCsvWithFallback(
              conn,
              escapedTableName,
              registeredFileName,
              true
            );
          } else {
            set({
              processingStatus: `Creating instant CSV view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating CSV VIEW for files >500MB`);

            await createCsvViewWithFallback(
              conn,
              escapedTableName,
              registeredFileName
            );
          }
        } else if (fileExt === "json") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating JSON table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating JSON TABLE for files ≤500MB`);

            await importJsonWithFallback(
              conn,
              escapedTableName,
              registeredFileName,
              true
            );
          } else {
            set({
              processingStatus: `Creating instant JSON view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating JSON VIEW for files >500MB`);

            await createJsonViewWithFallback(
              conn,
              escapedTableName,
              registeredFileName
            );
          }
        } else if (fileExt === "parquet") {
          if (useTableApproach) {
            set({
              processingStatus: `Creating Parquet table (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(
              `[DuckDBStore] Creating Parquet TABLE for files ≤500MB`
            );
            createQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_parquet('${registeredFileName}')`;
          } else {
            set({
              processingStatus: `Creating instant Parquet view (${fileSizeMB.toFixed(
                2
              )}MB)...`,
            });
            console.log(`[DuckDBStore] Creating Parquet VIEW for files >500MB`);
            createQuery = `CREATE VIEW ${escapedTableName} AS SELECT * FROM read_parquet('${registeredFileName}')`;
          }
        } else {
          throw new Error(`Unsupported file type: ${fileExt}`);
        }

        console.log(
          `[DuckDBStore] Executing ${queryType} creation (${
            useTableApproach ? "table" : "view"
          } approach)`
        );
        set({ processingProgress: 0.7 });

        // Execute the table/view creation
        await conn.query(createQuery);

        set({ processingProgress: 0.85 });
        await conn.close();

        // Handle row counting based on approach
        let rowCount = null;
        let statusMessage = "";

        if (useTableApproach) {
          set({ processingStatus: "Verifying table and counting rows..." });
          console.log(`[DuckDBStore] Counting rows for table approach`);

          try {
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            rowCount = countResult.toArray()[0].count;

            console.log(
              `[DuckDBStore] TABLE created with ${rowCount} rows: ${rawTableName} (${fileSizeMB.toFixed(
                2
              )}MB ${fileExt})`
            );
            statusMessage = `Table created: ${fileSizeMB.toFixed(
              2
            )}MB ${fileExt.toUpperCase()} with ${rowCount} rows`;
          } catch (countErr) {
            console.error(`[DuckDBStore] Error counting rows:`, countErr);
            throw new Error(
              "Error verifying table. The table may be empty or corrupted."
            );
          }
        } else {
          console.log(
            `[DuckDBStore] VIEW created instantly: ${rawTableName} (${fileSizeMB.toFixed(
              2
            )}MB ${fileExt})`
          );
          statusMessage = `View created: ${fileSizeMB.toFixed(
            2
          )}MB ${fileExt.toUpperCase()} file ready to query`;
        }

        set({ processingProgress: 0.95 });

        // Register the table/view in our store
        const newTables = new Map(get().registeredTables);
        newTables.set(rawTableName, escapedTableName);

        set({
          registeredTables: newTables,
          isLoading: false,
          processingStatus: statusMessage,
          processingProgress: 1.0,
        });

        await get().refreshSchemaCache();

        return {
          tableName: rawTableName,
          rowCount: rowCount,
          isView: !useTableApproach,
          fileSizeMB: fileSizeMB,
          fileType: fileExt,
          instantImport: !useTableApproach,
        };
      } catch (err) {
        if (conn) await conn.close();
        throw err;
      }
    } catch (err) {
      console.error(`[DuckDBStore] Hybrid import failed:`, err);

      let errorMessage = err instanceof Error ? err.message : String(err);

      // Enhanced error messages
      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();

        if (
          errMsg.includes("call stack") ||
          errMsg.includes("maximum call stack")
        ) {
          errorMessage =
            `File structure too complex for ${fileSizeMB.toFixed(2)}MB file. ` +
            `Try converting to Parquet format or simplifying the file structure.`;
        } else if (
          errMsg.includes("memory") ||
          errMsg.includes("out of bounds")
        ) {
          if (fileSizeMB <= 500) {
            errorMessage =
              `Memory limit exceeded with ${fileSizeMB.toFixed(
                2
              )}MB file during table creation. ` +
              `Try using a device with more RAM or the file may be too complex for table import.`;
          } else {
            errorMessage =
              `Memory limit exceeded with ${fileSizeMB.toFixed(2)}MB file. ` +
              `Try using a device with more RAM or converting to Parquet format.`;
          }
        } else if (errMsg.includes("worker") || errMsg.includes("terminate")) {
          errorMessage =
            `Browser crashed processing ${fileSizeMB.toFixed(2)}MB file. ` +
            `File may be corrupted or too complex for browser processing.`;
        } else if (
          errMsg.includes("unsupported") ||
          errMsg.includes("format")
        ) {
          errorMessage =
            `File format not supported or file may be corrupted. ` +
            `Supported formats: CSV, JSON, Parquet, Excel (.xlsx/.xls), TXT, DuckDB (.duckdb/.db).`;
        }
      }

      set({
        error: `Import failed: ${errorMessage}`,
        isLoading: false,
        processingProgress: 0,
        processingStatus: "Import failed",
      });

      throw err;
    }
  },

  importFileDirectly: async (file: File) => {
    const { connection, isInitialized } = get();

    // Initialize if needed
    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection || !get().db) {
        throw new Error("DuckDB is not initialized");
      }
    }

    try {
      set({
        isLoading: true,
        error: null,
        processingStatus: "Preparing to import file...",
        processingProgress: 0.1,
      });

      // Get file extension and size
      const fileName = file.name;
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileSize = file.size / (1024 * 1024); // Size in MB
      console.log(
        `[DuckDBStore] Importing file: ${file.name} (${fileSize.toFixed(2)} MB)`
      );

      // DuckDB database files - attach directly
      if (fileExt === "duckdb" || fileExt === "db") {
        set({ processingStatus: "Attaching DuckDB database file..." });

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        let attachName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        
        // Check if database with this name already exists and generate unique name if needed
        const existingTables = Array.from(get().registeredTables.keys());
        const attachedDatabases = new Set(
          existingTables
            .filter(name => name.includes('.'))
            .map(name => name.split('.')[0])
        );
        
        if (attachedDatabases.has(attachName)) {
          // Add timestamp to make it unique
          attachName = `${attachName}_${Date.now()}`;
          console.log(`[DuckDBStore] Database name conflict, using unique name: ${attachName}`);
        }

        const conn = await get().db!.connect();

        try {
          // Register the file with DuckDB
          const registeredFileName = `attach_${Date.now()}.${fileExt}`;
          await get().db!.registerFileHandle(
            registeredFileName,
            file,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            true
          );

          set({
            processingStatus: `Attaching database as '${attachName}'...`,
            processingProgress: 0.4,
          });

          // Try to detach if it already exists (shouldn't happen with unique names, but just in case)
          try {
            await conn.query(`DETACH ${attachName}`);
            console.log(`[DuckDBStore] Detached existing database: ${attachName}`);
          } catch (e) {
            // Database doesn't exist, which is expected
          }
          
          // Attach the database file
          const attachQuery = `ATTACH '${registeredFileName}' AS ${attachName} (READ_ONLY)`;
          console.log(`[DuckDBStore] Attaching database: ${attachQuery}`);
          await conn.query(attachQuery);

          set({
            processingStatus: "Discovering tables in attached database...",
            processingProgress: 0.6,
          });

          // List all tables in the attached database
          const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_catalog = '${attachName}'
            AND table_type = 'BASE TABLE'
          `;
          const tablesResult = await conn.query(tablesQuery);
          const tables = tablesResult.toArray();

          console.log(`[DuckDBStore] Found ${tables.length} tables in attached database:`, tables);

          // Register each table from the attached database
          const newTables = new Map(get().registeredTables);
          const originalBaseName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
          
          for (const table of tables) {
            const tableName = table.table_name;
            // Register with the actual attached database name
            const qualifiedName = `${attachName}.${tableName}`;
            newTables.set(qualifiedName, `"${attachName}"."${tableName}"`);
            console.log(`[DuckDBStore] Registered table: ${qualifiedName}`);
            
            // Also register with the original base name for user convenience
            if (attachName !== originalBaseName) {
              const originalQualifiedName = `${originalBaseName}.${tableName}`;
              newTables.set(originalQualifiedName, `"${attachName}"."${tableName}"`);
              console.log(`[DuckDBStore] Registered table alias: ${originalQualifiedName} -> ${attachName}.${tableName}`);
            }
          }

          await conn.close();

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `Attached database: ${tables.length} table(s) available`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();

          return {
            tableName: attachName,
            rowCount: tables.length,
            isDatabaseFile: true,
            attachedTables: tables.map(t => t.table_name),
            fileSizeMB: fileSize,
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      if (fileExt === "txt") {
        set({ processingStatus: "Analyzing TXT file structure..." });

        const analysis = await analyzeTxtFile(file);
        console.log(`[DuckDBStore] TXT analysis:`, analysis);

        // If it's delimited (any delimiter), import directly
        if (analysis.format === "delimited_direct" && analysis.separator) {
          const delimiterName =
            {
              ",": "comma",
              "\t": "tab",
              "|": "pipe",
              ";": "semicolon",
              " ": "space",
            }[analysis.separator] || "custom";

          set({
            processingStatus: `TXT file is ${delimiterName}-delimited, importing directly...`,
          });

          const baseName = fileName.replace(/\.[^/.]+$/, "");
          const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
          const escapedTableName = `"${rawTableName}"`;

          // Clean up any existing table or view
          await get().dropTableOrView(rawTableName);

          const conn = await get().db!.connect();

          try {
            const registeredFileName = `import_${Date.now()}.csv`; // Always register as .csv for DuckDB
            await get().db!.registerFileHandle(
              registeredFileName,
              file,
              duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
              false
            );

            set({
              processingStatus: `Creating table from ${delimiterName}-delimited TXT...`,
            });

            // Try multiple approaches with the detected delimiter
            let success = false;

            // Approach 1: Explicit delimiter with strict_mode=false
            try {
              const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                header=true, 
                delim='${analysis.separator}',
                quote='"',
                escape='"',
                strict_mode=false,
                auto_detect=true,
                parallel=false
              )`;

              console.log(
                `[DuckDBStore] Trying ${delimiterName}-delimited import:`,
                createTableQuery
              );
              await conn.query(createTableQuery);
              success = true;
            } catch (err1) {
              console.log(`[DuckDBStore] Strict approach failed:`, err1);

              // Approach 2: Very permissive
              try {
                await get().connection!.query(
                  `DROP TABLE IF EXISTS ${escapedTableName}`
                );
                const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                  header=true, 
                  delim='${analysis.separator}',
                  strict_mode=false,
                  ignore_errors=true,
                  auto_detect=true,
                  parallel=false
                )`;

                console.log(
                  `[DuckDBStore] Trying permissive ${delimiterName}-delimited import:`,
                  createTableQuery
                );
                await conn.query(createTableQuery);
                success = true;
              } catch (err2) {
                console.log(`[DuckDBStore] Permissive approach failed:`, err2);

                // Approach 3: Force all varchar
                try {
                  await get().connection!.query(
                    `DROP TABLE IF EXISTS ${escapedTableName}`
                  );
                  const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', 
                    header=true, 
                    delim='${analysis.separator}',
                    strict_mode=false,
                    ignore_errors=true,
                    all_varchar=true,
                    parallel=false
                  )`;

                  console.log(
                    `[DuckDBStore] Trying varchar-only ${delimiterName}-delimited import:`,
                    createTableQuery
                  );
                  await conn.query(createTableQuery);
                  success = true;
                } catch (err3) {
                  console.log(`[DuckDBStore] All approaches failed:`, err3);
                  throw new Error(
                    `Failed to import ${delimiterName}-delimited TXT file: ${
                      err3 instanceof Error ? err3.message : String(err3)
                    }`
                  );
                }
              }
            }

            if (!success) {
              throw new Error(
                `Failed to import ${delimiterName}-delimited TXT file`
              );
            }

            await conn.close();

            // Count rows and get column info
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            const count = countResult.toArray()[0].count;

            const columnsQuery = `PRAGMA table_info(${escapedTableName})`;
            const columnsResult = await get().connection!.query(columnsQuery);
            const columns = columnsResult.toArray();

            console.log(
              `[DuckDBStore] Successfully imported ${count} rows with ${columns.length} columns from ${delimiterName}-delimited TXT:`,
              columns.map((c) => c.name)
            );

            const newTables = new Map(get().registeredTables);
            newTables.set(rawTableName, escapedTableName);

            set({
              registeredTables: newTables,
              isLoading: false,
              processingStatus: `TXT imported: ${(fileSize || fileSize).toFixed(
                2
              )}MB table with ${count} rows, ${
                columns.length
              } columns (${delimiterName}-delimited)`,
              processingProgress: 1.0,
            });

            await get().refreshSchemaCache();
            return {
              tableName: rawTableName,
              rowCount: count,
              columnCount: columns.length,
              isView: false,
              convertedToCsv: false,
              fileSizeMB: fileSize,
              instantImport: false,
              txtFormat: "delimited_direct",
              delimiter: analysis.separator,
              delimiterName: delimiterName,
            };
          } catch (err) {
            await conn.close();
            throw err;
          }
        }

        // For single-column format, do the conversion as before
        set({ processingStatus: "Converting single-column TXT to CSV..." });

        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        // Single column format - each line becomes a row
        const csvData =
          "line_content\n" +
          lines
            .map((line) => {
              const escaped = line.trim().replace(/"/g, '""');
              return escaped.includes(",") ? `"${escaped}"` : escaped;
            })
            .join("\n");

        const baseName = fileName.replace(/\.[^/.]+$/, "");
        const csvFile = new File([csvData], `${baseName}_converted.csv`, {
          type: "text/csv",
        });

        const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
        const escapedTableName = `"${rawTableName}"`;

        // Clean up any existing table or view
        await get().dropTableOrView(rawTableName);

        const conn = await get().db!.connect();

        try {
          const registeredFileName = `import_${Date.now()}.csv`;
          await get().db!.registerFileHandle(
            registeredFileName,
            csvFile,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            false
          );

          set({ processingStatus: "Creating table from single-column TXT..." });
          const createTableQuery = `CREATE TABLE ${escapedTableName} AS SELECT * FROM read_csv('${registeredFileName}', header=true, auto_detect=true)`;
          await conn.query(createTableQuery);
          await conn.close();

          // Count rows
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;

          console.log(
            `[DuckDBStore] Successfully imported ${count} rows from single-column TXT conversion`
          );

          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: `TXT converted: ${fileSize.toFixed(
              2
            )}MB table with ${count} rows (single-column)`,
            processingProgress: 1.0,
          });

          await get().refreshSchemaCache();
          return {
            tableName: rawTableName,
            rowCount: count,
            isView: false,
            convertedToCsv: true,
            fileSizeMB: fileSize,
            instantImport: false,
            txtFormat: "single_column",
          };
        } catch (err) {
          await conn.close();
          throw err;
        }
      }

      // For Excel files larger than 2MB, use SheetJS conversion
      if (fileExt === "xlsx" || fileExt === "xls") {
        try {
          set({
            processingStatus: "Converting Excel file to CSV format...",
            processingProgress: 0.15,
          });

          // Dynamically import SheetJS to avoid loading it unless needed
          const XLSX = await import("xlsx");

          // Read the Excel file
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);

          set({ processingProgress: 0.3 });
          console.log(`[DuckDBStore] Parsing Excel file with SheetJS`);

          // Parse the workbook
          const workbook = XLSX.read(data, { type: "array" });

          // Get the first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          set({
            processingStatus: `Converting Excel sheet "${firstSheetName}" to CSV...`,
            processingProgress: 0.5,
          });

          // Convert to CSV
          const csvData = XLSX.utils.sheet_to_csv(worksheet);

          // Create a CSV File object
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const csvFileName = `${baseName}_converted.csv`;
          const csvBlob = new Blob([csvData], { type: "text/csv" });
          const csvFile = new File([csvBlob], csvFileName, {
            type: "text/csv",
          });

          set({
            processingStatus: "Importing converted CSV data...",
            processingProgress: 0.6,
          });

          // Now proceed with normal CSV import for the converted file
          // Generate a safe table name from the original file name
          const rawTableName = baseName.replace(/[^a-zA-Z0-9_]/g, "_");
          const escapedTableName = `"${rawTableName}"`;

          // Drop existing table if any
          const dropQuery = `DROP TABLE IF EXISTS ${escapedTableName}`;
          await get().connection!.query(dropQuery);

          // Create a temporary connection for this operation
          const conn = await get().db!.connect();

          try {
            // Register the CSV file with DuckDB
            const registeredFileName = `import_${Date.now()}.csv`;

            await get().db!.registerFileHandle(
              registeredFileName,
              csvFile,
              duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
              false
            );

            set({ processingProgress: 0.7 });

            // Import the CSV
            const createTableQuery = `
              CREATE TABLE ${escapedTableName} AS 
              SELECT * FROM read_csv_auto('${registeredFileName}', header=true, auto_detect=true)
            `;

            console.log(`[DuckDBStore] Importing converted CSV data`);
            await conn.query(createTableQuery);

            // Close the temporary connection
            await conn.close();

            // Verify the import
            const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
            const countResult = await get().connection!.query(countQuery);
            const count = countResult.toArray()[0].count;

            console.log(
              `[DuckDBStore] Successfully imported ${count} rows from Excel via CSV conversion`
            );

            // Register the table in our store
            const newTables = new Map(get().registeredTables);
            newTables.set(rawTableName, escapedTableName);

            set({
              registeredTables: newTables,
              isLoading: false,
              processingStatus: `Import complete (converted from Excel to CSV)`,
              processingProgress: 1.0,
            });

            // Refresh schema cache
            await get().refreshSchemaCache();

            return {
              tableName: rawTableName,
              rowCount: count,
              originalFormat: fileExt,
              convertedToCsv: true,
            };
          } catch (err) {
            // Make sure to close the connection on error
            await conn.close();
            throw err;
          }
        } catch (convErr) {
          console.error(`[DuckDBStore] Excel conversion failed:`, convErr);
          throw new Error(
            `Excel conversion failed: ${
              convErr instanceof Error ? convErr.message : String(convErr)
            }`
          );
        }
      }

      // Generate a safe table name from the file name
      const rawTableName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_]/g, "_");

      const escapedTableName = `"${rawTableName}"`;
      console.log(
        `[DuckDBStore] Importing file directly as table: ${rawTableName}`
      );

      // Clean up any existing table or view
      await get().dropTableOrView(rawTableName);
      set({ processingProgress: 0.2 });

      // Create a temporary connection for this operation
      const conn = await get().db!.connect();

      try {
        // Register the file with DuckDB
        const fileName = `import_${Date.now()}.${fileExt}`;

        await get().db!.registerFileHandle(
          fileName,
          file,
          duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
          true
        );

        set({ processingProgress: 0.4 });
        console.log(`[DuckDBStore] File registered with DuckDB as ${fileName}`);

        if (fileExt === "csv") {
          set({ processingStatus: "Importing CSV file..." });
          console.log(`[DuckDBStore] Creating table from CSV file`);

          await importCsvWithFallback(conn, escapedTableName, fileName, false);
        } else if (fileExt === "json") {
          set({ processingStatus: "Importing JSON file..." });
          console.log(`[DuckDBStore] Creating table from JSON file`);

          await importJsonWithFallback(conn, escapedTableName, fileName, false);
        } else if (fileExt === "parquet") {
          set({ processingStatus: "Importing Parquet file..." });
          const createTableQuery = `
            CREATE TABLE ${escapedTableName} AS 
            SELECT * FROM read_parquet('${fileName}')
          `;
          console.log(`[DuckDBStore] Creating table from Parquet file`);
          await conn.query(createTableQuery);
        } else {
          throw new Error(`Unsupported file type: ${fileExt}`);
        }

        set({ processingProgress: 0.9 });

        // Close the temporary connection
        await conn.close();

        // Verify the import
        try {
          const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
          console.log(
            `[DuckDBStore] Verifying import with query: ${countQuery}`
          );
          const countResult = await get().connection!.query(countQuery);
          const count = countResult.toArray()[0].count;
          console.log(
            `[DuckDBStore] Successfully imported table with ${count} rows`
          );

          // Register the table in our store
          const newTables = new Map(get().registeredTables);
          newTables.set(rawTableName, escapedTableName);

          set({
            registeredTables: newTables,
            isLoading: false,
            processingStatus: "Import complete",
            processingProgress: 1.0,
          });

          // Refresh schema cache
          await get().refreshSchemaCache();

          return {
            tableName: rawTableName,
            rowCount: count,
          };
        } catch (countErr) {
          console.error(`[DuckDBStore] Error verifying import:`, countErr);
          throw new Error(
            "Error verifying import. The table may be empty or corrupted."
          );
        }
      } catch (err) {
        // Make sure to close the connection on error
        if (conn) {
          await conn.close();
        }
        throw err;
      }
    } catch (err) {
      console.error(`[DuckDBStore] Direct file import failed:`, err);

      // Provide clearer error messages based on common failures
      let errorMessage = `Import failed: ${
        err instanceof Error ? err.message : String(err)
      }`;

      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();

        if (errMsg.includes("memory") || errMsg.includes("out of bounds")) {
          errorMessage =
            "Import failed: The file is too large for browser memory limits. Try a smaller file or convert Excel to CSV format.";
        } else if (
          errMsg.includes("function") ||
          errMsg.includes("signature")
        ) {
          errorMessage =
            "Import failed: This operation is not supported in the browser version of DuckDB. Try a different approach or convert to CSV.";
        } else if (errMsg.includes("xlsx") || errMsg.includes("excel")) {
          errorMessage =
            "Excel import failed: Excel files are challenging to process in browsers. For best results, convert to CSV format.";
        }
      }

      set({
        error: errorMessage,
        isLoading: false,
        processingProgress: 0,
        processingStatus: "Import failed",
      });
      throw err;
    }
  },

  /**
   * Execute a SQL query with pagination
   */

  executePaginatedQuery: async (
    sql: string,
    page: number,
    pageSize: number,
    applyPagination: boolean = true,
    countTotalRows: boolean = true
  ) => {
    const {
      connection,
      isInitialized,
      registeredTables,
      motherDuckConnected,
      motherDuckClient,
    } = get();

    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection) {
        set({ error: "DuckDB is not initialized" });
        return null;
      }
    }

    try {
      set({ isLoading: true, error: null });
      
      // QUERY ROUTING: Use unified query router to determine execution target
      const { postgresVirtualTables, postgresActiveConnections } = get();
      const { analyzeQuery } = await import('@/lib/duckdb/utils/queryRouter');
      
      const routingResult = analyzeQuery(
        sql,
        postgresVirtualTables,
        postgresActiveConnections,
        new Set() // TODO: Add MotherDuck databases when available
      );
      
      console.log(`[DuckDBStore] Paginated query routing analysis:`, {
        sql: sql,
        target: routingResult.target,
        confidence: routingResult.confidence,
        reasoning: routingResult.reasoning,
        postgresqlTables: routingResult.postgresqlTables,
        connectionId: routingResult.connectionId
      });
      
      if (routingResult.target === 'postgresql' && routingResult.connectionId) {
        console.log(`[DuckDBStore] Routing paginated query to PostgreSQL connection: ${routingResult.connectionId}`);
        
        try {
          // Route to PostgreSQL service with pagination
          const { postgreSQLService } = await import('@/lib/api/postgresService');
          
          // Add pagination to PostgreSQL query if requested
          let paginatedSql = sql;
          if (applyPagination) {
            // Use the proper pagination utility that handles SQL syntax correctly
            const { addLimitIfMissing } = await import('@/lib/duckdb/query/pagination');
            paginatedSql = addLimitIfMissing(sql, page, pageSize);
          }
          
          const result = await postgreSQLService.executeQuery(routingResult.connectionId, {
            sql: paginatedSql,
            timeout: 30000,
          });
          
          set({ isLoading: false });
          
          if (result.success && result.data) {
            // Convert PostgreSQL result to paginated format
            const headers = result.columns?.map(col => col.name) || [];
            const rows = result.data || [];
            
            // Create a mock paginated result structure
            const paginatedResult: PaginatedQueryResult = {
              data: rows,
              columns: headers,
              totalRows: countTotalRows ? rows.length : -1, // -1 indicates unknown for PostgreSQL
              page: page,
              pageSize: pageSize,
              totalPages: countTotalRows ? Math.ceil(rows.length / pageSize) : -1,
            };
            
            console.log(`[DuckDBStore] PostgreSQL paginated query executed successfully: ${rows.length} rows`);
            return paginatedResult;
          } else {
            throw new Error(result.error?.message || 'PostgreSQL query execution failed');
          }
        } catch (pgError) {
          console.error(`[DuckDBStore] PostgreSQL paginated query execution failed:`, pgError);
          set({
            error: `PostgreSQL query error: ${
              pgError instanceof Error ? pgError.message : String(pgError)
            }`,
            isLoading: false,
          });
          throw pgError;
        }
      } else if (routingResult.target === 'hybrid') {
        set({ isLoading: false });
        throw new Error(`Cross-database query not supported yet!\n\n${routingResult.reasoning}`);
      }
      
      const transformedSql = get().transformQueryForExecution(sql);

      // SMART DETECTION: Analyze the query to determine execution target
      const queryAnalysis = get().isMotherDuckQuery(transformedSql);

      console.log("[DuckDBStore] Query analysis:", {
        isMotherDuck: queryAnalysis.isMotherDuck,
        isHybrid: queryAnalysis.isHybrid,
        targetDatabase: queryAnalysis.targetDatabase,
        localTables: queryAnalysis.localTables,
        motherDuckTables: queryAnalysis.motherDuckTables,
      });

      // Handle hybrid queries
      if (queryAnalysis.isHybrid) {
        set({ isLoading: false });
        throw new Error(
          `Cross-database query detected!\n\n` +
            `This query references both local and MotherDuck tables:\n` +
            `• Local: ${queryAnalysis.localTables.join(", ")}\n` +
            `• MotherDuck: ${queryAnalysis.motherDuckTables
              .map((t) => `${t.database}.${t.name}`)
              .join(", ")}\n\n` +
            `DataKit will support cross database queries in future.\n` +
            `Please run separate queries for each database.`
        );
      }

      // Execute in MotherDuck if it's a MotherDuck query
      if (
        queryAnalysis.isMotherDuck &&
        motherDuckConnected &&
        motherDuckClient
      ) {
        console.log(
          `[DuckDBStore] Executing in MotherDuck (database: ${queryAnalysis.targetDatabase})`
        );
        console.log(`[DuckDBStore] Original SQL: "${sql}"`);
        console.log(`[DuckDBStore] Executing SQL: "${transformedSql}"`);

        // Check if this is a DDL statement (CREATE/DROP/ALTER)
        const isDDL = /^\s*(CREATE|DROP|ALTER)\s+/i.test(transformedSql);

        if (isDDL) {
          console.log(
            `[DuckDBStore] DDL detected - executing without pagination`
          );

          const startTime = Date.now();
          const result = await get().executeMotherDuckQuery(
            transformedSql,
            queryAnalysis.targetDatabase
          );
          const queryTime = Date.now() - startTime;

          // DDL operations typically don't return data
          set({ isLoading: false });

          // Trigger schema refresh if it was a successful DDL operation
          if (queryAnalysis.targetDatabase) {
            setTimeout(() => {
              get().refreshMotherDuckSchemas(queryAnalysis.targetDatabase!);
            }, 500);
          }

          return {
            data: [],
            columns: [],
            totalRows: 0,
            totalPages: 1,
            currentPage: 1,
            pageSize: pageSize,
            queryTime,
          };
        }

        // For non-DDL queries, continue with pagination logic
        const userHasLimit = hasLimitClause(transformedSql);
        console.log(`[DuckDBStore] hasLimitClause() returned: ${userHasLimit}`);
        console.log(
          `[DuckDBStore] Current page: ${page}, pageSize: ${pageSize}`
        );

        if (userHasLimit) {
          console.log(`[DuckDBStore] BRANCH: User has LIMIT - executing as-is`);

          const startTime = Date.now();
          const result = await get().executeMotherDuckQuery(
            transformedSql,
            queryAnalysis.targetDatabase
          );
          const queryTime = Date.now() - startTime;

          const columns =
            result && result.length > 0 ? Object.keys(result[0]) : [];

          set({ isLoading: false });

          return {
            data: Array.isArray(result) ? result : [],
            columns,
            totalRows: result.length,
            totalPages: 1,
            currentPage: 1,
            pageSize: result.length,
            queryTime,
          };
        } else {
          console.log(
            `[DuckDBStore] BRANCH: No LIMIT found - applying pagination`
          );

          const paginatedSql = addLimitIfMissing(transformedSql, page, pageSize);
          console.log(
            `[DuckDBStore] addLimitIfMissing() returned: "${paginatedSql}"`
          );

          const startTime = Date.now();
          const result = await get().executeMotherDuckQuery(
            paginatedSql,
            queryAnalysis.targetDatabase
          );
          const queryTime = Date.now() - startTime;

          // Get total count for pagination
          let totalRows = result ? result.length : 0;
          try {
            let cleanSql = sql.trim();
            if (cleanSql.endsWith(";")) {
              cleanSql = cleanSql.slice(0, -1).trim();
            }

            const countQuery = cleanSql.replace(
              /SELECT\s+.*?\s+FROM/i,
              "SELECT COUNT(*) as total FROM"
            );
            console.log(`[DuckDBStore] Count query: ${countQuery}`);

            const countResult = await get().executeMotherDuckQuery(
              countQuery,
              queryAnalysis.targetDatabase
            );
            if (countResult && countResult[0]) {
              const rawTotal = countResult[0].total;
              totalRows =
                typeof rawTotal === "bigint"
                  ? Number(rawTotal)
                  : rawTotal || result.length;
              console.log(`[DuckDBStore] Total rows from count: ${totalRows}`);
            }
          } catch (countErr) {
            console.warn("[DuckDBStore] Failed to get total count:", countErr);
            totalRows = result.length;
          }

          const columns =
            result && result.length > 0 ? Object.keys(result[0]) : [];

          set({ isLoading: false });

          return {
            data: Array.isArray(result) ? result : [],
            columns,
            totalRows: totalRows,
            totalPages: Math.ceil(totalRows / pageSize),
            currentPage: page,
            pageSize: pageSize,
            queryTime,
          };
        }
      }

      // Check if query references unknown MotherDuck tables but not connected
      else if (
        queryAnalysis.motherDuckTables.length > 0 &&
        !motherDuckConnected
      ) {
        set({ isLoading: false });
        throw new Error(
          `This query references MotherDuck tables but you're not connected:\n` +
            `${queryAnalysis.motherDuckTables
              .map((t) => `• ${t.database}.${t.name}`)
              .join("\n")}\n\n` +
            `Please connect to MotherDuck first.`
        );
      }

      // Execute locally
      else {
        console.log("[DuckDBStore] Executing locally");
        const result = await executePaginatedQuery(
          {
            sql: transformedSql,
            page,
            pageSize,
            applyPagination,
            countTotalRows,
          },
          connection,
          registeredTables
        );

        if (page === 1) {
          try {
            await get().autoDetectTableChanges(sql);
          } catch (autoDetectErr) {
            console.warn("[DuckDBStore] Auto-detection failed:", autoDetectErr);
          }
        }

        set({ isLoading: false });
        return result;
      }
    } catch (err) {
      console.error(`[DuckDBStore] Paginated query execution error:`, err);
      set({
        error: `Query execution error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        isLoading: false,
      });
      throw err;
    }
  },

  extractTableReferences: (sql: string) => {
    const references: Array<{ name: string; database?: string }> = [];

    // Patterns to match table references in different SQL clauses
    const patterns = [
      // FROM/JOIN with optional database qualification
      /(?:FROM|JOIN)\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))(?:\s+(?:AS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*))?/gi,
      // INSERT INTO
      /INSERT\s+INTO\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))(?:\s+(?:AS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*))?/gi,
      // UPDATE
      /UPDATE\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))(?:\s+(?:AS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*))?/gi,
      // CREATE TABLE/VIEW with database qualification
      /CREATE\s+(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
      // DROP TABLE/VIEW with database qualification
      /DROP\s+(?:TABLE|VIEW)\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
      // ALTER TABLE
      /ALTER\s+TABLE\s+(?:"([^"]+)"\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(sql)) !== null) {
        const [, database, quotedTable, unquotedTable] = match;
        const tableName = quotedTable || unquotedTable;

        if (tableName) {
          // Handle case where table name contains a dot (e.g., "store.products")
          // This could be interpreted as database.table format
          if (!database && tableName.includes('.')) {
            const [possibleDb, ...tableNameParts] = tableName.split('.');
            const possibleTableName = tableNameParts.join('.');
            
            // Only consider dot-splitting if we have exactly one dot and both parts are meaningful
            if (tableNameParts.length === 1 && possibleDb && possibleTableName) {
              // Check if the first part might be a database name by looking at registered tables
              const state = get();
              const attachedDatabases = new Set<string>();
              state.registeredTables.forEach((value, key) => {
                if (key.includes('.')) {
                  const [dbName] = key.split('.');
                  attachedDatabases.add(dbName);
                }
              });
              
              if (attachedDatabases.has(possibleDb)) {
                references.push({
                  name: possibleTableName,
                  database: possibleDb,
                });
              } else {
                // Treat as a single table name
                references.push({
                  name: tableName,
                  database: database || undefined,
                });
              }
            } else {
              // Multiple dots or empty parts - treat as single table name
              references.push({
                name: tableName,
                database: database || undefined,
              });
            }
          } else {
            references.push({
              name: tableName,
              database: database || undefined,
            });
          }
        }
      }
    });

    // Remove duplicates
    const unique = references.filter(
      (ref, index, self) =>
        index ===
        self.findIndex(
          (r) => r.name === ref.name && r.database === ref.database
        )
    );

    return unique;
  },

  transformQueryForExecution: (sql: string): string => {
    const state = get();
    const { registeredTables } = state;
    
    // Get list of attached databases
    const attachedDatabases = new Set<string>();
    registeredTables.forEach((value, key) => {
      if (key.includes('.')) {
        const [dbName] = key.split('.');
        attachedDatabases.add(dbName);
      }
    });

    console.log('[DuckDBStore] transformQueryForExecution - Attached databases:', Array.from(attachedDatabases));
    
    if (attachedDatabases.size === 0) {
      return sql; // No transformations needed if no attached databases
    }

    // Transform "database.table" format to "database"."table" format
    // This regex matches quoted identifiers that contain exactly one dot and the first part is an attached database
    let transformedSql = sql;
    
    // Pattern to match "database.table" where database is attached
    const quotedDotPattern = /"([^"]+)\.([^"]+)"/g;
    
    transformedSql = sql.replace(quotedDotPattern, (match, possibleDb, tableName) => {
      if (attachedDatabases.has(possibleDb) && tableName) {
        const replacement = `"${possibleDb}"."${tableName}"`;
        console.log(`[DuckDBStore] transformQueryForExecution - Transforming: ${match} -> ${replacement}`);
        return replacement;
      }
      return match; // Keep original if not an attached database
    });
    
    return transformedSql;
  },

  isMotherDuckQuery: (sql: string) => {
    const state = get();
    const { registeredTables, motherDuckSchemas } = state;

    // Extract all table references from the SQL
    const tableRefs = get().extractTableReferences(sql);

    if (tableRefs.length === 0) {
      return {
        isMotherDuck: false,
        localTables: [],
        motherDuckTables: [],
        isHybrid: false,
      };
    }

    const localTables: string[] = [];
    const motherDuckTables: Array<{ name: string; database: string }> = [];

    // Check if this is a DDL operation (CREATE/DROP/ALTER)
    const isDDL = /^\s*(CREATE|DROP|ALTER)\s+/i.test(sql);

    // Get list of attached databases (not MotherDuck)
    const attachedDatabases = new Set<string>();
    registeredTables.forEach((value, key) => {
      if (key.includes('.')) {
        const [dbName] = key.split('.');
        attachedDatabases.add(dbName);
      }
    });


    // Check each table reference
    tableRefs.forEach((ref) => {
      // If database is specified, check if it's an attached database or MotherDuck
      if (ref.database) {
        console.log(`[DuckDBStore] isMotherDuckQuery - Checking database: ${ref.database}`);
        // First check if it's an attached local database
        if (attachedDatabases.has(ref.database)) {
          // This is an attached database table, treat as local
          const fullTableName = `${ref.database}.${ref.name}`;
          // Check if this specific table exists
          if (registeredTables.has(fullTableName)) {
            localTables.push(fullTableName);
          } else {
            // Table might not exist yet but database is attached, still treat as local
            localTables.push(fullTableName);
          }
          return;
        }

        // For DDL operations, check if it's targeting MotherDuck
        if (isDDL) {
          // Check if it's a known MotherDuck database
          const hasSchemas = motherDuckSchemas.has(ref.database);
          if (hasSchemas || state.motherDuckConnected) {
            // It's either a known MotherDuck database or MotherDuck is connected (could be creating new)
            motherDuckTables.push({ name: ref.name, database: ref.database });
          } else {
            // Not a MotherDuck database and MotherDuck not connected, treat as local
            localTables.push(`${ref.database}.${ref.name}`);
          }
          return;
        }

        // For non-DDL operations, check if the database exists in MotherDuck
        const hasSchemas = motherDuckSchemas.has(ref.database);
        if (hasSchemas) {
          const schemas = motherDuckSchemas.get(ref.database) || [];
          const tableExists = schemas.some(
            (schema) => schema.name === ref.name
          );
          if (tableExists) {
            motherDuckTables.push({ name: ref.name, database: ref.database });
            return;
          }
          // If database exists in MotherDuck but table doesn't, still treat as MotherDuck
          // (might be a typo or the table was just dropped)
          motherDuckTables.push({ name: ref.name, database: ref.database });
          return;
        } else {
          // Database not in MotherDuck schema and not attached - treat as local
          // (could be a local database that's not attached yet)
          localTables.push(`${ref.database}.${ref.name}`);
          return;
        }
      }

      // No database specified - check if it's a local table
      
      if (registeredTables.has(ref.name)) {
        localTables.push(ref.name);
        return;
      }

      
      // If no database specified, check all MotherDuck databases for this table
      let foundInMotherDuck = false;
      motherDuckSchemas.forEach((schemas, databaseName) => {
        const tableExists = schemas.some((schema) => schema.name === ref.name);
        console.log(`[DuckDBStore] isMotherDuckQuery - Checking database ${databaseName} for table ${ref.name}: ${tableExists}`);
        if (tableExists && !foundInMotherDuck) {
          console.log(`[DuckDBStore] isMotherDuckQuery - Found ${ref.name} in MotherDuck database ${databaseName}`);
          motherDuckTables.push({ name: ref.name, database: databaseName });
          foundInMotherDuck = true;
        }
      });

      // If not found anywhere, assume it might be a local table or CTE
      if (!foundInMotherDuck) {
        localTables.push(ref.name);
      }
    });

    const isHybrid = localTables.length > 0 && motherDuckTables.length > 0;
    const isMotherDuckOnly =
      motherDuckTables.length > 0 && localTables.length === 0;

    // Determine target database (prefer the first one found)
    const targetDatabase =
      motherDuckTables.length > 0 ? motherDuckTables[0].database : undefined;

    return {
      isMotherDuck: isMotherDuckOnly,
      targetDatabase,
      localTables,
      motherDuckTables,
      isHybrid,
    };
  },

  executeChartQuery: async (
    tableName: string,
    dimension: string,
    measure: string,
    aggregation: "sum" | "avg" | "min" | "max" | "count" = "sum",
    limit: number = 100,
    filters: { field: string; operator: string; value: string }[] = []
  ) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      throw new Error("DuckDB is not initialized");
    }

    try {
      // Build WHERE clause if filters exist
      let whereClause = "";
      if (filters.length > 0) {
        whereClause =
          "WHERE " +
          filters
            .map((f) => `"${f.field}" ${f.operator} '${f.value}'`)
            .join(" AND ");
      }

      // Create SQL for different chart types
      const sql = `
      SELECT 
        "${dimension}" as dimension, 
        ${aggregation}("${measure}") as value,
        COUNT(*) as count
      FROM "${tableName}"
      ${whereClause}
      GROUP BY "${dimension}"
      ORDER BY value DESC
      LIMIT ${limit}
    `;

      console.log(`[DuckDBStore] Chart query: ${sql}`);
      const result = await connection.query(sql);

      return result.toArray().map((row) => ({
        dimension: row.dimension,
        value: typeof row.value === "bigint" ? Number(row.value) : row.value,
        count: typeof row.count === "bigint" ? Number(row.count) : row.count,
      }));
    } catch (err) {
      console.error(`[DuckDBStore] Chart query execution error:`, err);
      throw err;
    }
  },

  refreshAllTables: async () => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      console.warn("[DuckDBStore] Cannot refresh tables - not initialized");
      return;
    }

    try {
      console.log("[DuckDBStore] Auto-refreshing tables and views...");

      const currentKnownTables = get().registeredTables;
      const newRegisteredTables = new Map(currentKnownTables); // Copy existing
      const newSchemaCache = new Map(get().schemaCache);

      const discoveredObjects = await discoverAllTables(
        connection,
        currentKnownTables
      );

      let newObjectsCount = 0;

      for (const objectInfo of discoveredObjects) {
        // 🔧 FIXED: Only add if it's actually NEW (not already registered)
        if (!currentKnownTables.has(objectInfo.name)) {
          newRegisteredTables.set(objectInfo.name, objectInfo.escapedName);

          try {
            const schema = await getTableSchema(
              connection,
              objectInfo.name,
              objectInfo.escapedName
            );
            newSchemaCache.set(objectInfo.name, schema);
            newObjectsCount++;

            const objectTypeLabel =
              objectInfo.type === "view" ? "view" : "table";
            console.log(
              `[DuckDBStore] Discovered new ${objectTypeLabel}: ${
                objectInfo.name
              } with ${objectInfo.rowCount || 0} rows`
            );
          } catch (schemaErr) {
            console.warn(
              `[DuckDBStore] Failed to get schema for discovered ${objectInfo.type} ${objectInfo.name}:`,
              schemaErr
            );
          }
        } else {
          // Object already exists, just make sure it's still in the map
          // (it should be since we copied currentKnownTables)
          console.log(
            `[DuckDBStore] Object ${objectInfo.name} already registered, skipping`
          );
        }
      }

      const existingCount = currentKnownTables.size;
      const newCount = newRegisteredTables.size;

      console.log(`[DuckDBStore] Registration update:`, {
        before: existingCount,
        after: newCount,
        newObjects: newObjectsCount,
        preservedExisting: newCount - newObjectsCount,
      });

      set({
        registeredTables: newRegisteredTables,
        schemaCache: newSchemaCache,
        lastTableRefresh: Date.now(),
      });

      if (newObjectsCount > 0) {
        const tables = discoveredObjects.filter(
          (o) => o.type === "table"
        ).length;
        const views = discoveredObjects.filter((o) => o.type === "view").length;
        console.log(
          `[DuckDBStore] Auto-refresh complete. Found ${tables} tables and ${views} views (${newObjectsCount} new)`
        );
      } else {
        console.log(
          "[DuckDBStore] Auto-refresh complete. No new objects found."
        );
      }
    } catch (err) {
      console.error("[DuckDBStore] Failed to auto-refresh tables:", err);
    }
  },

  /**
   * Auto-detects table changes based on executed SQL and refreshes if needed
   */
  autoDetectTableChanges: async (executedSQL: string) => {
    const { connection, isInitialized } = get();

    if (!connection || !isInitialized) {
      return;
    }

    try {
      // Use the updated detection function
      const analysis = detectTableModifyingSQL(executedSQL);

      if (analysis.isModifying) {
        console.log(`[DuckDBStore] Detected table-modifying SQL:`, {
          commands: analysis.commands,
          possibleTableNames: analysis.possibleTableNames,
          isMotherDuck: analysis.isMotherDuck,
          database: analysis.database,
        });

        if (analysis.isMotherDuck && analysis.database) {
          // It's a MotherDuck DDL operation
          console.log(
            `[DuckDBStore] Detected MotherDuck DDL for database: ${analysis.database}`
          );

          // Wait a moment for the operation to complete
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Refresh MotherDuck schemas for that database
          try {
            await get().refreshMotherDuckSchemas(analysis.database);
            console.log(
              `[DuckDBStore] Refreshed MotherDuck schemas for ${analysis.database}`
            );
          } catch (refreshErr) {
            console.warn(
              `[DuckDBStore] Failed to refresh MotherDuck schemas:`,
              refreshErr
            );
          }
        } else {
          // It's a local operation
          console.log(`[DuckDBStore] Detected local DDL operation`);

          // Wait a brief moment for the query to complete
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Refresh local tables
          await get().refreshAllTables();
        }
      }
    } catch (err) {
      console.warn("[DuckDBStore] Auto-detection failed:", err);
      // Don't throw here - this is a background operation
    }
  },

  // In useDuckDBStore, update the connectToMotherDuck method:

  connectToMotherDuck: async (token: string) => {
    set({ motherDuckConnecting: true, motherDuckError: null });

    try {
      console.log("[DuckDBStore] Connecting to MotherDuck...");

      const { MDConnection } = await import("@motherduck/wasm-client");
      const client = await MDConnection.create({ mdToken: token });
      await client.isInitialized();

      const result = await client.evaluateQuery("SHOW DATABASES");
      let databases: Array<{ name: string; shared: boolean }> = [];

      if (result?.data?.toRows) {
        const rows = result.data.toRows();
        databases = rows
          .map((row: any) => ({
            name: row.database_name || row.name || row.Database || row[0] || "",
            shared: row.shared || false,
          }))
          .filter(
            (db: any) => db.name && db.name !== "system" && db.name !== "temp"
          );
      }

      set({
        motherDuckClient: client,
        motherDuckConnected: true,
        motherDuckConnecting: false,
        motherDuckDatabases: databases,
        selectedMotherDuckDatabase:
          databases.length > 0 ? databases[0].name : null,
      });

      console.log(
        `[DuckDBStore] Connected to MotherDuck with ${databases.length} databases`
      );

      // Auto-fetch schemas for the first database to improve UX
      if (databases.length > 0) {
        try {
          await get().refreshMotherDuckSchemas(databases[0].name);
          console.log(
            `[DuckDBStore] Auto-loaded schemas for ${databases[0].name}`
          );
        } catch (err) {
          console.warn(
            `[DuckDBStore] Failed to auto-load schemas for ${databases[0].name}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error("[DuckDBStore] MotherDuck connection failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Connection failed";
      set({
        motherDuckConnecting: false,
        motherDuckError: errorMessage,
      });
      throw err;
    }
  },

  disconnectFromMotherDuck: async () => {
    const { motherDuckClient } = get();

    try {
      if (motherDuckClient) {
        await motherDuckClient.close();
      }
    } catch (err) {
      console.warn("[DuckDBStore] Error during MotherDuck disconnect:", err);
    }

    set({
      motherDuckClient: null,
      motherDuckConnected: false,
      motherDuckConnecting: false,
      motherDuckError: null,
      motherDuckDatabases: [],
      selectedMotherDuckDatabase: null,
      motherDuckSchemas: new Map(),
    });

    console.log("[DuckDBStore] Disconnected from MotherDuck");
  },

  executeMotherDuckQuery: async (sql: string, databaseName?: string) => {
    const { motherDuckClient, selectedMotherDuckDatabase } = get();

    if (!motherDuckClient) {
      throw new Error("MotherDuck client not available");
    }

    const dbToUse = databaseName || selectedMotherDuckDatabase;

    console.log(
      `[DuckDBStore] Executing MotherDuck query in database '${dbToUse}':`
    );
    console.log(`[DuckDBStore] SQL: ${sql}`);

    try {
      // Check if query has qualified table names (database.table pattern)
      const hasQualifiedNames =
        /"\w+"\."\w+"/.test(sql) || sql.includes(`"${dbToUse}".`);

      let finalSql = sql;

      if (!hasQualifiedNames && dbToUse) {
        // Only add USE if no qualified names and we have a target database
        await motherDuckClient.evaluateQuery(`USE ${dbToUse}`);
        console.log(`[DuckDBStore] Switched to database: ${dbToUse}`);
      }

      console.log(`[DuckDBStore] About to execute: ${finalSql}`);
      const result = await motherDuckClient.evaluateQuery(finalSql);

      // DEBUG: Log the raw result structure
      console.log(`[DuckDBStore] Raw result type:`, typeof result);
      console.log(`[DuckDBStore] Raw result structure:`, {
        hasData: !!result?.data,
        dataType: typeof result?.data,
        dataIsArray: Array.isArray(result?.data),
        dataToRows: typeof result?.data?.toRows,
        dataToArray: typeof result?.data?.toArray,
      });

      let extractedData = [];

      // Extract data from MotherDuck result with better debugging
      if (result?.data?.toRows) {
        extractedData = result.data.toRows();
        console.log(
          `[DuckDBStore] Used toRows(), got ${extractedData.length} rows`
        );
      } else if (result?.data?.toArray) {
        extractedData = result.data.toArray();
        console.log(
          `[DuckDBStore] Used toArray(), got ${extractedData.length} rows`
        );
      } else if (Array.isArray(result?.data)) {
        extractedData = result.data;
        console.log(
          `[DuckDBStore] Used direct array, got ${extractedData.length} rows`
        );
      } else {
        console.warn(`[DuckDBStore] Unknown result format:`, result);
        extractedData = [];
      }

      // CRITICAL: If we got way more rows than expected, something went wrong
      if (sql.toLowerCase().includes("limit")) {
        const limitMatch = sql.match(/limit\s+(\d+)/i);
        if (limitMatch) {
          const expectedLimit = parseInt(limitMatch[1], 10);
          if (extractedData.length > expectedLimit * 2) {
            // Allow some buffer
            console.error(
              `[DuckDBStore] LIMIT clause ignored! Expected ~${expectedLimit} rows, got ${extractedData.length}`
            );
            console.error(
              `[DuckDBStore] This suggests MotherDuck is not respecting the LIMIT clause`
            );

            // FALLBACK: Manually limit the results client-side
            console.warn(
              `[DuckDBStore] Applying client-side limit to ${expectedLimit} rows`
            );
            extractedData = extractedData.slice(0, expectedLimit);
          }
        }
      }

      console.log(`[DuckDBStore] Final result: ${extractedData.length} rows`);
      return extractedData;
    } catch (err) {
      console.error("[DuckDBStore] MotherDuck query failed:", err);
      throw err;
    }
  },

  refreshMotherDuckSchemas: async (databaseName: string) => {
    const { motherDuckClient } = get();

    if (!motherDuckClient) {
      throw new Error("MotherDuck client not available");
    }

    try {
      console.log(
        `[DuckDBStore] Refreshing schemas for MotherDuck database: ${databaseName}`
      );

      // Switch to the database
      await motherDuckClient.evaluateQuery(`USE ${databaseName}`);

      // Get all tables
      const tablesResult = await motherDuckClient.evaluateQuery("SHOW TABLES");
      let tableNames: Set<string> = new Set();
      let schemas: { name: string; type: string }[] = [];

      if (tablesResult?.data?.toRows) {
        const rows = tablesResult.data.toRows();
        rows.forEach((row: any) => {
          const tableName = row.name || row.table_name || row[0] || "";
          if (tableName) {
            tableNames.add(tableName);
            schemas.push({
              name: tableName,
              type: "table",
            });
          }
        });
      }

      // Get all views and mark them correctly
      try {
        const viewsResult = await motherDuckClient.evaluateQuery("SHOW VIEWS");
        if (viewsResult?.data?.toRows) {
          const viewRows = viewsResult.data.toRows();
          viewRows.forEach((row: any) => {
            const viewName = row.name || row.view_name || row[0] || "";
            if (viewName) {
              // Remove from tables if it was listed there
              if (tableNames.has(viewName)) {
                schemas = schemas.filter((s) => s.name !== viewName);
              }
              // Add as view
              schemas.push({
                name: viewName,
                type: "view",
              });
            }
          });
        }
      } catch (viewErr) {
        console.log("[DuckDBStore] No views or views query failed:", viewErr);
      }

      // Alternative approach: Use information_schema if available
      try {
        const infoSchemaResult = await motherDuckClient.evaluateQuery(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = '${databaseName}'
      `);

        if (infoSchemaResult?.data?.toRows) {
          const infoRows = infoSchemaResult.data.toRows();
          // Create a map for accurate type information
          const typeMap = new Map<string, string>();

          infoRows.forEach((row: any) => {
            if (row.table_name && row.table_type) {
              const type = row.table_type.toLowerCase().includes("view")
                ? "view"
                : "table";
              typeMap.set(row.table_name, type);
            }
          });

          // Update schemas with accurate types
          schemas = schemas.map((schema) => ({
            ...schema,
            type: typeMap.get(schema.name) || schema.type,
          }));
        }
      } catch (infoErr) {
        console.log(
          "[DuckDBStore] information_schema query failed, using SHOW TABLES/VIEWS results"
        );
      }

      set((state) => ({
        motherDuckSchemas: new Map(state.motherDuckSchemas).set(
          databaseName,
          schemas
        ),
      }));

      console.log(
        `[DuckDBStore] Refreshed ${schemas.length} schemas for ${databaseName}:`,
        schemas.map((s) => `${s.name} (${s.type})`).join(", ")
      );
    } catch (err) {
      console.error(
        `[DuckDBStore] Failed to refresh schemas for ${databaseName}:`,
        err
      );
      throw err;
    }
  },

  getAllAvailableTables: () => {
    const state = get();
    const tables: Array<{
      name: string;
      source: "local" | "motherduck";
      database?: string;
    }> = [];

    // Local tables
    Array.from(state.registeredTables.keys()).forEach((tableName) => {
      tables.push({
        name: tableName,
        source: "local",
      });
    });

    // MotherDuck tables
    state.motherDuckSchemas.forEach((schemas, databaseName) => {
      schemas.forEach((schema) => {
        tables.push({
          name: schema.name,
          source: "motherduck",
          database: databaseName,
        });
      });
    });

    return tables;
  },

  listAttachedDatabases: async () => {
    const { connection, isInitialized } = get();
    
    if (!connection || !isInitialized) {
      return [];
    }
    
    try {
      // Query DuckDB for attached databases
      const result = await connection.query(`
        SELECT DISTINCT table_catalog as database_name
        FROM information_schema.tables
        WHERE table_catalog NOT IN ('memory', 'system', 'temp')
      `);
      
      const databases = result.toArray();
      const dbList = [];
      
      for (const db of databases) {
        const dbName = db.database_name;
        
        // Count tables in each database
        const tableCountResult = await connection.query(`
          SELECT COUNT(*) as count
          FROM information_schema.tables
          WHERE table_catalog = '${dbName}'
          AND table_type = 'BASE TABLE'
        `);
        
        const tableCount = tableCountResult.toArray()[0].count;
        dbList.push({ name: dbName, tables: tableCount });
      }
      
      return dbList;
    } catch (err) {
      console.error('[DuckDBStore] Error listing attached databases:', err);
      return [];
    }
  },

  // Detach a database
  detachDatabase: async (databaseName: string) => {
    const { connection, isInitialized } = get();
    
    if (!connection || !isInitialized) {
      throw new Error("DuckDB is not initialized");
    }
    
    try {
      // Detach the database
      await connection.query(`DETACH ${databaseName}`);
      console.log(`[DuckDBStore] Detached database: ${databaseName}`);
      
      // Remove tables from registered tables
      const newTables = new Map(get().registeredTables);
      const keysToRemove = [];
      
      newTables.forEach((value, key) => {
        if (key.startsWith(`${databaseName}.`)) {
          keysToRemove.push(key);
        }
      });
      
      keysToRemove.forEach(key => newTables.delete(key));
      
      set({ registeredTables: newTables });
      
      // Refresh schema cache
      await get().refreshSchemaCache();
      
      console.log(`[DuckDBStore] Removed ${keysToRemove.length} tables from ${databaseName}`);
    } catch (err) {
      console.error(`[DuckDBStore] Error detaching database ${databaseName}:`, err);
      throw err;
    }
  },

  // PostgreSQL Bridge Actions
  connectToPostgreSQL: async (connectionId: string) => {
    try {
      // Import postgresStore to get connection details
      const { usePostgreSQLStore } = await import('@/store/postgresStore');
      const postgresState = usePostgreSQLStore.getState();
      const connection = postgresState.connections.find(c => c.id === connectionId);
      
      if (!connection) {
        throw new Error(`PostgreSQL connection ${connectionId} not found`);
      }

      set((state) => ({
        postgresConnections: new Map(state.postgresConnections).set(connectionId, connection),
        postgresActiveConnections: new Set(state.postgresActiveConnections).add(connectionId),
        postgresError: null,
      }));

      console.log(`[DuckDBStore] Connected to PostgreSQL: ${connection.name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to PostgreSQL';
      set({ postgresError: errorMessage });
      throw err;
    }
  },

  disconnectFromPostgreSQL: async (connectionId: string) => {
    try {
      set((state) => {
        const newConnections = new Map(state.postgresConnections);
        newConnections.delete(connectionId);
        
        const newActiveConnections = new Set(state.postgresActiveConnections);
        newActiveConnections.delete(connectionId);
        
        // Remove virtual tables for this connection
        const newVirtualTables = new Map(state.postgresVirtualTables);
        for (const [key, table] of newVirtualTables) {
          if (table.connectionId === connectionId) {
            newVirtualTables.delete(key);
          }
        }
        
        // Remove schemas for this connection
        const newSchemas = new Map(state.postgresSchemas);
        newSchemas.delete(connectionId);
        
        return {
          postgresConnections: newConnections,
          postgresActiveConnections: newActiveConnections,
          postgresVirtualTables: newVirtualTables,
          postgresSchemas: newSchemas,
        };
      });
      
      console.log(`[DuckDBStore] Disconnected from PostgreSQL: ${connectionId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect from PostgreSQL';
      set({ postgresError: errorMessage });
      throw err;
    }
  },

  addVirtualPostgreSQLTable: (connectionId: string, table: PostgreSQLTable, columns = []) => {
    const tableKey = `${connectionId}.${table.schemaName}.${table.tableName}`;
    
    set((state) => {
      const newVirtualTables = new Map(state.postgresVirtualTables);
      newVirtualTables.set(tableKey, {
        connectionId,
        schemaName: table.schemaName,
        tableName: table.tableName,
        tableType: table.tableType as 'table' | 'view',
        columns: columns.length > 0 ? columns : table.columns?.map(col => ({
          name: col.columnName,
          type: col.dataType
        })) || [],
        isImported: false,
        estimatedSize: table.size ? parseInt(table.size.replace(/[^0-9]/g, '')) || 0 : 0,
      });
      
      return { postgresVirtualTables: newVirtualTables };
    });
    
    console.log(`[DuckDBStore] Added virtual PostgreSQL table: ${tableKey}`);
  },

  removeVirtualPostgreSQLTable: (tableKey: string) => {
    set((state) => {
      const newVirtualTables = new Map(state.postgresVirtualTables);
      newVirtualTables.delete(tableKey);
      return { postgresVirtualTables: newVirtualTables };
    });
    
    console.log(`[DuckDBStore] Removed virtual PostgreSQL table: ${tableKey}`);
  },

  refreshPostgreSQLVirtualSchemas: async (connectionId: string) => {
    try {
      const { postgreSQLService } = await import('@/lib/api/postgresService');
      const schemas = await postgreSQLService.getSchemas(connectionId);
      const allTables = await postgreSQLService.getAllTables(connectionId);
      
      // Convert to our schema format
      const schemaMap = new Map();
      allTables.forEach(table => {
        const schemaName = table.schemaName;
        if (!schemaMap.has(schemaName)) {
          schemaMap.set(schemaName, []);
        }
        schemaMap.get(schemaName).push({
          name: table.tableName,
          type: table.tableType,
          tableType: table.tableType
        });
      });
      
      set((state) => {
        const newSchemas = new Map(state.postgresSchemas);
        for (const [schemaName, tables] of schemaMap) {
          newSchemas.set(`${connectionId}.${schemaName}`, tables);
        }
        return { postgresSchemas: newSchemas };
      });
      
      console.log(`[DuckDBStore] Refreshed PostgreSQL schemas for connection: ${connectionId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh PostgreSQL schemas';
      set({ postgresError: errorMessage });
      throw err;
    }
  },

  executePostgreSQLQuery: async (sql: string, connectionId: string) => {
    try {
      const { postgreSQLService } = await import('@/lib/api/postgresService');
      const result = await postgreSQLService.executeQuery(connectionId, { sql });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PostgreSQL query execution failed';
      set({ postgresError: errorMessage });
      throw err;
    }
  },

  getAllAvailableTablesWithPostgreSQL: () => {
    const state = get();
    const tables = [];
    
    // Add local tables
    const localTables = state.getAvailableTables();
    localTables.forEach(tableName => {
      tables.push({
        name: tableName,
        source: "local" as const,
      });
    });
    
    // Add MotherDuck tables (if connected)
    if (state.motherDuckConnected) {
      state.motherDuckDatabases.forEach(db => {
        const schemas = state.motherDuckSchemas.get(db.name) || [];
        schemas.forEach(schema => {
          tables.push({
            name: `${db.name}.${schema.name}`,
            source: "motherduck" as const,
            database: db.name,
          });
        });
      });
    }
    
    // Add PostgreSQL virtual tables
    state.postgresVirtualTables.forEach((table, tableKey) => {
      tables.push({
        name: `${table.schemaName}.${table.tableName}`,
        source: "postgresql" as const,
        connectionId: table.connectionId,
        isVirtual: !table.isImported,
      });
    });
    
    return tables;
  },

  isPostgreSQLQuery: (sql: string) => {
    const state = get();
    const sqlLower = sql.toLowerCase();
    
    const localTables: string[] = [];
    const postgreSQLTables: Array<{ name: string; connectionId: string; schemaName: string }> = [];
    
    // Extract table references from SQL
    const tableReferences = state.extractTableReferences(sql);
    
    for (const ref of tableReferences) {
      // Check if it's a virtual PostgreSQL table
      let foundPostgres = false;
      for (const [tableKey, table] of state.postgresVirtualTables) {
        if (ref.name === table.tableName || ref.name === `${table.schemaName}.${table.tableName}`) {
          postgreSQLTables.push({
            name: ref.name,
            connectionId: table.connectionId,
            schemaName: table.schemaName
          });
          foundPostgres = true;
          break;
        }
      }
      
      if (!foundPostgres && state.getAvailableTables().includes(ref.name)) {
        localTables.push(ref.name);
      }
    }
    
    const isPostgreSQL = postgreSQLTables.length > 0;
    const isHybrid = postgreSQLTables.length > 0 && localTables.length > 0;
    const targetConnection = postgreSQLTables.length > 0 ? postgreSQLTables[0].connectionId : undefined;
    
    return {
      isPostgreSQL,
      targetConnection,
      localTables,
      postgreSQLTables,
      isHybrid
    };
  },

  setPostgreSQLAutoImportThreshold: (bytes: number) => {
    set({ postgresAutoImportThreshold: bytes });
    console.log(`[DuckDBStore] PostgreSQL auto-import threshold set to ${bytes} bytes`);
  },

  importPostgreSQLTableData: async (tableKey: string, forceImport = false) => {
    const state = get();
    const virtualTable = state.postgresVirtualTables.get(tableKey);
    
    if (!virtualTable) {
      throw new Error(`Virtual table ${tableKey} not found`);
    }
    
    if (virtualTable.isImported && !forceImport) {
      console.log(`[DuckDBStore] Table ${tableKey} already imported`);
      return;
    }
    
    try {
      const { postgreSQLService } = await import('@/lib/api/postgresService');
      
      // Check if we should auto-import based on size threshold
      const shouldAutoImport = !virtualTable.estimatedSize || 
        virtualTable.estimatedSize <= state.postgresAutoImportThreshold || 
        forceImport;
      
      if (shouldAutoImport) {
        console.log(`[DuckDBStore] Importing PostgreSQL table data: ${tableKey}`);
        
        // Fetch table data
        const tableData = await postgreSQLService.fetchTableDataForImport(
          virtualTable.connectionId,
          virtualTable.schemaName,
          virtualTable.tableName,
          { sampleOnly: !forceImport }
        );
        
        // Generate local table name
        const localTableName = `pg_${virtualTable.connectionId}_${virtualTable.schemaName}_${virtualTable.tableName}`
          .replace(/[^a-zA-Z0-9_]/g, '_');
        
        // Create table in DuckDB
        await state.createTable(
          localTableName, 
          tableData.columns.map(col => col.name),
          tableData.columns.map(() => ColumnType.Text) // Use text for all initially
        );
        
        // Insert data if available
        if (tableData.data.length > 1) {
          const dataRows = tableData.data.slice(1); // Remove header row
          await state.insertData(localTableName, dataRows);
        }
        
        // Mark as imported
        set((state) => {
          const newVirtualTables = new Map(state.postgresVirtualTables);
          const updatedTable = { ...virtualTable, isImported: true, localTableName };
          newVirtualTables.set(tableKey, updatedTable);
          return { postgresVirtualTables: newVirtualTables };
        });
        
        console.log(`[DuckDBStore] Successfully imported PostgreSQL table: ${tableKey} -> ${localTableName}`);
      } else {
        console.log(`[DuckDBStore] Table ${tableKey} exceeds auto-import threshold (${virtualTable.estimatedSize} bytes)`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import PostgreSQL table data';
      set({ postgresError: errorMessage });
      throw err;
    }
  },

  // Enhanced cloud storage methods following existing patterns
  
  /**
   * Export table to Parquet format with full schema preservation
   * Uses DuckDB's native COPY command for optimal performance and type fidelity
   */
  exportTableToParquet: async (tableName: string) => {
    const { connection, db, registeredTables } = get();

    if (!connection || !db) {
      throw new Error('DuckDB not initialized');
    }

    // Get the properly escaped table name from registeredTables
    const escapedTableName = registeredTables.get(tableName) || `"${tableName}"`;

    console.log(`[DuckDBStore] Exporting table to Parquet: ${tableName} (${escapedTableName})`);

    // Create temporary connection following existing pattern
    const conn = await db.connect();

    try {
      // Step 1: Get complete schema info using existing pattern
      const schemaQuery = `PRAGMA table_info(${escapedTableName})`;
      const schemaResult = await conn.query(schemaQuery);
      const schema = schemaResult.toArray();

      if (schema.length === 0) {
        throw new Error(`Table ${tableName} has no schema information`);
      }

      console.log(`[DuckDBStore] Table schema:`, schema);

      // Step 2: Get row count
      const countQuery = `SELECT COUNT(*) as count FROM ${escapedTableName}`;
      const countResult = await conn.query(countQuery);
      const rowCount = countResult.toArray()[0]?.count || 0;

      console.log(`[DuckDBStore] Table has ${rowCount} rows`);

      // Step 3: Generate unique temporary filename
      const tempFileName = `export_${tableName}_${Date.now()}.parquet`;

      // Step 4: Export using DuckDB's native COPY command with best practices
      const exportQuery = `COPY ${escapedTableName} TO '${tempFileName}' (FORMAT PARQUET, COMPRESSION 'SNAPPY')`;
      console.log(`[DuckDBStore] Executing export:`, exportQuery);

      await conn.query(exportQuery);

      // Step 5: Extract binary data
      const parquetBuffer = await db.copyFileToBuffer(tempFileName);
      console.log(`[DuckDBStore] Parquet export completed: ${parquetBuffer.byteLength} bytes`);

      // Step 6: Clean up temporary file
      await db.dropFile(tempFileName);

      return {
        parquetBuffer,
        schema,
        rowCount: typeof rowCount === 'bigint' ? Number(rowCount) : rowCount
      };

    } catch (err) {
      console.error(`[DuckDBStore] Parquet export failed:`, err);
      throw new Error(`Failed to export table to Parquet: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Always close connection following existing pattern
      await conn.close();
    }
  },

  /**
   * Import Parquet file with optional schema preservation
   * Extends existing importFileDirectly with schema correction capabilities
   */
  importParquetWithSchema: async (parquetFile: File, preservedSchema) => {
    console.log(`[DuckDBStore] Importing Parquet with schema preservation:`, parquetFile.name);

    try {
      // Step 1: Use existing importFileDirectly for initial import
      const importResult = await get().importFileDirectly(parquetFile);
      let schemaApplied = false;

      // Step 2: If we have preserved schema, check if it needs correction
      if (preservedSchema && preservedSchema.length > 0) {
        const { connection } = get();
        if (!connection) {
          throw new Error('DuckDB connection not available');
        }

        // Get current schema of imported table
        const currentSchemaQuery = `PRAGMA table_info("${importResult.tableName}")`;
        const currentSchemaResult = await connection.query(currentSchemaQuery);
        const currentSchema = currentSchemaResult.toArray();

        // Compare schemas to see if correction is needed
        console.log('[DuckDBStore] Current imported schema:', JSON.stringify(currentSchema, null, 2));
        console.log('[DuckDBStore] Preserved schema to apply:', JSON.stringify(preservedSchema, null, 2));
        
        const needsCorrection = preservedSchema.some(preservedCol => {
          const currentCol = currentSchema.find(c => c.name === preservedCol.name);
          const typeMismatch = !currentCol || currentCol.type !== preservedCol.type;
          if (typeMismatch) {
            console.log(`[DuckDBStore] Type mismatch for ${preservedCol.name}: current=${currentCol?.type}, preserved=${preservedCol.type}`);
          }
          return typeMismatch;
        });
        
        console.log('[DuckDBStore] Schema correction needed:', needsCorrection);

        if (needsCorrection) {
          console.log(`[DuckDBStore] Schema correction needed, applying preserved schema`);

          // Create target table with correct schema
          const targetTableName = `${importResult.tableName}_corrected`;
          const escapedTargetName = `"${targetTableName}"`;
          const escapedSourceName = `"${importResult.tableName}"`;

          // Drop existing target table
          await connection.query(`DROP TABLE IF EXISTS ${escapedTargetName}`);

          // Create table with preserved schema
          const columnDefs = preservedSchema.map(col => {
            let def = `"${col.name}" ${col.type}`;
            if (col.notnull) def += ' NOT NULL';
            if (col.dflt_value !== null && col.dflt_value !== undefined) {
              if (typeof col.dflt_value === 'string') {
                def += ` DEFAULT '${col.dflt_value.replace(/'/g, "''")}'`;
              } else if (typeof col.dflt_value === 'boolean') {
                def += ` DEFAULT ${col.dflt_value.toString().toUpperCase()}`;
              } else {
                def += ` DEFAULT ${col.dflt_value}`;
              }
            }
            return def;
          }).join(', ');

          const createTableQuery = `CREATE TABLE ${escapedTargetName} (${columnDefs})`;
          await connection.query(createTableQuery);

          // Copy data with smart type casting
          const selectClauses = preservedSchema.map(targetCol => {
            const sourceCol = currentSchema.find(c => c.name === targetCol.name);
            if (!sourceCol) {
              return `NULL as "${targetCol.name}"`;
            }
            
            // Smart casting based on target type
            if (sourceCol.type === targetCol.type) {
              return `"${targetCol.name}"`; // No casting needed
            } else if (targetCol.type === 'BOOLEAN' && sourceCol.type.includes('VARCHAR')) {
              // Special handling for boolean conversion
              return `CASE 
                WHEN LOWER(TRIM("${targetCol.name}")) IN ('true', '1', 'yes', 't') THEN TRUE
                WHEN LOWER(TRIM("${targetCol.name}")) IN ('false', '0', 'no', 'f') THEN FALSE
                ELSE TRY_CAST("${targetCol.name}" AS BOOLEAN)
              END as "${targetCol.name}"`;
            } else {
              return `TRY_CAST("${targetCol.name}" AS ${targetCol.type}) as "${targetCol.name}"`;
            }
          }).join(', ');

          const insertQuery = `INSERT INTO ${escapedTargetName} SELECT ${selectClauses} FROM ${escapedSourceName}`;
          console.log(`[DuckDBStore] Applying schema correction:`, insertQuery);

          try {
            await connection.query(insertQuery);
            schemaApplied = true;

            // Update registered tables
            const newTables = new Map(get().registeredTables);
            newTables.delete(importResult.tableName);
            newTables.set(targetTableName, escapedTargetName);
            set({ registeredTables: newTables });

            // Clean up source table
            await connection.query(`DROP TABLE IF EXISTS ${escapedSourceName}`);

            // Update result
            importResult.tableName = targetTableName;

            console.log(`[DuckDBStore] Schema correction applied successfully`);

          } catch (castError) {
            console.warn(`[DuckDBStore] Schema correction failed, using original table:`, castError);
            // Continue with original import result
          }
        }
      }

      console.log(`[DuckDBStore] Parquet import completed: ${importResult.tableName}, schemaApplied: ${schemaApplied}`);

      return {
        ...importResult,
        schemaApplied
      };

    } catch (err) {
      console.error(`[DuckDBStore] Parquet import with schema failed:`, err);
      throw err;
    }
  },

  /**
   * Ensure table exists and return actual table name
   * Fixes table synchronization issues by finding the correct table name
   */
  ensureTableExists: async (expectedTableName: string) => {
    const { connection } = get();

    if (!connection) {
      console.warn(`[DuckDBStore] Connection not available for table check: ${expectedTableName}`);
      return null;
    }

    try {
      // Step 1: Try direct access to expected table
      const testQuery = `SELECT 1 FROM "${expectedTableName}" LIMIT 1`;
      await connection.query(testQuery);
      
      console.log(`[DuckDBStore] Table exists and accessible: ${expectedTableName}`);
      return expectedTableName;

    } catch {
      // Step 2: Table doesn't exist or isn't accessible, find alternatives
      console.log(`[DuckDBStore] Table ${expectedTableName} not accessible, searching alternatives...`);

      try {
        const tablesResult = await connection.query('SHOW TABLES');
        const availableTables = tablesResult.toArray().map((row: any) => 
          row.name || row.Name || Object.values(row)[0]
        ) as string[];

        console.log(`[DuckDBStore] Available tables:`, availableTables);

        // Find best match using simple fuzzy matching
        const exactMatch = availableTables.find(t => t === expectedTableName);
        if (exactMatch) return exactMatch;

        const caseInsensitiveMatch = availableTables.find(t => 
          t.toLowerCase() === expectedTableName.toLowerCase()
        );
        if (caseInsensitiveMatch) {
          console.log(`[DuckDBStore] Found case-insensitive match: ${expectedTableName} -> ${caseInsensitiveMatch}`);
          return caseInsensitiveMatch;
        }

        const partialMatch = availableTables.find(t => 
          t.includes(expectedTableName) || expectedTableName.includes(t)
        );
        if (partialMatch) {
          console.log(`[DuckDBStore] Found partial match: ${expectedTableName} -> ${partialMatch}`);
          return partialMatch;
        }

        console.log(`[DuckDBStore] No suitable table found for: ${expectedTableName}`);
        return null;

      } catch (listError) {
        console.error(`[DuckDBStore] Error listing tables:`, listError);
        return null;
      }
    }
  },

  /**
   * Import cloud files with streaming support for large files
   * Inspired by importFileDirectlyStreaming but adapted for cloud file blobs
   * Provides progress feedback and memory-efficient processing
   */
  importCloudFileStreaming: async (
    cloudFile: File, 
    fileName: string, 
    fileSize: number,
    preservedSchema, 
    onProgress
  ) => {
    const { connection, isInitialized } = get();

    // Initialize if needed
    if (!connection || !isInitialized) {
      await get().initialize();
      if (!get().connection || !get().db) {
        throw new Error("DuckDB is not initialized");
      }
    }

    // Use the actual file extension from the cloudFile, not the original fileName
    const actualFileExt = cloudFile.name.split(".").pop()?.toLowerCase();
    const originalFileExt = fileName.split(".").pop()?.toLowerCase();
    const fileSizeMB = fileSize / (1024 * 1024);
    
    // Determine if we should use streaming (for files > 50MB)
    const shouldUseStreaming = fileSizeMB > 50;
    
    console.log(`[DuckDBStore] Cloud import: ${fileName} (${fileSizeMB.toFixed(2)}MB), actual ext: ${actualFileExt}, original ext: ${originalFileExt}, streaming: ${shouldUseStreaming}`);

    try {
      // Update progress
      onProgress?.(0.1, "Preparing cloud file import...");

      if (!shouldUseStreaming) {
        // For smaller files, use existing optimized method
        onProgress?.(0.2, "Using fast import for small file...");
        
        const result = await get().importParquetWithSchema(cloudFile, preservedSchema);
        
        onProgress?.(1.0, "Import completed");
        
        return {
          ...result,
          streamingUsed: false
        };
      }

      // === STREAMING IMPORT FOR LARGE FILES ===
      
      onProgress?.(0.2, "Initializing streaming import...");

      // Step 1: Create temporary table name  
      const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
      const tempTableName = `${baseName}_streaming_${Date.now()}`;
      const escapedTableName = `"${tempTableName}"`;

      // Step 2: Register file with DuckDB for streaming access
      // Use the actual file extension (usually .parquet) not the original (.csv)
      const registeredFileName = `cloud_streaming_${Date.now()}.${actualFileExt}`;
      await get().db!.registerFileHandle(
        registeredFileName,
        cloudFile,
        duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
        false
      );

      onProgress?.(0.3, "File registered, analyzing structure...");

      // Step 3: Create streaming connection
      const conn = await get().db!.connect();

      try {
        // Step 4: Import with streaming-optimized settings
        let createTableQuery;
        
        if (actualFileExt === 'parquet') {
          // Parquet streaming import
          createTableQuery = `CREATE TABLE ${escapedTableName} AS 
            SELECT * FROM read_parquet('${registeredFileName}')`;
          
          onProgress?.(0.5, "Streaming Parquet data...");
        } else {
          // CSV streaming import with more lenient settings
          createTableQuery = `CREATE TABLE ${escapedTableName} AS 
            SELECT * FROM read_csv('${registeredFileName}', 
              header=true, 
              auto_detect=true,
              parallel=true,
              buffer_size=16384,
              strict_mode=false,
              ignore_errors=true
            )`;
          
          onProgress?.(0.5, "Streaming CSV data...");
        }

        console.log(`[DuckDBStore] Streaming query:`, createTableQuery);
        await conn.query(createTableQuery);

        onProgress?.(0.7, "Processing schema corrections...");

        // Step 5: Apply schema corrections if provided
        let schemaApplied = false;
        let finalTableName = tempTableName;

        if (preservedSchema && preservedSchema.length > 0) {
          try {
            // Get current schema
            const currentSchemaQuery = `PRAGMA table_info(${escapedTableName})`;
            const currentSchemaResult = await conn.query(currentSchemaQuery);
            const currentSchema = currentSchemaResult.toArray();

            // Check if correction is needed (same logic as importParquetWithSchema)
            const needsCorrection = preservedSchema.some(preservedCol => {
              const currentCol = currentSchema.find(c => c.name === preservedCol.name);
              return !currentCol || currentCol.type !== preservedCol.type;
            });

            if (needsCorrection) {
              onProgress?.(0.8, "Applying schema corrections...");
              
              const correctedTableName = `${tempTableName}_corrected`;
              const escapedCorrectedName = `"${correctedTableName}"`;

              // Create corrected table with preserved schema
              const columnDefs = preservedSchema.map(col => {
                let def = `"${col.name}" ${col.type}`;
                if (col.notnull) def += ' NOT NULL';
                if (col.dflt_value !== null && col.dflt_value !== undefined) {
                  if (typeof col.dflt_value === 'string') {
                    def += ` DEFAULT '${col.dflt_value.replace(/'/g, "''")}'`;
                  } else {
                    def += ` DEFAULT ${col.dflt_value}`;
                  }
                }
                return def;
              }).join(', ');

              const createCorrectedQuery = `CREATE TABLE ${escapedCorrectedName} (${columnDefs})`;
              await conn.query(createCorrectedQuery);

              // Copy data with smart casting
              const selectClauses = preservedSchema.map(targetCol => {
                const sourceCol = currentSchema.find(c => c.name === targetCol.name);
                if (!sourceCol) {
                  return `NULL as "${targetCol.name}"`;
                } else if (sourceCol.type === targetCol.type) {
                  return `"${targetCol.name}"`;
                } else {
                  return `TRY_CAST("${targetCol.name}" AS ${targetCol.type}) as "${targetCol.name}"`;
                }
              }).join(', ');

              const insertQuery = `INSERT INTO ${escapedCorrectedName} SELECT ${selectClauses} FROM ${escapedTableName}`;
              await conn.query(insertQuery);

              // Clean up original table
              await conn.query(`DROP TABLE IF EXISTS ${escapedTableName}`);
              
              finalTableName = correctedTableName;
              schemaApplied = true;
              
              console.log(`[DuckDBStore] Streaming schema correction applied`);
            }
          } catch (schemaError) {
            console.warn(`[DuckDBStore] Streaming schema correction failed:`, schemaError);
            // Continue with original table
          }
        }

        onProgress?.(0.9, "Finalizing import...");

        // Step 6: Get final row count
        const finalEscapedName = `"${finalTableName}"`;
        const countQuery = `SELECT COUNT(*) as count FROM ${finalEscapedName}`;
        const countResult = await conn.query(countQuery);
        const rowCount = countResult.toArray()[0]?.count || 0;

        // Step 7: Register table
        const newTables = new Map(get().registeredTables);
        newTables.set(finalTableName, finalEscapedName);
        set({ registeredTables: newTables });

        await conn.close();

        // Step 8: Refresh schema cache
        await get().refreshSchemaCache();

        onProgress?.(1.0, `Streaming import completed: ${rowCount.toLocaleString()} rows`);

        console.log(`[DuckDBStore] Streaming import successful: ${finalTableName}, ${rowCount} rows, schema applied: ${schemaApplied}`);

        return {
          tableName: finalTableName,
          rowCount: rowCount,
          schemaApplied,
          streamingUsed: true
        };

      } catch (streamingError) {
        await conn.close();
        throw streamingError;
      }

    } catch (err) {
      console.error(`[DuckDBStore] Cloud streaming import failed:`, err);
      throw err;
    }
  },
}));
