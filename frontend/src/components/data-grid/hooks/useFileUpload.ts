import { useRef } from "react";
import useDirectFileImport from "@/hooks/useDirectFileImport";
import { useAppStore } from "@/store/appStore";
import { useAnalytics } from "@/hooks/useAnalytics";
import { LocalProjectFile } from "@/components/projects/FileTreeView";

// Helper function to check File System Access API support
const isFileSystemAccessSupported = (): boolean => {
  return 'showOpenFilePicker' in window && 'FileSystemFileHandle' in window;
};

export const useFileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analytics = useAnalytics();
  const { addFile, addFileToProject } = useAppStore();
  const { processFile, processFileStreaming, isProcessing } = useDirectFileImport();

  const handleButtonClick = async () => {
    // Try to use File System Access API for better performance
    if (isFileSystemAccessSupported()) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [
            {
              description: "Data Files",
              accept: {
                "text/csv": [".csv"],
                "application/json": [".json"],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                "application/vnd.ms-excel": [".xls"],
                "application/x-parquet": [".parquet"],
                "application/vnd.apache.parquet": [".parquet"],
                "text/plain": [".txt"],
                "application/octet-stream": [".duckdb", ".db"],
              },
            },
          ],
          multiple: false,
        });

        const file = await fileHandle.getFile();
        
        // Use streaming for better performance
        await processFileStreaming(fileHandle, file, (result) => {
          addFile(result);
          analytics.trackFileUpload(result);
          
          // Add file to workspace with handle for automatic access
          const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt';
          const newFile: LocalProjectFile = {
            id: `file-${Date.now()}`,
            name: file.name,
            type: fileType as LocalProjectFile['type'],
            size: file.size,
            lastModified: file.lastModified,
            handle: fileHandle, // Store the file handle for future automatic access
          };
          addFileToProject(newFile);
        });
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "AbortError") {
          // Fall back to regular input if API fails
          fileInputRef.current?.click();
        }
      }
    } else {
      // Fall back to regular input
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processFile(file, (result) => {
      addFile(result);
      analytics.trackFileUpload(result);
      
      // Add file to workspace (without handle since we're using regular file input)
      const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt';
      const newFile: LocalProjectFile = {
        id: `file-${Date.now()}`,
        name: file.name,
        type: fileType as LocalProjectFile['type'],
        size: file.size,
        lastModified: file.lastModified,
        // No handle available for regular file input
      };
      addFileToProject(newFile);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return {
    fileInputRef,
    handleButtonClick,
    handleFileSelect,
    isProcessing,
  };
};