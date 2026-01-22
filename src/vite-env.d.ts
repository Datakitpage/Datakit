/// <reference types="vite/client" />

declare module "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url" {
  const url: string;
  export default url;
}

declare module "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url" {
  const url: string;
  export default url;
}

declare module "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url" {
  const url: string;
  export default url;
}

declare module "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url" {
  const url: string;
  export default url;
}
