import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ExternalLink, Settings } from 'lucide-react';

import { GlobalDropZone } from '@/components/common/GlobalDropZone';
import { SidebarToolbar } from '@/components/workspace/SidebarToolbar';
import { FolderTreeView } from '@/components/workspace/FolderTreeView';
import { SettingsPopover } from '@/components/common/SettingsPopover';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useFolderStore } from '@/store/folderStore';
import { useAppStore } from '@/store/appStore';
import { useFileImport } from '@/hooks/useFileImport';
import { motion } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { FolderNode } from '@/types/folder';

import UserMenu from '@/components/auth/UserMenu';
import DuckDBIcon from '@/assets/duckdb.svg';
import RemoteDataImportModal from '@/components/common/RemoteDataImportPanel';
import HelpDropdown from '@/components/common/HelpDropdown';
import SidebarFeedbackButton from '@/components/common/SidebarFeedbackButton';

import { ColumnType } from '@/types/csv';
import { DataSourceType } from '@/types/json';
import { ImportProvider } from '@/types/remoteImport';

export interface DataLoadWithDuckDBResult {
  data: string[][];
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
  sourceType?: DataSourceType;
  rawData?: any;
  schema?: any;
  loadedToDuckDB: boolean;
  tableName?: string;
  isRemote?: boolean;
  remoteURL?: string;
  isStreamingImport?: boolean;
  remoteProvider?: ImportProvider;
  convertedFromExcel?: boolean;
  isDatabaseAttachment?: boolean;
  attachedTables?: string[];
}

interface SidebarProps {
  onDataLoad?: (result: DataLoadWithDuckDBResult) => void;
}

// Check for custom logo from environment variable or window object
const customLogoUrl =
  import.meta.env.VITE_CUSTOM_LOGO_URL || (window as any).CUSTOM_LOGO_URL;

const Sidebar: React.FC<SidebarProps> = ({ onDataLoad }) => {
  const { t } = useTranslation();
  const {
    sidebarCollapsed,
    toggleSidebar,
    isRemoteModalOpen,
    setIsRemoteModalOpen
  } = useAppStore();

  // Handle settings navigation
  const handleOpenSettings = () => {
    window.location.href = '/settings';
  };

  // Removed file checking - Help & Support always shows

  // Sidebar resizing state
  const [sidebarWidth, setSidebarWidth] = useState(200); // Default 200px
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Initialize CSS custom property
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      `${sidebarWidth}px`
    );
  }, []);

  const { showSuccess, showError } = useNotifications();

  // Folder store
  const {
    initializeStore,
    draftFolderId,
    remoteFolderId,
    addFile: addFileToFolder,
    getNodeById,
    expandFolder,
  } = useFolderStore();

  // Unified file import
  const {
    importFileWithHandle,
    importFiles,
    reopenWorkspaceFile,
    isProcessing: isProcessingLocalFile,
  } = useFileImport();

  const {
    isLoading: duckDBLoading,
    processingProgress: duckDBProgress,
    error: duckDBError,
  } = useDuckDBStore();

  // Initialize folder store on mount
  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    // Disable transitions during resize
    if (sidebarRef.current) {
      sidebarRef.current.classList.add('sidebar-resizing');
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;

      e.preventDefault();
      const newWidth = Math.min(Math.max(200, e.clientX), 500); // Min 200px (default), max 500px

      // Direct CSS custom property update - instant and smooth
      document.documentElement.style.setProperty(
        '--sidebar-width',
        `${newWidth}px`
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;

      const finalWidth = Math.min(Math.max(200, e.clientX), 500); // Min 200px (default), max 500px

      // Re-enable transitions
      sidebarRef.current.classList.remove('sidebar-resizing');

      // Update React state for persistence
      setSidebarWidth(finalWidth);
      setIsResizing(false);

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (isResizing) {
      document.body.style.userSelect = 'none'; // Disable text selection during drag
      document.body.style.cursor = 'col-resize'; // Set cursor globally

      document.addEventListener('mousemove', handleMouseMove, {
        passive: false,
      });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing]);

  // Handle file import with streaming support (unified)
  const handleFileWithStreaming = async (
    handle: FileSystemFileHandle,
    file: File
  ) => {
    console.log(
      '[handleFileWithStreaming] Using unified import for:',
      file.name
    );

    return await importFileWithHandle(
      handle,
      file,
      onDataLoad,
      draftFolderId || undefined
    );
  };

  // Handle regular file import (unified)
  const handleFileImport = async (file: File) => {
    console.log('[handleFileImport] Using unified import for:', file.name);

    return await importFiles([file], onDataLoad, draftFolderId || undefined);
  };

  // Handle remote data import
  const handleRemoteDataImport = (result: DataLoadWithDuckDBResult) => {
    if (onDataLoad) {
      onDataLoad(result);

      // Add remote file to Remote Sources folder
      if (result.isRemote) {
        const file = new File([], result.fileName, {
          lastModified: Date.now(),
        });
        addFileToFolder(
          file,
          {
            isRemote: true,
            remoteUrl: result.remoteURL,
            fileType: 'remote',
            isLoaded: true,
            tableName: result.tableName,
          },
          remoteFolderId || undefined
        );

        showSuccess(
          t('sidebar.remote.importedTitle'),
          t('sidebar.remote.importedMessage', {
            fileName: result.fileName,
            provider:
              result.remoteProvider || t('sidebar.remote.defaultProvider'),
          }),
          { icon: 'check', duration: 5000 }
        );
      }
    }
  };

  // Handle file selection from tree (unified)
  const handleFileSelect = async (node: FolderNode) => {
    console.log('[Sidebar] File selected from tree:', {
      fileName: node.name,
      nodeType: node.type,
      fileData: node.fileData,
      hasHandle: !!node.fileData?.handle,
      isLoaded: node.fileData?.isLoaded,
      tableName: node.fileData?.tableName,
      isTemporary: node.fileData?.isTemporary,
    });

    if (node.type !== 'file') return;

    // Special handling for temporary tables
    if (node.fileData?.isTemporary && node.fileData?.tableName) {
      console.log('[Sidebar] Opening temporary table:', node.fileData.tableName);
      const { files, setActiveFile, addFile } = useAppStore.getState();

      // Check if this temporary table is already open
      const existingFile = files.find((f) => f.tableName === node.fileData?.tableName);
      if (existingFile) {
        console.log('[Sidebar] Temporary table already open, switching to it');
        setActiveFile(existingFile.id);
        return;
      }

      // Create a new tab for this temporary table
      const tempTableData = {
        data: [], // Data will be queried from DuckDB
        columnTypes: [],
        fileName: node.name.replace(/\.sql$/, ''), // Remove .sql extension if present
        rowCount: node.fileData.rowCount || 0,
        columnCount: node.fileData.columnCount || 0,
        sourceType: 'TABLE' as any, // Mark as TABLE type
        loadedToDuckDB: true,
        tableName: node.fileData.tableName,
        isTemporary: true,
        metadata: {
          isTemporary: true,
          sourceFileName: node.fileData.sourceFileName,
        }
      };

      addFile(tempTableData);
      console.log('[Sidebar] Created new tab for temporary table:', node.fileData.tableName);
      return;
    }

    // Special handling for saved tables (from AI "Keep Results")
    // Only handle tables that are specifically marked as saved tables and don't have workspace files
    if (node.fileData?.tableName && node.fileData?.isLoaded && !node.fileData?.isTemporary && node.fileData?.fileType === 'query') {
      console.log('[Sidebar] Opening saved table:', node.fileData.tableName);
      const { files, setActiveFile, addFile } = useAppStore.getState();

      // Check if this saved table is already open
      const existingFile = files.find((f) => f.tableName === node.fileData?.tableName);
      if (existingFile) {
        console.log('[Sidebar] Saved table already open, switching to it');
        setActiveFile(existingFile.id);
        return;
      }

      // Create a new tab for this saved table
      const savedTableData = {
        data: [], // Data will be queried from DuckDB
        columnTypes: [],
        fileName: node.name,
        rowCount: node.fileData.rowCount || 0,
        columnCount: node.fileData.columnCount || 0,
        sourceType: 'TABLE' as any, // Mark as TABLE type
        loadedToDuckDB: true,
        tableName: node.fileData.tableName,
        metadata: {
          isSavedTable: true,
          originalName: node.name,
        }
      };

      addFile(savedTableData);
      console.log('[Sidebar] Created new tab for saved table:', node.fileData.tableName);
      addFile(savedTableData);
      console.log('[Sidebar] Created new tab for saved table:', node.fileData.tableName);
      return;
    }

    // Special handling for remote tables (e.g. Databricks)
    if (node.fileData?.isRemote && node.fileData?.tableName) {
      console.log('[Sidebar] Opening remote table:', node.fileData.tableName);
      const { files, setActiveFile, addFile } = useAppStore.getState();

      const existingFile = files.find((f) => f.tableName === node.fileData?.tableName);
      if (existingFile) {
        console.log('[Sidebar] Remote table already open, switching to it');
        setActiveFile(existingFile.id);
        return;
      }

      const remoteTableData = {
        data: [],
        columnTypes: [],
        fileName: node.name,
        rowCount: node.fileData.rowCount || 0,
        columnCount: node.fileData.columnCount || 0,
        sourceType: 'TABLE' as any,
        loadedToDuckDB: true,
        tableName: node.fileData.tableName,
        isRemote: true,
        metadata: {
          isRemote: true,
          remoteUrl: node.fileData.remoteUrl
        }
      };

      addFile(remoteTableData);
      console.log('[Sidebar] Created new tab for remote table:', node.fileData.tableName);
      return;
    }

    // Find the workspace file corresponding to this folder node
    const { workspaceFiles, files, setActiveFile } = useAppStore.getState();

    // Try to match by handle first (most reliable), then by name
    let workspaceFile = workspaceFiles.find(
      (f) =>
        node.fileData?.handle && f.handle && f.handle === node.fileData.handle
    );

    // Fallback to name matching if handle matching fails
    if (!workspaceFile) {
      workspaceFile = workspaceFiles.find(
        (f) => f.name === node.name || f.originalName === node.name
      );
    }

    console.log(
      '[Sidebar] Found workspace file:',
      !!workspaceFile,
      workspaceFile
    );

    if (workspaceFile) {
      // Check if file is already loaded in app store
      const existingFile = files.find((f) => f.fileName === workspaceFile.name);
      if (existingFile) {
        console.log('[Sidebar] File already in app store, switching to it');
        setActiveFile(existingFile.id);
        return;
      }

      // Use unified reopen logic
      try {
        const result = await reopenWorkspaceFile(workspaceFile, onDataLoad);
        if (result) {
          console.log(
            '[Sidebar] File reopened successfully using unified import'
          );
        }
      } catch (error) {
        console.error('[Sidebar] Failed to reopen file:', error);
      }
    } else {
      console.warn('[Sidebar] No workspace file found for:', node.name);

      // For files without handles (drag & drop), check if they're already in app store
      const existingFile = files.find((f) => f.fileName === node.name);
      if (existingFile) {
        console.log(
          '[Sidebar] File found in app store, switching to existing tab'
        );
        setActiveFile(existingFile.id);
        return;
      }

      // File is completely missing - show error and suggest re-import
      showError(
        t('sidebar.fileLoadError', 'Failed to Load File'),
        'Please re-import the file using the import button.'
      );
    }
  };

  // Handle folder selection
  const handleFolderSelect = (node: FolderNode) => {
    console.log('[Sidebar] Folder selected:', node);
    // Could implement folder-level actions here
  };

  // Handle global file drop (unified)
  const handleGlobalFileDrop = async (
    files: File[],
    targetFolderId?: string,
    handles?: (FileSystemFileHandle | undefined)[]
  ) => {
    console.log(
      '[handleGlobalFileDrop] Using unified import for:',
      files.length,
      'files',
      'targetFolderId:',
      targetFolderId,
      'draftFolderId:', draftFolderId,
      'handles:',
      handles?.filter(Boolean).length || 0
    );

    const finalFolderId = targetFolderId || draftFolderId || undefined;
    console.log('[handleGlobalFileDrop] Final folder ID:', finalFolderId);

    try {
      const results = [];

      // Process each file with its corresponding handle
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const handle = handles?.[i];

        if (handle) {
          console.log(
            '[handleGlobalFileDrop] Using handle for file:',
            file.name
          );
          const result = await importFileWithHandle(
            handle,
            file,
            onDataLoad,
            finalFolderId
          );
          if (result) results.push(result);
        } else {
          console.log(
            '[handleGlobalFileDrop] No handle available for file:',
            file.name
          );
          const result = await importFiles([file], onDataLoad, finalFolderId);
          if (result) results.push(...result);
        }
      }

      console.log(
        '[handleGlobalFileDrop] Import completed, results:',
        results.length
      );
      return results;
    } catch (error) {
      console.error('[handleGlobalFileDrop] Import failed:', error);
      throw error;
    }
  };

  // Determine if any loading state is active
  const isLoading = isProcessingLocalFile || duckDBLoading;
  const errorMessage = duckDBError;

  // Sidebar animation variants - only for collapse/expand
  const sidebarVariants = {
    expanded: { width: 'var(--sidebar-width)' },
    collapsed: { width: '4rem' },
  };

  // Collapsed sidebar content
  const renderCollapsedContent = () => (
    <>
      <div className="p-4">{/* Header space for collapsed mode */}</div>

      {/* Vertical Toolbar */}
      <div className="mb-12">
        <SidebarToolbar
          collapsed={true}
          onOpenFolder={() => {
            // Handled in SidebarToolbar directly
          }}
          onRemoteClick={() => setIsRemoteModalOpen(true)}
        />
      </div>

      <div className="mt-auto pt-4 p-4 flex flex-col items-center gap-4 border-t border-gray-500/20">
        <div className="flex flex-col gap-2 items-center">
          <Tooltip content={t('sidebar.footer.settings', 'Settings')} placement="right">
            <button
              onClick={handleOpenSettings}
              className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/5 rounded"
              aria-label={t('sidebar.footer.settings', 'Settings')}
            >
              <Settings size={16} />
            </button>
          </Tooltip>
          <a
            href="https://amin.contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-foreground transition-custom p-2 hover:bg-background hover:bg-opacity-30 rounded"
            aria-label={t('sidebar.footer.visitAdmin')}
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </>
  );

  // Expanded sidebar content
  const renderExpandedContent = () => (
    <>
      {/* Header with logo and title */}
      <div className="px-5 py-4 border-b border-gray-500/20 bg-black/20 flex items-center justify-between">
        {customLogoUrl ? (
          <img
            src={customLogoUrl}
            className="h-12 w-24 object-contain"
            crossOrigin="anonymous"
          />
        ) : (
          <h1 className="text-white font-heading font-medium text-lg">
            {t('sidebar.header.title')}
          </h1>
        )}
      </div>

      {/* Toolbar */}
      <SidebarToolbar
        collapsed={false}
        onOpenFolder={() => {
          // Handled in SidebarToolbar directly
        }}
        onRemoteClick={() => setIsRemoteModalOpen(true)}
      />

      {/* Folder Tree View - Main content area */}
      <div className="flex-1 overflow-y-auto overflow-x-visible border-t border-gray-500/20">
        <FolderTreeView
          onFileSelect={handleFileSelect}
          onFolderSelect={handleFolderSelect}
        />
      </div>

      {/* Loading status */}
      {isLoading && (
        <div className="mx-5 mb-3 bg-background/30 p-3 border border-white/5 rounded-md">
          <div className="text-xs font-medium text-white text-opacity-80 mb-2 flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 animate-pulse"></div>
            {t('sidebar.processing', 'Processing files...')}
          </div>

          {isLoading && (
            <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, duckDBProgress * 100)}%` }}
              ></div>
            </div>
          )}

          {errorMessage && (
            <div className="text-destructive text-xs mt-2 p-2 rounded bg-background/50 border border-destructive/20">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Footer area - Enhanced */}
      <div className="border-t border-gray-500/20 bg-black/30">
        {/* User Menu - Match Help & Support section styling */}
        <div className="px-3 py-2.5 border-b border-gray-400/15">
          <UserMenu variant="sidebar" />
        </div>
        {/* Action Buttons Section */}
        <div className="px-3 py-2.5 border-b border-gray-400/15 bg-black/20">
          <div className="space-y-0.5">
            {/* DataKit Studio - Standalone */}
            <a
              href="https://datakit.studio"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-2 py-1.5 text-xs hover:bg-white/5 rounded transition-all duration-200 group"
            >
              <svg
                className="h-3.5 w-3.5 text-white/50 group-hover:text-white/70 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <span className="font-medium bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                DataKit Studio
              </span>
            </a>

            {/* Help Dropdown */}
            <HelpDropdown />

            {/* Send Feedback - Standalone */}
            <SidebarFeedbackButton context="sidebar" />
          </div>
        </div>

        {/* Attribution footer - Responsive design */}
        <div className="px-2 py-2 border-t border-gray-400/15 bg-black/40">
          <div className="flex items-center justify-between">
            {/* Responsive footer content */}
            <div className="flex-1 min-w-0">
              {/* Wide layout (>250px) - Full text */}
              <div className="hidden xl:block">
                <p className="text-[10px] text-white text-opacity-30 flex items-center flex-wrap">
                  {t('sidebar.footer.poweredBy')}{' '}
                  <a
                    href="https://duckdb.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center mx-1"
                  >
                    <img
                      src={DuckDBIcon}
                      className="h-3 w-3 transition-colors hover:opacity-80"
                      alt="DuckDB"
                    />
                  </a>
                  <a
                    href="https://amin.contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t('sidebar.footer.built')}
                  </a>
                  {' @ '}
                  <a
                    href="https://www.linkedin.com/company/datakitpage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t('sidebar.footer.company')}
                  </a>
                </p>
              </div>

              {/* Compact layout (200-250px) - Stacked text */}
              <div className="block xl:hidden">
                <div className="text-[9px] text-white text-opacity-30 space-y-1">
                  {/* First line: Powered by DuckDB */}
                  <div className="flex items-center">
                    <span>{t('sidebar.footer.poweredBy')}</span>
                    <a
                      href="https://duckdb.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center ml-1"
                    >
                      <img
                        src={DuckDBIcon}
                        className="h-2.5 w-2.5 transition-colors hover:opacity-80"
                        alt="DuckDB"
                      />
                    </a>
                  </div>

                  {/* Second line: Built by links */}
                  <div className="flex items-center gap-1">
                    <a
                      href="https://amin.contact"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t('sidebar.footer.built')}
                    </a>
                    <span>@</span>
                    <a
                      href="https://www.linkedin.com/company/datakitpage"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {t('sidebar.footer.company')}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings always on the right */}
            <div className="flex-shrink-0 ml-2">
              <SettingsPopover variant="sidebar" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <motion.div
        ref={sidebarRef}
        className={`relative bg-darkNav flex flex-col h-full border-r border-gray-500/20 overflow-visible sidebar-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''
          }`}
        initial={sidebarCollapsed ? 'collapsed' : 'expanded'}
        animate={sidebarCollapsed ? 'collapsed' : 'expanded'}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {sidebarCollapsed ? renderCollapsedContent() : renderExpandedContent()}

        {/* Resize handle with unique fade-out border */}
        {!sidebarCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize group"
            onMouseDown={handleMouseDown}
          >
            {/* Fade-out border effect with primary gradient */}
            <div
              className={`absolute top-0 right-0 w-1 h-full transition-all duration-150 ease-out ${isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'
                }`}
              style={{
                background: isResizing
                  ? 'linear-gradient(to bottom, transparent 0%, hsl(175 100% 36% / 0.6) 10%, hsl(175 100% 45% / 0.7) 30%, hsl(175 100% 55% / 0.5) 50%, hsl(175 100% 45% / 0.7) 70%, hsl(175 100% 36% / 0.6) 90%, transparent 100%)'
                  : 'linear-gradient(to bottom, transparent 0%, hsl(175 100% 36% / 0.7) 15%, hsl(175 100% 45% / 0.5) 35%, hsl(175 100% 55% / 0.4) 50%, hsl(175 100% 45% / 0.5) 65%, hsl(175 100% 36% / 0.7) 85%, transparent 100%)',
              }}
            />

            {/* Subtle glow effect when actively resizing */}
            {isResizing && (
              <>
                <div
                  className="absolute top-0 right-0 w-3 h-full opacity-25 blur-sm transition-all duration-150"
                  style={{
                    background:
                      'linear-gradient(to bottom, transparent 0%, hsl(175 100% 36% / 0.3) 15%, hsl(175 100% 45% / 0.25) 40%, hsl(175 100% 55% / 0.15) 50%, hsl(175 100% 45% / 0.25) 60%, hsl(175 100% 36% / 0.3) 85%, transparent 100%)',
                  }}
                />
                <div
                  className="absolute top-0 right-0 w-6 h-full opacity-15 blur-md transition-all duration-150"
                  style={{
                    background:
                      'linear-gradient(to bottom, transparent 0%, hsl(175 100% 36% / 0.15) 20%, hsl(175 100% 45% / 0.1) 50%, hsl(175 100% 36% / 0.15) 80%, transparent 100%)',
                  }}
                />
              </>
            )}
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className={`absolute top-3 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:border-white/10 transition-colors shadow-lg cursor-pointer rounded-md hover:bg-white/10 ${sidebarCollapsed
            ? 'left-1/2 transform -translate-x-1/2'
            : 'right-3'
            }`}
          aria-label={
            sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')
          }
        >
          {sidebarCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
      </motion.div>

      {/* Remote Data Import Modal */}
      <RemoteDataImportModal
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        onImport={handleRemoteDataImport}
      />

      {/* Global Drop Zone */}
      <GlobalDropZone
        onFileDrop={handleGlobalFileDrop}
        isProcessing={isLoading}
      />
    </>
  );
};

export default Sidebar;
