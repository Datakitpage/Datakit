import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { ContentNodeData, ContentType } from '@/components/flow/ContentNode';
import Papa from 'papaparse';

export interface Folder {
  id: string;
  name: string;
  position: { x: number; y: number };
  fileIds: string[];
  color?: string;
  isOpen?: boolean;
  selected?: boolean;
  isRenaming?: boolean;
}

interface FlowState {
  // Data
  files: ContentNodeData[];
  folders: Folder[];

  // UI state
  selectedId: string | null;
  focusedFileId: string | null;
  openFileIds: string[];
  dragOverFileId: string | null;
  pendingFolderFiles: string[] | null;

  // Actions - Files
  addFile: (file: File, position: { x: number; y: number }) => Promise<void>;
  updateFilePosition: (id: string, position: { x: number; y: number }) => void;
  deleteFile: (id: string) => void;
  selectItem: (id: string | null) => void;
  focusFile: (id: string) => void;
  unfocusFile: () => void;
  closeFileTab: (id: string) => void;
  reorderTabs: (newOrder: string[]) => void;

  // Actions - Folders
  createFolder: (fileIds: string[], position: { x: number; y: number }) => string;
  addFileToFolder: (folderId: string, fileId: string) => void;
  removeFileFromFolder: (folderId: string, fileId: string) => void;
  deleteFolder: (folderId: string, keepFiles?: boolean) => void;
  renameFolder: (folderId: string, name: string) => void;
  updateFolderPosition: (folderId: string, position: { x: number; y: number }) => void;
  openFolder: (folderId: string) => void;
  closeFolder: (folderId: string) => void;
  startRenamingFolder: (folderId: string) => void;
  stopRenamingFolder: (folderId: string) => void;
  setDragOverFile: (fileId: string | null) => void;
  setPendingFolderFiles: (fileIds: string[] | null) => void;
  getFilesInFolder: (folderId: string) => ContentNodeData[];
}

export const useFlowStore = create<FlowState>((set, get) => ({
  files: [],
  folders: [],
  selectedId: null,
  focusedFileId: null,
  openFileIds: [],
  dragOverFileId: null,
  pendingFolderFiles: null,

  addFile: async (file: File, position: { x: number; y: number }) => {
    const id = uuid();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // Detect file type
    let fileType: ContentType = 'unknown';
    if (ext === 'csv') fileType = 'csv';
    else if (ext === 'json') fileType = 'json';
    else if (ext === 'xlsx' || ext === 'xls') fileType = 'xlsx';
    else if (ext === 'parquet') fileType = 'parquet';
    else if (ext === 'txt') fileType = 'txt';
    else if (ext === 'md' || ext === 'markdown') fileType = 'md';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) fileType = 'image';
    else if (ext === 'pdf') fileType = 'pdf';

    // Add file immediately with processing state and auto-focus it
    set(state => ({
      files: [
        ...state.files,
        {
          id,
          name: file.name,
          type: fileType,
          size: file.size,
          position,
          processing: true,
        },
      ],
      focusedFileId: id,
      openFileIds: [...state.openFileIds.filter(fid => fid !== id), id],
    }));

    // Parse file contents
    try {
      let data: unknown[] = [];
      let rawContent: string | undefined;
      let imageUrl: string | undefined;
      let rowCount = 0;
      let columnCount = 0;
      let columns: string[] = [];

      if (fileType === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = result.data;
        columns = result.meta.fields || [];
        rowCount = data.length;
        columnCount = columns.length;
      } else if (fileType === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        data = Array.isArray(parsed) ? parsed : [parsed];
        rowCount = data.length;
        if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
          columns = Object.keys(data[0] as object);
          columnCount = columns.length;
        }
      } else if (fileType === 'parquet') {
        // Parquet files are binary and require DuckDB to parse
        // Mark as empty data - FocusedFileView will use DuckDB's createViewFromFile
        data = [];
        columns = [];
        rowCount = 0;
        columnCount = 0;
      } else if (fileType === 'txt' || fileType === 'md') {
        rawContent = await file.text();
      } else if (fileType === 'image') {
        imageUrl = URL.createObjectURL(file);
      }

      // Update file with parsed data
      set(state => ({
        files: state.files.map(f =>
          f.id === id
            ? {
                ...f,
                data,
                columns,
                rawContent,
                imageUrl,
                rowCount,
                columnCount,
                processing: false,
                // Keep file reference for binary formats that need DuckDB
                ...(fileType === 'parquet' ? { file } : {}),
              }
            : f
        ),
      }));
    } catch (error) {
      console.error('Failed to parse file:', error);
      set(state => ({
        files: state.files.map(f =>
          f.id === id
            ? { ...f, processing: false, error: 'Failed to parse file' }
            : f
        ),
      }));
    }
  },

  updateFilePosition: (id, position) => {
    set(state => ({
      files: state.files.map(f => (f.id === id ? { ...f, position } : f)),
    }));
  },

  deleteFile: (id) => {
    set(state => ({
      files: state.files.filter(f => f.id !== id),
      openFileIds: state.openFileIds.filter(fid => fid !== id),
      focusedFileId: state.focusedFileId === id ? null : state.focusedFileId,
      selectedId: state.selectedId === id ? null : state.selectedId,
      // Also remove from any folders
      folders: state.folders.map(f => ({
        ...f,
        fileIds: f.fileIds.filter(fid => fid !== id),
      })),
    }));
  },

  selectItem: (id) => {
    set({ selectedId: id });
  },

  focusFile: (id) => {
    set(state => ({
      focusedFileId: id,
      selectedId: id,
      openFileIds: state.openFileIds.includes(id)
        ? state.openFileIds
        : [...state.openFileIds, id],
    }));
  },

  unfocusFile: () => {
    set({ focusedFileId: null });
  },

  closeFileTab: (id) => {
    const { openFileIds, focusedFileId } = get();
    const newOpenIds = openFileIds.filter(fid => fid !== id);

    let newFocusedId = focusedFileId;
    if (focusedFileId === id) {
      const currentIndex = openFileIds.indexOf(id);
      if (newOpenIds.length > 0) {
        newFocusedId = newOpenIds[Math.max(0, currentIndex - 1)];
      } else {
        newFocusedId = null;
      }
    }

    set({
      openFileIds: newOpenIds,
      focusedFileId: newFocusedId,
    });
  },

  reorderTabs: (newOrder) => {
    set({ openFileIds: newOrder });
  },

  // Folder actions
  createFolder: (fileIds, position) => {
    const id = uuid();
    const files = get().files;

    const fileNames = fileIds
      .map(fid => files.find(f => f.id === fid)?.name)
      .filter(Boolean)
      .slice(0, 2);
    const name = fileNames.length === 1
      ? `${fileNames[0]} folder`
      : fileNames.length === 2
        ? `${fileNames.join(' & ')}`
        : `${fileNames[0]} + ${fileIds.length - 1}`;

    set(state => ({
      folders: [
        ...state.folders,
        {
          id,
          name,
          position,
          fileIds,
          color: '#6366F1',
        },
      ],
      pendingFolderFiles: null,
      dragOverFileId: null,
    }));

    return id;
  },

  addFileToFolder: (folderId, fileId) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId && !f.fileIds.includes(fileId)
          ? { ...f, fileIds: [...f.fileIds, fileId] }
          : f
      ),
    }));
  },

  removeFileFromFolder: (folderId, fileId) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId
          ? { ...f, fileIds: f.fileIds.filter(id => id !== fileId) }
          : f
      ),
    }));
  },

  deleteFolder: (folderId, keepFiles = true) => {
    const folder = get().folders.find(f => f.id === folderId);
    if (!folder) return;

    set(state => {
      const newFiles = keepFiles
        ? state.files
        : state.files.filter(f => !folder.fileIds.includes(f.id));

      return {
        folders: state.folders.filter(f => f.id !== folderId),
        files: newFiles,
      };
    });
  },

  renameFolder: (folderId, name) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, name, isRenaming: false } : f
      ),
    }));
  },

  updateFolderPosition: (folderId, position) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, position } : f
      ),
    }));
  },

  openFolder: (folderId) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, isOpen: true } : f
      ),
    }));
  },

  closeFolder: (folderId) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, isOpen: false } : f
      ),
    }));
  },

  startRenamingFolder: (folderId) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, isRenaming: true } : f
      ),
    }));
  },

  stopRenamingFolder: (folderId) => {
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, isRenaming: false } : f
      ),
    }));
  },

  setDragOverFile: (fileId) => {
    set({ dragOverFileId: fileId });
  },

  setPendingFolderFiles: (fileIds) => {
    set({ pendingFolderFiles: fileIds });
  },

  getFilesInFolder: (folderId) => {
    const { folders, files } = get();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    return files.filter(f => folder.fileIds.includes(f.id));
  },
}));
