import { useEffect, useCallback } from 'react';

// TypeScript declaration for the Electron API
declare global {
  interface Window {
    electronAPI?: {
      showSaveDialog: (options: any) => Promise<any>;
      showOpenDialog: (options: any) => Promise<any>;
      getOpenedFile: () => Promise<string | null>;
      openFile: (filePath: string) => Promise<any>;
      onFileOpened: (callback: (filePath: string) => void) => void;
      removeAllFileOpenedListeners: () => void;
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
    };
  }
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: string;
}

export const useElectronFileHandler = () => {
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  // Check for opened file on mount (for app startup with file)
  const checkForOpenedFile = useCallback(async (): Promise<FileInfo | null> => {
    if (!isElectron) return null;
    
    try {
      const filePath = await window.electronAPI!.getOpenedFile();
      if (filePath) {
        const fileInfo = await window.electronAPI!.openFile(filePath);
        return fileInfo;
      }
    } catch (error) {
      console.error('Error checking for opened file:', error);
    }
    return null;
  }, [isElectron]);

  // Convert file path to File object for existing upload flow
  const createFileFromPath = useCallback(async (filePath: string): Promise<File | null> => {
    if (!isElectron) return null;

    try {
      // Use fetch to read the file as blob in Electron
      const response = await fetch(`file://${filePath}`);
      const blob = await response.blob();
      const fileName = filePath.split('/').pop() || 'unknown';
      
      // Create File object
      const file = new File([blob], fileName, {
        type: blob.type || getContentTypeFromExtension(fileName),
      });
      
      return file;
    } catch (error) {
      console.error('Error creating file from path:', error);
      return null;
    }
  }, [isElectron]);

  // Setup file opening event listener
  useEffect(() => {
    if (!isElectron) return;

    const handleFileOpened = async (filePath: string) => {
      console.log('File opened via double-click:', filePath);
      // This will be handled by the parent component that uses this hook
    };

    window.electronAPI!.onFileOpened(handleFileOpened);

    return () => {
      window.electronAPI!.removeAllFileOpenedListeners();
    };
  }, [isElectron]);

  // Helper function to get content type from file extension
  const getContentTypeFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'parquet':
        return 'application/x-parquet';
      default:
        return 'application/octet-stream';
    }
  };

  return {
    isElectron,
    checkForOpenedFile,
    createFileFromPath,
  };
};