import * as duckdb from "@duckdb/duckdb-wasm";
import { duckDBConfig, getBundles, cleanupWorkerBlobUrls } from "./config";

let currentBundles: duckdb.DuckDBBundles | null = null;

export async function initializeDuckDB() {
  try {
    console.log("[Board/DuckDB] Starting initialization...");
    currentBundles = await getBundles();
    const bundle = await duckdb.selectBundle(currentBundles);
    console.log("[Board/DuckDB] Selected bundle:", bundle);

    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const conn = await db.connect();

    await configureDuckDB(conn);
    console.log("[Board/DuckDB] Initialization complete");

    return { db, conn };
  } catch (err) {
    if (currentBundles) {
      cleanupWorkerBlobUrls(currentBundles);
    }
    console.error("[Board/DuckDB] Failed to initialize:", err);
    throw new Error("Failed to initialize DuckDB: " + (err instanceof Error ? err.message : String(err)));
  }
}

async function configureDuckDB(conn: duckdb.AsyncDuckDBConnection) {
  try {
    await conn.query("PRAGMA memory_limit='" + duckDBConfig.MEMORY_LIMIT + "'");
    
    for (const extension of duckDBConfig.REQUIRED_EXTENSIONS) {
      try {
        await conn.query("INSTALL " + extension);
        await conn.query("LOAD " + extension);
        console.log("[Board/DuckDB] Extension loaded:", extension);
      } catch (extErr) {
        console.log("[Board/DuckDB] Extension not available:", extension);
      }
    }
  } catch (configErr) {
    console.warn("[Board/DuckDB] Config warning:", configErr);
  }
}

export function cleanup() {
  if (currentBundles) {
    cleanupWorkerBlobUrls(currentBundles);
    currentBundles = null;
  }
}
