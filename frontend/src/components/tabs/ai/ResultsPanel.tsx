import React, { useCallback, useState } from "react";
import { Table, AlertCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

import { useAIStore } from "@/store/aiStore";
import { useQueryResultsImport } from "@/hooks/query/useQueryResultsImport";
import { useExportProvider } from "@/hooks/query/useExportProvider";
import QueryResults from "@/components/tabs/query/query-results/QueryResults";
import ExportResultsModal from "@/components/tabs/query/query-results/ExportResultsModal";

interface ResultsPanelProps {
  height: number;
  activeFile?: {
    id: string;
    fileName?: string;
    tableName?: string;
  } | null;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ height, activeFile }) => {
  const { t } = useTranslation();
  const { queryResults } = useAIStore();
  const { isImporting, importQueryResultsAsTable } = useQueryResultsImport();
  const [showSaveAsTableModal, setShowSaveAsTableModal] = useState(false);

  // Hook for export functionality
  const { handleExportWithProvider } = useExportProvider(
    {
      results: queryResults?.data || [],
      columns: queryResults?.columns || [],
      query: queryResults?.executedSQL,
      sourceFileName: activeFile?.fileName || activeFile?.tableName || 'ai_query_results'
    },
    activeFile,
    () => setShowSaveAsTableModal(false)
  );
  
  // Handle opening the save as table modal
  const handleImportAsTable = useCallback(() => {
    setShowSaveAsTableModal(true);
  }, []);
  
  
  if (!queryResults) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-white/50">
          <Table className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t('ai.results.placeholder', { defaultValue: 'Query results will appear here' })}</p>
        </div>
      </div>
    );
  }
  
  if (queryResults.error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-400" />
          <h3 className="text-sm font-medium text-white mb-2">{t('ai.results.error.title', { defaultValue: 'Query Error' })}</h3>
          <p className="text-xs text-white/60">{queryResults.error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="h-full" style={{ height: `${height}px` }}>
        <QueryResults
          results={queryResults.data}
          columns={queryResults.columns}
          isLoading={queryResults.isLoading}
          error={queryResults.error}
          totalRows={queryResults.totalRows}
          currentPage={queryResults.currentPage}
          totalPages={queryResults.totalPages}
          rowsPerPage={queryResults.rowsPerPage}
          onPageChange={(page) => {
            // Handle pagination - this should be implemented in the store
            console.log("Page change:", page);
          }}
          onRowsPerPageChange={(rowsPerPage) => {
            // Handle rows per page change
            console.log("Rows per page:", rowsPerPage);
          }}
          onImportAsTable={handleImportAsTable}
          isImporting={isImporting}
        />
      </div>
      
      {/* Export Modal */}
      <ExportResultsModal
        isOpen={showSaveAsTableModal}
        onClose={() => setShowSaveAsTableModal(false)}
        onConfirm={handleExportWithProvider}
        isExporting={isImporting}
        results={queryResults.data}
        columns={queryResults.columns}
        query={queryResults.executedSQL}
        rowCount={queryResults.totalRows}
        columnCount={queryResults.columns?.length || 0}
        sourceFileName={activeFile?.fileName || activeFile?.tableName || 'ai_query_results'}
      />
    </>
  );
};

export default ResultsPanel;