import React from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

import { DataSourceManager } from '@/components/data-sources';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import {
  FileTreeView,
  WorkspaceFile,
} from '@/components/workspace/FileTreeView';
import { ThemeColorPicker } from '@/components/common/ThemeColorPicker';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useDuckDBStore } from '@/store/duckDBStore';
import useDirectFileImport from '@/hooks/useDirectFileImport';
import { useAppStore } from '@/store/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import usePopover from '@/hooks/usePopover';
import { useNotifications } from '@/hooks/useNotifications';

import UserMenu from '@/components/auth/UserMenu';
import DuckDBIcon from '@/assets/duckdb.svg';

// Check for custom logo from environment variable or window object
const customLogoUrl =
  import.meta.env.VITE_CUSTOM_LOGO_URL || (window as any).CUSTOM_LOGO_URL;

// Helper function to check File System Access API support
const isFileSystemAccessSupported = (): boolean => {
  return 'showOpenFilePicker' in window && 'FileSystemFileHandle' in window;
};

// Helper function to get browser-specific compatibility info
const getBrowserCompatibilityInfo = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
  const isEdge = userAgent.includes('edg');
  const isFirefox = userAgent.includes('firefox');
  const isSafari =
    userAgent.includes('safari') && !userAgent.includes('chrome');

  return {
    isChrome,
    isEdge,
    isFirefox,
    isSafari,
    hasFullSupport: isChrome || isEdge,
    hasLimitedSupport: isSafari,
    noSupport: isFirefox,
    getBrowserName: () => {
      if (isChrome) return 'Chrome';
      if (isEdge) return 'Edge';
      if (isFirefox) return 'Firefox';
      if (isSafari) return 'Safari';
      return 'Unknown';
    },
  };
};

// Helper function to request permission for file handle
const requestFileHandlePermission = async (
  handle: FileSystemFileHandle
): Promise<boolean> => {
  try {
    // Check if we already have permission
    const permission = await handle.queryPermission({ mode: 'read' });
    if (permission === 'granted') {
      return true;
    }

    // Request permission if not granted
    if (permission === 'prompt') {
      const requestedPermission = await handle.requestPermission({
        mode: 'read',
      });
      return requestedPermission === 'granted';
    }

    return false;
  } catch (error) {
    console.log('[Permission] Error requesting file handle permission:', error);
    return false;
  }
};

// Helper function to verify handle validity with permission request
const verifyFileHandle = async (
  handle: FileSystemFileHandle,
  expectedFileName: string
): Promise<{ isValid: boolean; file?: File; error?: string }> => {
  try {
    // First, try to request permission
    const hasPermission = await requestFileHandlePermission(handle);
    if (!hasPermission) {
      return { isValid: false, error: 'Permission denied by user or system' };
    }

    // Try to get the file
    const file = await handle.getFile();

    // Verify the file name matches
    if (file.name !== expectedFileName) {
      return {
        isValid: false,
        error: `File name mismatch: expected "${expectedFileName}", got "${file.name}"`,
      };
    }

    return { isValid: true, file };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return { isValid: false, error: errorMessage };
  }
};

import RemoteDataImportModal from '@/components/common/RemoteDataImportPanel';

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

const Sidebar: React.FC<SidebarProps> = ({ onDataLoad }) => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    isRemoteModalOpen,
    setIsRemoteModalOpen,
  } = useAppStore();

  const uploadPopover = usePopover();

  // Get notifications
  const { showSuccess } = useNotifications();

  // Get workspace state from appStore
  const {
    workspaceFiles,
    addFileToWorkspace,
    removeFileFromWorkspace,
    renameFileInWorkspace,
    files,
    setActiveFile,
  } = useAppStore();

  const {
    processFileStreaming,
    processFile,
    isProcessing: isProcessingLocalFile,
    loadingStatus: localFileLoadingStatus,
    processingError: localFileProcessingError,
  } = useDirectFileImport();

  const {
    isLoading: duckDBLoading,
    processingProgress: duckDBProgress,
    error: duckDBError,
  } = useDuckDBStore();

  const handleFileWithStreaming = async (
    handle: FileSystemFileHandle,
    file: File,
    skipWorkspaceAdd = false
  ) => {
    if (!onDataLoad) return;

    try {
      uploadPopover.close();
      const result = await processFileStreaming(handle, file, onDataLoad);

      // Add file to workspace with handle for automatic access (if supported)
      // Skip if this is being called from workspace file selection
      if (result && !skipWorkspaceAdd) {
        const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt';
        const newFile: WorkspaceFile = {
          id: `file-${Date.now()}`,
          name: file.name,
          type: fileType as WorkspaceFile['type'],
          size: file.size,
          lastModified: file.lastModified,
          handle: isFileSystemAccessSupported() ? handle : undefined, // Only store handle if supported
        };
        addFileToWorkspace(newFile);
      }

      return result;
    } catch (error) {
      console.error('Error importing file with streaming:', error);
    }
  };

  const handleRemoteDataImport = (result: DataLoadWithDuckDBResult) => {
    if (onDataLoad) {
      onDataLoad(result);

      // Add remote file to workspace
      if (result.isRemote) {
        const newFile: WorkspaceFile = {
          id: `remote-${Date.now()}`,
          name: result.fileName,
          type: 'remote',
          isRemote: true,
          remoteUrl: result.remoteURL,
          lastModified: Date.now(),
        };
        addFileToWorkspace(newFile);

        // Show success notification for remote file import
        showSuccess(
          'Remote File Imported',
          `"${result.fileName}" has been imported from ${
            result.remoteProvider || 'remote source'
          }`,
          { icon: 'check', duration: 5000 }
        );
      }
    }
  };

  // File tree handlers
  const handleFileRemove = async (fileId: string) => {
    // Get file info before removing
    const file = workspaceFiles.find((f) => f.id === fileId);

    if (!file) return;

    // Show confirmation alert before removing
    const confirmed = confirm(
      `Remove "${file.name}" from workspace? This will not delete the actual file.`
    );

    if (!confirmed) return;

    // Remove from workspace after confirmation
    removeFileFromWorkspace(fileId);

    // Show success notification
    showSuccess(
      'File Removed',
      `"${file.name}" has been removed from workspace`,
      { icon: 'check', duration: 4000 }
    );

    // If file was loaded into DuckDB, remove the table or view
    try {
      const duckDBStore = useDuckDBStore.getState();

      // Try to drop table or view with the file name (escaped)
      const tableName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_]/g, '_');
      await duckDBStore.dropTableOrView(tableName);

      console.log(
        `[Sidebar] Dropped table/view for removed file: ${tableName}`
      );
    } catch (error) {
      console.error(
        '[Sidebar] Error dropping table/view for removed file:',
        error
      );
    }
  };

  const handleFileRename = (fileId: string, newName: string) => {
    renameFileInWorkspace(fileId, newName);
  };

  const handleFileSelect = async (file: WorkspaceFile) => {
    console.log('[Sidebar] File selected from workspace:', file);

    if (!onDataLoad) {
      console.log('[Sidebar] No onDataLoad callback available');
      return;
    }

    try {
      // First, check if file is already loaded in FileTabs
      const existingFileTab = files.find((f) => f.fileName === file.name);

      if (existingFileTab) {
        console.log(
          '[Sidebar] File already loaded, switching to existing tab:',
          file.name
        );
        setActiveFile(existingFileTab.id);
        return;
      }

      // For local files, try to use stored handle first, then prompt if needed
      if (!file.isRemote) {
        // Check browser support for File System Access API
        if (!isFileSystemAccessSupported()) {
          console.log(
            '[Sidebar] File System Access API not supported, cannot auto-open files'
          );
          const browserInfo = getBrowserCompatibilityInfo();
          const browserName = browserInfo.getBrowserName();

          let message = `Your browser (${browserName}) does not support automatic file access. Please re-import the file manually. `;

          if (browserInfo.noSupport) {
            message += 'For automatic file access, please use Chrome or Edge.';
          } else if (browserInfo.hasLimitedSupport) {
            message +=
              'File access support is limited in Safari. For better experience, use Chrome or Edge.';
          } else {
            message +=
              'For automatic import features, please use Chrome or Edge.';
          }

          alert(message);
          return;
        }

        // Try using stored file handle for automatic access
        if (file.handle) {
          console.log(
            '[Sidebar] Using stored file handle for automatic import:',
            file.name
          );

          const handleResult = await verifyFileHandle(file.handle, file.name);

          if (handleResult.isValid && handleResult.file) {
            console.log(
              '[Sidebar] Handle valid with permission, importing automatically:',
              file.name
            );
            await handleFileWithStreaming(file.handle, handleResult.file, true); // Skip workspace add
            return;
          } else {
            console.log(
              '[Sidebar] Handle verification failed:',
              handleResult.error
            );

            // Show specific error message to user based on the error type
            if (handleResult.error?.includes('Permission denied')) {
              const shouldRetry = confirm(
                `Permission denied to access "${file.name}". This can happen due to browser security policies.\n\n` +
                  `Click "OK" to manually select the file again, or "Cancel" to skip.`
              );
              if (!shouldRetry) return;
            } else if (handleResult.error?.includes('File name mismatch')) {
              alert(
                `The stored file reference for "${file.name}" points to a different file. Please re-select the correct file.`
              );
            } else {
              const shouldRetry = confirm(
                `Cannot automatically access "${file.name}". The file may have been moved, deleted, or access permissions changed.\n\n` +
                  `Click "OK" to manually select the file again, or "Cancel" to skip.`
              );
              if (!shouldRetry) return;
            }
          }
        }

        // Fallback: prompt user to re-select file
        console.log(
          '[Sidebar] No valid handle, prompting user to re-select:',
          file.name
        );

        try {
          const fileHandleArray = await window.showOpenFilePicker({
            types: [
              {
                description: 'Data Files',
                accept: {
                  'text/csv': ['.csv'],
                  'application/json': ['.json'],
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                    ['.xlsx'],
                  'application/vnd.ms-excel': ['.xls'],
                  'application/x-parquet': ['.parquet'],
                  'application/vnd.apache.parquet': ['.parquet'],
                  'text/plain': ['.txt'],
                  'application/octet-stream': ['.duckdb', '.db'],
                },
              },
            ],
            excludeAcceptAllOption: false,
            multiple: false,
          });

          if (fileHandleArray.length > 0) {
            const selectedHandle = fileHandleArray[0];
            const selectedFile = await selectedHandle.getFile();

            // Verify it's the same file name
            if (selectedFile.name === file.name) {
              console.log(
                '[Sidebar] File verified, importing with streaming:',
                selectedFile.name
              );

              // Check again if file was loaded while we were selecting (race condition)
              const existingFileTabAfterPicker = files.find(
                (f) => f.fileName === file.name
              );
              if (existingFileTabAfterPicker) {
                console.log(
                  '[Sidebar] File was loaded while picker was open, switching to existing'
                );
                setActiveFile(existingFileTabAfterPicker.id);
                return;
              }

              await handleFileWithStreaming(selectedHandle, selectedFile, true); // Skip workspace add

              // Update the file handle in the workspace file for future automatic access
              const updatedFile: WorkspaceFile = {
                ...file,
                handle: isFileSystemAccessSupported()
                  ? selectedHandle
                  : undefined,
              };
              // We could add a method to update workspace file handles here
              console.log('[Sidebar] Updated file handle for:', file.name);
            } else {
              console.log(
                '[Sidebar] File name mismatch:',
                selectedFile.name,
                'vs',
                file.name
              );
              alert(`Please select the correct file: ${file.name}`);
            }
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error re-importing file:', error);
            alert(
              `Could not load file ${file.name}. Please re-import it using the file upload button.`
            );
          }
        }
      } else if (file.isRemote && file.remoteUrl) {
        // Handle remote files - could trigger remote import modal
        console.log('Remote file clicked:', file);
        alert(
          'Remote source re-import not yet implemented. Please use the Cloud Sources button to re-import.'
        );
      }
    } catch (error) {
      console.error('Error handling file selection:', error);
    }
  };

  // Determine if any loading state is active
  const isLoading = isProcessingLocalFile || duckDBLoading;

  // Determine current loading status message
  const loadingStatus = localFileLoadingStatus;

  // Determine current error message
  const errorMessage = localFileProcessingError || duckDBError;

  // Variants for framer-motion animations
  const sidebarVariants = {
    expanded: { width: '16rem' }, // w-64 = 16rem
    collapsed: { width: '4rem' }, // mini sidebar width
  };

  // File upload popup for collapsed mode
  const renderFileUploadPopup = () => (
    <div className="absolute left-16 top-0 bg-popover rounded-lg shadow-lg border border-border p-3 w-64">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-foreground mb-1">Upload File</h3>
        <p className="text-xs text-muted-foreground">
          Import your data file for analysis
        </p>
      </div>

      <DataSourceManager
        onFileHandleSelect={handleFileWithStreaming}
        onFileSelect={async (file) => {
          uploadPopover.close();
          const result = onDataLoad
            ? await processFile(file, onDataLoad)
            : await processFile(file);

          // Add file to workspace
          if (result) {
            const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt';
            const newFile: WorkspaceFile = {
              id: `file-${Date.now()}`,
              name: file.name,
              type: fileType as WorkspaceFile['type'],
              size: file.size,
              lastModified: file.lastModified,
            };
            addFileToWorkspace(newFile);
          }

          return result;
        }}
        onRemoteClick={() => {
          uploadPopover.close();
          setIsRemoteModalOpen(true);
        }}
        isLoading={isProcessingLocalFile}
        className="w-full"
      />

      {(isLoading || loadingStatus) && (
        <div className="mt-3 bg-background/30 p-2 border border-border rounded-md">
          {loadingStatus && (
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 animate-pulse"></div>
              {loadingStatus}
            </div>
          )}

          {isLoading && (
            <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, duckDBProgress * 100)}%` }}
              ></div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Define what to show in collapsed mode - only icons with functionality
  const renderCollapsedContent = () => (
    <>
      <div className="p-4">
        {/* Header space for collapsed mode */}
      </div>

      <div className="flex flex-col items-center gap-4 p-2 mt-2">
        {/* File Upload Button with Dropdown */}
        <div className="relative" ref={uploadPopover.ref}>
          <AnimatePresence>
            {uploadPopover.isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.2 }}
              >
                <>{renderFileUploadPopup()}</>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-auto p-4 flex flex-col items-center gap-4 border-t border-border">
        <UserMenu variant="collapsed" />

        <div className="flex flex-col gap-2 items-center">
          <a
            href="https://amin.contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-foreground transition-custom p-2 hover:bg-accent hover:bg-opacity-30 rounded"
            aria-label="Visit Amin"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </>
  );

  // Define expanded sidebar content
  const renderExpandedContent = () => (
    <>
      {/* Header with logo and title */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        {customLogoUrl ? (
          <img
            src={customLogoUrl}
            className="h-12 w-24 object-contain"
            crossOrigin="anonymous"
          />
        ) : (
          <h1 className="text-foreground font-heading font-medium text-lg">
            DataKit
          </h1>
        )}
      </div>

      {/* Workspace Selector */}
      <div className="px-5 py-3 border-b border-border">
        <WorkspaceSelector />
      </div>

      {/* Data Source Manager section */}
      <div className="px-5 pt-3 pb-2">
        <DataSourceManager
          onFileHandleSelect={handleFileWithStreaming}
          onFileSelect={async (file) => {
            const result = onDataLoad
              ? await processFile(file, onDataLoad)
              : await processFile(file);

            // Add file to workspace
            if (result) {
              const fileType =
                file.name.split('.').pop()?.toLowerCase() || 'txt';
              const newFile: WorkspaceFile = {
                id: `file-${Date.now()}`,
                name: file.name,
                type: fileType as WorkspaceFile['type'],
                size: file.size,
                lastModified: file.lastModified,
              };
              addFileToWorkspace(newFile);
            }

            return result;
          }}
          onRemoteClick={() => setIsRemoteModalOpen(true)}
          isLoading={isProcessingLocalFile}
          className="w-full"
        />

        {/* Loading Status - Combined for both local and remote */}
      </div>
      <div className="flex-1 overflow-y-auto border-t border-border mt-2">
        <FileTreeView
          files={workspaceFiles}
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
          onFileRename={handleFileRename}
        />
      </div>

      {/* File Tree - Main content area */}

      {(isLoading || loadingStatus) && (
        <div className="mt-3 bg-background/30 p-3 border border-border rounded-md">
          {loadingStatus && (
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 animate-pulse"></div>
              {loadingStatus}
            </div>
          )}

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

      {/* Footer area with UserMenu */}
      <div>
        <div className="p-4">
          <UserMenu variant="sidebar" />
        </div>

        <div className="px-2 py-3 border-t border-border">
          <div className="flex items-center justify-end">
            <p className="text-xs text-muted-foreground flex items-center">
              Powered by{' '}
              <a
                href="https://duckdb.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={DuckDBIcon}
                  className="text-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-0.5 mx-1 h-4 w-4"
                />
              </a>
              <a
                href="https://amin.contact"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                built
              </a>
              {' @ '}
              <a
                href="https://www.linkedin.com/company/datakitpage"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                DataKit
              </a>
            </p>
            <div className="flex items-center gap-2 flex-shrink-0 ml-1">
              <ThemeToggle variant="sidebar" />
              <ThemeColorPicker variant="sidebar" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <motion.div
        className="relative bg-popover flex flex-col h-full border-r border-border overflow-hidden"
        initial={sidebarCollapsed ? 'collapsed' : 'expanded'}
        animate={sidebarCollapsed ? 'collapsed' : 'expanded'}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {sidebarCollapsed ? renderCollapsedContent() : renderExpandedContent()}

        <button
          onClick={toggleSidebar}
          className="absolute top-5 right-3 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors shadow-lg cursor-pointer"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
    </>
  );
};

export default Sidebar;
