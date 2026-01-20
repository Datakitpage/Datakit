import * as duckdb from "@duckdb/duckdb-wasm";

// Version should match package.json
const DUCKDB_VERSION = "1.33.1-dev18.0";
const DUCKDB_CDN = "https://unpkg.com/@duckdb/duckdb-wasm@" + DUCKDB_VERSION + "/dist";

export const isDevelopment = import.meta.env.DEV;

async function createWorkerBlobURL(workerUrl: string): Promise<string> {
  const response = await fetch(workerUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch worker: " + response.status);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

const CDN_URLS = {
  mvp: {
    mainModule: DUCKDB_CDN + "/duckdb-mvp.wasm",
    mainWorker: DUCKDB_CDN + "/duckdb-browser-mvp.worker.js",
  },
  eh: {
    mainModule: DUCKDB_CDN + "/duckdb-eh.wasm",
    mainWorker: DUCKDB_CDN + "/duckdb-browser-eh.worker.js",
  },
};

async function getDevBundles(): Promise<duckdb.DuckDBBundles> {
  // Always use CDN bundles to avoid bundling large WASM files (~70MB)
  // This keeps the build size small for Cloudflare Pages/Workers deployment
  console.log("[DuckDB] Using CDN bundles for all environments...");
  return getProdBundles();
}

async function getProdBundles(): Promise<duckdb.DuckDBBundles> {
  console.log("[DuckDB] Loading production bundles from CDN...");
  const [mvpWorkerBlob, ehWorkerBlob] = await Promise.all([
    createWorkerBlobURL(CDN_URLS.mvp.mainWorker),
    createWorkerBlobURL(CDN_URLS.eh.mainWorker),
  ]);
  console.log("[DuckDB] Production bundles loaded");
  return {
    mvp: { mainModule: CDN_URLS.mvp.mainModule, mainWorker: mvpWorkerBlob },
    eh: { mainModule: CDN_URLS.eh.mainModule, mainWorker: ehWorkerBlob },
  };
}

export async function getBundles(): Promise<duckdb.DuckDBBundles> {
  return isDevelopment ? getDevBundles() : getProdBundles();
}

export const duckDBConfig = {
  MEMORY_LIMIT: "4GB",
  TEMP_DIRECTORY: "/tmp/duckdb",
  REQUIRED_EXTENSIONS: ["json", "parquet"],
};

export function cleanupWorkerBlobUrls(bundles: duckdb.DuckDBBundles) {
  try {
    if (bundles.mvp?.mainWorker && typeof bundles.mvp.mainWorker === "string") {
      URL.revokeObjectURL(bundles.mvp.mainWorker);
    }
    if (bundles.eh?.mainWorker && typeof bundles.eh.mainWorker === "string") {
      URL.revokeObjectURL(bundles.eh.mainWorker);
    }
  } catch (error) {
    console.error("[DuckDB] Failed to cleanup worker blob URLs:", error);
  }
}
