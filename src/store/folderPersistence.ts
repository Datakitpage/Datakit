import { createStore, get, set, del, keys } from 'idb-keyval';

/**
 * FolderPersistence - Persists folder structure to IndexedDB
 *
 * Folders are JSON-serializable so we store them directly.
 * On page reload, we restore folders and match fileIds with restored file handles.
 */

// Create a dedicated IndexedDB store for folders
const folderDB = createStore('opensheet-folders', 'folders');

// Persisted folder structure (JSON-serializable)
export interface PersistedFolder {
  id: string;
  name: string;
  position: { x: number; y: number };
  fileIds: string[];
  color: string;
}

/**
 * Save a folder to IndexedDB
 */
export async function saveFolder(folder: PersistedFolder): Promise<void> {
  try {
    await set(folder.id, folder, folderDB);
  } catch (error) {
    console.error('[FolderPersistence] Failed to save folder:', error);
  }
}

/**
 * Get a folder by ID
 */
export async function getFolder(folderId: string): Promise<PersistedFolder | null> {
  try {
    const folder = await get<PersistedFolder>(folderId, folderDB);
    return folder ?? null;
  } catch (error) {
    console.error('[FolderPersistence] Failed to get folder:', error);
    return null;
  }
}

/**
 * Get all stored folders
 */
export async function getAllFolders(): Promise<PersistedFolder[]> {
  const folders: PersistedFolder[] = [];

  try {
    const allKeys = await keys<string>(folderDB);

    for (const key of allKeys) {
      const folder = await get<PersistedFolder>(key, folderDB);
      if (folder) {
        folders.push(folder);
      }
    }
  } catch (error) {
    console.error('[FolderPersistence] Failed to get all folders:', error);
  }

  return folders;
}

/**
 * Remove a folder from IndexedDB
 */
export async function removeFolder(folderId: string): Promise<void> {
  try {
    await del(folderId, folderDB);
  } catch (error) {
    console.error('[FolderPersistence] Failed to remove folder:', error);
  }
}

/**
 * Clear all stored folders
 */
export async function clearAllFolders(): Promise<void> {
  try {
    const allKeys = await keys<string>(folderDB);
    for (const key of allKeys) {
      await del(key, folderDB);
    }
  } catch (error) {
    console.error('[FolderPersistence] Failed to clear folders:', error);
  }
}

/**
 * Update a folder's fileIds (when files are added/removed)
 */
export async function updateFolderFileIds(folderId: string, fileIds: string[]): Promise<void> {
  try {
    const folder = await get<PersistedFolder>(folderId, folderDB);
    if (folder) {
      folder.fileIds = fileIds;
      await set(folderId, folder, folderDB);
    }
  } catch (error) {
    console.error('[FolderPersistence] Failed to update folder fileIds:', error);
  }
}

/**
 * Update a folder's position
 */
export async function updateFolderPosition(folderId: string, position: { x: number; y: number }): Promise<void> {
  try {
    const folder = await get<PersistedFolder>(folderId, folderDB);
    if (folder) {
      folder.position = position;
      await set(folderId, folder, folderDB);
    }
  } catch (error) {
    console.error('[FolderPersistence] Failed to update folder position:', error);
  }
}

/**
 * Update a folder's name
 */
export async function updateFolderName(folderId: string, name: string): Promise<void> {
  try {
    const folder = await get<PersistedFolder>(folderId, folderDB);
    if (folder) {
      folder.name = name;
      await set(folderId, folder, folderDB);
    }
  } catch (error) {
    console.error('[FolderPersistence] Failed to update folder name:', error);
  }
}

/**
 * Update a folder's color
 */
export async function updateFolderColor(folderId: string, color: string): Promise<void> {
  try {
    const folder = await get<PersistedFolder>(folderId, folderDB);
    if (folder) {
      folder.color = color;
      await set(folderId, folder, folderDB);
    }
  } catch (error) {
    console.error('[FolderPersistence] Failed to update folder color:', error);
  }
}
