import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isFileSystemAccessSupported,
  saveFileHandle,
  getFileHandle,
  getFileMetadata,
  getAllFileHandles,
  removeFileHandle,
  clearAllFileHandles,
  checkHandlePermission,
  requestHandlePermission,
  getFileFromHandle,
} from './fileHandleStore';

// Mock idb-keyval with two separate stores
vi.mock('idb-keyval', () => {
  const handleStore = new Map<string, unknown>();
  const metadataStore = new Map<string, unknown>();

  return {
    createStore: vi.fn((dbName: string) => dbName), // Return db name as store identifier
    get: vi.fn((key: string, store: string) => {
      const targetStore = store === 'opensheet-file-handles' ? handleStore : metadataStore;
      return Promise.resolve(targetStore.get(key));
    }),
    set: vi.fn((key: string, value: unknown, store: string) => {
      const targetStore = store === 'opensheet-file-handles' ? handleStore : metadataStore;
      targetStore.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((key: string, store: string) => {
      const targetStore = store === 'opensheet-file-handles' ? handleStore : metadataStore;
      targetStore.delete(key);
      return Promise.resolve();
    }),
    keys: vi.fn((store: string) => {
      const targetStore = store === 'opensheet-file-handles' ? handleStore : metadataStore;
      return Promise.resolve([...targetStore.keys()]);
    }),
    // Expose for test cleanup
    __handleStore: handleStore,
    __metadataStore: metadataStore,
  };
});

describe('fileHandleStore', () => {
  // Mock FileSystemFileHandle
  const createMockHandle = (permissions: Record<string, 'granted' | 'denied' | 'prompt'> = {}) => ({
    kind: 'file' as const,
    name: 'test.csv',
    queryPermission: vi.fn(({ mode }: { mode: string }) =>
      Promise.resolve(permissions[mode] || 'granted')
    ),
    requestPermission: vi.fn(({ mode }: { mode: string }) =>
      Promise.resolve(permissions[mode] || 'granted')
    ),
    getFile: vi.fn(() => Promise.resolve(new File(['test'], 'test.csv', { type: 'text/csv' }))),
  });

  const mockMetadata = {
    id: 'file-1',
    name: 'test.csv',
    type: 'csv',
    size: 1024,
    position: { x: 100, y: 200 },
    lastModified: Date.now(),
  };

  beforeEach(async () => {
    // Clear mock stores
    const {
      __handleStore,
      __metadataStore,
    } = await import('idb-keyval') as unknown as {
      __handleStore: Map<string, unknown>;
      __metadataStore: Map<string, unknown>;
    };
    __handleStore.clear();
    __metadataStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isFileSystemAccessSupported', () => {
    it('should return true when File System Access API is available', () => {
      // Mock window APIs
      const originalShowOpenFilePicker = (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
      const originalFileSystemFileHandle = (window as { FileSystemFileHandle?: unknown }).FileSystemFileHandle;

      (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = vi.fn();
      (window as { FileSystemFileHandle?: unknown }).FileSystemFileHandle = class {};

      expect(isFileSystemAccessSupported()).toBe(true);

      // Restore
      (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = originalShowOpenFilePicker;
      (window as { FileSystemFileHandle?: unknown }).FileSystemFileHandle = originalFileSystemFileHandle;
    });

    it('should return false when File System Access API is not available', () => {
      const originalShowOpenFilePicker = (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;

      delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;

      expect(isFileSystemAccessSupported()).toBe(false);

      // Restore if needed
      if (originalShowOpenFilePicker) {
        (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = originalShowOpenFilePicker;
      }
    });
  });

  describe('saveFileHandle', () => {
    it('should save handle and metadata to separate stores', async () => {
      const { set } = await import('idb-keyval');
      const mockHandle = createMockHandle();

      await saveFileHandle('file-1', mockHandle as unknown as FileSystemFileHandle, mockMetadata);

      // Should be called twice - once for handle, once for metadata
      expect(set).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFileHandle', () => {
    it('should retrieve file handle from IndexedDB', async () => {
      const { __handleStore } = await import('idb-keyval') as unknown as {
        __handleStore: Map<string, unknown>;
      };
      const mockHandle = createMockHandle();
      __handleStore.set('file-1', mockHandle);

      const result = await getFileHandle('file-1');

      expect(result).toBe(mockHandle);
    });

    it('should return null for non-existent handle', async () => {
      const result = await getFileHandle('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getFileMetadata', () => {
    it('should retrieve file metadata from IndexedDB', async () => {
      const { __metadataStore } = await import('idb-keyval') as unknown as {
        __metadataStore: Map<string, unknown>;
      };
      __metadataStore.set('file-1', mockMetadata);

      const result = await getFileMetadata('file-1');

      expect(result).toEqual(mockMetadata);
    });

    it('should return null for non-existent metadata', async () => {
      const result = await getFileMetadata('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAllFileHandles', () => {
    it('should return all handles with their metadata', async () => {
      const {
        __handleStore,
        __metadataStore,
      } = await import('idb-keyval') as unknown as {
        __handleStore: Map<string, unknown>;
        __metadataStore: Map<string, unknown>;
      };

      const mockHandle1 = createMockHandle();
      const mockHandle2 = createMockHandle();
      const metadata1 = { ...mockMetadata, id: 'file-1' };
      const metadata2 = { ...mockMetadata, id: 'file-2', name: 'test2.csv' };

      __handleStore.set('file-1', mockHandle1);
      __handleStore.set('file-2', mockHandle2);
      __metadataStore.set('file-1', metadata1);
      __metadataStore.set('file-2', metadata2);

      const result = await getAllFileHandles();

      expect(result.size).toBe(2);
      expect(result.has('file-1')).toBe(true);
      expect(result.has('file-2')).toBe(true);
    });

    it('should skip entries without matching metadata', async () => {
      const { __handleStore } = await import('idb-keyval') as unknown as {
        __handleStore: Map<string, unknown>;
      };
      const mockHandle = createMockHandle();
      __handleStore.set('file-1', mockHandle);
      // No metadata added

      const result = await getAllFileHandles();

      expect(result.size).toBe(0);
    });
  });

  describe('removeFileHandle', () => {
    it('should delete handle and metadata from IndexedDB', async () => {
      const { del } = await import('idb-keyval');

      await removeFileHandle('file-1');

      // Should be called twice - once for handle, once for metadata
      expect(del).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAllFileHandles', () => {
    it('should delete all handles and metadata', async () => {
      const {
        del,
        __handleStore,
        __metadataStore,
      } = await import('idb-keyval') as unknown as {
        del: ReturnType<typeof vi.fn>;
        __handleStore: Map<string, unknown>;
        __metadataStore: Map<string, unknown>;
      };

      __handleStore.set('file-1', createMockHandle());
      __handleStore.set('file-2', createMockHandle());
      __metadataStore.set('file-1', mockMetadata);
      __metadataStore.set('file-2', mockMetadata);

      await clearAllFileHandles();

      // 2 handles * 2 (handle + metadata) = 4 delete calls
      expect(del).toHaveBeenCalledTimes(4);
    });
  });

  describe('checkHandlePermission', () => {
    it('should return permission status from handle', async () => {
      const mockHandle = createMockHandle({ read: 'granted' });

      const result = await checkHandlePermission(mockHandle as unknown as FileSystemFileHandle);

      expect(result).toBe('granted');
      expect(mockHandle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    });

    it('should return denied on error', async () => {
      const mockHandle = {
        queryPermission: vi.fn(() => Promise.reject(new Error('Failed'))),
      };

      const result = await checkHandlePermission(mockHandle as unknown as FileSystemFileHandle);

      expect(result).toBe('denied');
    });
  });

  describe('requestHandlePermission', () => {
    it('should return true when permission is granted', async () => {
      const mockHandle = createMockHandle({ read: 'granted' });

      const result = await requestHandlePermission(mockHandle as unknown as FileSystemFileHandle);

      expect(result).toBe(true);
      expect(mockHandle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    });

    it('should return false when permission is denied', async () => {
      const mockHandle = createMockHandle({ read: 'denied' });

      const result = await requestHandlePermission(mockHandle as unknown as FileSystemFileHandle);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockHandle = {
        requestPermission: vi.fn(() => Promise.reject(new Error('Failed'))),
      };

      const result = await requestHandlePermission(mockHandle as unknown as FileSystemFileHandle);

      expect(result).toBe(false);
    });
  });

  describe('getFileFromHandle', () => {
    it('should return file from handle', async () => {
      const mockHandle = createMockHandle();

      const result = await getFileFromHandle(mockHandle as unknown as FileSystemFileHandle);

      expect(result).toBeInstanceOf(File);
      expect(result?.name).toBe('test.csv');
      expect(mockHandle.getFile).toHaveBeenCalled();
    });

    it('should return null on error', async () => {
      const mockHandle = {
        getFile: vi.fn(() => Promise.reject(new Error('Failed'))),
      };

      const result = await getFileFromHandle(mockHandle as unknown as FileSystemFileHandle);

      expect(result).toBeNull();
    });
  });
});
