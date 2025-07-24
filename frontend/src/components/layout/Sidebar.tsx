import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Cloud,
} from "lucide-react";
import { FileUploadButton } from "@/components/common/FileUploadButton";
import { ThemeColorPicker } from "@/components/common/ThemeColorPicker";
import { useDuckDBStore } from "@/store/duckDBStore";
import useDirectFileImport from "@/hooks/useDirectFileImport";
import { useAppStore } from "@/store/appStore";
import { motion, AnimatePresence } from "framer-motion";
import usePopover from "@/hooks/usePopover";
import { Button } from "@/components/ui/Button";
import UserMenu from "@/components/auth/UserMenu";
import { useElectronFileUpload } from "@/hooks/useElectronFileUpload";

import RemoteDataImportModal from "@/components/common/RemoteDataImportPanel";

import { ColumnType } from "@/types/csv";
import { DataSourceType } from "@/types/json";
import { ImportProvider } from "@/types/remoteImport";

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
  const [electronFileStatus, setElectronFileStatus] = useState<string | null>(null);

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

  // Initialize Electron file handling with status updates
  const { isElectron } = useElectronFileUpload({
    onFileSelect: (file) => {
      setElectronFileStatus(null); // Clear status once file is processed
      return onDataLoad ? processFile(file, onDataLoad) : processFile(file);
    },
    onFileHandleSelect: (handle, file) => {
      setElectronFileStatus(null); // Clear status once file is processed
      if (!onDataLoad) return;
      return processFileStreaming(handle, file, onDataLoad);
    },
    onStatusUpdate: setElectronFileStatus,
  });

  const handleFileWithStreaming = async (
    handle: FileSystemFileHandle,
    file: File
  ) => {
    if (!onDataLoad) return;

    try {
      uploadPopover.close();
      return await processFileStreaming(handle, file, onDataLoad);
    } catch (error) {
      console.error("Error importing file with streaming:", error);
    }
  };

  const handleRemoteDataImport = (result: DataLoadWithDuckDBResult) => {
    if (onDataLoad) {
      onDataLoad(result);
    }
  };

  // Determine if any loading state is active
  const isLoading = isProcessingLocalFile || duckDBLoading || Boolean(electronFileStatus);

  // Determine current loading status message
  const loadingStatus = electronFileStatus || localFileLoadingStatus;

  // Determine current error message
  const errorMessage = localFileProcessingError || duckDBError;

  // Variants for framer-motion animations
  const sidebarVariants = {
    expanded: { width: "16rem" }, // w-64 = 16rem
    collapsed: { width: "4rem" }, // mini sidebar width
  };

  // File upload popup for collapsed mode
  const renderFileUploadPopup = () => (
    <div className="absolute left-16 top-0 bg-darkNav rounded-lg shadow-lg border border-white/10 p-3 w-64">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-white mb-1">Upload File</h3>
        <p className="text-xs text-white/70">
          Import your data file for analysis
        </p>
      </div>

      <FileUploadButton
        onFileHandleSelect={handleFileWithStreaming}
        onFileSelect={(file) => {
          uploadPopover.close();
          return onDataLoad ? processFile(file, onDataLoad) : processFile(file);
        }}
        isLoading={isProcessingLocalFile}
        className="w-full mb-2"
        supportLargeFiles={true}
        electronStatus={electronFileStatus}
      />

      <Button
        variant="outline"
        className="w-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-white"
        onClick={() => {
          uploadPopover.close();
          setIsRemoteModalOpen(true);
        }}
      >
        <Cloud className="h-4 w-4 mr-2 text-blue-500" />
        <span className="text-sm">Remote Data</span>
      </Button>

      {(isLoading || loadingStatus) && (
        <div className="mt-3 bg-background/30 p-2 border border-white/5 rounded-md">
          {loadingStatus && (
            <div className="text-xs font-medium text-white text-opacity-80 mb-2 flex items-center">
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
      <div className="p-4 border-b border-white/10">
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

      <div className="mt-auto p-4 flex flex-col items-center gap-4 border-t border-white/10">
        <UserMenu variant="collapsed" />

        <a
          href="https://amin.contact"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary-foreground transition-custom p-2 hover:bg-background hover:bg-opacity-30 rounded"
          aria-label="Visit Amin"
        >
          <ExternalLink size={16} />
        </a>
      </div>
    </>
  );

  // Define expanded sidebar content
  const renderExpandedContent = () => (
    <>
      {/* Header with logo and title */}
      <div className="px-5 py-4 border-b border-white border-opacity-10 flex items-center justify-between">
        <h1 className="text-white font-heading font-medium text-lg">DataKit</h1>
      </div>

      {/* Introduction text */}
      <div className="px-5 py-4">
        <p className="text-sm text-white text-opacity-70">
          DataKit leverages WebAssembly to process large datasets.
        </p>
      </div>

      {/* File Upload section */}
      <div className="px-5 pt-2 pb-2">
        <FileUploadButton
          onFileHandleSelect={handleFileWithStreaming}
          onFileSelect={(file) => {
            return onDataLoad
              ? processFile(file, onDataLoad)
              : processFile(file);
          }}
          isLoading={isProcessingLocalFile}
          className="w-full mb-2"
          supportLargeFiles={true}
          electronStatus={electronFileStatus}
        />

        {/* New Remote Data Import Button */}
        <Button
          variant="outline"
          className="w-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-white group transition-all mb-1"
          onClick={() => setIsRemoteModalOpen(true)}
          disabled={isLoading}
        >
          <div className="flex items-center justify-center py-1">
            <Cloud className="h-4.5 w-4.5 mr-2 text-blue-500 group-hover:text-blue-400" />
            <span className="text-sm font-medium">Import Remote File</span>
          </div>
        </Button>

        {/* Loading Status - Combined for both local and remote */}
        {(isLoading || loadingStatus) && (
          <div className="mt-3 bg-background/30 p-3 border border-white/5 rounded-md">
            {loadingStatus && (
              <div className="text-xs font-medium text-white text-opacity-80 mb-2 flex items-center">
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
      </div>

      {/* Divider */}
      {/* <div className="px-5">
        <div className="border-t border-white border-opacity-10"></div>
      </div> */}

      {/* UPDATE 06/07/2025: MOST RECENT FILES section just commented out */}
      {/* Recent Files section */}
      <div className="px-5 py-3 flex-1 overflow-auto">
      </div>

      {/* Footer area with UserMenu */}
      <div className="border-t border-white border-opacity-10">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <UserMenu variant="sidebar" />
            </div>
            <div className="flex-shrink-0">
              <ThemeColorPicker variant="sidebar" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 text-center border-t border-white border-opacity-5">
          <p className="text-xs text-white text-opacity-50">
            Powered by DuckDB {" | "}
            <a
              href="https://amin.contact"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              built
            </a>
            {" @ "}
            <a
              href="https://www.linkedin.com/company/datakitpage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              DataKit
            </a>
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <motion.div
        className="relative bg-darkNav flex flex-col h-full border-r border-white border-opacity-10 overflow-hidden"
        initial={sidebarCollapsed ? "collapsed" : "expanded"}
        animate={sidebarCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {sidebarCollapsed ? renderCollapsedContent() : renderExpandedContent()}
        
        <button
          onClick={toggleSidebar}
          className="absolute top-5 right-3 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white hover:border-white/10 transition-colors shadow-lg"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
