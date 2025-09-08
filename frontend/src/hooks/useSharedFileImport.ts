import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAppStore } from '@/store/appStore';
import { useNotifications } from '@/hooks/useNotifications';

export const useSharedFileImport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { importFileDirectly } = useDuckDBStore();
  const { addFile } = useAppStore();
  const { showSuccess, showError } = useNotifications();

  useEffect(() => {
    // Check if we have a shared file to import
    const state = location.state as any;
    if (state?.sharedFile && state?.sharedFileMetadata) {
      handleSharedFileImport(state.sharedFile, state.sharedFileMetadata);
      
      // Clear the state to prevent re-import on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const handleSharedFileImport = async (file: File, metadata: any) => {
    try {
      console.log('[SharedFileImport] Importing shared file:', metadata);
      console.log('[SharedFileImport] File details:', { 
        name: file.name, 
        size: file.size, 
        type: file.type 
      });
      
      // Import the file directly into DuckDB
      // importFileDirectly takes a File object directly
      const result = await importFileDirectly(file);
      
      if (result) {
        // Add to app store
        const fileData = {
          ...result,
          id: `shared_${Date.now()}`,
          fileName: metadata.fileName,
          sharedBy: metadata.sharedBy,
          shareId: metadata.shareId,
        };
        
        addFile(fileData);
        
        showSuccess(
          'File Imported',
          `Successfully imported ${metadata.fileName} shared by ${metadata.sharedBy || 'DataKit user'}`,
          { duration: 5000 }
        );
      }
    } catch (error) {
      console.error('[SharedFileImport] Error importing shared file:', error);
      showError(
        'Import Failed',
        error instanceof Error ? error.message : 'Failed to import the shared file'
      );
    }
  };

  return {
    handleSharedFileImport,
  };
};