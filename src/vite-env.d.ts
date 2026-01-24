/// <reference types="vite/client" />

// Asset imports
declare module "*.webp" {
  const src: string;
  export default src;
}

// File System Access API permission extensions
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemFileHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
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
