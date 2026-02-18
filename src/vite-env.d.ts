/// <reference types="vite/client" />

// Google API (gapi) and Picker API type declarations
interface Window {
  gapi: {
    load(api: string, config: { callback: () => void; onerror: () => void }): void;
  };
}

declare namespace google.picker {
  enum ViewId {
    SPREADSHEETS = 'spreadsheets',
  }

  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
  }

  interface Document {
    id: string;
    name: string;
    mimeType: string;
    url: string;
  }

  interface ResponseObject {
    action: Action;
    docs: Document[];
  }

  class DocsView {
    constructor(viewId: ViewId);
    setIncludeFolders(include: boolean): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
  }

  class PickerBuilder {
    addView(view: DocsView): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }

  class Picker {
    setVisible(visible: boolean): void;
  }
}

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
