import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  WarmCanvas,
  DesktopFileIcon,
  DesktopFolderIcon,
  ControlPanel,
  AICommandBar,
  FocusedFileView,
  SettingsPanel,
  AppChangelog,
  GoogleSheetsModal,
} from '@/components/flow';
import type { WarmCanvasRef } from '@/components/flow/WarmCanvas';
import { useBoardStore } from '@/store/boardStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useDuckDBViewStore } from '@/store/duckDBViewStore';
import { useGoogleSheetsStore } from '@/store/googleSheetsStore';
import { getSheetData, getFileModifiedTime, TokenExpiredError } from '@/lib/google/sheetsApi';
import {
  getAllFileHandles,
  checkHandlePermission,
  requestHandlePermission,
  getFileFromHandle,
  removeFileHandle,
  isFileSystemAccessSupported,
} from '@/store/fileHandleStore';
import { getAllFolders } from '@/store/folderPersistence';
import type { ContentType } from '@/components/flow/ContentNode';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useIsMobile } from '@/hooks/useIsMobile';
import { DownloadButton } from '@/components/DownloadButton';
import { MobileBoardView } from '@/components/MobileBoardView';
import { OnboardingOverlay } from '@/components/onboarding';
import { streamGlobalAssistant, type GlobalSearchContext } from '@/lib/ai';

export function OpenSheet() {
  const isMobile = useIsMobile();
  const [gsheetsEnabled] = useState(() => new URLSearchParams(window.location.search).get('gsheets') === 'enabled');

  const {
    files,
    folders,
    selectedId,
    focusedFileId,
    openFileIds,
    expandedFolderId,
    dragOverFileId,
    dragOverFolderId,
    addFile,
    restoreFile,
    updateFilePosition,
    renameFile,
    deleteFile,
    selectItem,
    focusFile,
    unfocusFile,
    closeFileTab,
    reorderTabs,
    createFolder,
    restoreFolder,
    addFileToFolder,
    removeFileFromFolder,
    updateFolderPosition,
    openFolder,
    renameFolder,
    setFolderColor,
    deleteFolder,
    startRenamingFolder,
    stopRenamingFolder,
    setDragOverFile,
    setDragOverFolder,
    expandFolder,
    collapseFolder,
  } = useBoardStore();

  // File restoration state
  const [pendingRestoreCount, setPendingRestoreCount] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const pendingHandlesRef = useRef<Map<string, { handle: FileSystemFileHandle; metadata: { id: string; name: string; type: string; size: number; position: { x: number; y: number } } }>>(new Map());

  // Track which folder is currently "open" (when user opens files from a folder)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  // Get open files for tabs (in order they were opened)
  const openFiles = useMemo(
    () => openFileIds.map(id => files.find(f => f.id === id)).filter(Boolean) as typeof files,
    [files, openFileIds]
  );

  // Get files that are NOT in any folder (for desktop display)
  const filesInFolders = useMemo(
    () => new Set(folders.flatMap(f => f.fileIds)),
    [folders]
  );

  const desktopFiles = useMemo(
    () => files.filter(f => !filesInFolders.has(f.id)),
    [files, filesInFolders]
  );

  // Compute grid positions for files when a folder is expanded (bloom layout)
  const expandedFolderFilePositions = useMemo(() => {
    if (!expandedFolderId) return new Map<string, { x: number; y: number }>();
    const folder = folders.find(f => f.id === expandedFolderId);
    if (!folder) return new Map<string, { x: number; y: number }>();

    const SPACING = 108; // 88px icon + 20px gap
    const fileIds = folder.fileIds;
    const cols = fileIds.length <= 2 ? 2 : fileIds.length <= 6 ? 3 : 4;

    const gridWidth = (cols - 1) * SPACING;
    const startX = folder.position.x - gridWidth / 2 + 44; // center on folder (folder icon is 88px, so +44 to center)
    const startY = folder.position.y + 100; // below folder icon

    const positions = new Map<string, { x: number; y: number }>();
    fileIds.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(id, { x: startX + col * SPACING, y: startY + row * SPACING });
    });
    return positions;
  }, [expandedFolderId, folders]);

  // Track drag state for expanded folder files (real-time feedback during drag)
  const [expandedDragState, setExpandedDragState] = useState<{
    fileId: string;
    isOutside: boolean;
  } | null>(null);

  // Display positions: when a file is being dragged outside, remaining files close the gap
  const expandedDisplayPositions = useMemo(() => {
    if (!expandedDragState?.isOutside || !expandedFolderId) {
      return expandedFolderFilePositions;
    }
    const folder = folders.find(f => f.id === expandedFolderId);
    if (!folder) return expandedFolderFilePositions;

    const remainingIds = folder.fileIds.filter(id => id !== expandedDragState.fileId);
    if (remainingIds.length === 0) return expandedFolderFilePositions;

    const SPACING = 108;
    const cols = remainingIds.length <= 2 ? 2 : remainingIds.length <= 6 ? 3 : 4;
    const gridWidth = (cols - 1) * SPACING;
    const startX = folder.position.x - gridWidth / 2 + 44;
    const startY = folder.position.y + 100;

    const positions = new Map<string, { x: number; y: number }>();
    remainingIds.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(id, { x: startX + col * SPACING, y: startY + row * SPACING });
    });
    return positions;
  }, [expandedDragState, expandedFolderId, folders, expandedFolderFilePositions]);

  // Check if only sample files exist (no user-dropped files)
  const onlySampleFiles = useMemo(
    () => files.length > 0 && files.every(f => f.id.startsWith('sample-')) && folders.length === 0,
    [files, folders]
  );

  // Canvas ref for controlling zoom/pan
  const canvasRef = useRef<WarmCanvasRef>(null);

  const [zoom, setZoom] = useState(1);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [googleSheetsModalOpen, setGoogleSheetsModalOpen] = useState(false);
  const [changelogMinimized, setChangelogMinimized] = useState(false);
  const [changelogAutoExpand, setChangelogAutoExpand] = useState(false);

  // Settings (theme is applied automatically via settingsStore's onRehydrateStorage)
  const { theme, toggleTheme, anthropicApiKey } = useSettingsStore();

  // Preload DuckDB on app startup for instant data operations
  const initializeDuckDB = useDuckDBViewStore(state => state.initialize);
  useEffect(() => {
    console.log('[OpenSheet] Preloading DuckDB on app startup...');
    initializeDuckDB().then(success => {
      console.log('[OpenSheet] DuckDB preload complete:', success);
    });
  }, [initializeDuckDB]);

  // Check for stored file handles on app load and restore files with granted permissions
  useEffect(() => {
    if (!isFileSystemAccessSupported()) {
      console.log('[OpenSheet] File System Access API not supported');
      return;
    }

    async function checkStoredHandles() {
      console.log('[OpenSheet] Checking for stored file handles...');
      const storedHandles = await getAllFileHandles();

      if (storedHandles.size === 0) {
        console.log('[OpenSheet] No stored file handles found');
        return;
      }

      console.log(`[OpenSheet] Found ${storedHandles.size} stored file handles`);
      const pendingHandles = new Map<string, { handle: FileSystemFileHandle; metadata: { id: string; name: string; type: string; size: number; position: { x: number; y: number } } }>();

      for (const [fileId, { handle, metadata }] of storedHandles) {
        // Skip if file already exists in the store
        if (files.some(f => f.id === fileId)) {
          console.log(`[OpenSheet] File ${fileId} already exists, skipping`);
          continue;
        }

        const permission = await checkHandlePermission(handle);
        console.log(`[OpenSheet] Handle ${metadata.name}: permission = ${permission}`);

        if (permission === 'granted') {
          // Permission already granted, restore immediately
          try {
            const file = await getFileFromHandle(handle);
            if (file) {
              restoreFile(fileId, file, {
                name: metadata.name,
                type: metadata.type as ContentType,
                size: metadata.size,
                position: metadata.position,
              }, handle);
              console.log(`[OpenSheet] Restored file: ${metadata.name}`);
            }
          } catch (error) {
            console.error(`[OpenSheet] Failed to restore file ${metadata.name}:`, error);
            // Handle may be stale, remove it
            await removeFileHandle(fileId);
          }
        } else if (permission === 'prompt') {
          // Need user gesture to request permission
          pendingHandles.set(fileId, { handle, metadata });
        } else {
          // Permission denied, remove the handle
          console.log(`[OpenSheet] Permission denied for ${metadata.name}, removing handle`);
          await removeFileHandle(fileId);
        }
      }

      if (pendingHandles.size > 0) {
        pendingHandlesRef.current = pendingHandles;
        setPendingRestoreCount(pendingHandles.size);
      }
    }

    checkStoredHandles();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally run only on mount
  }, []);

  // Restore folders from IndexedDB on app load
  useEffect(() => {
    async function restoreStoredFolders() {
      console.log('[OpenSheet] Checking for stored folders...');
      const storedFolders = await getAllFolders();

      if (storedFolders.length === 0) {
        console.log('[OpenSheet] No stored folders found');
        return;
      }

      console.log(`[OpenSheet] Found ${storedFolders.length} stored folders`);

      for (const folder of storedFolders) {
        // Filter out fileIds that don't exist (files may have been deleted)
        // Note: At this point, files may still be restoring, so we keep all fileIds
        // The folder will simply show fewer files if some couldn't be restored
        restoreFolder(folder);
        console.log(`[OpenSheet] Restored folder: ${folder.name}`);
      }
    }

    restoreStoredFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally run only on mount
  }, []);

  // Handler to restore files that need permission (requires user gesture)
  const handleRestoreFiles = useCallback(async () => {
    if (pendingHandlesRef.current.size === 0) return;

    setIsRestoring(true);
    let restoredCount = 0;

    for (const [fileId, { handle, metadata }] of pendingHandlesRef.current) {
      try {
        const granted = await requestHandlePermission(handle);
        if (granted) {
          const file = await getFileFromHandle(handle);
          if (file) {
            restoreFile(fileId, file, {
              name: metadata.name,
              type: metadata.type as ContentType,
              size: metadata.size,
              position: metadata.position,
            }, handle);
            restoredCount++;
          }
        } else {
          // Permission denied, remove the handle
          await removeFileHandle(fileId);
        }
      } catch (error) {
        console.error(`[OpenSheet] Failed to restore file ${metadata.name}:`, error);
        await removeFileHandle(fileId);
      }
    }

    pendingHandlesRef.current.clear();
    setPendingRestoreCount(0);
    setIsRestoring(false);

    console.log(`[OpenSheet] Restored ${restoredCount} files`);
  }, [restoreFile]);

  // Sync zoom from canvas
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  // Control panel zoom handlers
  const handleControlPanelZoom = useCallback((newZoom: number) => {
    setZoom(newZoom);
    canvasRef.current?.setZoom(newZoom);
  }, []);

  // Keyboard navigation (disabled when a file is focused - FocusedFileView has its own handlers)
  useKeyboard({
    onToggleCommandPalette: () => setCommandBarOpen(prev => !prev),
    onZoomIn: () => canvasRef.current?.zoomIn(),
    onZoomOut: () => canvasRef.current?.zoomOut(),
    onZoomReset: () => canvasRef.current?.reset(),
    onEscape: () => {
      if (commandBarOpen) {
        setCommandBarOpen(false);
      } else if (focusedFileId) {
        unfocusFile();
      } else if (expandedFolderId) {
        collapseFolder();
      } else {
        selectItem(null);
      }
    },
    onEnter: () => {
      // Open (focus) the selected file or expand the selected folder
      if (selectedId && !focusedFileId) {
        const isFile = files.some(f => f.id === selectedId);
        const isFolder = folders.some(f => f.id === selectedId);
        if (isFile) {
          focusFile(selectedId);
        } else if (isFolder) {
          const folder = folders.find(f => f.id === selectedId);
          if (folder && folder.fileIds.length > 0) {
            expandFolder(selectedId);
          }
        }
      }
    },
    onDelete: () => {
      console.log('Delete:', selectedId);
    },
    onSelectNext: () => {
      if (focusedFileId && files.length > 1) {
        const currentIdx = files.findIndex(f => f.id === focusedFileId);
        const nextIdx = (currentIdx + 1) % files.length;
        focusFile(files[nextIdx].id);
        return;
      }
      const allIds = [...files.map(f => f.id), ...folders.map(f => f.id)];
      if (allIds.length === 0) return;
      const currentIdx = selectedId ? allIds.indexOf(selectedId) : -1;
      const nextIdx = (currentIdx + 1) % allIds.length;
      selectItem(allIds[nextIdx]);
    },
    onSelectPrev: () => {
      if (focusedFileId && files.length > 1) {
        const currentIdx = files.findIndex(f => f.id === focusedFileId);
        const prevIdx = (currentIdx - 1 + files.length) % files.length;
        focusFile(files[prevIdx].id);
        return;
      }
      const allIds = [...files.map(f => f.id), ...folders.map(f => f.id)];
      if (allIds.length === 0) return;
      const currentIdx = selectedId ? allIds.indexOf(selectedId) : 0;
      const prevIdx = (currentIdx - 1 + allIds.length) % allIds.length;
      selectItem(allIds[prevIdx]);
    },
    customShortcuts: files.slice(0, 9).map((file, index) => ({
      key: String(index + 1),
      modifiers: [] as ('meta' | 'ctrl' | 'alt' | 'shift')[],
      action: () => {
        if (focusedFileId) {
          focusFile(file.id);
        }
      },
    })),
    enabled: !commandBarOpen && !focusedFileId,
    // When file is focused, FocusedFileView has its own CMD+K handler for local AI command
    skipGlobalCmdK: !!focusedFileId,
  });

  // Command items - files, view controls, and settings
  const commands = useMemo(() => [
    // Settings commands
    {
      id: 'toggle-theme',
      type: 'action' as const,
      icon: theme === 'light' ? '🌙' : '☀️',
      title: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      subtitle: `Currently: ${theme} mode`,
      keywords: ['theme', 'dark', 'light', 'mode', 'toggle'],
      action: () => toggleTheme(),
    },
    {
      id: 'open-settings',
      type: 'action' as const,
      icon: '⚙️',
      title: 'Settings',
      subtitle: 'Theme, colors, and AI configuration',
      keywords: ['settings', 'preferences', 'config', 'theme', 'colors', 'ai', 'api', 'key', 'anthropic'],
      action: () => setSettingsPanelOpen(true),
    },
    {
      id: 'open-integrations',
      type: 'action' as const,
      icon: '🔌',
      title: 'Integrations',
      subtitle: 'Connect Google Sheets and other data sources',
      keywords: ['integrations', 'google', 'sheets', 'connect', 'import', 'drive', 'cloud'],
      action: () => setGoogleSheetsModalOpen(true),
    },
    // View commands
    {
      id: 'zoom-fit',
      type: 'action' as const,
      icon: '⊡',
      title: 'Zoom to Fit',
      subtitle: 'Fit all items on screen',
      shortcut: '⌘0',
      keywords: ['zoom', 'fit', 'view'],
      action: () => canvasRef.current?.reset(),
    },
    {
      id: 'zoom-in',
      type: 'action' as const,
      icon: '+',
      title: 'Zoom In',
      subtitle: 'Increase zoom level',
      shortcut: '⌘+',
      keywords: ['zoom', 'in', 'bigger'],
      action: () => canvasRef.current?.zoomIn(),
    },
    {
      id: 'zoom-out',
      type: 'action' as const,
      icon: '−',
      title: 'Zoom Out',
      subtitle: 'Decrease zoom level',
      shortcut: '⌘-',
      keywords: ['zoom', 'out', 'smaller'],
      action: () => canvasRef.current?.zoomOut(),
    },
    // Files
    ...files.map(f => ({
      id: `file-${f.id}`,
      type: 'file' as const,
      icon: f.type === 'csv' ? '⊞' : f.type === 'json' ? '{ }' : '◎',
      title: f.name,
      subtitle: `${f.rowCount || 0} rows · ${f.columnCount || 0} columns`,
      keywords: [f.name, f.type],
      action: () => focusFile(f.id),
    })),
    // Folders
    ...folders.map(f => ({
      id: `folder-${f.id}`,
      type: 'file' as const,
      icon: '📁',
      title: f.name,
      subtitle: `${f.fileIds.length} files`,
      keywords: [f.name, 'folder'],
      action: () => {
        if (f.fileIds.length > 0) {
          openFolder(f.id);
          focusFile(f.fileIds[0]);
        }
      },
    })),
  ], [files, folders, focusFile, openFolder, theme, toggleTheme]);

  const handleCanvasClick = useCallback(() => {
    if (expandedFolderId) {
      collapseFolder();
    }
    selectItem(null);
  }, [selectItem, expandedFolderId, collapseFolder]);

  const handleFileDrop = useCallback(
    (file: File, position: { x: number; y: number }, handle?: FileSystemFileHandle) => {
      addFile(file, position, handle);
    },
    [addFile]
  );

  const handleFileSelect = useCallback(
    (id: string) => {
      selectItem(id);
    },
    [selectItem]
  );

  // Detect file/folder overlap during drag (for folder creation or adding to folder)
  const handleFileDragMove = useCallback(
    (draggedId: string, position: { x: number; y: number }) => {
      // First, check if dragged file overlaps any folder (priority over files)
      const overlappingFolder = folders.find(f => {
        const dx = Math.abs(f.position.x - position.x);
        const dy = Math.abs(f.position.y - position.y);
        // Folder icons are ~88x100px, consider overlap if within ~50px
        return dx < 50 && dy < 50;
      });

      if (overlappingFolder) {
        setDragOverFolder(overlappingFolder.id);
        setDragOverFile(null);
        return;
      }

      // Check if dragged file overlaps any other file
      const overlappingFile = desktopFiles.find(f => {
        if (f.id === draggedId) return false;
        const dx = Math.abs(f.position.x - position.x);
        const dy = Math.abs(f.position.y - position.y);
        // Icons are ~88x100px, consider overlap if within ~50px
        return dx < 50 && dy < 50;
      });

      setDragOverFile(overlappingFile?.id || null);
      setDragOverFolder(null);
    },
    [desktopFiles, folders, setDragOverFile, setDragOverFolder]
  );

  // Handle drag end - create folder if dropped on another file, or add to folder
  const handleFileDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- position parameter available for future drag-and-drop logic
    (draggedId: string, _position: { x: number; y: number }) => {
      // If dropped on a folder, add the file to that folder
      if (dragOverFolderId) {
        addFileToFolder(dragOverFolderId, draggedId);
        setDragOverFolder(null);
        setDragOverFile(null);
        return;
      }

      // If dropped on another file, create a new folder
      if (dragOverFileId && dragOverFileId !== draggedId) {
        const targetFile = files.find(f => f.id === dragOverFileId);
        if (targetFile) {
          createFolder([draggedId, dragOverFileId], targetFile.position);
        }
      }
      setDragOverFile(null);
      setDragOverFolder(null);
    },
    [dragOverFileId, dragOverFolderId, files, createFolder, addFileToFolder, setDragOverFile, setDragOverFolder]
  );

  // Handle file dropped on a folder
  const handleFileDropOnFolder = useCallback(
    (folderId: string, fileId: string) => {
      addFileToFolder(folderId, fileId);
    },
    [addFileToFolder]
  );

  // Handle folder double-click (expand/collapse files on canvas with bloom animation)
  const handleFolderDoubleClick = useCallback(
    (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder || folder.fileIds.length === 0) return;

      if (expandedFolderId === folderId) {
        collapseFolder();
      } else {
        expandFolder(folderId);
      }
    },
    [folders, expandedFolderId, expandFolder, collapseFolder]
  );

  // Track drag position in real-time for visual feedback
  const handleExpandedFileDragMove = useCallback(
    (fileId: string, pos: { x: number; y: number }) => {
      if (!expandedFolderId) return;
      const folder = folders.find(f => f.id === expandedFolderId);
      if (!folder) return;
      const bloomPos = expandedFolderFilePositions.get(fileId);
      if (!bloomPos) return;

      const canvasX = bloomPos.x + pos.x;
      const canvasY = bloomPos.y + pos.y;
      const dx = canvasX - folder.position.x;
      const dy = canvasY - folder.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      setExpandedDragState({ fileId, isOutside: distance > 150 });
    },
    [expandedFolderId, folders, expandedFolderFilePositions]
  );

  // Handle dropping a file — remove from folder if dragged out
  const handleExpandedFileDragEnd = useCallback(
    (fileId: string, dragDelta: { x: number; y: number }) => {
      setExpandedDragState(null);

      if (!expandedFolderId) return;

      const folder = folders.find(f => f.id === expandedFolderId);
      if (!folder) return;

      const bloomPos = expandedFolderFilePositions.get(fileId);
      if (!bloomPos) return;

      // Compute actual canvas drop position
      const canvasPos = {
        x: bloomPos.x + dragDelta.x,
        y: bloomPos.y + dragDelta.y,
      };

      // Check distance from folder center — threshold is 150px
      const dx = canvasPos.x - folder.position.x;
      const dy = canvasPos.y - folder.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 150) {
        // Dragged out — remove from folder, place on canvas
        updateFilePosition(fileId, canvasPos);
        removeFileFromFolder(expandedFolderId, fileId);

        // Auto-dissolve folder if 1 or 0 files remain
        const remainingCount = folder.fileIds.length - 1;
        if (remainingCount <= 1) {
          collapseFolder();
          if (remainingCount === 1) {
            // Release the last remaining file to the canvas at the folder's position
            const lastFileId = folder.fileIds.find(id => id !== fileId);
            if (lastFileId) {
              removeFileFromFolder(expandedFolderId, lastFileId);
              updateFilePosition(lastFileId, folder.position);
            }
          }
          deleteFolder(expandedFolderId, true);
        }
      }
      // If not dragged far enough: no-op — file snaps back to grid position
    },
    [expandedFolderId, folders, expandedFolderFilePositions,
     updateFilePosition, removeFileFromFolder, collapseFolder, deleteFolder]
  );

  // Handle folder selection
  const handleFolderSelect = useCallback(
    (folderId: string) => {
      selectItem(folderId);
    },
    [selectItem]
  );

  // Handle folder rename
  const handleFolderRename = useCallback(
    (folderId: string, newName: string) => {
      renameFolder(folderId, newName);
    },
    [renameFolder]
  );

  // Handle folder rename start
  const handleFolderRenameStart = useCallback(
    (folderId: string) => {
      startRenamingFolder(folderId);
    },
    [startRenamingFolder]
  );

  // Handle folder rename cancel
  const handleFolderRenameCancel = useCallback(
    (folderId: string) => {
      stopRenamingFolder(folderId);
    },
    [stopRenamingFolder]
  );

  // Handle removing a file from a folder (from focused view)
  const handleRemoveFileFromFolder = useCallback(
    (fileId: string) => {
      if (!openFolderId) return;

      const folder = folders.find(f => f.id === openFolderId);
      if (!folder) return;

      removeFileFromFolder(openFolderId, fileId);

      // If this was the last file in the folder, close the focused view and clear the folder
      const remainingFiles = folder.fileIds.filter(id => id !== fileId);
      if (remainingFiles.length === 0) {
        unfocusFile();
        setOpenFolderId(null);
        // Optionally delete the empty folder
        deleteFolder(openFolderId, true);
      }
    },
    [openFolderId, folders, removeFileFromFolder, unfocusFile, deleteFolder]
  );

  // Handle closing the focused view
  const handleCloseFocusedView = useCallback(() => {
    unfocusFile();
    // Preserve expandedFolderId so user returns to bloom-expanded folder
    setOpenFolderId(null);
  }, [unfocusFile]);

  // Desktop icon dimensions (smaller icons)
  const DESKTOP_ICON_WIDTH = 72;
  const DESKTOP_ICON_HEIGHT = 85;

  // Zoom to fit all content
  const handleZoomToFit = useCallback(() => {
    if (files.length === 0 && folders.length === 0) {
      canvasRef.current?.reset();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    files.forEach(f => {
      minX = Math.min(minX, f.position.x);
      minY = Math.min(minY, f.position.y);
      maxX = Math.max(maxX, f.position.x + DESKTOP_ICON_WIDTH);
      maxY = Math.max(maxY, f.position.y + DESKTOP_ICON_HEIGHT);
    });

    folders.forEach(f => {
      minX = Math.min(minX, f.position.x);
      minY = Math.min(minY, f.position.y);
      maxX = Math.max(maxX, f.position.x + DESKTOP_ICON_WIDTH);
      maxY = Math.max(maxY, f.position.y + DESKTOP_ICON_HEIGHT);
    });

    if (minX !== Infinity) {
      canvasRef.current?.fitToContent({ minX, minY, maxX, maxY });
    }
  }, [files, folders]);

  // AI query handler with streaming and file context
  const handleAIQueryStream = useCallback((
    query: string,
    onChunk: (text: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void
  ) => {
    if (!anthropicApiKey) {
      // Simulate streaming for the no-API-key message
      const message = `To use AI features, please add your Anthropic API key in Settings (⌘K → "Settings").

Your workspace has ${files.length} files and ${folders.length} folders.`;
      onChunk(message);
      onComplete(message);
      return;
    }

    // Build context from files and folders
    const context: GlobalSearchContext = {
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        rowCount: f.rowCount,
        columnCount: f.columnCount,
        columns: f.columns,
      })),
      folders: folders.map(f => ({
        name: f.name,
        fileCount: f.fileIds.length,
      })),
    };

    streamGlobalAssistant(anthropicApiKey, query, context, onChunk, onComplete, onError);
  }, [anthropicApiKey, files, folders]);

  // Google Sheets import handler
  const { addSheet: addGoogleSheetToStore } = useGoogleSheetsStore();
  const googleUserPhoto = useGoogleSheetsStore(state => state.userPhoto);
  const googleUserEmail = useGoogleSheetsStore(state => state.userEmail);
  const googleUserName = useGoogleSheetsStore(state => state.userName);
  const googleConnected = useGoogleSheetsStore(state =>
    !!state.accessToken && (state.expiresAt ? Date.now() < state.expiresAt - 5 * 60 * 1000 : false)
  );
  const createViewFromData = useDuckDBViewStore(state => state.createViewFromData);
  const addGoogleSheet = useBoardStore(state => state.addGoogleSheet);

  const handleGoogleSheetImport = useCallback(async (data: {
    spreadsheetId: string;
    spreadsheetName: string;
    sheetId: number;
    sheetName: string;
    headers: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    columnCount: number;
    isTruncated: boolean;
  }) => {
    // Generate a unique ID for this sheet
    const sheetNodeId = `gsheet-${data.spreadsheetId}-${data.sheetId}-${Date.now()}`;
    const viewName = `gsheet_${data.spreadsheetId.slice(0, 8)}_${data.sheetId}`.replace(/[^a-zA-Z0-9_]/g, '_');

    try {
      // Create DuckDB view from the sheet data
      await createViewFromData(viewName, data.rows, data.headers);

      // Fetch remote modified time for conflict detection
      const token = useGoogleSheetsStore.getState().accessToken;
      let remoteModifiedTime: string | undefined;
      if (token) {
        try {
          remoteModifiedTime = await getFileModifiedTime(token, data.spreadsheetId);
        } catch {
          console.warn('[OpenSheet] Could not fetch remoteModifiedTime');
        }
      }

      const now = Date.now();

      // Add to Google Sheets store for tracking
      addGoogleSheetToStore({
        id: sheetNodeId,
        spreadsheetId: data.spreadsheetId,
        spreadsheetName: data.spreadsheetName,
        sheetId: data.sheetId,
        sheetName: data.sheetName,
        rowCount: data.rowCount,
        columnCount: data.columnCount,
        lastSynced: now,
        remoteModifiedTime,
      });

      // Add as a file node on the canvas
      // Position in center of viewport (will be adjusted by canvas)
      const position = { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 };

      // Add Google Sheet to the board
      addGoogleSheet({
        id: sheetNodeId,
        name: `${data.spreadsheetName} - ${data.sheetName}`,
        position,
        viewName,
        rowCount: data.rowCount,
        columnCount: data.columnCount,
        columns: data.headers,
        googleSheetMeta: {
          spreadsheetId: data.spreadsheetId,
          spreadsheetName: data.spreadsheetName,
          sheetId: data.sheetId,
          sheetName: data.sheetName,
          lastSynced: now,
          remoteModifiedTime,
        },
      });

      console.log('[OpenSheet] Imported Google Sheet:', data.spreadsheetName, '-', data.sheetName);
    } catch (error) {
      console.error('[OpenSheet] Failed to import Google Sheet:', error);
    }
  }, [addGoogleSheet, addGoogleSheetToStore, createViewFromData]);


  // Pull fresh data from Google Sheets (destructive: replaces local DuckDB data)
  const { updateSheetSyncTime } = useGoogleSheetsStore();
  const pullGoogleSheet = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file?.googleSheetMeta || !file.viewName) return;

    const token = useGoogleSheetsStore.getState().accessToken;
    if (!token) return;

    const { spreadsheetId, sheetName } = file.googleSheetMeta;

    const data = await getSheetData(token, spreadsheetId, sheetName);

    // Re-create the DuckDB view with fresh data
    await createViewFromData(file.viewName, data.rows, data.headers);

    // Clear local committed versions (they're now stale)
    useDuckDBViewStore.getState().clearCommittedVersions(file.viewName);

    // Fetch updated remote modified time
    let remoteModifiedTime: string | undefined;
    try {
      remoteModifiedTime = await getFileModifiedTime(token, spreadsheetId);
    } catch { /* ignore */ }

    // Update sync timestamps
    const now = Date.now();
    updateSheetSyncTime(fileId);

    // Update the board file node
    useBoardStore.setState(state => ({
      files: state.files.map(f =>
        f.id === fileId
          ? {
              ...f,
              rowCount: data.rowCount,
              columnCount: data.columnCount,
              columns: data.headers,
              googleSheetMeta: f.googleSheetMeta
                ? { ...f.googleSheetMeta, lastSynced: now, remoteModifiedTime }
                : undefined,
            }
          : f
      ),
    }));

    console.log('[OpenSheet] Pulled Google Sheet:', file.name);
  }, [files, createViewFromData, updateSheetSyncTime]);

  // Sync a Google Sheet node: push local changes or pull remote changes
  const handleSyncGoogleSheet = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file?.googleSheetMeta || !file.viewName) return;

    const token = useGoogleSheetsStore.getState().accessToken;
    if (!token) return;

    const { spreadsheetId, sheetId, sheetName, lastSynced } = file.googleSheetMeta;

    const { pushChanges, checkForConflicts } = await import('@/lib/google/syncEngine');
    const syncStore = (await import('@/store/syncStore')).useSyncStore.getState();

    syncStore.setSyncing(fileId, true);
    syncStore.setSyncError(fileId, null);

    try {
      // Gather local changes: pending + committed versions
      const duckStore = useDuckDBViewStore.getState();
      const pendingChanges = duckStore.getPendingChanges(file.viewName);
      const committedVersions = duckStore.committedVersions.get(file.viewName) || [];
      const allCommittedChanges = committedVersions.flatMap(v => v.changes);
      const allChanges = [...allCommittedChanges, ...pendingChanges];
      const hasLocalChanges = allChanges.length > 0;

      // Check for conflicts
      const { hasConflict, remoteModifiedTime } = await checkForConflicts(
        token, spreadsheetId, lastSynced, hasLocalChanges
      );

      if (hasConflict) {
        syncStore.setSyncing(fileId, false);
        syncStore.setSyncStatus(fileId, 'conflict');
        syncStore.showConflict({
          fileId,
          localChangeCount: allChanges.length,
          remoteModifiedTime,
        });
        return;
      }

      if (hasLocalChanges) {
        // Commit pending changes first if any
        if (pendingChanges.length > 0) {
          await duckStore.commitChanges(file.viewName);
        }

        // Gather schema and push
        const schema = duckStore.views.get(file.viewName)?.schema || [];
        const freshVersions = useDuckDBViewStore.getState().committedVersions.get(file.viewName) || [];
        const changesToPush = freshVersions.flatMap(v => v.changes);

        const result = await pushChanges({
          accessToken: token,
          spreadsheetId,
          sheetId,
          sheetName,
          changes: changesToPush,
          schema,
        });

        if (!result.success) {
          throw new Error(result.error || 'Push failed');
        }

        // Clear committed versions after successful push
        useDuckDBViewStore.getState().clearCommittedVersions(file.viewName);

        const now = Date.now();
        updateSheetSyncTime(fileId);
        useBoardStore.setState(state => ({
          files: state.files.map(f =>
            f.id === fileId
              ? {
                  ...f,
                  googleSheetMeta: f.googleSheetMeta
                    ? { ...f.googleSheetMeta, lastSynced: now, remoteModifiedTime: result.remoteModifiedTime }
                    : undefined,
                }
              : f
          ),
        }));

        syncStore.setSyncStatus(fileId, 'synced');
        syncStore.setLastSyncedAt(fileId, now);
        console.log('[OpenSheet] Pushed changes to Google Sheet:', file.name);
      } else {
        // No local changes — pull remote data
        await pullGoogleSheet(fileId);
        syncStore.setSyncStatus(fileId, 'synced');
        syncStore.setLastSyncedAt(fileId, Date.now());
      }
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        useGoogleSheetsStore.getState().disconnect();
      }
      const msg = error instanceof Error ? error.message : 'Sync failed';
      const syncStoreNow = (await import('@/store/syncStore')).useSyncStore.getState();
      syncStoreNow.setSyncError(fileId, msg);
      console.error('[OpenSheet] Sync failed:', error);
    } finally {
      const syncStoreNow = (await import('@/store/syncStore')).useSyncStore.getState();
      syncStoreNow.setSyncing(fileId, false);
    }
  }, [files, createViewFromData, updateSheetSyncTime, pullGoogleSheet]);

  // Force push: overwrite remote with local (used after conflict resolution)
  const handleForcePushGoogleSheet = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file?.googleSheetMeta || !file.viewName) return;

    const token = useGoogleSheetsStore.getState().accessToken;
    if (!token) return;

    const { pushChanges } = await import('@/lib/google/syncEngine');
    const syncStore = (await import('@/store/syncStore')).useSyncStore.getState();

    syncStore.setSyncing(fileId, true);
    syncStore.dismissConflict();

    try {
      const duckStore = useDuckDBViewStore.getState();
      const pendingChanges = duckStore.getPendingChanges(file.viewName);
      if (pendingChanges.length > 0) {
        await duckStore.commitChanges(file.viewName);
      }

      const schema = duckStore.views.get(file.viewName)?.schema || [];
      const freshVersions = useDuckDBViewStore.getState().committedVersions.get(file.viewName) || [];
      const changesToPush = freshVersions.flatMap(v => v.changes);

      const result = await pushChanges({
        accessToken: token,
        spreadsheetId: file.googleSheetMeta.spreadsheetId,
        sheetId: file.googleSheetMeta.sheetId,
        sheetName: file.googleSheetMeta.sheetName,
        changes: changesToPush,
        schema,
      });

      if (!result.success) throw new Error(result.error || 'Push failed');

      useDuckDBViewStore.getState().clearCommittedVersions(file.viewName);

      const now = Date.now();
      updateSheetSyncTime(fileId);
      useBoardStore.setState(state => ({
        files: state.files.map(f =>
          f.id === fileId
            ? {
                ...f,
                googleSheetMeta: f.googleSheetMeta
                  ? { ...f.googleSheetMeta, lastSynced: now, remoteModifiedTime: result.remoteModifiedTime }
                  : undefined,
              }
            : f
        ),
      }));

      syncStore.setSyncStatus(fileId, 'synced');
      syncStore.setLastSyncedAt(fileId, now);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        useGoogleSheetsStore.getState().disconnect();
      }
      const msg = error instanceof Error ? error.message : 'Push failed';
      syncStore.setSyncError(fileId, msg);
    } finally {
      const syncStoreNow = (await import('@/store/syncStore')).useSyncStore.getState();
      syncStoreNow.setSyncing(fileId, false);
    }
  }, [files, updateSheetSyncTime]);

  // Force pull: discard local, replace with remote (used after conflict resolution)
  const handleForcePullGoogleSheet = useCallback(async (fileId: string) => {
    const syncStore = (await import('@/store/syncStore')).useSyncStore.getState();
    syncStore.setSyncing(fileId, true);
    syncStore.dismissConflict();

    try {
      const file = files.find(f => f.id === fileId);
      if (file?.viewName) {
        useDuckDBViewStore.getState().discardChanges(file.viewName);
      }
      await pullGoogleSheet(fileId);
      syncStore.setSyncStatus(fileId, 'synced');
      syncStore.setLastSyncedAt(fileId, Date.now());
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        useGoogleSheetsStore.getState().disconnect();
      }
      const msg = error instanceof Error ? error.message : 'Pull failed';
      syncStore.setSyncError(fileId, msg);
    } finally {
      const syncStoreNow = (await import('@/store/syncStore')).useSyncStore.getState();
      syncStoreNow.setSyncing(fileId, false);
    }
  }, [files, pullGoogleSheet]);

  // Handle actions from FocusedFileView
  const handleFocusedAction = useCallback((action: string, params?: Record<string, unknown>) => {
    if ((action === 'refresh-gsheet' || action === 'sync-gsheet') && params?.fileId) {
      handleSyncGoogleSheet(params.fileId as string);
    } else if (action === 'force-push-gsheet' && params?.fileId) {
      handleForcePushGoogleSheet(params.fileId as string);
    } else if (action === 'force-pull-gsheet' && params?.fileId) {
      handleForcePullGoogleSheet(params.fileId as string);
    }
  }, [handleSyncGoogleSheet, handleForcePushGoogleSheet, handleForcePullGoogleSheet]);

  // Mobile view - show simplified board with messages
  if (isMobile) {
    return (
      <>
        {/* Mobile board view */}
        {!focusedFileId && <MobileBoardView />}

        {/* Focused file view (works on mobile too) */}
        <AnimatePresence>
          {focusedFileId && openFiles.length > 0 && (
            <FocusedFileView
              files={openFiles}
              activeFileId={focusedFileId}
              onClose={handleCloseFocusedView}
              onFileChange={focusFile}
              onFileClose={closeFileTab}
              onTabReorder={reorderTabs}
              currentFolderId={openFolderId}
              folderFileIds={openFolderId ? folders.find(f => f.id === openFolderId)?.fileIds : undefined}
              onRemoveFromFolder={openFolderId ? handleRemoveFileFromFolder : undefined}
              onAction={handleFocusedAction}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden">
      {/* Minimal header - clean, non-animated */}
      <header
        className="fixed top-0 left-0 right-0 z-40 h-10 flex items-center justify-between px-4"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Left: Logo + Google Sheets */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            OpenSheet
          </span>

          {/* Google Sheets button — gated behind ?gsheets=enabled */}
          {gsheetsEnabled && <button
            onClick={() => setGoogleSheetsModalOpen(true)}
            className="group flex items-center gap-2 h-7 rounded-lg text-xs font-medium transition-all hover:bg-[var(--surface-secondary)]"
            style={{
              color: 'var(--text-secondary)',
              border: `1px solid ${googleConnected ? 'rgba(15,157,88,0.25)' : 'var(--border-subtle)'}`,
              paddingLeft: googleConnected && googleUserPhoto ? '2px' : '8px',
              paddingRight: '6px',
            }}
          >
            {googleConnected && googleUserPhoto ? (
              <img
                src={googleUserPhoto}
                alt=""
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                className="w-[22px] h-[22px] rounded-md flex-shrink-0"
                style={{ border: '1.5px solid rgba(15,157,88,0.3)' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
              />
            ) : null}
            {/* Initials fallback (hidden when photo loads, shown on error) */}
            {googleConnected && googleUserPhoto ? (
              <span
                className="hidden w-[22px] h-[22px] rounded-md flex-shrink-0 items-center justify-center text-[10px] font-semibold"
                style={{ backgroundColor: 'rgba(15,157,88,0.15)', color: '#0F9D58' }}
              >
                {(googleUserName || googleUserEmail || '?')[0].toUpperCase()}
              </span>
            ) : null}
            {!googleConnected || !googleUserPhoto ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#0F9D58" />
                <path d="M14 2v6h6" fill="#87CEAC" />
                <rect x="7" y="12" width="10" height="1.5" rx="0.5" fill="white" opacity="0.9" />
                <rect x="7" y="15" width="10" height="1.5" rx="0.5" fill="white" opacity="0.9" />
                <rect x="7" y="18" width="6" height="1.5" rx="0.5" fill="white" opacity="0.7" />
              </svg>
            ) : null}
            <span className="hidden sm:flex items-center gap-1.5">
              {googleConnected ? (
                <>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {googleUserName?.split(' ')[0] || googleUserEmail?.split('@')[0] || 'Connected'}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                    Sheets
                  </span>
                </>
              ) : (
                'Google Sheets'
              )}
            </span>
            {/* Chevron */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0 transition-transform group-hover:translate-y-[1px]"
              style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>}
        </div>

        {/* Right: Search + Utility actions */}
        <div className="flex items-center gap-1.5">
          {/* Search button */}
          <button
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs transition-colors hover:bg-[var(--surface-secondary)]"
            style={{
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={() => setCommandBarOpen(true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            <kbd
              className="hidden sm:inline-flex items-center h-4 px-1 rounded text-[10px] font-medium"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              ⌘K
            </kbd>
          </button>

          {/* Divider */}
          <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-subtle)' }} />

          {/* Feedback button */}
          <Tooltip.Provider delayDuration={100}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => window.open('https://amin.contact', '_blank')}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--surface-secondary)]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={8}
                  className="px-3 py-2 rounded-lg text-xs z-50"
                  style={{
                    backgroundColor: 'var(--surface-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  Send feedback
                  <Tooltip.Arrow style={{ fill: 'var(--surface-elevated)' }} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>

          {/* Changelog button - shown when changelog widget is minimized */}
          <AnimatePresence mode="wait">
            {changelogMinimized && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <Tooltip.Provider delayDuration={100}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        onClick={() => {
                          setChangelogMinimized(false);
                          setChangelogAutoExpand(true);
                        }}
                        className="relative flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--surface-secondary)]"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="bottom"
                        sideOffset={8}
                        className="px-3 py-2 rounded-lg text-xs z-50"
                        style={{
                          backgroundColor: 'var(--surface-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-default)',
                          boxShadow: 'var(--shadow-lg)',
                        }}
                      >
                        What's new
                        <Tooltip.Arrow style={{ fill: 'var(--surface-elevated)' }} />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </motion.div>
            )}
          </AnimatePresence>
          <DownloadButton />
        </div>
      </header>

      {/* Canvas with built-in zoom/pan */}
      <WarmCanvas
        ref={canvasRef}
        onCanvasClick={handleCanvasClick}
        onFileDrop={handleFileDrop}
        onZoomChange={handleZoomChange}
      >
        {/* Desktop file icons - hidden when a file is focused, dimmed when folder is expanded */}
        {!focusedFileId && (
          <div style={{
            opacity: expandedFolderId ? 0.3 : 1,
            transition: 'opacity 0.25s ease',
            pointerEvents: expandedFolderId ? 'none' : 'auto',
          }}>
            {desktopFiles.map(file => (
              <DesktopFileIcon
                key={file.id}
                node={{ ...file, selected: selectedId === file.id }}
                zoom={zoom}
                onSelect={handleFileSelect}
                onDoubleClick={focusFile}
                onRename={renameFile}
                onDelete={deleteFile}
                onDrag={updateFilePosition}
                onDragMove={handleFileDragMove}
                onDragEnd={handleFileDragEnd}
                isDragTarget={dragOverFileId === file.id}
              />
            ))}
          </div>
        )}

        {/* Desktop folder icons - hidden when a file is focused */}
        {!focusedFileId && folders.map(folder => {
          const folderFileTypes = folder.fileIds
            .map(fid => files.find(f => f.id === fid)?.type)
            .filter((t): t is NonNullable<typeof t> => !!t);
          const isThisExpanded = expandedFolderId === folder.id;

          return (
            <div
              key={folder.id}
              style={{
                opacity: expandedFolderId && !isThisExpanded ? 0.3 : 1,
                transition: 'opacity 0.25s ease',
                pointerEvents: expandedFolderId && !isThisExpanded ? 'none' : 'auto',
                zIndex: isThisExpanded ? 10 : 1,
                position: 'relative',
              }}
            >
              <DesktopFolderIcon
                folder={{ ...folder, selected: selectedId === folder.id }}
                fileTypes={folderFileTypes}
                zoom={zoom}
                onSelect={handleFolderSelect}
                onDoubleClick={handleFolderDoubleClick}
                onDrag={updateFolderPosition}
                onFileDrop={handleFileDropOnFolder}
                onRename={handleFolderRename}
                onRenameStart={handleFolderRenameStart}
                onRenameCancel={handleFolderRenameCancel}
                onChangeColor={setFolderColor}
                onDelete={(folderId) => deleteFolder(folderId, true)}
                isDragTarget={dragOverFolderId === folder.id}
                isExpanded={isThisExpanded}
              />
            </div>
          );
        })}

        {/* Expanded folder files — bloom onto canvas */}
        <AnimatePresence>
          {expandedFolderId && !focusedFileId && (() => {
            const folder = folders.find(f => f.id === expandedFolderId);
            if (!folder) return null;

            const folderColor = folder.color || '#6366F1';
            const isDragging = !!expandedDragState;
            const isDraggingOut = expandedDragState?.isOutside ?? false;

            // Use display positions (gap-closed when dragging outside) for container bounds
            const displayPositions = Array.from(expandedDisplayPositions.values());
            const CONTAINER_PAD = 24;
            const CONTAINER_PAD_TOP = 20;
            const minX = Math.min(...displayPositions.map(p => p.x)) - CONTAINER_PAD;
            const minY = Math.min(...displayPositions.map(p => p.y)) - CONTAINER_PAD_TOP;
            const maxX = Math.max(...displayPositions.map(p => p.x)) + 88 + CONTAINER_PAD;
            const maxY = Math.max(...displayPositions.map(p => p.y)) + 85 + CONTAINER_PAD;

            const folderFiles = folder.fileIds
              .map(id => files.find(f => f.id === id))
              .filter(Boolean) as typeof files;

            return [
              // Folder container — reacts to drag state
              <motion.div
                key="glass-backdrop"
                className="absolute rounded-2xl overflow-hidden"
                style={{
                  backdropFilter: 'blur(12px)',
                  background: isDraggingOut ? `${folderColor}08` : `${folderColor}10`,
                  border: isDraggingOut
                    ? `2px dashed ${folderColor}35`
                    : isDragging
                      ? `1.5px solid ${folderColor}45`
                      : `1.5px solid ${folderColor}25`,
                  boxShadow: `inset 0 1px 4px ${folderColor}${isDraggingOut ? '04' : '0A'}, 0 8px 32px ${folderColor}08`,
                  zIndex: 5,
                  transition: 'background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease',
                }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{
                  opacity: isDraggingOut ? 0.7 : 1,
                  scale: 1,
                  left: minX,
                  top: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />,

              // Bloomed file icons — draggable out of folder
              ...folderFiles.map((file, i) => {
                const isThisDragged = expandedDragState?.fileId === file.id;
                // Dragged file: use original position (for snap-back)
                // Other files: use display positions (gap-closed when something is dragged out)
                const targetPos = isThisDragged
                  ? expandedFolderFilePositions.get(file.id)
                  : expandedDisplayPositions.get(file.id);
                if (!targetPos) return null;
                return (
                  <motion.div
                    key={`expanded-${file.id}`}
                    className="absolute"
                    style={{ zIndex: isThisDragged ? 20 : 10 }}
                    initial={{
                      x: folder.position.x,
                      y: folder.position.y,
                      scale: 0,
                      opacity: 0,
                    }}
                    animate={{
                      x: targetPos.x,
                      y: targetPos.y,
                      scale: 1,
                      opacity: 1,
                    }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 22,
                      delay: i * 0.05,
                    }}
                  >
                    <DesktopFileIcon
                      node={{ ...file, position: { x: 0, y: 0 }, selected: selectedId === file.id }}
                      zoom={zoom}
                      onSelect={handleFileSelect}
                      onDoubleClick={(fileId) => {
                        setOpenFolderId(expandedFolderId);
                        // Open all folder files as tabs, then focus the clicked one
                        folder.fileIds.forEach(id => focusFile(id));
                        focusFile(fileId);
                      }}
                      onRename={renameFile}
                      onDelete={deleteFile}
                      onDrag={() => {}}
                      onDragMove={handleExpandedFileDragMove}
                      onDragEnd={handleExpandedFileDragEnd}
                      isDragTarget={false}
                    />
                  </motion.div>
                );
              }),
            ];
          })()}
        </AnimatePresence>

        {/* Empty state - shows when canvas is empty or only has sample files */}
        {!focusedFileId && (files.length === 0 || onlySampleFiles) && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-center">
              <motion.div
                className="text-6xl mb-6"
                style={{ color: 'var(--text-tertiary)' }}
              >
                ◎
              </motion.div>
              <p className="text-lg font-light mb-2" style={{ color: 'var(--text-secondary)' }}>
                Drop your files on the canvas to explore
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
                CSV, JSON, Parquet - your files becomes visible
              </p>
              <p className="text-xs mb-8" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
                Everything runs locally — Your data stays private
              </p>
              {/* Keyboard hints */}
              <div className="flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>⌘K</kbd>
                  <span>Search</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>Tab</kbd>
                  <span>Navigate</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>Enter</kbd>
                  <span>Open</span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </WarmCanvas>

      {/* Control Panel */}
      <ControlPanel
        zoom={zoom}
        onZoomChange={handleControlPanelZoom}
        onZoomToFit={handleZoomToFit}
        onCenterCanvas={() => canvasRef.current?.reset()}
        nodeCount={files.length + folders.length}
        connectionCount={0}
      />

      {/* App Changelog Widget - hidden when file is focused */}
      {!focusedFileId && (
        <AppChangelog
          isMinimized={changelogMinimized}
          onMinimize={() => {
            setChangelogMinimized(true);
            setChangelogAutoExpand(false);
          }}
          autoExpand={changelogAutoExpand}
        />
      )}

      {/* AI Command Bar */}
      <AICommandBar
        isOpen={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        commands={commands}
        onAIQueryStream={handleAIQueryStream}
        placeholder="Search files and folders..."
      />

      {/* Focused file view (app-like experience) */}
      <AnimatePresence>
        {focusedFileId && openFiles.length > 0 && (
          <FocusedFileView
            files={openFiles}
            activeFileId={focusedFileId}
            onClose={handleCloseFocusedView}
            onFileChange={focusFile}
            onFileClose={closeFileTab}
            onTabReorder={reorderTabs}
            currentFolderId={openFolderId}
            folderFileIds={openFolderId ? folders.find(f => f.id === openFolderId)?.fileIds : undefined}
            onRemoveFromFolder={openFolderId ? handleRemoveFileFromFolder : undefined}
            onAction={handleFocusedAction}
          />
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
      />

      {/* Google Sheets Modal */}
      <GoogleSheetsModal
        isOpen={googleSheetsModalOpen}
        onClose={() => setGoogleSheetsModalOpen(false)}
        onImport={handleGoogleSheetImport}
      />

      {/* Onboarding overlay for first-time users */}
      <OnboardingOverlay
        onlySampleFiles={onlySampleFiles}
        hasOpenFile={!!focusedFileId}
        commandBarOpen={commandBarOpen}
      />

      {/* File restoration toast */}
      <AnimatePresence>
        {pendingRestoreCount > 0 && !focusedFileId && (
          <motion.div
            className="fixed bottom-20 left-1/2 z-50"
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
              style={{
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-default)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📁</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {pendingRestoreCount} file{pendingRestoreCount > 1 ? 's' : ''} from last session
                </span>
              </div>
              <button
                onClick={handleRestoreFiles}
                disabled={isRestoring}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                }}
              >
                {isRestoring ? 'Restoring...' : 'Restore'}
              </button>
              <button
                onClick={() => {
                  pendingHandlesRef.current.clear();
                  setPendingRestoreCount(0);
                }}
                className="p-1 rounded hover:bg-[var(--surface-secondary)] transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer links — desktop only */}
      <div
        className="fixed bottom-2 left-4 hidden sm:flex items-center gap-1.5"
        style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.6 }}
      >
        <a href="/#/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>Privacy</a>
        <span>&middot;</span>
        <a href="/#/terms" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>Terms</a>
      </div>
    </div>
  );
}

export default OpenSheet;
