import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { ContentNodeData, ContentType } from '@/components/flow/ContentNode';
import Papa from 'papaparse';
import { parseXlsxFile } from '@/lib/xlsx';
import { saveFileHandle, removeFileHandle } from '@/store/fileHandleStore';
import {
  saveFolder as persistFolder,
  removeFolder as unpersistFolder,
  updateFolderFileIds,
  updateFolderPosition as persistFolderPosition,
  updateFolderName,
  updateFolderColor,
  type PersistedFolder,
} from '@/store/folderPersistence';

// ============================================
// Sample data for initial state
// ============================================

const SAMPLE_SALES_DATA = [
  { _rowid: 0, product: 'Laptop Pro', category: 'Electronics', price: 1299, quantity: 45, revenue: 58455, region: 'North' },
  { _rowid: 1, product: 'Wireless Mouse', category: 'Electronics', price: 29, quantity: 234, revenue: 6786, region: 'East' },
  { _rowid: 2, product: 'Office Chair', category: 'Furniture', price: 399, quantity: 67, revenue: 26733, region: 'West' },
  { _rowid: 3, product: 'Standing Desk', category: 'Furniture', price: 599, quantity: 32, revenue: 19168, region: 'North' },
  { _rowid: 4, product: 'Monitor 27"', category: 'Electronics', price: 449, quantity: 89, revenue: 39961, region: 'South' },
  { _rowid: 5, product: 'Keyboard RGB', category: 'Electronics', price: 149, quantity: 156, revenue: 23244, region: 'East' },
  { _rowid: 6, product: 'Webcam HD', category: 'Electronics', price: 79, quantity: 203, revenue: 16037, region: 'West' },
  { _rowid: 7, product: 'Desk Lamp', category: 'Furniture', price: 49, quantity: 312, revenue: 15288, region: 'South' },
  { _rowid: 8, product: 'USB Hub', category: 'Electronics', price: 39, quantity: 445, revenue: 17355, region: 'North' },
  { _rowid: 9, product: 'Cable Kit', category: 'Accessories', price: 19, quantity: 567, revenue: 10773, region: 'East' },
];

const SAMPLE_USERS_DATA = [
  { _rowid: 0, user_id: 'U001', name: 'Alice Chen', email: 'alice@example.com', signups: '2024-01-15', country: 'USA', plan: 'Pro', active: true },
  { _rowid: 1, user_id: 'U002', name: 'Bob Smith', email: 'bob@example.com', signups: '2024-02-20', country: 'UK', plan: 'Free', active: true },
  { _rowid: 2, user_id: 'U003', name: 'Carol Davis', email: 'carol@example.com', signups: '2024-03-10', country: 'Canada', plan: 'Pro', active: false },
  { _rowid: 3, user_id: 'U004', name: 'David Lee', email: 'david@example.com', signups: '2024-03-25', country: 'Australia', plan: 'Team', active: true },
  { _rowid: 4, user_id: 'U005', name: 'Eva Martinez', email: 'eva@example.com', signups: '2024-04-01', country: 'Spain', plan: 'Pro', active: true },
  { _rowid: 5, user_id: 'U006', name: 'Frank Wilson', email: 'frank@example.com', signups: '2024-04-15', country: 'Germany', plan: 'Free', active: true },
  { _rowid: 6, user_id: 'U007', name: 'Grace Kim', email: 'grace@example.com', signups: '2024-05-01', country: 'Japan', plan: 'Team', active: true },
  { _rowid: 7, user_id: 'U008', name: 'Henry Brown', email: 'henry@example.com', signups: '2024-05-20', country: 'France', plan: 'Pro', active: false },
];

const SAMPLE_API_DATA = [
  { _rowid: 0, id: 1, status: 'success', method: 'GET', endpoint: '/api/users', latency_ms: 45, timestamp: '2024-06-01T10:30:00Z' },
  { _rowid: 1, id: 2, status: 'success', method: 'POST', endpoint: '/api/orders', latency_ms: 128, timestamp: '2024-06-01T10:31:15Z' },
  { _rowid: 2, id: 3, status: 'error', method: 'GET', endpoint: '/api/products', latency_ms: 5032, timestamp: '2024-06-01T10:32:00Z' },
  { _rowid: 3, id: 4, status: 'success', method: 'PUT', endpoint: '/api/users/123', latency_ms: 67, timestamp: '2024-06-01T10:33:45Z' },
  { _rowid: 4, id: 5, status: 'success', method: 'DELETE', endpoint: '/api/cache', latency_ms: 23, timestamp: '2024-06-01T10:34:30Z' },
  { _rowid: 5, id: 6, status: 'warning', method: 'GET', endpoint: '/api/reports', latency_ms: 890, timestamp: '2024-06-01T10:35:00Z' },
];

// Initial sample files - shown from the beginning, positioned vertically from top-left
const INITIAL_SAMPLE_FILES: ContentNodeData[] = [
  {
    id: 'sample-sales',
    name: 'sales.csv',
    type: 'csv',
    size: 2048,
    position: { x: 50, y: 70 },
    data: SAMPLE_SALES_DATA,
    columns: ['product', 'category', 'price', 'quantity', 'revenue', 'region'],
    rowCount: SAMPLE_SALES_DATA.length,
    columnCount: 6,
  },
  {
    id: 'sample-users',
    name: 'sample.csv',
    type: 'csv',
    size: 1536,
    position: { x: 50, y: 190 },
    data: SAMPLE_USERS_DATA,
    columns: ['user_id', 'name', 'email', 'signups', 'country', 'plan', 'active'],
    rowCount: SAMPLE_USERS_DATA.length,
    columnCount: 7,
  },
  {
    id: 'sample-api',
    name: 'api_logs.json',
    type: 'json',
    size: 1024,
    position: { x: 50, y: 310 },
    data: SAMPLE_API_DATA,
    columns: ['id', 'status', 'method', 'endpoint', 'latency_ms', 'timestamp'],
    rowCount: SAMPLE_API_DATA.length,
    columnCount: 6,
  },
];

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

interface BoardState {
  // Data
  files: ContentNodeData[];
  folders: Folder[];

  // UI state
  selectedId: string | null;
  focusedFileId: string | null;
  openFileIds: string[];
  expandedFolderId: string | null;
  dragOverFileId: string | null;
  dragOverFolderId: string | null;
  pendingFolderFiles: string[] | null;

  // Actions - Files
  addFile: (file: File, position: { x: number; y: number }, handle?: FileSystemFileHandle) => Promise<void>;
  restoreFile: (id: string, file: File, metadata: { name: string; type: ContentType; size: number; position: { x: number; y: number } }, handle?: FileSystemFileHandle) => Promise<void>;
  updateFilePosition: (id: string, position: { x: number; y: number }) => void;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
  selectItem: (id: string | null) => void;
  focusFile: (id: string) => void;
  unfocusFile: () => void;
  closeFileTab: (id: string) => void;
  reorderTabs: (newOrder: string[]) => void;

  // Actions - Folders
  createFolder: (fileIds: string[], position: { x: number; y: number }) => string;
  restoreFolder: (folder: PersistedFolder) => void;
  addFileToFolder: (folderId: string, fileId: string) => void;
  removeFileFromFolder: (folderId: string, fileId: string) => void;
  deleteFolder: (folderId: string, keepFiles?: boolean) => void;
  renameFolder: (folderId: string, name: string) => void;
  setFolderColor: (folderId: string, color: string) => void;
  updateFolderPosition: (folderId: string, position: { x: number; y: number }) => void;
  openFolder: (folderId: string) => void;
  closeFolder: (folderId: string) => void;
  expandFolder: (folderId: string) => void;
  collapseFolder: () => void;
  startRenamingFolder: (folderId: string) => void;
  stopRenamingFolder: (folderId: string) => void;
  setDragOverFile: (fileId: string | null) => void;
  setDragOverFolder: (folderId: string | null) => void;
  setPendingFolderFiles: (fileIds: string[] | null) => void;
  getFilesInFolder: (folderId: string) => ContentNodeData[];
  addSampleFiles: () => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  files: INITIAL_SAMPLE_FILES,
  folders: [],
  selectedId: null,
  focusedFileId: null,
  openFileIds: [],
  expandedFolderId: null,
  dragOverFileId: null,
  dragOverFolderId: null,
  pendingFolderFiles: null,

  addFile: async (file: File, position: { x: number; y: number }, handle?: FileSystemFileHandle) => {
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

    // Save file handle to IndexedDB for persistence (if available)
    if (handle) {
      saveFileHandle(id, handle, {
        id,
        name: file.name,
        type: fileType,
        size: file.size,
        position,
        lastModified: file.lastModified,
      });
    }

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
          fileHandle: handle,
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
      let pdfUrl: string | undefined;
      let pageCount: number | undefined;
      let rowCount = 0;
      let columnCount = 0;
      let columns: string[] = [];

      if (fileType === 'csv') {
        // MINIMAL PARSE: Just get headers and estimate row count
        // DuckDB will do the real parsing (much faster native C++ parser)
        const text = await file.text();
        const headerResult = Papa.parse(text, { header: true, preview: 1 });
        columns = headerResult.meta.fields || [];
        columnCount = columns.length;
        // Estimate row count from newlines (fast, avoids full parse)
        rowCount = (text.match(/\n/g) || []).length;
        // Don't store parsed data - DuckDB will handle it
        data = [];
      } else if (fileType === 'json') {
        // MINIMAL PARSE: Just get structure from first object
        // DuckDB will do the real parsing
        const text = await file.text();
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        rowCount = arr.length;
        if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
          columns = Object.keys(arr[0] as object);
          columnCount = columns.length;
        }
        // Don't store parsed data for large files - DuckDB will handle it
        // Only keep data for small files (fallback for DOM table)
        data = arr.length < 10000 ? arr : [];
      } else if (fileType === 'parquet') {
        // Parquet is binary - DuckDB will parse and provide schema
        data = [];
        columns = [];
        rowCount = 0;
        columnCount = 0;
      } else if (fileType === 'xlsx') {
        // Parse Excel file using xlsx library
        // DuckDB can't read xlsx natively, so we extract headers + CSV for DuckDB
        const result = await parseXlsxFile(file);
        columns = result.headers;
        columnCount = result.columnCount;
        rowCount = result.rowCount;
        data = [];
      } else if (fileType === 'txt' || fileType === 'md') {
        rawContent = await file.text();
      } else if (fileType === 'image') {
        imageUrl = URL.createObjectURL(file);
      } else if (fileType === 'pdf') {
        pdfUrl = URL.createObjectURL(file);
        try {
          const { initPDFWorker } = await import('@/lib/pdf/pdfWorkerConfig');
          await initPDFWorker();
          const { pdfjs } = await import('react-pdf');
          const pdfDoc = await pdfjs.getDocument(pdfUrl).promise;
          pageCount = pdfDoc.numPages;
          pdfDoc.destroy();
        } catch (e) {
          console.warn('[PDF] Could not read page count:', e);
          pageCount = 0;
        }
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
                pdfUrl,
                pageCount,
                rowCount,
                columnCount,
                processing: false,
                // Keep file reference for DuckDB (much faster than re-serializing parsed data)
                ...(['csv', 'json', 'parquet', 'xlsx'].includes(fileType) ? { file } : {}),
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

  // Restore a file from a persisted handle (used on app reload)
  restoreFile: async (id: string, file: File, metadata: { name: string; type: ContentType; size: number; position: { x: number; y: number } }, handle?: FileSystemFileHandle) => {
    const { files } = get();

    // Don't restore if already exists
    if (files.some(f => f.id === id)) {
      return;
    }

    const fileType = metadata.type;

    // Add file immediately with processing state (don't auto-focus restored files)
    set(state => ({
      files: [
        ...state.files,
        {
          id,
          name: metadata.name,
          type: fileType,
          size: metadata.size,
          position: metadata.position,
          processing: true,
          fileHandle: handle,
        },
      ],
    }));

    // Parse file contents (same logic as addFile)
    try {
      let data: unknown[] = [];
      let rawContent: string | undefined;
      let imageUrl: string | undefined;
      let pdfUrl: string | undefined;
      let pageCount: number | undefined;
      let rowCount = 0;
      let columnCount = 0;
      let columns: string[] = [];

      if (fileType === 'csv') {
        const text = await file.text();
        const headerResult = Papa.parse(text, { header: true, preview: 1 });
        columns = headerResult.meta.fields || [];
        columnCount = columns.length;
        rowCount = (text.match(/\n/g) || []).length;
        data = [];
      } else if (fileType === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        rowCount = arr.length;
        if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
          columns = Object.keys(arr[0] as object);
          columnCount = columns.length;
        }
        data = arr.length < 10000 ? arr : [];
      } else if (fileType === 'parquet') {
        data = [];
        columns = [];
        rowCount = 0;
        columnCount = 0;
      } else if (fileType === 'xlsx') {
        const result = await parseXlsxFile(file);
        columns = result.headers;
        columnCount = result.columnCount;
        rowCount = result.rowCount;
        data = [];
      } else if (fileType === 'txt' || fileType === 'md') {
        rawContent = await file.text();
      } else if (fileType === 'image') {
        imageUrl = URL.createObjectURL(file);
      } else if (fileType === 'pdf') {
        pdfUrl = URL.createObjectURL(file);
        try {
          const { initPDFWorker } = await import('@/lib/pdf/pdfWorkerConfig');
          await initPDFWorker();
          const { pdfjs } = await import('react-pdf');
          const pdfDoc = await pdfjs.getDocument(pdfUrl).promise;
          pageCount = pdfDoc.numPages;
          pdfDoc.destroy();
        } catch (e) {
          console.warn('[PDF] Could not read page count:', e);
          pageCount = 0;
        }
      }

      set(state => ({
        files: state.files.map(f =>
          f.id === id
            ? {
                ...f,
                data,
                columns,
                rawContent,
                imageUrl,
                pdfUrl,
                pageCount,
                rowCount,
                columnCount,
                processing: false,
                ...(['csv', 'json', 'parquet', 'xlsx'].includes(fileType) ? { file } : {}),
              }
            : f
        ),
      }));
    } catch (error) {
      console.error('Failed to parse restored file:', error);
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

  renameFile: (id, name) => {
    set(state => ({
      files: state.files.map(f => (f.id === id ? { ...f, name } : f)),
    }));
  },

  deleteFile: (id) => {
    // Revoke blob URLs to free memory
    const file = get().files.find(f => f.id === id);
    if (file?.imageUrl) URL.revokeObjectURL(file.imageUrl);
    if (file?.pdfUrl) URL.revokeObjectURL(file.pdfUrl);

    // Remove file handle from IndexedDB
    removeFileHandle(id);

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

    const color = '#6366F1';

    // Persist folder to IndexedDB
    persistFolder({ id, name, position, fileIds, color });

    set(state => ({
      folders: [
        ...state.folders,
        {
          id,
          name,
          position,
          fileIds,
          color,
        },
      ],
      pendingFolderFiles: null,
      dragOverFileId: null,
    }));

    return id;
  },

  // Restore a folder from IndexedDB (used on app reload)
  restoreFolder: (folder: PersistedFolder) => {
    const { folders } = get();

    // Don't restore if already exists
    if (folders.some(f => f.id === folder.id)) {
      return;
    }

    set(state => ({
      folders: [
        ...state.folders,
        {
          id: folder.id,
          name: folder.name,
          position: folder.position,
          fileIds: folder.fileIds,
          color: folder.color,
        },
      ],
    }));
  },

  addFileToFolder: (folderId, fileId) => {
    const folder = get().folders.find(f => f.id === folderId);
    if (folder && !folder.fileIds.includes(fileId)) {
      const newFileIds = [...folder.fileIds, fileId];
      // Persist to IndexedDB
      updateFolderFileIds(folderId, newFileIds);
    }

    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId && !f.fileIds.includes(fileId)
          ? { ...f, fileIds: [...f.fileIds, fileId] }
          : f
      ),
    }));
  },

  removeFileFromFolder: (folderId, fileId) => {
    const folder = get().folders.find(f => f.id === folderId);
    if (folder) {
      const newFileIds = folder.fileIds.filter(id => id !== fileId);
      // Persist to IndexedDB
      updateFolderFileIds(folderId, newFileIds);
    }

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

    // Remove from IndexedDB
    unpersistFolder(folderId);

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
    // Persist to IndexedDB
    updateFolderName(folderId, name);

    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, name, isRenaming: false } : f
      ),
    }));
  },

  setFolderColor: (folderId, color) => {
    // Persist to IndexedDB
    updateFolderColor(folderId, color);

    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, color } : f
      ),
    }));
  },

  updateFolderPosition: (folderId, position) => {
    // Persist to IndexedDB
    persistFolderPosition(folderId, position);

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

  expandFolder: (folderId) => {
    set(state => ({
      expandedFolderId: folderId,
      folders: state.folders.map(f =>
        f.id === folderId
          ? { ...f, isOpen: true }
          : f.isOpen ? { ...f, isOpen: false } : f
      ),
    }));
  },

  collapseFolder: () => {
    set(state => ({
      expandedFolderId: null,
      folders: state.folders.map(f =>
        f.isOpen ? { ...f, isOpen: false } : f
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

  setDragOverFolder: (folderId) => {
    set({ dragOverFolderId: folderId });
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

  // Reset to sample files (used when canvas is cleared)
  addSampleFiles: () => {
    // Only add if no sample files exist
    const hasSamples = get().files.some(f => f.id.startsWith('sample-'));
    if (!hasSamples) {
      set(state => ({
        files: [...state.files, ...INITIAL_SAMPLE_FILES],
      }));
    }
  },
}));
