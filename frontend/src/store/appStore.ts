import { create } from "zustand";
import {
  get as getFromIndexDB,
  set as setToIndexDB,
  keys,
  del,
} from "idb-keyval";

import { DataSourceType } from "@/types/json";
import { DataFile, DataLoadWithDuckDBResult } from "@/types/multiFile";
import { ImportProvider } from "@/types/remoteImport";
import { DucklakeCatalog } from "@/lib/duckdb/ducklake";
import { LocalProjectFile } from "@/components/projects/FileTreeView";

/**
 * Interface for a local project
 */
export interface LocalProject {
  /** Unique identifier for the project */
  id: string;
  /** User-provided project name */
  name: string;
  /** Array of files in this project */
  files: LocalProjectFile[];
  /** Timestamp when project was created */
  createdAt: number;
  /** Timestamp when project was last modified */
  lastModified: number;
  /** Whether this is the draft (unsaved) project */
  isDraft?: boolean;
}

/**
 * Interface for a saved or recent query
 */
export interface SavedQuery {
  /** Unique identifier for the query */
  id: string;
  /** User-provided or auto-generated name */
  name: string;
  /** SQL query text */
  query: string;
  /** Timestamp when the query was saved */
  timestamp: number;
  /** Whether this is a favorite/saved query */
  isFavorite: boolean;
}

/**
 * Interface for split view state
 */
interface SplitViewState {
  /** Whether split view is currently active */
  isActive: boolean;
  /** ID of the file in the left panel */
  leftFileId: string | null;
  /** ID of the file in the right panel */
  rightFileId: string | null;
  /** Split ratio (0.5 = 50/50 split) */
  splitRatio: number;
}

/**
 * Interface for application state managed by Zustand
 */
interface AppState {
  // Multi-file state
  /** Array of all imported files/datasets */
  files: DataFile[];
  /** ID of the currently active/viewed file */
  activeFileId: string | null;

  // Split view state
  /** Side-by-side file comparison state */
  splitView: SplitViewState;

  // UI state
  /** Currently active tab ID */
  activeTab: string;
  /** View mode for JSON data (table or tree) */
  jsonViewMode: "table" | "tree";
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Whether the app is running inside an iframe */
  isInIframe: boolean;

  // Query history state
  /** Array of recent queries */
  recentQueries: SavedQuery[];
  /** Array of saved queries */
  savedQueries: SavedQuery[];
  /** Pending query to be loaded in query tab */
  pendingQuery: string | null;

  // Local project state
  /** Array of all local projects */
  localProjects: LocalProject[];
  /** ID of the currently active local project */
  activeProjectId: string;
  /** Files in the current project (denormalized for easy access) */
  projectFiles: LocalProjectFile[];

  // Multi-file actions
  /** Add a new file to the collection */
  addFile: (fileData: DataLoadWithDuckDBResult) => string;
  /** Remove a file from the collection */
  removeFile: (fileId: string) => void;
  /** Set the active file */
  setActiveFile: (fileId: string) => void;
  /** Close all files */
  closeAllFiles: () => void;
  /** Close all files except the specified one */
  closeOthersFiles: (keepFileId: string) => void;
  /** Update a file's data */
  updateFile: (fileId: string, updates: Partial<DataFile>) => void;

  // Split view actions
  /** Enable split view with two files */
  setSplitView: (leftFileId: string, rightFileId: string) => void;
  /** Close split view and return to single file view */
  closeSplitView: () => void;
  /** Update the split ratio */
  updateSplitRatio: (ratio: number) => void;
  /** Swap the left and right files */
  swapSplitFiles: () => void;
  /** Set split view for a specific file */
  setFileSplitView: (fileId: string, partnerId: string | null, position?: 'left' | 'right') => void;
  /** Clear split view for a specific file */
  clearFileSplitView: (fileId: string) => void;

  // UI actions
  /** Change the active tab */
  setActiveTab: (tab: string) => void;
  /** Change the JSON view mode */
  setJsonViewMode: (mode: "table" | "tree") => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Set iframe state */
  setIsInIframe: (isInIframe: boolean) => void;
  isRemoteModalOpen: boolean;
  activeProviderRemoteModal: ImportProvider;

  // Legacy actions (for backward compatibility)
  /** Set the data grid content (updates active file) */
  setData: (data: string[][] | undefined) => void;
  /** Load data from parsed result (legacy - delegates to addFile) */
  loadData: (result: DataLoadWithDuckDBResult) => void;
  /** Reset state to initial values */
  resetState: () => void;

  // Query history actions
  /** Add a query to recent history */
  addRecentQuery: (query: string) => void;
  /** Save a query to favorites */
  saveQuery: (query: string, name?: string) => void;
  /** Delete a query */
  deleteQuery: (id: string) => void;
  loadQueriesFromStorage: () => void;
  setIsRemoteModalOpen: (val: boolean) => void;
  setActiveProviderRemoteModal: (val: ImportProvider) => void;
  /** Set a pending query to be loaded in query tab */
  setPendingQuery: (query: string | null) => void;

  // Local project actions
  /** Create a new local project */
  createLocalProject: (name: string) => string;
  /** Switch to a different local project */
  switchLocalProject: (projectId: string) => void;
  /** Clear active project (switch to draft) */
  clearActiveProject: () => void;
  /** Rename a local project */
  renameLocalProject: (projectId: string, newName: string) => void;
  /** Delete a local project */
  deleteLocalProject: (projectId: string) => void;
  /** Add a file to the current project */
  addFileToProject: (file: LocalProjectFile) => void;
  /** Remove a file from the current project */
  removeFileFromProject: (fileId: string) => void;
  /** Rename a file in the current project */
  renameFileInProject: (fileId: string, newName: string) => void;
  /** Save the draft project */
  saveDraftProject: (name: string) => void;
  /** Load projects from storage */
  loadProjectsFromStorage: () => Promise<void>;
  /** Persist projects to storage */
  saveProjectsToStorage: () => Promise<void>;
}

// Create initial draft project
const createDraftProject = (): LocalProject => ({
  id: 'draft',
  name: 'Draft',
  files: [],
  createdAt: Date.now(),
  lastModified: Date.now(),
  isDraft: true
});

// Initial state
const initialState = {
  // Multi-file state
  files: [],
  activeFileId: null,

  // Split view state
  splitView: {
    isActive: false,
    leftFileId: null,
    rightFileId: null,
    splitRatio: 0.5,
  },

  // UI state
  activeTab: "preview",
  jsonViewMode: "table" as const,
  sidebarCollapsed: false,
  isInIframe: false,

  // Query history state
  recentQueries: [],
  savedQueries: [],
  pendingQuery: null,
  isRemoteModalOpen: false,
  activeProviderRemoteModal: 'huggingface' as ImportProvider,

  // Local project state
  localProjects: [createDraftProject()],
  activeProjectId: 'draft',
  projectFiles: [],
};

/**
 * Maximum number of recent queries to keep
 */
const MAX_RECENT_QUERIES = 50;

/**
 * Generate a unique file ID
 */
const generateFileId = (): string => {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate a safe table name from file name
 */
const generateTableName = (fileName: string, fileId: string): string => {
  const safeName = fileName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9_]/g, "_") // Replace non-alphanumeric with underscore
    .toLowerCase();

  // For cloud files (cloud_xxx), use full cloud ID for uniqueness
  // For regular files (file_timestamp_randomId), use the random part
  // For shared files (shared_timestamp), use timestamp
  let uniqueSuffix: string;
  if (fileId.startsWith('cloud_')) {
    // Use the full cloud ID part after 'cloud_' to ensure uniqueness
    uniqueSuffix = fileId.substring(6); // Remove 'cloud_' prefix
  } else if (fileId.startsWith('shared_')) {
    // Use timestamp for shared files
    uniqueSuffix = fileId.substring(7); // Remove 'shared_' prefix
  } else {
    // For regular files, use the random part (last segment)
    uniqueSuffix = fileId.split("_").pop() || "unknown";
  }
  
  return `${safeName}_${uniqueSuffix}`;
};

// Detect if running inside an iframe
const detectIframe = () => {
  try {
    return window.self !== window.top;
  } catch (e) {
    // If we can't access window.top due to cross-origin restrictions,
    // we're likely in an iframe
    return true;
  }
};

// Load sidebar collapsed state from localStorage on initialization
const getSavedSidebarState = () => {
  try {
    // If we're in an iframe, always collapse the sidebar initially
    if (detectIframe()) {
      return true;
    }
    
    const savedState = localStorage.getItem("sidebar-collapsed");
    return savedState === "true"; // Convert string to boolean
  } catch (e) {
    return false; // Default to expanded if there's an error
  }
};

/**
 * Zustand store for managing application state
 */
export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,
  sidebarCollapsed: getSavedSidebarState(),
  isInIframe: detectIframe(),
  
  // Initialize projects on store creation
  ...((() => {
    // Load projects from storage on initialization
    setTimeout(() => {
      get().loadProjectsFromStorage();
    }, 0);
    return {};
  })()),

  // Multi-file actions
  addFile: (fileData: DataLoadWithDuckDBResult): string => {
    // If this is a database attachment, don't add it as a regular file
    // since it doesn't have data to preview
    if (fileData.isDatabaseAttachment) {
      console.log('[AppStore] Database attached, not adding to files list:', fileData.fileName);
      console.log('[AppStore] Attached tables:', fileData.attachedTables);
      // Return a fake ID for compatibility
      return `db-attachment-${Date.now()}`;
    }
    
    const fileId = generateFileId();
    const tableName =
      fileData.tableName || generateTableName(fileData.fileName, fileId);

    const newFile: DataFile = {
      id: fileId,
      fileName: fileData.fileName,
      data: fileData.data,
      columnTypes: fileData.columnTypes,
      sourceType: fileData.sourceType || DataSourceType.CSV,
      rawData: fileData.rawData || null,
      jsonSchema: fileData.schema || null,
      rowCount: fileData.rowCount,
      columnCount: fileData.columnCount,
      loadedToDuckDB: fileData.loadedToDuckDB,
      tableName: tableName,
      isRemote: fileData.isRemote || false,
      remoteURL: fileData.remoteURL,
      remoteProvider: fileData.remoteProvider,
      googleSheets: fileData.googleSheets,
      postgresql: fileData.postgresql,
      importedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    set((state) => ({
      files: [...state.files, newFile],
      activeFileId: fileId, // Auto-switch to new file
    }));

    // Load queries from storage when first file is added
    if (get().files.length === 1) {
      get().loadQueriesFromStorage();
    }

    return fileId;
  },

  removeFile: (fileId: string) => {
    set((state) => {
      const newFiles = state.files.filter((f) => f.id !== fileId);
      let newActiveFileId = state.activeFileId;

      // Clear split view references to this file
      const updatedFiles = newFiles.map(file => {
        if (file.splitView?.partnerId === fileId) {
          return {
            ...file,
            splitView: undefined
          };
        }
        return file;
      });

      // If we're removing the active file, switch to another file
      if (state.activeFileId === fileId) {
        if (updatedFiles.length > 0) {
          // Try to find the next file, or fallback to the first
          const currentIndex = state.files.findIndex((f) => f.id === fileId);
          const nextFile =
            updatedFiles[Math.min(currentIndex, updatedFiles.length - 1)];
          newActiveFileId = nextFile.id;
        } else {
          newActiveFileId = null;
        }
      }

      return {
        files: updatedFiles,
        activeFileId: newActiveFileId,
      };
    });
  },

  setActiveFile: (fileId: string) => {
    set((state) => {
      // Update last accessed time
      const updatedFiles = state.files.map((file) =>
        file.id === fileId ? { ...file, lastAccessedAt: Date.now() } : file
      );

      return {
        files: updatedFiles,
        activeFileId: fileId,
      };
    });
  },

  closeAllFiles: () => {
    set({ files: [], activeFileId: null });
  },

  closeOthersFiles: (keepFileId: string) => {
    set((state) => ({
      files: state.files.filter((f) => f.id === keepFileId),
      activeFileId: keepFileId,
    }));
  },

  updateFile: (fileId: string, updates: Partial<DataFile>) => {
    set((state) => ({
      files: state.files.map((file) =>
        file.id === fileId
          ? { ...file, ...updates, lastAccessedAt: Date.now() }
          : file
      ),
    }));
  },

  // UI actions
  setActiveTab: (activeTab) => set({ activeTab }),

  setJsonViewMode: (jsonViewMode) => set({ jsonViewMode }),

  toggleSidebar: () => {
    const newState = !get().sidebarCollapsed;
    localStorage.setItem("sidebar-collapsed", String(newState));
    set({ sidebarCollapsed: newState });
  },

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  setIsInIframe: (isInIframe) => {
    set({ isInIframe });
  },

  // Split view actions
  setSplitView: (leftFileId: string, rightFileId: string) => {
    set((state) => {
      // Update files with split view info
      const updatedFiles = state.files.map(file => {
        if (file.id === leftFileId) {
          return {
            ...file,
            splitView: {
              isActive: true,
              partnerId: rightFileId,
              position: 'left' as const
            }
          };
        } else if (file.id === rightFileId) {
          return {
            ...file,
            splitView: {
              isActive: true,
              partnerId: leftFileId,
              position: 'right' as const
            }
          };
        }
        return file;
      });

      return {
        files: updatedFiles,
        splitView: {
          isActive: true,
          leftFileId,
          rightFileId,
          splitRatio: 0.5,
        }
      };
    });
  },

  closeSplitView: () => {
    set((state) => {
      // Clear split view from files that were in split mode
      const updatedFiles = state.files.map(file => {
        if (file.splitView?.isActive) {
          return {
            ...file,
            splitView: undefined
          };
        }
        return file;
      });

      return {
        files: updatedFiles,
        splitView: {
          isActive: false,
          leftFileId: null,
          rightFileId: null,
          splitRatio: 0.5,
        }
      };
    });
  },

  updateSplitRatio: (ratio: number) => {
    set((state) => ({
      splitView: {
        ...state.splitView,
        splitRatio: Math.max(0.1, Math.min(0.9, ratio)), // Clamp between 10% and 90%
      }
    }));
  },

  swapSplitFiles: () => {
    set((state) => {
      // Swap files in split view
      const leftId = state.splitView.leftFileId;
      const rightId = state.splitView.rightFileId;
      
      const updatedFiles = state.files.map(file => {
        if (file.id === leftId && file.splitView) {
          return {
            ...file,
            splitView: {
              ...file.splitView,
              position: 'right' as const
            }
          };
        } else if (file.id === rightId && file.splitView) {
          return {
            ...file,
            splitView: {
              ...file.splitView,
              position: 'left' as const
            }
          };
        }
        return file;
      });

      return {
        files: updatedFiles,
        splitView: {
          ...state.splitView,
          leftFileId: state.splitView.rightFileId,
          rightFileId: state.splitView.leftFileId,
        }
      };
    });
  },

  setFileSplitView: (fileId: string, partnerId: string | null, position: 'left' | 'right' = 'left') => {
    set((state) => {
      const updatedFiles = state.files.map(file => {
        if (file.id === fileId) {
          return {
            ...file,
            splitView: partnerId ? {
              isActive: true,
              partnerId,
              position
            } : undefined
          };
        }
        return file;
      });

      return { files: updatedFiles };
    });
  },

  clearFileSplitView: (fileId: string) => {
    set((state) => {
      const updatedFiles = state.files.map(file => {
        if (file.id === fileId || file.splitView?.partnerId === fileId) {
          return {
            ...file,
            splitView: undefined
          };
        }
        return file;
      });

      return { files: updatedFiles };
    });
  },

  // Legacy actions
  setData: (data) => {
    // For backward compatibility, update active file if exists
    const state = get();
    const activeFile = state.files.find((f) => f.id === state.activeFileId);
    if (activeFile && data) {
      get().updateFile(activeFile.id, { data });
    }
  },

  // Load data from result (legacy - now delegates to addFile)
  loadData: (result: DataLoadWithDuckDBResult) => {
    get().addFile(result);
  },

  // Reset state
  resetState: () =>
    set({
      ...initialState,
      sidebarCollapsed: get().sidebarCollapsed,
    }),

  // Query history actions (unchanged)
  addRecentQuery: (query) => {
    if (!query.trim()) return;

    const id = `recent-query:${Date.now()}`;
    const recentQuery: SavedQuery = {
      id,
      name: `Query at ${new Date().toLocaleString()}`,
      query,
      timestamp: Date.now(),
      isFavorite: false,
    };

    setToIndexDB(id, recentQuery).catch(console.error);

    set((state) => ({
      recentQueries: [
        recentQuery,
        ...state.recentQueries
          .filter((q) => q.query !== query)
          .slice(0, MAX_RECENT_QUERIES - 1),
      ],
    }));
  },

  loadQueriesFromStorage: async () => {
    try {
      const allKeys = await keys();
      const savedKeys = allKeys.filter((k) =>
        String(k).startsWith("saved-query:")
      );
      const recentKeys = allKeys.filter((k) =>
        String(k).startsWith("recent-query:")
      );

      const savedQueryPromises = savedKeys.map((key) => getFromIndexDB(key));
      const savedQueries = await Promise.all(savedQueryPromises);

      const recentQueryPromises = recentKeys.map((key) => getFromIndexDB(key));
      const recentQueries = await Promise.all(recentQueryPromises);

      set({
        savedQueries: savedQueries.sort((a, b) => b.timestamp - a.timestamp),
        recentQueries: recentQueries.sort((a, b) => b.timestamp - a.timestamp),
      });
    } catch (err) {
      console.error("Error loading queries from storage:", err);
    }
  },

  saveQuery: (query, name) => {
    if (!query.trim()) return;

    const id = `saved-query:${Date.now()}`;
    const savedQuery: SavedQuery = {
      id,
      name: name || `Saved Query ${new Date().toLocaleString()}`,
      query,
      timestamp: Date.now(),
      isFavorite: true,
    };

    setToIndexDB(id, savedQuery).catch(console.error);

    set((state) => ({
      savedQueries: [savedQuery, ...state.savedQueries],
    }));
  },

  deleteQuery: (id) => {
    del(id).catch(console.error);

    if (id.startsWith("saved-query:")) {
      set((state) => ({
        savedQueries: state.savedQueries.filter((q) => q.id !== id),
      }));
    } else {
      set((state) => ({
        recentQueries: state.recentQueries.filter((q) => q.id !== id),
      }));
    }
  },

  setIsRemoteModalOpen: (val) => {
    set({ isRemoteModalOpen: val });
  },
  setActiveProviderRemoteModal: (val) => {
    set({ activeProviderRemoteModal: val });
  },
  
  setPendingQuery: (query) => {
    set({ pendingQuery: query });
  },

  // Local project actions
  createLocalProject: (name: string): string => {
    const projectId = `project-${Date.now()}`;
    const newProject: LocalProject = {
      id: projectId,
      name,
      files: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      isDraft: false
    };

    set((state) => ({
      localProjects: [...state.localProjects, newProject],
      activeProjectId: projectId,
      projectFiles: []
    }));

    // Only save to storage if not a draft project
    const activeProject = get().localProjects.find(p => p.id === get().activeProjectId);
    if (activeProject && !activeProject.isDraft) {
      get().saveProjectsToStorage();
    }
    return projectId;
  },

  switchLocalProject: (projectId: string) => {
    set((state) => {
      const project = state.localProjects.find(p => p.id === projectId);
      if (project) {
        return {
          activeProjectId: projectId,
          projectFiles: project.files || []
        };
      }
      return state;
    });
  },
  
  clearActiveProject: () => {
    set({
      activeProjectId: 'draft',
      projectFiles: []
    });
  },

  renameLocalProject: (projectId: string, newName: string) => {
    set((state) => ({
      localProjects: state.localProjects.map(p =>
        p.id === projectId 
          ? { ...p, name: newName, lastModified: Date.now() }
          : p
      )
    }));
    // Only save to storage if not a draft project
    const activeProject = get().localProjects.find(p => p.id === get().activeProjectId);
    if (activeProject && !activeProject.isDraft) {
      get().saveProjectsToStorage();
    }
  },

  deleteLocalProject: (projectId: string) => {
    if (projectId === 'draft') return; // Can't delete draft
    
    set((state) => {
      const newProjects = state.localProjects.filter(p => p.id !== projectId);
      const needsSwitch = state.activeProjectId === projectId;
      
      return {
        localProjects: newProjects,
        activeProjectId: needsSwitch ? 'draft' : state.activeProjectId,
        projectFiles: needsSwitch ? [] : state.projectFiles
      };
    });
    // Always save to storage after deleting a project (since we're deleting a non-draft project)
    get().saveProjectsToStorage();
  },

  addFileToProject: (file: LocalProjectFile) => {
    set((state) => {
      const updatedProjects = state.localProjects.map(p => {
        if (p.id === state.activeProjectId) {
          return {
            ...p,
            files: [...(p.files || []), file],
            lastModified: Date.now()
          };
        }
        return p;
      });

      return {
        localProjects: updatedProjects,
        projectFiles: [...state.projectFiles, file]
      };
    });
    // Only save to storage if not a draft project
    const activeProject = get().localProjects.find(p => p.id === get().activeProjectId);
    if (activeProject && !activeProject.isDraft) {
      get().saveProjectsToStorage();
    }
  },

  removeFileFromProject: (fileId: string) => {
    // Get the project file before removing to check for corresponding file tabs
    const projectFile = get().projectFiles.find(f => f.id === fileId);
    
    set((state) => {
      const updatedProjects = state.localProjects.map(p => {
        if (p.id === state.activeProjectId) {
          return {
            ...p,
            files: p.files.filter(f => f.id !== fileId),
            lastModified: Date.now()
          };
        }
        return p;
      });

      // Find and remove corresponding file tab(s) with the same name
      let updatedFiles = state.files;
      if (projectFile) {
        // Remove file tabs that match the project file name
        updatedFiles = state.files.filter(f => {
          // Check if file tab name matches project file name
          const tabFileName = f.fileName || '';
          const projectFileName = projectFile.name || '';
          return tabFileName !== projectFileName;
        });
      }

      // Handle active file switching if we removed the active file tab
      let newActiveFileId = state.activeFileId;
      const activeFileRemoved = projectFile && state.files.some(f => 
        f.id === state.activeFileId && (f.fileName === projectFile.name)
      );
      
      if (activeFileRemoved && updatedFiles.length > 0) {
        // Switch to the first available file
        newActiveFileId = updatedFiles[0].id;
      } else if (activeFileRemoved) {
        newActiveFileId = null;
      }

      return {
        localProjects: updatedProjects,
        projectFiles: state.projectFiles.filter(f => f.id !== fileId),
        files: updatedFiles,
        activeFileId: newActiveFileId
      };
    });
    
    // Only save to storage if not a draft project
    const activeProject = get().localProjects.find(p => p.id === get().activeProjectId);
    if (activeProject && !activeProject.isDraft) {
      get().saveProjectsToStorage();
    }
  },
  // TODO: for now disabling on the UI, as it might bring some confusion on what does it happen to other tabs/query panel
  renameFileInProject: (fileId: string, newName: string) => {
    // Get the old file name before renaming for matching with file tabs
    const oldProjectFile = get().projectFiles.find(f => f.id === fileId);
    const oldFileName = oldProjectFile?.name;
    
    set((state) => {
      const updatedProjects = state.localProjects.map(p => {
        if (p.id === state.activeProjectId) {
          return {
            ...p,
            files: p.files.map(f => 
              f.id === fileId ? { ...f, name: newName } : f
            ),
            lastModified: Date.now()
          };
        }
        return p;
      });

      // Find file tabs that match the old project file name and update them
      const updatedFiles = state.files.map(file => {
        // Check if this file tab corresponds to the renamed project file
        // Match by fileName (since project files and file tabs might have different IDs)
        if (oldFileName && file.fileName === oldFileName) {
          return {
            ...file,
            fileName: newName // Update the display name in the file tab
          };
        }
        return file;
      });

      return {
        localProjects: updatedProjects,
        projectFiles: state.projectFiles.map(f =>
          f.id === fileId ? { ...f, name: newName } : f
        ),
        files: updatedFiles
      };
    });
    // Only save to storage if not a draft project
    const activeProject = get().localProjects.find(p => p.id === get().activeProjectId);
    if (activeProject && !activeProject.isDraft) {
      get().saveProjectsToStorage();
    }
  },

  saveDraftProject: (name: string) => {
    const state = get();
    const draftWorkspace = state.workspaces.find(w => w.id === 'draft');
    
    if (draftWorkspace && draftWorkspace.files.length > 0) {
      const workspaceId = state.createWorkspace(name);
      
      // Copy files from draft to new workspace
      set((state) => {
        const updatedWorkspaces = state.workspaces.map(w => {
          if (w.id === workspaceId) {
            return {
              ...w,
              files: draftWorkspace.files,
              lastModified: Date.now()
            };
          } else if (w.id === 'draft') {
            return {
              ...w,
              files: [],
              lastModified: Date.now()
            };
          }
          return p;
        });

        return {
          localProjects: updatedProjects,
          workspaceFiles: draftWorkspace.files
        };
      });
      
      // Only save to storage if not a draft project
    const activeProject = get().localProjects.find(p => p.id === get().activeProjectId);
    if (activeProject && !activeProject.isDraft) {
      get().saveProjectsToStorage();
    }
    }
  },

  loadProjectsFromStorage: async () => {
    try {
      const stored = await getFromIndexDB('datakit-workspaces');
      let storedHandles: Record<string, FileSystemFileHandle> = {};
      
      // Try to load file handles, but don't fail if it doesn't work
      try {
        storedHandles = await getFromIndexDB('datakit-file-handles') as Record<string, FileSystemFileHandle> || {};
      } catch (handleError) {
        console.warn('[AppStore] Could not load file handles (browser may not support this):', handleError);
      }
      
      if (stored && Array.isArray(stored)) {
        // Restore file handles to project files
        const projectsWithHandles = stored.map(project => ({
          ...project,
          files: project.files.map(file => ({
            ...file,
            handle: storedHandles[file.id] || undefined
          }))
        }));
        
        // Ensure draft project exists
        const hasDraft = projectsWithHandles.some(p => p.id === 'draft');
        const projects = hasDraft ? projectsWithHandles : [createDraftProject(), ...projectsWithHandles];
        
        set({ 
          localProjects: projects,
          projectFiles: projects.find(p => p.id === get().activeProjectId)?.files || []
        });
        
        console.log('[AppStore] Loaded projects with', Object.keys(storedHandles).length, 'file handles');
      }
    } catch (error) {
      console.error('[AppStore] Failed to load projects:', error);
    }
  },

  saveProjectsToStorage: async () => {
    try {
      const projects = get().localProjects.filter(p => !p.isDraft);
      
      // Separate file handles from project data for storage
      const projectsForStorage = projects.map(project => ({
        ...project,
        files: project.files.map(file => ({
          ...file,
          handle: undefined // Remove handles from JSON storage
        }))
      }));
      
      // Store project data without handles
      await setToIndexDB('datakit-workspaces', projectsForStorage);
      
      // Try to store file handles separately, but don't fail if it doesn't work
      try {
        const fileHandles: Record<string, FileSystemFileHandle> = {};
        projects.forEach(project => {
          project.files.forEach(file => {
            if (file.handle) {
              fileHandles[file.id] = file.handle;
            }
          });
        });
        
        if (Object.keys(fileHandles).length > 0) {
          await setToIndexDB('datakit-file-handles', fileHandles);
          console.log('[AppStore] Saved', Object.keys(fileHandles).length, 'file handles');
        }
      } catch (handleError) {
        console.warn('[AppStore] Could not save file handles (browser may not support this):', handleError);
        // Continue without failing - project data is still saved
      }
    } catch (error) {
      console.error('[AppStore] Failed to save projects:', error);
    }
  }
}));
