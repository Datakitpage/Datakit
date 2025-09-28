/**
 * FileTreeView - Display workspace files in a tree structure
 * Shows all files in the current workspace with actions
 */

import React, { useState } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Database, 
  Package, 
  Braces,
  Cloud,
  MoreVertical,
  Trash2,
  Edit2,
  FolderOpen,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface WorkspaceFile {
  id: string;
  name: string;
  path?: string;
  type: 'csv' | 'json' | 'excel' | 'parquet' | 'txt' | 'duckdb' | 'remote';
  size?: number;
  isRemote?: boolean;
  remoteUrl?: string;
  lastModified?: number;
  handle?: FileSystemFileHandle; // Store file handle for automatic access
}

interface FileTreeViewProps {
  files: WorkspaceFile[];
  onFileSelect?: (file: WorkspaceFile) => void;
  onFileRemove?: (fileId: string) => void;
  onFileRename?: (fileId: string, newName: string) => void;
  activeFileId?: string;
}

export const FileTreeView: React.FC<FileTreeViewProps> = ({
  files,
  onFileSelect,
  onFileRemove,
  onFileRename,
  activeFileId
}) => {
  const [contextMenuFileId, setContextMenuFileId] = useState<string | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const getFileIcon = (type: WorkspaceFile['type']) => {
    const iconProps = { className: "h-4 w-4", strokeWidth: 1.5 };
    
    switch (type) {
      case 'csv':
      case 'excel':
        return <FileSpreadsheet {...iconProps} className={`${iconProps.className} text-emerald-400`} />;
      case 'json':
        return <Braces {...iconProps} className={`${iconProps.className} text-amber-400`} />;
      case 'parquet':
        return <Package {...iconProps} className={`${iconProps.className} text-cyan-400`} />;
      case 'txt':
        return <FileText {...iconProps} className={`${iconProps.className} text-slate-400`} />;
      case 'duckdb':
        return <Database {...iconProps} className={`${iconProps.className} text-violet-400`} />;
      case 'remote':
        return <Cloud {...iconProps} className={`${iconProps.className} text-blue-400`} />;
      default:
        return <FileText {...iconProps} className={`${iconProps.className} text-muted-foreground`} />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleStartRename = (file: WorkspaceFile) => {
    setRenamingFileId(file.id);
    setNewFileName(file.name);
    setContextMenuFileId(null);
  };

  const handleConfirmRename = (fileId: string) => {
    if (newFileName.trim() && onFileRename) {
      onFileRename(fileId, newFileName.trim());
    }
    setRenamingFileId(null);
    setNewFileName('');
  };

  const handleCancelRename = () => {
    setRenamingFileId(null);
    setNewFileName('');
  };

  if (files.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <FolderOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No files in workspace</p>
        <p className="text-[10px] text-muted-foreground/80 mt-1">Add files using the source panel above</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-2">
        Workspace Files ({files.length})
      </div>
      
      <div className="space-y-0.5">
        {files.map((file) => (
          <div
            key={file.id}
            className={`
              group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer
              transition-all duration-150
              ${activeFileId === file.id 
                ? 'bg-primary/10 text-primary' 
                : 'hover:bg-accent/5 text-muted-foreground hover:text-foreground'
              }
            `}
            onClick={() => !renamingFileId && onFileSelect?.(file)}
          >
            {/* File Icon */}
            <div className="flex-shrink-0">
              {getFileIcon(file.type)}
            </div>

            {/* File Name or Rename Input */}
            {renamingFileId === file.id ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmRename(file.id);
                    if (e.key === 'Escape') handleCancelRename();
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-accent/10 border border-border rounded px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmRename(file.id);
                  }}
                  className="p-0.5 hover:bg-accent/10 rounded"
                >
                  <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelRename();
                  }}
                  className="p-0.5 hover:bg-accent/10 rounded"
                >
                  <X className="h-3 w-3 text-red-400" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{file.name}</div>
                  {file.isRemote && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {file.remoteUrl}
                    </div>
                  )}
                </div>

                {/* File Size */}
                {file.size && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                )}

                {/* Actions Menu */}
                <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenuFileId(contextMenuFileId === file.id ? null : file.id);
                    }}
                    className="p-1 hover:bg-accent/10 rounded"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>

                  {/* Context Menu */}
                  <AnimatePresence>
                    {contextMenuFileId === file.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-xl overflow-hidden z-50"
                        onMouseLeave={() => setContextMenuFileId(null)}
                      >
                        {/* // TOOD: Disabled for now */}
                        {/* <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(file);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/5 w-full text-left text-xs cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" />
                          Rename
                        </button> */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFileRemove?.(file.id);
                            setContextMenuFileId(null);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/5 w-full text-left text-xs text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};