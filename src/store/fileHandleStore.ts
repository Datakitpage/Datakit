import { createStore, get, set, del, keys } from 'idb-keyval';

/**
 * FileHandleStore - Persists FileSystemFileHandle objects to IndexedDB
 *
 * FileSystemFileHandle objects are structured-clonable (can be stored in IndexedDB)
 * but NOT JSON-serializable. We use idb-keyval with a custom store to persist them.
 *
 * On page reload, we can retrieve handles and request permission to re-read files.
 */

// Create a dedicated IndexedDB store for file handles
const fileHandleDB = createStore('opensheet-file-handles', 'handles');

// Metadata stored alongside handles (JSON-serializable)
interface FileHandleMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  position: { x: number; y: number };
  lastModified: number;
}

const metadataDB = createStore('opensheet-file-metadata', 'metadata');

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'FileSystemFileHandle' in window;
}

/**
 * Save a file handle with its metadata
 */
export async function saveFileHandle(
  fileId: string,
  handle: FileSystemFileHandle,
  metadata: FileHandleMetadata
): Promise<void> {
  try {
    await set(fileId, handle, fileHandleDB);
    await set(fileId, metadata, metadataDB);
  } catch (error) {
    console.error('[FileHandleStore] Failed to save handle:', error);
  }
}

/**
 * Get a file handle by ID
 */
export async function getFileHandle(fileId: string): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await get<FileSystemFileHandle>(fileId, fileHandleDB);
    return handle ?? null;
  } catch (error) {
    console.error('[FileHandleStore] Failed to get handle:', error);
    return null;
  }
}

/**
 * Get metadata for a file
 */
export async function getFileMetadata(fileId: string): Promise<FileHandleMetadata | null> {
  try {
    const metadata = await get<FileHandleMetadata>(fileId, metadataDB);
    return metadata ?? null;
  } catch (error) {
    console.error('[FileHandleStore] Failed to get metadata:', error);
    return null;
  }
}

/**
 * Get all stored file handles with their metadata
 */
export async function getAllFileHandles(): Promise<Map<string, { handle: FileSystemFileHandle; metadata: FileHandleMetadata }>> {
  const result = new Map<string, { handle: FileSystemFileHandle; metadata: FileHandleMetadata }>();

  try {
    const allKeys = await keys<string>(fileHandleDB);

    for (const key of allKeys) {
      const handle = await get<FileSystemFileHandle>(key, fileHandleDB);
      const metadata = await get<FileHandleMetadata>(key, metadataDB);

      if (handle && metadata) {
        result.set(key, { handle, metadata });
      }
    }
  } catch (error) {
    console.error('[FileHandleStore] Failed to get all handles:', error);
  }

  return result;
}

/**
 * Remove a file handle
 */
export async function removeFileHandle(fileId: string): Promise<void> {
  try {
    await del(fileId, fileHandleDB);
    await del(fileId, metadataDB);
  } catch (error) {
    console.error('[FileHandleStore] Failed to remove handle:', error);
  }
}

/**
 * Clear all stored file handles
 */
export async function clearAllFileHandles(): Promise<void> {
  try {
    const allKeys = await keys<string>(fileHandleDB);
    for (const key of allKeys) {
      await del(key, fileHandleDB);
      await del(key, metadataDB);
    }
  } catch (error) {
    console.error('[FileHandleStore] Failed to clear handles:', error);
  }
}

/**
 * Check permission status for a handle
 */
export async function checkHandlePermission(
  handle: FileSystemFileHandle
): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const permission = await handle.queryPermission({ mode: 'read' });
    return permission;
  } catch (error) {
    console.error('[FileHandleStore] Failed to query permission:', error);
    return 'denied';
  }
}

/**
 * Request permission for a handle (requires user gesture)
 */
export async function requestHandlePermission(
  handle: FileSystemFileHandle
): Promise<boolean> {
  try {
    const permission = await handle.requestPermission({ mode: 'read' });
    return permission === 'granted';
  } catch (error) {
    console.error('[FileHandleStore] Failed to request permission:', error);
    return false;
  }
}

/**
 * Get file from handle (requires permission)
 */
export async function getFileFromHandle(handle: FileSystemFileHandle): Promise<File | null> {
  try {
    return await handle.getFile();
  } catch (error) {
    console.error('[FileHandleStore] Failed to get file from handle:', error);
    return null;
  }
}
