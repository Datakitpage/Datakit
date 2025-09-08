import { create } from 'zustand';
import { cloudStorageService } from '@/lib/api/cloudStorageService';
import { useAppStore } from './appStore';
import { useDuckDBStore } from './duckDBStore';

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
      
      // Get the actual table name
      const tableCheckQuery = `SHOW TABLES`;
      const tables = await duckDBStore.executeQuery(tableCheckQuery);
      const tableList = tables?.toArray() || [];
      
      let actualTableName = file.tableName;
      if (tableList.length > 0) {
        const tableNames = tableList.map((t: any) => t.name || t.Name || Object.values(t)[0]);
        const matchingTable = tableNames.find((name: string) => 
          name.toLowerCase() === file.tableName.toLowerCase()
        );
        
        if (matchingTable) {
          actualTableName = matchingTable;
        }
      }
      
      // Export data from DuckDB
      const dataQuery = `SELECT * FROM "${actualTableName}"`;
      const result = await duckDBStore.executeQuery(dataQuery);
      
      if (!result) {
        throw new Error('Failed to export data from DuckDB');
      }
      
      set({ uploadProgress: 30 });
      
      // Step 2: Convert to CSV (50%)
      const rows = result.toArray();
      const headers = Object.keys(rows[0] || {});
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          headers.map(h => {
            const value = row[h];
            // Handle BigInt values
            if (typeof value === 'bigint') {
              return value.toString();
            }
            // Escape values containing commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          }).join(',')
        )
      ].join('\n');
      
      set({ uploadProgress: 50 });
      
      // Step 3: Create file blob (60%)
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const csvFile = new File([blob], file.fileName, { type: 'text/csv' });
      
      set({ uploadProgress: 60 });
      
      // Step 4: Upload to cloud (60-90%)
      const metadata = {
        originalName: file.fileName,
        rowCount: typeof file.rowCount === 'bigint' ? Number(file.rowCount) : file.rowCount,
        columnCount: typeof file.columnCount === 'bigint' ? Number(file.columnCount) : file.columnCount,
        fileType: 'csv',
        tableName: actualTableName,
      };
      
      const uploadResult = await cloudStorageService.uploadToCloud(
        csvFile,
        {
          projectId,
          fileName: file.fileName,
          metadata,
          ...options,
        },
        (progress) => {
          // Update progress from 60 to 90 based on upload
          set({ uploadProgress: 60 + (progress * 30) });
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
  
  // Load file from cloud
  loadFromCloud: async (cloudFileId: string) => {
    const file = get().cloudFiles.find(f => f.id === cloudFileId);
    if (!file) {
      throw new Error('Cloud file not found');
    }
    
    set({ isLoading: true, error: null });
    
    try {
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
      
      // Create File object
      const downloadedFile = new File([blob], file.fileName, { 
        type: accessData.mimeType 
      });
      
      // Import into DuckDB
      const duckDBStore = useDuckDBStore.getState();
      const result = await duckDBStore.importFileDirectly(downloadedFile);
      
      if (result) {
        // Add to app store
        const appStore = useAppStore.getState();
        const fileData = {
          ...result,
          id: `cloud_${cloudFileId}`,
          fileName: file.fileName,
          cloudFileId,
          projectId: file.projectId,
        };
        
        appStore.addFile(fileData);
        
        console.log('[CloudStore] File loaded from cloud:', file.fileName);
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