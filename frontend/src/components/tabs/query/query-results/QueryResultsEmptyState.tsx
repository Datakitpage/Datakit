// src/components/tabs/query/results/QueryResultsEmptyState.tsx
import React from 'react';
import { AlertCircle, Database, Check } from 'lucide-react';

interface QueryResultsEmptyStateProps {
  type: 'loading' | 'error' | 'empty' | 'no-results';
  message?: string;
}

const QueryResultsEmptyState: React.FC<QueryResultsEmptyStateProps> = ({ type, message }) => {
  switch (type) {
    case 'loading':
      return (
        <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
          <p className="text-sm">Executing query...</p>
        </div>
      );
      
    case 'error':
      return (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-4 text-foreground m-3">
          <h4 className="font-medium text-destructive mb-2 flex items-center">
            <AlertCircle size={16} className="mr-2" />
            Error
          </h4>
          <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap">
            {message}
          </pre>
        </div>
      );
      
    case 'empty':
      return (
        <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
          <p className="text-sm">Execute a query to see results.</p>
        </div>
      );
      
    case 'no-results':
      return (
        <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
          <Check size={24} className="text-primary mb-4" />
          <p className="text-sm">Query executed successfully. No results returned.</p>
        </div>
      );
      
    default:
      return null;
  }
};

export default QueryResultsEmptyState;