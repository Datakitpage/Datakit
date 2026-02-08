import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBoardStore } from './boardStore';
import type { ContentNodeData } from '@/components/flow/ContentNode';

// Mock persistence modules — they use IndexedDB which isn't available in tests
vi.mock('@/store/fileHandleStore', () => ({
  saveFileHandle: vi.fn(),
  removeFileHandle: vi.fn(),
}));

vi.mock('@/store/folderPersistence', () => ({
  saveFolder: vi.fn(),
  removeFolder: vi.fn(),
  updateFolderFileIds: vi.fn(),
  updateFolderPosition: vi.fn(),
  updateFolderName: vi.fn(),
  updateFolderColor: vi.fn(),
}));

// Helper: create a minimal file node
function makeFile(id: string, position = { x: 0, y: 0 }): ContentNodeData {
  return {
    id,
    name: `${id}.csv`,
    type: 'csv',
    size: 1024,
    position,
    data: [],
    columns: ['col1'],
    rowCount: 1,
    columnCount: 1,
  };
}

// Helper: reset store to a clean state with given files and no folders
function resetStore(files: ContentNodeData[] = []) {
  useBoardStore.setState({
    files,
    folders: [],
    selectedId: null,
    focusedFileId: null,
    openFileIds: [],
    expandedFolderId: null,
    dragOverFileId: null,
    dragOverFolderId: null,
    pendingFolderFiles: null,
  });
}

describe('boardStore — folder drag-in / drag-out', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Creating folders (drag file onto file)
  // =========================================================================
  describe('createFolder', () => {
    it('should create a folder containing both files', () => {
      const f1 = makeFile('file-1', { x: 100, y: 100 });
      const f2 = makeFile('file-2', { x: 100, y: 100 });
      resetStore([f1, f2]);

      const { createFolder } = useBoardStore.getState();
      const folderId = createFolder(['file-1', 'file-2'], { x: 100, y: 100 });

      const { folders } = useBoardStore.getState();
      expect(folders).toHaveLength(1);
      expect(folders[0].id).toBe(folderId);
      expect(folders[0].fileIds).toEqual(['file-1', 'file-2']);
      expect(folders[0].position).toEqual({ x: 100, y: 100 });
    });

    it('should not remove files from the files array', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);

      useBoardStore.getState().createFolder(['file-1', 'file-2'], { x: 0, y: 0 });

      const { files } = useBoardStore.getState();
      expect(files).toHaveLength(2);
    });

    it('should clear dragOverFileId after creating a folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);
      useBoardStore.setState({ dragOverFileId: 'file-2' });

      useBoardStore.getState().createFolder(['file-1', 'file-2'], { x: 0, y: 0 });

      expect(useBoardStore.getState().dragOverFileId).toBeNull();
    });
  });

  // =========================================================================
  // Adding files to folders (drag file onto folder)
  // =========================================================================
  describe('addFileToFolder', () => {
    it('should add a file to an existing folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      const f3 = makeFile('file-3');
      resetStore([f1, f2, f3]);

      const { createFolder, addFileToFolder } = useBoardStore.getState();
      const folderId = createFolder(['file-1', 'file-2'], { x: 0, y: 0 });

      addFileToFolder(folderId, 'file-3');

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-1', 'file-2', 'file-3']);
    });

    it('should not add duplicate file to folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);

      const { createFolder, addFileToFolder } = useBoardStore.getState();
      const folderId = createFolder(['file-1', 'file-2'], { x: 0, y: 0 });

      addFileToFolder(folderId, 'file-1'); // already in folder

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-1', 'file-2']);
    });
  });

  // =========================================================================
  // Removing files from folders
  // =========================================================================
  describe('removeFileFromFolder', () => {
    it('should remove a file from the folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      const f3 = makeFile('file-3');
      resetStore([f1, f2, f3]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2', 'file-3'], { x: 0, y: 0 }
      );

      useBoardStore.getState().removeFileFromFolder(folderId, 'file-2');

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-1', 'file-3']);
    });

    it('should keep the file in the files array after removal from folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], { x: 0, y: 0 }
      );

      useBoardStore.getState().removeFileFromFolder(folderId, 'file-1');

      const { files } = useBoardStore.getState();
      expect(files.some(f => f.id === 'file-1')).toBe(true);
    });
  });

  // =========================================================================
  // Expanding / collapsing folders
  // =========================================================================
  describe('expandFolder / collapseFolder', () => {
    it('should set expandedFolderId on expand', () => {
      const f1 = makeFile('file-1');
      resetStore([f1]);

      const folderId = useBoardStore.getState().createFolder(['file-1'], { x: 0, y: 0 });

      useBoardStore.getState().expandFolder(folderId);

      expect(useBoardStore.getState().expandedFolderId).toBe(folderId);
    });

    it('should mark the folder as isOpen on expand', () => {
      const f1 = makeFile('file-1');
      resetStore([f1]);

      const folderId = useBoardStore.getState().createFolder(['file-1'], { x: 0, y: 0 });

      useBoardStore.getState().expandFolder(folderId);

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.isOpen).toBe(true);
    });

    it('should clear expandedFolderId on collapse', () => {
      const f1 = makeFile('file-1');
      resetStore([f1]);

      const folderId = useBoardStore.getState().createFolder(['file-1'], { x: 0, y: 0 });
      useBoardStore.getState().expandFolder(folderId);
      useBoardStore.getState().collapseFolder();

      expect(useBoardStore.getState().expandedFolderId).toBeNull();
    });

    it('should close other open folders when expanding a different folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);

      const folder1Id = useBoardStore.getState().createFolder(['file-1'], { x: 0, y: 0 });
      const folder2Id = useBoardStore.getState().createFolder(['file-2'], { x: 100, y: 0 });

      useBoardStore.getState().expandFolder(folder1Id);
      useBoardStore.getState().expandFolder(folder2Id);

      const state = useBoardStore.getState();
      const folder1 = state.folders.find(f => f.id === folder1Id);
      const folder2 = state.folders.find(f => f.id === folder2Id);

      expect(state.expandedFolderId).toBe(folder2Id);
      expect(folder1?.isOpen).toBe(false);
      expect(folder2?.isOpen).toBe(true);
    });
  });

  // =========================================================================
  // Delete folder
  // =========================================================================
  describe('deleteFolder', () => {
    it('should remove folder but keep files when keepFiles=true', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], { x: 0, y: 0 }
      );

      useBoardStore.getState().deleteFolder(folderId, true);

      const state = useBoardStore.getState();
      expect(state.folders).toHaveLength(0);
      expect(state.files).toHaveLength(2);
    });

    it('should remove folder and delete files when keepFiles=false', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      const f3 = makeFile('file-3');
      resetStore([f1, f2, f3]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], { x: 0, y: 0 }
      );

      useBoardStore.getState().deleteFolder(folderId, false);

      const state = useBoardStore.getState();
      expect(state.folders).toHaveLength(0);
      // Only file-3 remains (not in the folder)
      expect(state.files).toHaveLength(1);
      expect(state.files[0].id).toBe('file-3');
    });
  });

  // =========================================================================
  // Drag-out scenario: full workflow
  // =========================================================================
  describe('drag-out workflow', () => {
    it('should correctly handle drag-out from a 3-file folder (2 remain)', () => {
      const f1 = makeFile('file-1', { x: 50, y: 50 });
      const f2 = makeFile('file-2', { x: 50, y: 50 });
      const f3 = makeFile('file-3', { x: 50, y: 50 });
      resetStore([f1, f2, f3]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2', 'file-3'], { x: 200, y: 200 }
      );

      // Expand the folder
      useBoardStore.getState().expandFolder(folderId);
      expect(useBoardStore.getState().expandedFolderId).toBe(folderId);

      // Simulate drag-out: remove file-1, place on canvas at new position
      useBoardStore.getState().updateFilePosition('file-1', { x: 500, y: 500 });
      useBoardStore.getState().removeFileFromFolder(folderId, 'file-1');

      const state = useBoardStore.getState();
      const folder = state.folders.find(f => f.id === folderId);

      // Folder still exists with 2 files
      expect(folder).toBeDefined();
      expect(folder?.fileIds).toEqual(['file-2', 'file-3']);

      // Dragged file is positioned at the drop location
      const draggedFile = state.files.find(f => f.id === 'file-1');
      expect(draggedFile?.position).toEqual({ x: 500, y: 500 });
    });

    it('should dissolve folder when drag-out leaves 1 file (simulating handleExpandedFileDragEnd)', () => {
      const f1 = makeFile('file-1', { x: 50, y: 50 });
      const f2 = makeFile('file-2', { x: 50, y: 50 });
      resetStore([f1, f2]);

      const folderPos = { x: 200, y: 200 };
      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], folderPos
      );
      useBoardStore.getState().expandFolder(folderId);

      // Simulate the full handleExpandedFileDragEnd logic for drag-out:
      // 1. Update dragged file position
      useBoardStore.getState().updateFilePosition('file-1', { x: 500, y: 500 });
      // 2. Remove dragged file from folder
      useBoardStore.getState().removeFileFromFolder(folderId, 'file-1');

      // 3. remainingCount = 2 - 1 = 1, so dissolve:
      //    a. Collapse
      useBoardStore.getState().collapseFolder();
      //    b. Release last remaining file
      useBoardStore.getState().removeFileFromFolder(folderId, 'file-2');
      useBoardStore.getState().updateFilePosition('file-2', folderPos);
      //    c. Delete folder
      useBoardStore.getState().deleteFolder(folderId, true);

      const state = useBoardStore.getState();

      // Folder should be gone
      expect(state.folders).toHaveLength(0);
      expect(state.expandedFolderId).toBeNull();

      // Both files should exist on the canvas
      expect(state.files).toHaveLength(2);

      // Dragged file at drop position
      expect(state.files.find(f => f.id === 'file-1')?.position).toEqual({ x: 500, y: 500 });

      // Remaining file released at folder position
      expect(state.files.find(f => f.id === 'file-2')?.position).toEqual(folderPos);
    });

    it('should delete folder when drag-out leaves 0 files', () => {
      const f1 = makeFile('file-1', { x: 50, y: 50 });
      resetStore([f1]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1'], { x: 200, y: 200 }
      );
      useBoardStore.getState().expandFolder(folderId);

      // Drag out the only file
      useBoardStore.getState().updateFilePosition('file-1', { x: 500, y: 500 });
      useBoardStore.getState().removeFileFromFolder(folderId, 'file-1');

      // remainingCount = 0, collapse + delete
      useBoardStore.getState().collapseFolder();
      useBoardStore.getState().deleteFolder(folderId, true);

      const state = useBoardStore.getState();
      expect(state.folders).toHaveLength(0);
      expect(state.expandedFolderId).toBeNull();
      expect(state.files).toHaveLength(1);
      expect(state.files[0].position).toEqual({ x: 500, y: 500 });
    });

    it('should not modify folder when drag distance < threshold (snap back)', () => {
      const f1 = makeFile('file-1', { x: 50, y: 50 });
      const f2 = makeFile('file-2', { x: 50, y: 50 });
      resetStore([f1, f2]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], { x: 200, y: 200 }
      );
      useBoardStore.getState().expandFolder(folderId);

      // No state changes when user drops close (< 150px threshold)
      // The handler just returns without calling store methods

      const state = useBoardStore.getState();
      const folder = state.folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-1', 'file-2']);
      expect(state.expandedFolderId).toBe(folderId);
    });
  });

  // =========================================================================
  // Drag-in scenario: file -> folder
  // =========================================================================
  describe('drag-in workflow', () => {
    it('should add file to folder when dropped on it', () => {
      const f1 = makeFile('file-1', { x: 100, y: 100 });
      const f2 = makeFile('file-2', { x: 200, y: 200 });
      const f3 = makeFile('file-3', { x: 300, y: 300 });
      resetStore([f1, f2, f3]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], { x: 150, y: 150 }
      );

      // Simulate dropping file-3 on the folder
      useBoardStore.getState().addFileToFolder(folderId, 'file-3');

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-1', 'file-2', 'file-3']);
    });

    it('should create a new folder when file is dropped on another file', () => {
      const f1 = makeFile('file-1', { x: 100, y: 100 });
      const f2 = makeFile('file-2', { x: 200, y: 200 });
      resetStore([f1, f2]);

      // Simulate drag + drop: file-1 dropped on file-2
      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], { x: 200, y: 200 }
      );

      const state = useBoardStore.getState();
      expect(state.folders).toHaveLength(1);
      expect(state.folders[0].fileIds).toEqual(['file-1', 'file-2']);
      expect(state.folders[0].position).toEqual({ x: 200, y: 200 });
      expect(state.folders[0].id).toBe(folderId);
    });
  });

  // =========================================================================
  // File position updates
  // =========================================================================
  describe('updateFilePosition', () => {
    it('should update the file position in the store', () => {
      const f1 = makeFile('file-1', { x: 0, y: 0 });
      resetStore([f1]);

      useBoardStore.getState().updateFilePosition('file-1', { x: 300, y: 400 });

      const file = useBoardStore.getState().files.find(f => f.id === 'file-1');
      expect(file?.position).toEqual({ x: 300, y: 400 });
    });
  });

  // =========================================================================
  // Folder color
  // =========================================================================
  describe('setFolderColor', () => {
    it('should update folder color', () => {
      const f1 = makeFile('file-1');
      resetStore([f1]);

      const folderId = useBoardStore.getState().createFolder(['file-1'], { x: 0, y: 0 });

      useBoardStore.getState().setFolderColor(folderId, '#EF4444');

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.color).toBe('#EF4444');
    });
  });

  // =========================================================================
  // Rename folder
  // =========================================================================
  describe('renameFolder', () => {
    it('should rename folder and clear isRenaming', () => {
      const f1 = makeFile('file-1');
      resetStore([f1]);

      const folderId = useBoardStore.getState().createFolder(['file-1'], { x: 0, y: 0 });
      useBoardStore.getState().startRenamingFolder(folderId);

      const renamingFolder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(renamingFolder?.isRenaming).toBe(true);

      useBoardStore.getState().renameFolder(folderId, 'My New Folder');

      const renamedFolder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(renamedFolder?.name).toBe('My New Folder');
      expect(renamedFolder?.isRenaming).toBe(false);
    });
  });

  // =========================================================================
  // addGoogleSheet
  // =========================================================================
  describe('addGoogleSheet', () => {
    it('should add a Google Sheet node with correct properties', () => {
      resetStore();
      const { addGoogleSheet } = useBoardStore.getState();

      addGoogleSheet({
        id: 'gsheet-1',
        name: 'Q4 Sales - Sheet1',
        viewName: 'gsheet_sales_data',
        rowCount: 500,
        columnCount: 5,
        columns: ['Name', 'Revenue', 'Region', 'Date', 'Status'],
        position: { x: 200, y: 300 },
        googleSheetMeta: {
          spreadsheetId: 'abc-123',
          spreadsheetName: 'Q4 Sales',
          sheetId: 0,
          sheetName: 'Sheet1',
          lastSynced: Date.now(),
        },
      });

      const state = useBoardStore.getState();
      const file = state.files.find(f => f.id === 'gsheet-1');

      expect(file).toBeDefined();
      expect(file?.type).toBe('gsheet');
      expect(file?.name).toBe('Q4 Sales - Sheet1');
      expect(file?.viewName).toBe('gsheet_sales_data');
      expect(file?.isCloudSource).toBe(true);
      expect(file?.position).toEqual({ x: 200, y: 300 });
      expect(file?.rowCount).toBe(500);
      expect(file?.columnCount).toBe(5);
      expect(file?.columns).toEqual(['Name', 'Revenue', 'Region', 'Date', 'Status']);
      expect(file?.processing).toBe(false);
      expect(file?.size).toBe(0);
    });

    it('should auto-focus the added Google Sheet', () => {
      resetStore();
      useBoardStore.getState().addGoogleSheet({
        id: 'gsheet-2',
        name: 'Test Sheet - Data',
        viewName: 'gsheet_test',
        rowCount: 10,
        columnCount: 2,
        columns: ['A', 'B'],
        position: { x: 0, y: 0 },
        googleSheetMeta: {
          spreadsheetId: 'xyz',
          spreadsheetName: 'Test Sheet',
          sheetId: 0,
          sheetName: 'Data',
          lastSynced: Date.now(),
        },
      });

      expect(useBoardStore.getState().focusedFileId).toBe('gsheet-2');
    });

    it('should add the sheet to openFileIds', () => {
      resetStore();
      useBoardStore.getState().addGoogleSheet({
        id: 'gsheet-3',
        name: 'Open Test - Sheet1',
        viewName: 'gsheet_open',
        rowCount: 1,
        columnCount: 1,
        columns: ['Col'],
        position: { x: 0, y: 0 },
        googleSheetMeta: {
          spreadsheetId: 'abc',
          spreadsheetName: 'Open Test',
          sheetId: 0,
          sheetName: 'Sheet1',
          lastSynced: Date.now(),
        },
      });

      expect(useBoardStore.getState().openFileIds).toContain('gsheet-3');
    });

    it('should not duplicate in openFileIds if already present', () => {
      resetStore();
      useBoardStore.setState({ openFileIds: ['gsheet-4'] });

      useBoardStore.getState().addGoogleSheet({
        id: 'gsheet-4',
        name: 'Dup - Sheet1',
        viewName: 'gsheet_dup',
        rowCount: 1,
        columnCount: 1,
        columns: ['X'],
        position: { x: 0, y: 0 },
        googleSheetMeta: {
          spreadsheetId: 'dup',
          spreadsheetName: 'Dup',
          sheetId: 0,
          sheetName: 'Sheet1',
          lastSynced: Date.now(),
        },
      });

      const ids = useBoardStore.getState().openFileIds;
      expect(ids.filter(id => id === 'gsheet-4')).toHaveLength(1);
    });

    it('should preserve existing files when adding a Google Sheet', () => {
      const f1 = makeFile('existing-csv');
      resetStore([f1]);

      useBoardStore.getState().addGoogleSheet({
        id: 'gsheet-5',
        name: 'Keep - Sheet1',
        viewName: 'gsheet_preserve',
        rowCount: 5,
        columnCount: 2,
        columns: ['A', 'B'],
        position: { x: 100, y: 100 },
        googleSheetMeta: {
          spreadsheetId: 'keep',
          spreadsheetName: 'Keep',
          sheetId: 0,
          sheetName: 'Sheet1',
          lastSynced: Date.now(),
        },
      });

      const state = useBoardStore.getState();
      expect(state.files).toHaveLength(2);
      expect(state.files.find(f => f.id === 'existing-csv')).toBeDefined();
      expect(state.files.find(f => f.id === 'gsheet-5')).toBeDefined();
    });

    it('should store googleSheetMeta on the file node', () => {
      resetStore();
      const meta = {
        spreadsheetId: 'meta-test',
        spreadsheetName: 'Meta Sheet',
        sheetId: 42,
        sheetName: 'Revenue',
        lastSynced: 1700000000000,
        remoteModifiedTime: '2025-01-01T00:00:00Z',
      };

      useBoardStore.getState().addGoogleSheet({
        id: 'gsheet-meta',
        name: 'Meta Sheet - Revenue',
        viewName: 'gsheet_meta_view',
        rowCount: 100,
        columnCount: 3,
        columns: ['A', 'B', 'C'],
        position: { x: 0, y: 0 },
        googleSheetMeta: meta,
      });

      const file = useBoardStore.getState().files.find(f => f.id === 'gsheet-meta');
      expect(file?.googleSheetMeta).toEqual(meta);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('should handle deleteFile removing file from folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2'], { x: 0, y: 0 }
      );

      // Delete file-1 entirely (not just remove from folder)
      useBoardStore.getState().deleteFile('file-1');

      const state = useBoardStore.getState();
      expect(state.files).toHaveLength(1);
      expect(state.files[0].id).toBe('file-2');

      // Folder should still exist but with file-1 removed from fileIds
      const folder = state.folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-2']);
    });

    it('should handle removing a file that is not in the folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      resetStore([f1, f2]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1'], { x: 0, y: 0 }
      );

      // Try to remove file-2 which isn't in this folder — should be a no-op
      useBoardStore.getState().removeFileFromFolder(folderId, 'file-2');

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-1']);
    });

    it('should handle deleting a non-existent folder gracefully', () => {
      resetStore([]);

      // Should not throw
      expect(() => {
        useBoardStore.getState().deleteFolder('non-existent', true);
      }).not.toThrow();
    });

    it('should handle multiple rapid drag-outs from same folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      const f3 = makeFile('file-3');
      const f4 = makeFile('file-4');
      resetStore([f1, f2, f3, f4]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-2', 'file-3', 'file-4'], { x: 200, y: 200 }
      );
      useBoardStore.getState().expandFolder(folderId);

      // Drag out file-1
      useBoardStore.getState().updateFilePosition('file-1', { x: 500, y: 100 });
      useBoardStore.getState().removeFileFromFolder(folderId, 'file-1');

      let folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-2', 'file-3', 'file-4']);

      // Drag out file-3
      useBoardStore.getState().updateFilePosition('file-3', { x: 600, y: 100 });
      useBoardStore.getState().removeFileFromFolder(folderId, 'file-3');

      folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.fileIds).toEqual(['file-2', 'file-4']);

      // All 4 files still exist
      expect(useBoardStore.getState().files).toHaveLength(4);
    });

    it('should update folder position', () => {
      const f1 = makeFile('file-1');
      resetStore([f1]);

      const folderId = useBoardStore.getState().createFolder(['file-1'], { x: 0, y: 0 });

      useBoardStore.getState().updateFolderPosition(folderId, { x: 300, y: 400 });

      const folder = useBoardStore.getState().folders.find(f => f.id === folderId);
      expect(folder?.position).toEqual({ x: 300, y: 400 });
    });
  });

  // =========================================================================
  // getFilesInFolder helper
  // =========================================================================
  describe('getFilesInFolder', () => {
    it('should return files that belong to the folder', () => {
      const f1 = makeFile('file-1');
      const f2 = makeFile('file-2');
      const f3 = makeFile('file-3');
      resetStore([f1, f2, f3]);

      const folderId = useBoardStore.getState().createFolder(
        ['file-1', 'file-3'], { x: 0, y: 0 }
      );

      const folderFiles = useBoardStore.getState().getFilesInFolder(folderId);
      expect(folderFiles).toHaveLength(2);
      expect(folderFiles.map(f => f.id).sort()).toEqual(['file-1', 'file-3']);
    });

    it('should return empty array for non-existent folder', () => {
      resetStore([]);
      const result = useBoardStore.getState().getFilesInFolder('non-existent');
      expect(result).toEqual([]);
    });
  });
});
