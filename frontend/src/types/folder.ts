/**
 * Folder structure types for the new folder-based file management system
 */

export type FileType = 'csv' | 'json' | 'excel' | 'parquet' | 'txt' | 'duckdb' | 'remote' | 'query';

export interface WorkspaceFile {
  id: string;
  name: string;
  originalName?: string; // Original filename on disk (for handle verification)
  path?: string;
  type: FileType;
  size?: number;
  isRemote?: boolean;
  remoteUrl?: string;
  lastModified?: number;
  handle?: FileSystemFileHandle; // Store file handle for automatic access
}

export interface FileData {
  /** File system handle for direct access */
  handle?: FileSystemFileHandle;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  lastModified?: number;
  /** Whether the file is loaded into DuckDB */
  isLoaded?: boolean;
  /** DuckDB table name if loaded */
  tableName?: string;
  /** Whether this is a remote file */
  isRemote?: boolean;
  /** URL for remote files */
  remoteUrl?: string;
  /** Whether this is a temporary query result */
  isTemporary?: boolean;
  /** File extension/type */
  fileType?: FileType;
  /** For linked folders - original file path */
  originalPath?: string;
  /** Number of rows in the table */
  rowCount?: number;
  /** Number of columns in the table */
  columnCount?: number;
  /** Original source file name for temporary tables */
  sourceFileName?: string;
}

export interface FolderNode {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Node type */
  type: 'folder' | 'file';
  /** Parent folder ID (null for root items) */
  parentId: string | null;
  /** Child nodes (only for folders) */
  children?: FolderNode[];

  /** File-specific data */
  fileData?: FileData;

  /** Folder-specific properties */
  folderData?: {
    /** Is this the Draft folder? */
    isDraft?: boolean;
    /** Is this a linked folder (watches file system)? */
    isLinked?: boolean;
    /** Directory handle for linked folders */
    directoryHandle?: FileSystemDirectoryHandle;
    /** Is this the Remote Sources folder? */
    isRemote?: boolean;
    /** Is this the Temporary Tables folder? */
    isTemp?: boolean;
  };

  /** UI state */
  isExpanded?: boolean;
  isSelected?: boolean;
  /** Timestamp when node was created */
  createdAt?: number;
  /** Timestamp when node was last modified */
  modifiedAt?: number;
}

export interface FolderTreeState {
  /** Root nodes (top-level folders and files) */
  roots: FolderNode[];
  /** Flat map for quick lookups by ID */
  nodeMap: Map<string, FolderNode>;
  /** Currently selected node IDs */
  selectedIds: Set<string>;
  /** Currently expanded folder IDs */
  expandedIds: Set<string>;
}

/** Drag and drop data transfer type */
export interface DraggedNode {
  nodeId: string;
  type: 'folder' | 'file';
  parentId: string | null;
}

/** File import options */
export interface FileImportOptions {
  /** Target folder ID */
  targetFolderId?: string;
  /** Whether to load immediately into DuckDB */
  loadImmediately?: boolean;
  /** Whether to maintain folder structure for folder imports */
  preserveStructure?: boolean;
}