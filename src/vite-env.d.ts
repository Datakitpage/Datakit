/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_POSTHOG_KEY: string
  readonly VITE_PUBLIC_POSTHOG_HOST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

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
