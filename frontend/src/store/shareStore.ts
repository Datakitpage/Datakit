import { create } from 'zustand';
import { shareService } from '@/lib/api/shareService';
import { useAppStore } from './appStore';
import { useDuckDBStore } from './duckDBStore';

export enum ShareAccessType {
  PUBLIC = 'public',
  EMAIL_LIST = 'email_list',
}

export interface ShareOptions {
  accessType?: ShareAccessType;
  allowedEmails?: string[];
  requireAuth?: boolean;
  expirationDays?: number;
}

export interface SharedFile {
  shareId: string;
  shareUrl: string;
  fileName: string;
  fileSize: number;
  accessType: ShareAccessType;
  requireAuth: boolean;
  expiresAt: Date;
  createdAt: Date;
  fileMetadata?: {
    rowCount?: number;
    columnCount?: number;
    fileType: string;
    compressed: boolean;
  };
  accessCount?: number;
}

interface ShareState {
  // State
  isSharing: boolean;
  shareProgress: number;
  shareError: string | null;
  currentShare: SharedFile | null;
  shareHistory: SharedFile[];
  isLoadingHistory: boolean;
  
  // Modal state
  isShareModalOpen: boolean;
  shareModalFileId: string | null;
  
  // Actions
  createShare: (fileId: string, options?: ShareOptions) => Promise<SharedFile>;
  loadShareHistory: () => Promise<void>;
  deleteShare: (shareId: string) => Promise<void>;
  copyShareLink: (shareUrl: string) => Promise<void>;
  
  // Modal actions
  openShareModal: (fileId: string) => void;
  closeShareModal: () => void;
  
  // Helpers
  setShareError: (error: string | null) => void;
  clearShareError: () => void;
}

export const useShareStore = create<ShareState>((set, get) => ({
  // Initial state
  isSharing: false,
  shareProgress: 0,
  shareError: null,
  currentShare: null,
  shareHistory: [],
  isLoadingHistory: false,
  isShareModalOpen: false,
  shareModalFileId: null,
  
  // Create a new share
  createShare: async (fileId: string, options: ShareOptions = {}) => {
    const appStore = useAppStore.getState();
    const duckDBStore = useDuckDBStore.getState();
    
    // Get file from app store
    const file = appStore.files.find(f => f.id === fileId);
    if (!file) {
      throw new Error('File not found');
    }
    
    set({ 
      isSharing: true, 
      shareProgress: 0, 
      shareError: null 
    });
    
    try {
      // Step 1: Export data from DuckDB
      set({ shareProgress: 10 });
      console.log('[ShareStore] Exporting data from DuckDB:', file.tableName);
      
      // Check if table exists first
      const tableCheckQuery = `SHOW TABLES`;
      const tables = await duckDBStore.executeQuery(tableCheckQuery);
      const tableList = tables?.toArray() || [];
      console.log('[ShareStore] Available tables:', tableList);
      
      // Get the actual table name (it might be different from file.tableName)
      let actualTableName = file.tableName;
      if (tableList.length > 0) {
        // Tables are returned as objects with a 'name' property
        const tableNames = tableList.map((t: any) => t.name || t.Name || Object.values(t)[0]);
        console.log('[ShareStore] Table names:', tableNames);
        
        // Find matching table (case-insensitive)
        const matchingTable = tableNames.find((name: string) => 
          name.toLowerCase() === file.tableName.toLowerCase()
        );
        
        if (matchingTable) {
          actualTableName = matchingTable;
        } else if (tableNames.length > 0) {
          // If no match, use the first available table
          actualTableName = tableNames[0];
          console.log('[ShareStore] Using first available table:', actualTableName);
        }
      }
      
      // Try with the actual table name
      const dataQuery = `SELECT * FROM "${actualTableName}"`;
      console.log('[ShareStore] Executing query:', dataQuery);
      const result = await duckDBStore.executeQuery(dataQuery);
      
      if (!result) {
        throw new Error('Failed to export data from DuckDB');
      }
      
      set({ shareProgress: 30 });
      
      // Step 2: Convert result to CSV
      const rows = result.toArray();
      const headers = Object.keys(rows[0] || {});
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          headers.map(h => {
            const value = row[h];
            // Handle BigInt values
            if (typeof value === 'bigint') {
              return value.toString();
            }
            // Escape values containing commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          }).join(',')
        )
      ].join('\n');
      
      set({ shareProgress: 50 });
      
      // Step 3: Create file blob
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const csvFile = new File([blob], file.fileName, { type: 'text/csv' });
      
      set({ shareProgress: 70 });
      
      // Step 4: Upload to backend
      const metadata = {
        originalName: file.fileName,
        rowCount: typeof file.rowCount === 'bigint' ? Number(file.rowCount) : file.rowCount,
        columnCount: typeof file.columnCount === 'bigint' ? Number(file.columnCount) : file.columnCount,
        fileType: 'csv',
      };
      
      const sharedFile = await shareService.createShare(
        csvFile,
        metadata,
        options,
        (progress) => {
          // Update progress from 70 to 90 based on upload
          set({ shareProgress: 70 + (progress * 20) });
        }
      );
      
      set({ shareProgress: 100 });
      
      // Add to history
      set(state => ({
        currentShare: sharedFile,
        shareHistory: [sharedFile, ...state.shareHistory],
        isSharing: false,
        shareProgress: 0,
      }));
      
      console.log('[ShareStore] Share created successfully:', sharedFile.shareUrl);
      
      return sharedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create share';
      console.error('[ShareStore] Share creation failed:', error);
      set({ 
        shareError: errorMessage,
        isSharing: false,
        shareProgress: 0,
      });
      throw error;
    }
  },
  
  // Load share history
  loadShareHistory: async () => {
    set({ isLoadingHistory: true });
    
    try {
      const shares = await shareService.getUserShares();
      set({ 
        shareHistory: shares,
        isLoadingHistory: false,
      });
    } catch (error) {
      console.error('[ShareStore] Failed to load share history:', error);
      set({ 
        isLoadingHistory: false,
        shareError: 'Failed to load share history',
      });
    }
  },
  
  // Delete a share
  deleteShare: async (shareId: string) => {
    try {
      await shareService.deleteShare(shareId);
      
      // Remove from history
      set(state => ({
        shareHistory: state.shareHistory.filter(s => s.shareId !== shareId),
        currentShare: state.currentShare?.shareId === shareId ? null : state.currentShare,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete share';
      set({ shareError: errorMessage });
      throw error;
    }
  },
  
  // Copy share link to clipboard
  copyShareLink: async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      console.log('[ShareStore] Share link copied to clipboard');
    } catch (error) {
      console.error('[ShareStore] Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  },
  
  // Modal actions
  openShareModal: (fileId: string) => {
    set({ 
      isShareModalOpen: true,
      shareModalFileId: fileId,
      currentShare: null,
      shareError: null,
    });
  },
  
  closeShareModal: () => {
    set({ 
      isShareModalOpen: false,
      shareModalFileId: null,
    });
  },
  
  // Helpers
  setShareError: (error) => set({ shareError: error }),
  clearShareError: () => set({ shareError: null }),
}));