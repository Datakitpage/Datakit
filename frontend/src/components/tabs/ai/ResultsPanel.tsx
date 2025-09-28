import React from "react";
import { Table, AlertCircle } from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import QueryResults from "@/components/tabs/query/query-results/QueryResults";

interface ResultsPanelProps {
  height: number;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ height }) => {
  const { queryResults } = useAIStore();
  
  if (!queryResults) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Table className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Query results will appear here</p>
        </div>
      </div>
    );
  }
  
  if (queryResults.error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-400" />
          <h3 className="text-sm font-medium text-foreground mb-2">Query Error</h3>
          <p className="text-xs text-muted-foreground">{queryResults.error}</p>
        </div>
      </div>
    );
  }
  
  return (
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
      />
    </div>
  );
};

export default ResultsPanel;