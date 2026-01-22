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
} from '@/components/flow';
import type { WarmCanvasRef } from '@/components/flow/WarmCanvas';
import { useBoardStore } from '@/store/boardStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useDuckDBViewStore } from '@/store/duckDBViewStore';
import { useKeyboard } from '@/hooks/useKeyboard';
import { DownloadButton } from '@/components/DownloadButton';
import { streamGlobalAssistant, type GlobalSearchContext } from '@/lib/ai';

export function OpenSheet() {
  const {
    files,
    folders,
    selectedId,
    focusedFileId,
    openFileIds,
    dragOverFileId,
    addFile,
    updateFilePosition,
    renameFile,
    deleteFile,
    selectItem,
    focusFile,
    unfocusFile,
    closeFileTab,
    reorderTabs,
    createFolder,
    addFileToFolder,
    updateFolderPosition,
    openFolder,
    renameFolder,
    startRenamingFolder,
    stopRenamingFolder,
    setDragOverFile,
  } = useBoardStore();

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
      } else {
        selectItem(null);
      }
    },
    onEnter: () => {
      // Open (focus) the selected file or folder
      if (selectedId && !focusedFileId) {
        const isFile = files.some(f => f.id === selectedId);
        const isFolder = folders.some(f => f.id === selectedId);
        if (isFile) {
          focusFile(selectedId);
        } else if (isFolder) {
          const folder = folders.find(f => f.id === selectedId);
          if (folder && folder.fileIds.length > 0) {
            openFolder(selectedId);
            focusFile(folder.fileIds[0]);
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
    selectItem(null);
  }, [selectItem]);

  const handleFileDrop = useCallback(
    (file: File, position: { x: number; y: number }) => {
      addFile(file, position);
    },
    [addFile]
  );

  const handleFileSelect = useCallback(
    (id: string) => {
      selectItem(id);
    },
    [selectItem]
  );

  // Detect file overlap during drag (for folder creation)
  const handleFileDragMove = useCallback(
    (draggedId: string, position: { x: number; y: number }) => {
      // Check if dragged file overlaps any other file
      const overlappingFile = desktopFiles.find(f => {
        if (f.id === draggedId) return false;
        const dx = Math.abs(f.position.x - position.x);
        const dy = Math.abs(f.position.y - position.y);
        // Icons are ~88x100px, consider overlap if within ~50px
        return dx < 50 && dy < 50;
      });

      setDragOverFile(overlappingFile?.id || null);
    },
    [desktopFiles, setDragOverFile]
  );

  // Handle drag end - create folder if dropped on another file
  const handleFileDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- position parameter available for future drag-and-drop logic
    (draggedId: string, position: { x: number; y: number }) => {
      if (dragOverFileId && dragOverFileId !== draggedId) {
        const targetFile = files.find(f => f.id === dragOverFileId);
        if (targetFile) {
          createFolder([draggedId, dragOverFileId], targetFile.position);
        }
      }
      setDragOverFile(null);
    },
    [dragOverFileId, files, createFolder, setDragOverFile]
  );

  // Handle file dropped on a folder
  const handleFileDropOnFolder = useCallback(
    (folderId: string, fileId: string) => {
      addFileToFolder(folderId, fileId);
    },
    [addFileToFolder]
  );

  // Handle folder double-click (open in focused view showing all files)
  const handleFolderDoubleClick = useCallback(
    (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder || folder.fileIds.length === 0) return;

      openFolder(folderId);
      focusFile(folder.fileIds[0]);

      folder.fileIds.slice(1).forEach(fileId => {
        focusFile(fileId);
      });
      focusFile(folder.fileIds[0]);
    },
    [folders, openFolder, focusFile]
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
        {/* Left: Logo + quick search */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            OpenSheet
          </span>
          <button
            className="flex items-center gap-2 h-6 px-2 rounded text-xs transition-colors hover:bg-[var(--surface-secondary)]"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={() => setCommandBarOpen(true)}
          >
            <span style={{ opacity: 0.6 }}>⌘K</span>
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Right: Minimal actions */}
        <div className="flex items-center gap-2">
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
        {/* Desktop file icons - hidden when a file is focused */}
        {!focusedFileId && desktopFiles.map(file => (
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

        {/* Desktop folder icons - hidden when a file is focused */}
        {!focusedFileId && folders.map(folder => {
          const folderFileTypes = folder.fileIds
            .map(fid => files.find(f => f.id === fid)?.type)
            .filter((t): t is NonNullable<typeof t> => !!t);

          return (
            <DesktopFolderIcon
              key={folder.id}
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
            />
          );
        })}

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
                Drop a file to explore
              </p>
              <p className="text-sm mb-8" style={{ color: 'var(--text-tertiary)' }}>
                CSV, JSON, Excel, Parquet - your data becomes visible
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
            onClose={unfocusFile}
            onFileChange={focusFile}
            onFileClose={closeFileTab}
            onTabReorder={reorderTabs}
          />
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
      />
    </div>
  );
}

export default OpenSheet;
