import { create } from 'zustand';
import { cloudStorageService } from '@/lib/api/cloudStorageService';
import { useAppStore } from './appStore';
import { useDuckDBStore } from './duckDBStore';
import { ColumnType } from '@/types/csv';

export enum WorkspaceType {
  LOCAL = 'local',
  CLOUD = 'cloud',
}

export enum CloudFileStatus {
  SYNCED = 'synced',
  SYNCING = 'syncing',
  PENDING = 'pending',
  ERROR = 'error',
}

export interface CloudProject {
  id: string;
  name: string;
  description?: string;
  type: WorkspaceType;
  storageUsed: string;
  fileCount: number;
  settings?: {
    autoSync?: boolean;
    versioningEnabled?: boolean;
    defaultFileFormat?: string;
  };
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudFile {
  id: string;
  projectId: string;
  projectName?: string;
  fileName: string;
  originalName: string;
  fileSize: string;
  compressedSize?: string;
  mimeType: string;
  status: CloudFileStatus;
  metadata?: {
    rowCount?: number;
    columnCount?: number;
    fileType?: string;
    compressed?: boolean;
    tableName?: string;
  };
  isShared: boolean;
  sharedFileId?: string;
  lastAccessedAt?: Date;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudStorageStats {
  totalStorageUsed: string;
  storageLimit: string;
  storagePercentage: number;
  totalFiles: number;
  totalProjects: number;
  plan: string;
}

interface CloudStoreState {
  // State
  cloudProjects: CloudProject[];
  cloudFiles: CloudFile[];
  currentCloudProject: CloudProject | null;
  storageStats: CloudStorageStats | null;
  
  // UI State
  isLoading: boolean;
  isSyncing: boolean;
  isUploadingToCloud: boolean;
  uploadProgress: number;
  error: string | null;
  
  // Modal State
  isSaveToCloudModalOpen: boolean;
  saveToCloudFileId: string | null;
  
  // Actions
  loadCloudProjects: () => Promise<void>;
  loadWorkspaceProjects: (workspaceId: string) => Promise<void>;
  createCloudProject: (workspaceId: string, name: string, description?: string) => Promise<CloudProject>;
  renameCloudProject: (projectId: string, newName: string) => Promise<void>;
  deleteCloudProject: (projectId: string) => Promise<void>;
  switchToCloudProject: (projectId: string) => Promise<void>;
  switchToLocalWorkspace: () => void;
  
  // File Operations
  saveToCloud: (fileId: string, projectId: string, options?: {
    replaceIfExists?: boolean;
    keepVersionHistory?: boolean;
  }) => Promise<void>;
  loadFromCloud: (cloudFileId: string) => Promise<void>;
  deleteFromCloud: (cloudFileId: string) => Promise<void>;
  
  // Cloud Files
  loadCloudFiles: (projectId?: string) => Promise<void>;
  loadAllCloudFiles: () => Promise<void>;
  
  // Storage Stats
  loadStorageStats: () => Promise<void>;
  
  // Modal Actions
  openSaveToCloudModal: (fileId: string) => void;
  closeSaveToCloudModal: () => void;
  
  // Helpers
  setError: (error: string | null) => void;
  clearError: () => void;
  getCloudProjectById: (id: string) => CloudProject | undefined;
  formatStorageSize: (bytes: string | number) => string;
}

export const useCloudStore = create<CloudStoreState>((set, get) => ({
  // Initial state
  cloudProjects: [],
  cloudFiles: [],
  currentCloudProject: null,
  storageStats: null,
  
  // UI State
  isLoading: false,
  isSyncing: false,
  isUploadingToCloud: false,
  uploadProgress: 0,
  error: null,
  
  // Modal State
  isSaveToCloudModalOpen: false,
  saveToCloudFileId: null,
  
  // Load cloud projects
  // Load all cloud projects user has access to
  loadCloudProjects: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const projects = await cloudStorageService.getUserProjects();
      set({ 
        cloudProjects: projects,
        isLoading: false,
      });
      
      // Set default project if exists
      const defaultProject = projects.find(p => p.isDefault);
      if (defaultProject) {
        set({ currentCloudProject: defaultProject });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load cloud projects';
      set({ 
        error: message,
        isLoading: false,
      });
    }
  },

  // Load projects in a specific workspace
  loadWorkspaceProjects: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const projects = await cloudStorageService.getWorkspaceProjects(workspaceId);
      set({ 
        cloudProjects: projects,
        isLoading: false,
      });
      
      // Set default project if exists
      const defaultProject = projects.find(p => p.isDefault);
      if (defaultProject) {
        set({ currentCloudProject: defaultProject });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workspace projects';
      set({ 
        error: message,
        isLoading: false,
      });
    }
  },
  
  // Create cloud project
  createCloudProject: async (workspaceId: string, name: string, description?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const project = await cloudStorageService.createCloudProject(workspaceId, {
        name,
        description,
        type: WorkspaceType.CLOUD,
      });
      
      set(state => ({
        cloudProjects: [...state.cloudProjects, project],
        currentCloudProject: project,
        isLoading: false,
      }));
      
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project';
      set({ 
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },
  
  // Rename cloud project
  renameCloudProject: async (projectId: string, newName: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const updatedProject = await cloudStorageService.renameCloudProject(projectId, newName);
      
      set(state => ({
        cloudProjects: state.cloudProjects.map(p => 
          p.id === projectId ? { ...p, name: newName } : p
        ),
        currentCloudProject: state.currentCloudProject?.id === projectId 
          ? { ...state.currentCloudProject, name: newName }
          : state.currentCloudProject,
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename project';
      set({ 
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },
  
  // Delete cloud project
  deleteCloudProject: async (projectId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await cloudStorageService.deleteCloudProject(projectId);
      
      set(state => ({
        cloudProjects: state.cloudProjects.filter(p => p.id !== projectId),
        currentCloudProject: state.currentCloudProject?.id === projectId 
          ? null 
          : state.currentCloudProject,
        isLoading: false,
      }));
      
      // If we just deleted the current project, switch to local workspace
      const state = get();
      if (!state.currentCloudProject) {
        const appStore = useAppStore.getState();
        appStore.clearActiveProject();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project';
      set({ 
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },
  
  // Switch to cloud project
  switchToCloudProject: async (projectId: string) => {
    const project = get().cloudProjects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Clear local workspace state when switching to cloud
    const appStore = useAppStore.getState();
    appStore.clearActiveProject();
    
    set({ currentCloudProject: project });
    
    // Load files for this project
    await get().loadCloudFiles(projectId);
  },

  // Switch to local workspace (clear cloud state)
  switchToLocalWorkspace: () => {
    set({ currentCloudProject: null });
  },
  
  // Save file to cloud
  saveToCloud: async (fileId: string, projectId: string, options = {}) => {
    const appStore = useAppStore.getState();
    const duckDBStore = useDuckDBStore.getState();
    
    // Get file from app store
    const file = appStore.files.find(f => f.id === fileId);
    if (!file) {
      throw new Error('File not found');
    }
    
    set({ 
      isUploadingToCloud: true,
      uploadProgress: 0,
      error: null,
    });
    
    try {
      // Step 1: Export data from DuckDB (10%)
      set({ uploadProgress: 10 });
      console.log('[CloudStore] Exporting data from DuckDB:', file.tableName);
      
      // Ensure table exists and get correct name (fixes sync issues)
      const actualTableName = await duckDBStore.ensureTableExists(file.tableName) || file.tableName;
      console.log('[CloudStore] Verified table name:', actualTableName);
      
      set({ uploadProgress: 20 });
      
      // Step 2: Export to Parquet with full type preservation (20-70%)
      console.log('[CloudStore] Exporting to Parquet for optimal type preservation...');
      const parquetExport = await duckDBStore.exportTableToParquet(actualTableName);
      
      set({ uploadProgress: 70 });
      
      // Step 3: Create optimized Parquet file (70-80%)
      const parquetFileName = file.fileName.replace(/\.[^/.]+$/, '') + '.parquet';
      const parquetBlob = new Blob([parquetExport.parquetBuffer], { 
        type: 'application/octet-stream' 
      });
      const parquetFile = new File([parquetBlob], parquetFileName, {
        type: 'application/octet-stream',
        lastModified: Date.now()
      });
      
      console.log('[CloudStore] Parquet file created:', {
        originalName: file.fileName,
        parquetName: parquetFileName,
        originalSize: file.fileSize || 'unknown',
        parquetSize: parquetExport.parquetBuffer.byteLength,
        compressionRatio: ((1 - parquetExport.parquetBuffer.byteLength / (Number(file.fileSize) || parquetExport.parquetBuffer.byteLength)) * 100).toFixed(1) + '%',
        rowCount: parquetExport.rowCount,
        preservedSchema: parquetExport.schema.length + ' columns'
      });
      
      set({ uploadProgress: 80 });
      
      // Step 4: Upload Parquet file to cloud (80-95%)
      const metadata = {
        originalName: file.fileName,
        tableName: actualTableName,
        rowCount: parquetExport.rowCount,
        columnCount: parquetExport.schema.length,
        storageFormat: 'parquet',
        originalFileType: file.sourceType || (file.fileName.toLowerCase().endsWith('.parquet') ? 'PARQUET' : 
                       file.fileName.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 
                       file.fileName.toLowerCase().endsWith('.json') ? 'JSON' : 'CSV'),
        
        // Enhanced schema preservation metadata
        schema: parquetExport.schema,
        typePreservation: {
          enabled: true,
          version: '1.0.0',
          preservedTypes: parquetExport.schema.map(col => ({
            column: col.name,
            originalType: col.type,
            nullable: !col.notnull,
            isPrimaryKey: col.pk === 1,
            defaultValue: col.dflt_value
          }))
        },
        
        // File extension preservation
        originalExtension: file.fileName.split('.').pop()?.toLowerCase() || 'csv',
        
        // Performance metadata
        compressionRatio: ((1 - parquetExport.parquetBuffer.byteLength / (Number(file.fileSize) || parquetExport.parquetBuffer.byteLength)) * 100).toFixed(1) + '%',
        parquetSize: parquetExport.parquetBuffer.byteLength,
        createdAt: new Date().toISOString()
      };
      
      console.log('[CloudStore] Uploading to cloud with enhanced metadata:', {
        storageFormat: metadata.storageFormat,
        typePreservation: metadata.typePreservation.enabled,
        preservedTypes: metadata.typePreservation.preservedTypes.length
      });
      
      const uploadResult = await cloudStorageService.uploadToCloud(
        parquetFile,
        {
          projectId,
          fileName: file.fileName, // Keep original display name
          metadata,
          ...options,
        },
        (progress) => {
          // Update progress from 80 to 95 based on upload
          set({ uploadProgress: 80 + (progress * 15) });
        }
      );
      
      set({ uploadProgress: 95 });
      
      // Step 5: Update local state (100%)
      set(state => ({
        cloudFiles: [uploadResult.file, ...state.cloudFiles.filter(f => f.id !== uploadResult.file.id)],
        storageStats: uploadResult.storageStats,
        isUploadingToCloud: false,
        uploadProgress: 100,
      }));
      
      // Update projects with new storage info
      await get().loadCloudProjects();
      
      console.log('[CloudStore] File saved to cloud successfully:', uploadResult.file.fileName);
      
      // Reset progress after delay
      setTimeout(() => set({ uploadProgress: 0 }), 1000);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save to cloud';
      console.error('[CloudStore] Save to cloud failed:', error);
      set({ 
        error: message,
        isUploadingToCloud: false,
        uploadProgress: 0,
      });
      throw error;
    }
  },
  
  // Load file from cloud with Parquet-first schema preservation
  loadFromCloud: async (cloudFileId: string) => {
    const file = get().cloudFiles.find(f => f.id === cloudFileId);
    if (!file) {
      throw new Error('Cloud file not found');
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const appStore = useAppStore.getState();
      
      // Check for duplicate files to prevent multiple tabs (simplified and more reliable)
      const existingFile = appStore.files.find(f => f.cloudFileId === cloudFileId);

      if (existingFile) {
        appStore.setActiveFile(existingFile.id);
        set({ isLoading: false });
        console.log('[CloudStore] Duplicate detected, switching to existing tab:', existingFile.id);
        return;
      }

      // Get download URL
      const accessData = await cloudStorageService.getFileAccess(cloudFileId);
      
      // Download file
      const response = await fetch(accessData.downloadUrl);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      let blob = await response.blob();
      
      // Decompress if needed
      if (accessData.compressed) {
        const decompressionModule = await import('pako');
        const pako = decompressionModule.default || decompressionModule;
        
        const arrayBuffer = await blob.arrayBuffer();
        const decompressed = pako.inflate(new Uint8Array(arrayBuffer));
        blob = new Blob([decompressed], { type: accessData.mimeType });
      }
      
      // Determine file type and create appropriate File object
      const isParquetStorage = file.metadata?.storageFormat === 'parquet';
      const originalFileName = file.metadata?.originalName || file.fileName;
      
      let downloadedFile: File;
      if (isParquetStorage) {
        // For Parquet files, ensure proper extension for DuckDB recognition
        const parquetName = originalFileName.replace(/\.[^/.]+$/, '') + '.parquet';
        downloadedFile = new File([blob], parquetName, { 
          type: 'application/octet-stream' 
        });
        console.log('[CloudStore] Loading Parquet file:', parquetName);
      } else {
        // Legacy CSV or other formats
        downloadedFile = new File([blob], originalFileName, { 
          type: accessData.mimeType 
        });
        console.log('[CloudStore] Loading legacy file:', originalFileName);
      }
      
      // Import with schema preservation and streaming support
      const duckDBStore = useDuckDBStore.getState();
      const fileSizeMB = blob.size / (1024 * 1024);
      
      // Progress callback for UI feedback
      const handleProgress = (progress: number, status: string) => {
        console.log(`[CloudStore] ${status} (${Math.round(progress * 100)}%)`);
        // Could emit progress events here for UI progress bars
      };
      
      let result;
      if (isParquetStorage && file.metadata?.schema) {
        console.log(`[CloudStore] Using streaming Parquet import with schema preservation (${fileSizeMB.toFixed(1)}MB)...`);
        console.log('[CloudStore] Preserved schema:', JSON.stringify(file.metadata.schema, null, 2));
        
        // Use new streaming method for all cloud files (it handles size detection internally)
        result = await duckDBStore.importCloudFileStreaming(
          downloadedFile, 
          originalFileName, 
          blob.size, 
          file.metadata.schema, 
          handleProgress
        );
      } else {
        console.log(`[CloudStore] Using streaming standard import (${fileSizeMB.toFixed(1)}MB)...`);
        
        // Use streaming method for standard imports too
        result = await duckDBStore.importCloudFileStreaming(
          downloadedFile, 
          originalFileName, 
          blob.size, 
          undefined, 
          handleProgress
        );
      }
      
      // Safe logging that handles BigInt values
      const safeStringify = (obj: any): string => {
        return JSON.stringify(obj, (key, value) => 
          typeof value === 'bigint' ? value.toString() + 'n' : value
        , 2);
      };
      
      console.log('[CloudStore] Import result structure:', safeStringify(result));
      
      if (result) {
        // Determine final table name (may have been corrected during schema application)
        let finalTableName = result.tableName;
        
        // If we have preserved metadata and original table name, try to use it
        if (file.metadata?.tableName && file.metadata.tableName !== result.tableName) {
          // Try to use the original table name if schema was successfully applied
          if (result.schemaApplied) {
            finalTableName = file.metadata.tableName;
          }
        }

        // Generate columnTypes from schema for proper cell formatting
        const columnTypes: ColumnType[] = [];
        if (file.metadata?.schema && Array.isArray(file.metadata.schema)) {
          file.metadata.schema.forEach((col: any) => {
            const duckDbType = col.type?.toLowerCase() || '';
            
            if (duckDbType.includes('int') || duckDbType.includes('double') || duckDbType.includes('float') || 
                duckDbType.includes('decimal') || duckDbType.includes('numeric') || duckDbType.includes('smallint')) {
              columnTypes.push(ColumnType.Number);
            } else if (duckDbType.includes('bool')) {
              columnTypes.push(ColumnType.Boolean);
            } else if (duckDbType.includes('date') || duckDbType.includes('time')) {
              columnTypes.push(ColumnType.Date);
            } else {
              columnTypes.push(ColumnType.Text);
            }
          });
        }

        const fileData = {
          ...result,
          id: `cloud_${cloudFileId}`,
          fileName: originalFileName,
          tableName: finalTableName,
          sourceType: file.metadata?.originalFileType || file.metadata?.originalExtension?.toUpperCase() || 'CSV',
          columnTypes: columnTypes.length > 0 ? columnTypes : undefined,
          cloudFileId,
          projectId: file.projectId,
          cloudMetadata: file.metadata,
          schemaPreserved: result.schemaApplied || false,
        };
        
        appStore.addFile(fileData);
        
        console.log('[CloudStore] File loaded from cloud with type preservation:', {
          fileName: originalFileName,
          tableName: finalTableName,
          storageFormat: file.metadata?.storageFormat,
          schemaPreserved: result.schemaApplied || false,
          typePreservation: file.metadata?.typePreservation?.enabled || false,
          columnTypes: columnTypes,
          schemaColumns: file.metadata?.schema?.length || 0,
          streamingUsed: result.streamingUsed || false,
          fileSizeMB: fileSizeMB.toFixed(1)
        });
      }
      
      set({ isLoading: false });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load from cloud';
      console.error('[CloudStore] Load from cloud failed:', error);
      set({ 
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },
  
  // Delete file from cloud
  deleteFromCloud: async (cloudFileId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await cloudStorageService.deleteFile(cloudFileId);
      
      // Remove from local state
      set(state => ({
        cloudFiles: state.cloudFiles.filter(f => f.id !== cloudFileId),
        isLoading: false,
      }));
      
      // Reload storage stats
      await get().loadStorageStats();
      
      console.log('[CloudStore] File deleted from cloud:', cloudFileId);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete file';
      set({ 
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },
  
  // Load cloud files
  loadCloudFiles: async (projectId?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      let files: CloudFile[];
      
      if (projectId) {
        files = await cloudStorageService.getProjectFiles(projectId);
      } else {
        files = await cloudStorageService.getAllUserFiles();
      }
      
      set({ 
        cloudFiles: files,
        isLoading: false,
      });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load cloud files';
      set({ 
        error: message,
        isLoading: false,
      });
    }
  },
  
  // Load all cloud files
  loadAllCloudFiles: async () => {
    await get().loadCloudFiles();
  },
  
  // Load storage statistics
  loadStorageStats: async () => {
    try {
      const stats = await cloudStorageService.getStorageStats();
      set({ storageStats: stats });
    } catch (error) {
      console.error('[CloudStore] Failed to load storage stats:', error);
    }
  },
  
  // Modal actions
  openSaveToCloudModal: (fileId: string) => {
    set({ 
      isSaveToCloudModalOpen: true,
      saveToCloudFileId: fileId,
      error: null,
    });
  },
  
  closeSaveToCloudModal: () => {
    set({ 
      isSaveToCloudModalOpen: false,
      saveToCloudFileId: null,
    });
  },
  
  // Helpers
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  
  getCloudProjectById: (id: string) => {
    return get().cloudProjects.find(p => p.id === id);
  },
  
  formatStorageSize: (bytes: string | number) => {
    const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    const gb = size / (1024 * 1024 * 1024);
    const mb = size / (1024 * 1024);
    
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    } else if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    } else {
      return `${(size / 1024).toFixed(2)} KB`;
    }
  },
}));