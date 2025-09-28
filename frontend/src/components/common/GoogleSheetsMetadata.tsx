import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Clock } from 'lucide-react';

import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';

interface GoogleSheetsMetadataProps {
  metadata: {
    sheetName: string;
    docId: string | null;
    sheetId: string | null;
    format: 'csv' | 'xlsx' | 'html' | null;
    importedAt: number;
  };
  url: string;
  className?: string;
  compact?: boolean;
}

const GoogleSheetsMetadata: React.FC<GoogleSheetsMetadataProps> = ({
  metadata,
  url,
  className = '',
  compact = false
}) => {
  const timeAgo = formatDistanceToNow(metadata.importedAt, { addSuffix: true });
  
  if (compact) {
    return (
      <div className={`flex items-center text-xs text-muted-foreground bg-green-500/10 rounded border border-green-500/20 px-3 py-2 ${className}`}>
        <GoogleSheetsIcon className="h-3.5 w-3.5 mr-2 text-green-500 flex-shrink-0" />
        <div className="flex items-center flex-1 min-w-0">
          <span className="truncate">
            {metadata.sheetName || 'Google Sheet'}
          </span>
          <span className="mx-2 text-muted-foreground/50">•</span>
          <span className="flex-shrink-0 text-muted-foreground">
            {timeAgo}
          </span>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="ml-2 text-green-500 hover:text-green-400 inline-flex items-center flex-shrink-0"
          title="Open in Google Sheets"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }
  
  return (
    <div className={`bg-green-500/10 rounded-md p-3 border border-green-500/20 ${className}`}>
      <div className="flex items-center">
        <GoogleSheetsIcon className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">
            {metadata.sheetName || 'Google Sheet'}
          </h4>
          <div className="flex items-center mt-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
            <span>Imported {timeAgo}</span>
            {metadata.format && (
              <>
                <span className="mx-2">•</span>
                <span className="uppercase">{metadata.format}</span>
              </>
            )}
          </div>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="ml-3 bg-background/30 hover:bg-green-500/20 text-green-500 hover:text-green-400 border border-green-500/20 hover:border-green-500/40 rounded px-2 py-1 text-xs flex items-center transition-colors flex-shrink-0"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open
        </a>
      </div>
    </div>
  );
};

export default GoogleSheetsMetadata;