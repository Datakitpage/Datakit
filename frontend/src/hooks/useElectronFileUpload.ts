import { useEffect, useCallback } from 'react';
import { useElectronFileHandler } from './useElectronFileHandler';

interface UseElectronFileUploadProps {
  onFileSelect?: (file: File) => void;
  onFileHandleSelect?: (handle: FileSystemFileHandle, file: File) => void;
  onStatusUpdate?: (status: string) => void;
}

export const useElectronFileUpload = ({ 
  onFileSelect, 
  onFileHandleSelect,
  onStatusUpdate 
}: UseElectronFileUploadProps) => {
  const { isElectron, checkForOpenedFile, createFileFromPath } = useElectronFileHandler();

  // Handle file opened at startup
  useEffect(() => {
    if (!isElectron) return;

    const handleStartupFile = async () => {
      try {
        const fileInfo = await checkForOpenedFile();
        if (fileInfo) {
          console.log('Processing file opened at startup:', fileInfo.name);
          onStatusUpdate?.(`Opening ${fileInfo.name}...`);
          await processElectronFile(fileInfo.path);
        }
      } catch (error) {
        console.error('Error handling startup file:', error);
        onStatusUpdate?.('Failed to open file');
      }
    };

    // Check for file after a short delay to allow the UI to load
    const timeout = setTimeout(handleStartupFile, 1000);
    return () => clearTimeout(timeout);
  }, [isElectron, onFileSelect, onFileHandleSelect]);

  // Handle file opened while app is running
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const handleFileOpened = async (filePath: string) => {
      console.log('Processing file opened while running:', filePath);
      const fileName = filePath.split('/').pop() || 'file';
      onStatusUpdate?.(`Opening ${fileName}...`);
      await processElectronFile(filePath);
    };

    window.electronAPI.onFileOpened(handleFileOpened);

    return () => {
      window.electronAPI!.removeAllFileOpenedListeners();
    };
  }, [isElectron, onFileSelect, onFileHandleSelect]);

  // Process file from Electron path
  const processElectronFile = useCallback(async (filePath: string) => {
    if (!isElectron) return;

    try {
      // Validate file extension
      const fileExt = filePath.split('.').pop()?.toLowerCase();
      const validExtensions = ['csv', 'json', 'xlsx', 'xls', 'parquet'];
      
      if (!validExtensions.includes(fileExt || '')) {
        console.error('Invalid file type:', fileExt);
        onStatusUpdate?.('Invalid file type');
        alert('Please open a CSV, JSON, Excel, or Parquet file');
        return;
      }

      onStatusUpdate?.('Reading file...');
      
      // Create File object from path
      const file = await createFileFromPath(filePath);
      if (!file) {
        console.error('Failed to create file object from path:', filePath);
        onStatusUpdate?.('Failed to read file');
        return;
      }

      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`Processing Electron file: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
      onStatusUpdate?.(`Processing ${file.name} (${fileSizeMB.toFixed(1)}MB)...`);

      // Use the appropriate callback based on what's available
      if (onFileHandleSelect) {
        // For Electron files, we don't have a FileSystemFileHandle
        // So we'll fall back to onFileSelect or create a mock handle
        console.warn('FileSystemFileHandle not available for Electron files, using onFileSelect');
        if (onFileSelect) {
          await onFileSelect(file);
        }
      } else if (onFileSelect) {
        await onFileSelect(file);
      }
    } catch (error) {
      console.error('Error processing Electron file:', error);
      onStatusUpdate?.('Failed to process file');
      alert('Failed to open the file. Please try again.');
    }
  }, [isElectron, onFileSelect, onFileHandleSelect, createFileFromPath, onStatusUpdate]);

  return {
    isElectron,
    processElectronFile,
  };
};