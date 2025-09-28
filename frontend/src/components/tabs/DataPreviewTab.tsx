import React from 'react';

import { useAppStore } from '@/store/appStore';
import {
  selectActiveFile,
  selectHasFiles,
  selectRemoteURL,
  selectRemoteProvider,
  selectGoogleSheets,
} from '@/store/selectors/appSelectors';

import DataPreviewGrid from '@/components/data-grid/DataPreviewGrid';
import EmptyDataState from '@/components/data-grid/EmptyDataState';
import GoogleSheetsMetadata from '@/components/common/GoogleSheetsMetadata';
import SplitViewContainer from '@/components/layout/SplitViewContainer';

import { ImportProvider } from '@/types/remoteImport';

const DataPreviewTab: React.FC = () => {
  const { setIsRemoteModalOpen, setActiveProviderRemoteModal } = useAppStore();
  const hasFiles = useAppStore(selectHasFiles);
  const activeFile = useAppStore(selectActiveFile);
  const remoteURL = useAppStore(selectRemoteURL);
  const remoteProvider = useAppStore(selectRemoteProvider);
  const googleSheets = useAppStore(selectGoogleSheets);

  // Check if active file has split view
  const activeFileSplitView = activeFile?.splitView;

  const handleImportOptionClick = (val: ImportProvider) => {
    setIsRemoteModalOpen(true);
    setActiveProviderRemoteModal(val);
  };

  // Show empty state if no files are loaded
  if (!hasFiles) {
    return <EmptyDataState onImportOptionClick={handleImportOptionClick} />;
  }

  // Show active file content
  return (
    <div className="h-full flex flex-col">
      {/* Split View or Regular View */}
      {activeFileSplitView?.isActive ? (
        <SplitViewContainer className="flex-1" />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeFile && remoteProvider === 'google_sheets' && googleSheets && (
            <div className="px-3 pt-3">
              <GoogleSheetsMetadata
                metadata={googleSheets}
                url={remoteURL || ''}
                className="mb-0"
                compact={true}
              />
            </div>
          )}

          {/* Data grid component based on source type */}
          <div className="flex-1 overflow-hidden">
            {activeFile ? (
              <DataPreviewGrid />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">No data to preview</p>
                  <p className="text-sm">
                    Select a file tab to view its contents
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPreviewTab;
