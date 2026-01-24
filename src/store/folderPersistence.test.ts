import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveFolder,
  getFolder,
  getAllFolders,
  removeFolder,
  clearAllFolders,
  updateFolderFileIds,
  updateFolderPosition,
  updateFolderName,
  updateFolderColor,
  type PersistedFolder,
} from './folderPersistence';

// Mock idb-keyval
vi.mock('idb-keyval', () => {
  const mockStore = new Map<string, unknown>();

  return {
    createStore: vi.fn(() => 'mockFolderStore'),
    get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      mockStore.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((key: string) => {
      mockStore.delete(key);
      return Promise.resolve();
    }),
    keys: vi.fn(() => Promise.resolve([...mockStore.keys()])),
    // Expose for test cleanup
    __mockStore: mockStore,
  };
});

describe('folderPersistence', () => {
  const mockFolder: PersistedFolder = {
    id: 'folder-1',
    name: 'Test Folder',
    position: { x: 100, y: 200 },
    fileIds: ['file-1', 'file-2'],
    color: '#6366F1',
  };

  beforeEach(async () => {
    // Clear mock store
    const { __mockStore } = await import('idb-keyval') as unknown as { __mockStore: Map<string, unknown> };
    __mockStore.clear();
    vi.clearAllMocks();
  });

  describe('saveFolder', () => {
    it('should save folder to IndexedDB', async () => {
      const { set } = await import('idb-keyval');

      await saveFolder(mockFolder);

      expect(set).toHaveBeenCalledWith(mockFolder.id, mockFolder, 'mockFolderStore');
    });
  });

  describe('getFolder', () => {
    it('should retrieve folder from IndexedDB', async () => {
      const { __mockStore } = await import('idb-keyval') as unknown as { __mockStore: Map<string, unknown> };
      __mockStore.set(mockFolder.id, mockFolder);

      const result = await getFolder(mockFolder.id);

      expect(result).toEqual(mockFolder);
    });

    it('should return null for non-existent folder', async () => {
      const result = await getFolder('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAllFolders', () => {
    it('should return all folders from IndexedDB', async () => {
      const { __mockStore } = await import('idb-keyval') as unknown as { __mockStore: Map<string, unknown> };
      const folder2: PersistedFolder = { ...mockFolder, id: 'folder-2', name: 'Second Folder' };

      __mockStore.set(mockFolder.id, mockFolder);
      __mockStore.set(folder2.id, folder2);

      const folders = await getAllFolders();

      expect(folders).toHaveLength(2);
      expect(folders.map(f => f.id).sort()).toEqual(['folder-1', 'folder-2']);
    });

    it('should return empty array when no folders exist', async () => {
      const folders = await getAllFolders();

      expect(folders).toEqual([]);
    });
  });

  describe('removeFolder', () => {
    it('should delete folder from IndexedDB', async () => {
      const { del, __mockStore } = await import('idb-keyval') as unknown as {
        del: ReturnType<typeof vi.fn>;
        __mockStore: Map<string, unknown>;
      };
      __mockStore.set(mockFolder.id, mockFolder);

      await removeFolder(mockFolder.id);

      expect(del).toHaveBeenCalledWith(mockFolder.id, 'mockFolderStore');
    });
  });

  describe('clearAllFolders', () => {
    it('should delete all folders from IndexedDB', async () => {
      const { del, __mockStore } = await import('idb-keyval') as unknown as {
        del: ReturnType<typeof vi.fn>;
        __mockStore: Map<string, unknown>;
      };
      __mockStore.set('folder-1', mockFolder);
      __mockStore.set('folder-2', { ...mockFolder, id: 'folder-2' });

      await clearAllFolders();

      expect(del).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateFolderFileIds', () => {
    it('should update folder fileIds', async () => {
      const { set, __mockStore } = await import('idb-keyval') as unknown as {
        set: ReturnType<typeof vi.fn>;
        __mockStore: Map<string, unknown>;
      };
      __mockStore.set(mockFolder.id, mockFolder);

      const newFileIds = ['file-3', 'file-4'];
      await updateFolderFileIds(mockFolder.id, newFileIds);

      expect(set).toHaveBeenCalledWith(
        mockFolder.id,
        expect.objectContaining({ fileIds: newFileIds }),
        'mockFolderStore'
      );
    });

    it('should not update non-existent folder', async () => {
      const { set } = await import('idb-keyval');

      await updateFolderFileIds('non-existent', ['file-1']);

      // set should not be called for updates (only get would be called)
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('updateFolderPosition', () => {
    it('should update folder position', async () => {
      const { set, __mockStore } = await import('idb-keyval') as unknown as {
        set: ReturnType<typeof vi.fn>;
        __mockStore: Map<string, unknown>;
      };
      __mockStore.set(mockFolder.id, mockFolder);

      const newPosition = { x: 300, y: 400 };
      await updateFolderPosition(mockFolder.id, newPosition);

      expect(set).toHaveBeenCalledWith(
        mockFolder.id,
        expect.objectContaining({ position: newPosition }),
        'mockFolderStore'
      );
    });
  });

  describe('updateFolderName', () => {
    it('should update folder name', async () => {
      const { set, __mockStore } = await import('idb-keyval') as unknown as {
        set: ReturnType<typeof vi.fn>;
        __mockStore: Map<string, unknown>;
      };
      __mockStore.set(mockFolder.id, mockFolder);

      const newName = 'Renamed Folder';
      await updateFolderName(mockFolder.id, newName);

      expect(set).toHaveBeenCalledWith(
        mockFolder.id,
        expect.objectContaining({ name: newName }),
        'mockFolderStore'
      );
    });
  });

  describe('updateFolderColor', () => {
    it('should update folder color', async () => {
      const { set, __mockStore } = await import('idb-keyval') as unknown as {
        set: ReturnType<typeof vi.fn>;
        __mockStore: Map<string, unknown>;
      };
      __mockStore.set(mockFolder.id, mockFolder);

      const newColor = '#EF4444';
      await updateFolderColor(mockFolder.id, newColor);

      expect(set).toHaveBeenCalledWith(
        mockFolder.id,
        expect.objectContaining({ color: newColor }),
        'mockFolderStore'
      );
    });
  });
});
