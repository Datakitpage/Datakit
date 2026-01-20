import { useState, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useFlowStore } from '@/store/flowStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useKeyboard } from '@/hooks/useKeyboard';
import { DownloadButton } from '@/components/DownloadButton';

export function Flow() {
  const {
    files,
    folders,
    selectedId,
    focusedFileId,
    openFileIds,
    dragOverFileId,
    addFile,
    updateFilePosition,
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
  } = useFlowStore();

  // Get the currently focused file
  const focusedFile = useMemo(
    () => files.find(f => f.id === focusedFileId),
    [files, focusedFileId]
  );

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

  // Canvas ref for controlling zoom/pan
  const canvasRef = useRef<WarmCanvasRef>(null);

  const [zoom, setZoom] = useState(1);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [aiPanelOpen, setAIPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  // Settings (theme is applied automatically via settingsStore's onRehydrateStorage)
  const { theme, toggleTheme } = useSettingsStore();

  // Sync zoom from canvas
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  // Control panel zoom handlers
  const handleControlPanelZoom = useCallback((newZoom: number) => {
    setZoom(newZoom);
    canvasRef.current?.setZoom(newZoom);
  }, []);

  // Keyboard navigation
  useKeyboard({
    onToggleCommandPalette: () => setCommandBarOpen(prev => !prev),
    onToggleAI: () => setAIPanelOpen(prev => !prev),
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
    enabled: !commandBarOpen,
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

  // Desktop icon dimensions
  const DESKTOP_ICON_WIDTH = 88;
  const DESKTOP_ICON_HEIGHT = 100;

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

  // AI query handler
  const handleAIQuery = async (query: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `I analyzed your query: "${query}"\n\nHere's what I found:\n• You have ${files.length} files loaded\n• ${folders.length} folders\n\nOpen a file to explore and transform your data!`;
  };

  return (
    <div className="w-screen h-screen overflow-hidden">
      {/* Minimal header */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-4"
        style={{
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-default)',
        }}
        initial={{ y: -48 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-light" style={{ color: 'var(--text-primary)' }}>Flow</span>
          <motion.button
            className="text-xs px-2 py-1 rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={() => setCommandBarOpen(true)}
          >
            ⌘K
          </motion.button>
        </div>

        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {files.length > 0 && (
            <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
          )}
          {folders.length > 0 && (
            <span>{folders.length} folder{folders.length !== 1 ? 's' : ''}</span>
          )}
          <DownloadButton />
          <motion.button
            className="px-2 py-1 rounded-md transition-colors"
            style={{
              backgroundColor: aiPanelOpen ? 'var(--primary-subtle)' : 'transparent',
              color: aiPanelOpen ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setAIPanelOpen(!aiPanelOpen)}
          >
            ✦ AI
          </motion.button>
        </div>
      </motion.header>

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

        {/* Empty state - only show when no files and no focus */}
        {!focusedFileId && files.length === 0 && folders.length === 0 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="text-center max-w-md">
              <motion.div
                className="text-6xl mb-6"
                style={{ color: 'var(--text-tertiary)' }}
              >
                ◎
              </motion.div>
              <p className="text-xl font-light mb-3" style={{ color: 'var(--text-secondary)' }}>
                Drop a file to see it
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
                CSV, JSON, images — your data becomes visible
              </p>
              <div className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                <p>
                  <kbd
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                    style={{ backgroundColor: 'var(--surface-secondary)' }}
                  >
                    ⌘K
                  </kbd>{' '}
                  commands
                </p>
                <p>
                  <kbd
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                    style={{ backgroundColor: 'var(--surface-secondary)' }}
                  >
                    Pinch
                  </kbd>{' '}
                  zoom
                  {' · '}
                  <kbd
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                    style={{ backgroundColor: 'var(--surface-secondary)' }}
                  >
                    Scroll
                  </kbd>{' '}
                  pan
                </p>
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
        onToggleAI={() => setAIPanelOpen(!aiPanelOpen)}
        aiActive={aiPanelOpen}
      />

      {/* AI Command Bar */}
      <AICommandBar
        isOpen={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        commands={commands}
        onAIQuery={handleAIQuery}
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

export default Flow;
