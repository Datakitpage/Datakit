/**
 * Import provider types
 */
export type ImportProvider =
  | "s3"
  | "gcs"
  | "aws"
  | "google-drive"
  | "custom-url"
  | "huggingface"
  | "google-sheets"
  | "motherduck"
  | "postgresql"
  | "databricks";

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  id: ImportProvider;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  comingSoon?: boolean;
  phase?: number;
}

/**
 *  Public dataset interface
 */
export interface PublicDataset {
  id: string;
  name: string;
  description: string;
  category:
    | "weather"
    | "government"
    | "research"
    | "business"
    | "finance"
    | "health"
    | "transportation"
    | "education"
    | "sample";
  format: string[];
  size: string;
  lastUpdated: string;

  // Provider-specific URLs
  url: string; // Primary URL for import
  s3Url?: string; // S3 URL (for AWS datasets)
  httpUrl?: string; // Direct HTTP URL

  documentation?: string;
  tags: string[];
  featured: boolean;

  // Provider info
  provider: ImportProvider

  // Optional fields
  license?: string;
  updateFrequency?: string;

  // AWS-specific (for S3 datasets)
  bucket?: string;
  region?: string;
  corsStatus?: "direct" | "proxy-required" | "limited";

  // GitHub-specific
  repository?: string;
  branch?: string;
  path?: string;
}

/**
 * Dataset category structure
 */
export interface DatasetCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  datasets: PublicDataset[];
}

/**
 * Import progress state
 */
export interface ImportProgress {
  stage: "connecting" | "downloading" | "processing" | "complete" | "error";
  progress: number; // 0-1
  message: string;
  bytesLoaded?: number;
  bytesTotal?: number;
}


/**
 * Environment configuration
 */
export interface GoogleAPIConfig {
  apiKey: string;
  clientId: string;
  discoveryDoc: string;
  scope: string;
}


export interface MotherDuckDatabase {
  name: string;
  shared: boolean;
  tableCount?: number;
  lastAccessed?: string;
  owner?: string;
}

export interface MotherDuckTable {
  name: string;
  database: string;
  rowCount?: number;
  columnCount?: number;
  size?: string;
  lastModified?: string;
  schema?: Array<{ name: string; type: string }>;
  description?: string;
}

export interface MotherDuckConnection {
  token: string;
  isConnected: boolean;
  databases: MotherDuckDatabase[];
  currentDatabase?: string;
  lastConnected?: Date;
}

export interface MotherDuckImportResult {
  data: string[][];
  columnTypes: any[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType: any;
  loadedToDuckDB: boolean;
  tableName: string;
  isRemote: true;
  remoteProvider: "motherduck";
  remoteURL: string;
  motherDuck: {
    database: string;
    table: string;
    originalRowCount?: number;
    token?: string; // Optional, for session persistence
  };
}


/**
 * Error types for remote imports
 */
export class RemoteImportError extends Error {
  constructor(
    message: string,
    public provider: ImportProvider,
    public code?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = "RemoteImportError";
  }
}

export class AuthenticationError extends RemoteImportError {
  constructor(provider: ImportProvider, message = "Authentication failed") {
    super(message, provider, "AUTH_ERROR");
    this.name = "AuthenticationError";
  }
}

export class NetworkError extends RemoteImportError {
  constructor(provider: ImportProvider, message = "Network request failed") {
    super(message, provider, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class FormatError extends RemoteImportError {
  constructor(provider: ImportProvider, format: string) {
    super(`Unsupported file format: ${format}`, provider, "FORMAT_ERROR");
    this.name = "FormatError";
  }
}

/**
 * File validation utilities
 */
export const SUPPORTED_MIME_TYPES = [
  "text/csv",
  "application/json",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.spreadsheet",
  "text/plain",
  "application/octet-stream", // For parquet files
] as const;
