import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Download,
  Trash2,
  MoreVertical,
  FileText,
  Activity,
  Clock,
  Loader2,
  CloudOff,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCloudStore, CloudFile } from '@/store/cloudStore';
import { useAuth } from '@/hooks/auth/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ShareProjectModal } from '@/components/project-sharing/ShareProjectModal';
import { useProjectSharingStore } from '@/store/projectSharingStore';

interface CloudFilesListProps {
  onFileLoad?: (file: CloudFile) => void;
}

export const CloudFilesList: React.FC<CloudFilesListProps> = ({ onFileLoad }) => {
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const {
    cloudFiles,
    currentCloudProject,
    isLoading,
    loadCloudFiles,
    loadFromCloud,
    deleteFromCloud,
    formatStorageSize,
  } = useCloudStore();

  // Load cloud files when project changes
  useEffect(() => {
    if (isAuthenticated && currentCloudProject) {
      loadCloudFiles(currentCloudProject.id);
    }
  }, [isAuthenticated, currentCloudProject?.id]);

  const handleLoadFile = async (file: CloudFile) => {
    setLoadingFileId(file.id);
    try {
      await loadFromCloud(file.id);
      showSuccess(
        'File Loaded',
        `${file.fileName} has been loaded from cloud`,
        { duration: 3000 }
      );
      if (onFileLoad) {
        onFileLoad(file);
      }
    } catch (error) {
      showError(
        'Load Failed',
        error instanceof Error ? error.message : 'Failed to load file'
      );
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleDeleteFile = async (file: CloudFile) => {
    const confirmed = confirm(`Delete "${file.fileName}" from cloud storage? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingFileId(file.id);
    try {
      await deleteFromCloud(file.id);
      showSuccess(
        'File Deleted',
        `${file.fileName} has been deleted from cloud`,
        { duration: 3000 }
      );
    } catch (error) {
      showError(
        'Delete Failed',
        error instanceof Error ? error.message : 'Failed to delete file'
      );
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleRefresh = async () => {
    if (currentCloudProject) {
      await loadCloudFiles(currentCloudProject.id);
    }
  };

  const formatLastAccessed = (date?: Date) => {
    if (!date) return 'Never';
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('csv') || mimeType.includes('text')) {
      return <FileText className="h-4 w-4 text-green-400" />;
    }
    return <FileText className="h-4 w-4 text-blue-400" />;
  };

  if (!isAuthenticated) {
    return (
      <div className="px-5 py-8 text-center">
        <CloudOff className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/60 mb-2">Sign in to access cloud files</p>
        <p className="text-xs text-white/40">
          Your files will sync across all devices
        </p>
      </div>
    );
  }

  if (!currentCloudProject) {
    return (
      <div className="px-5 py-8 text-center">
        <Cloud className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/60 mb-2">No cloud workspace selected</p>
        <p className="text-xs text-white/40">
          Select or create a cloud workspace to see files
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-5 py-8 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
        <p className="text-[11px] text-white/60">Loading cloud files...</p>
      </div>
    );
  }

  const projectFiles = cloudFiles.filter(f => f.projectId === currentCloudProject.id);

  if (projectFiles.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <Cloud className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/60 mb-2">No files in this workspace</p>
        <p className="text-xs text-white/40">
          Save files to cloud to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-2 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-white/80">
              Cloud Files ({projectFiles.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* TODO: To be introduced later on */}
            {/*  */}
            {/* <button
              onClick={() => setShowShareModal(true)}
              className="p-1 hover:bg-white/10 rounded transition-colors group"
              title="Share project"
            >
              <Share2 className="h-3 w-3 text-white/60 group-hover:text-primary" />
            </button> */}
            <button
              onClick={handleRefresh}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Refresh cloud files"
            >
              <RefreshCw className="h-3 w-3 text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {projectFiles.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="group border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <div className="px-5 py-3">
                {/* Main File Row */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleLoadFile(file)}
                    disabled={loadingFileId === file.id || deletingFileId === file.id}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    {/* File Icon */}
                    <div className="relative">
                      {getFileIcon(file.mimeType)}
                      {file.metadata?.compressed && (
                        <div className="absolute -bottom-1 -right-1 h-2 w-2 bg-purple-500 rounded-full" />
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-white/90 truncate max-w-[160px]" title={file.fileName}>
                          {file.fileName}
                        </span>
                        {file.status === 'synced' && (
                          <Activity className="h-2 w-2 text-green-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-white/40">
                        <span>{formatStorageSize(file.fileSize)}</span>
                        {file.metadata?.rowCount && file.metadata?.columnCount && (
                          <span>{file.metadata.rowCount.toLocaleString()} × {file.metadata.columnCount}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {loadingFileId === file.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : deletingFileId === file.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                    ) : (
                      <>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"
                          title="Delete from cloud"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400/60" />
                        </button>
                        <button
                          onClick={() => setExpandedFileId(
                            expandedFileId === file.id ? null : file.id
                          )}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"
                          title="More info"
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-white/60" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedFileId === file.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                        <div className="flex items-center gap-2 text-[9px] text-white/50">
                          <Clock className="h-2.5 w-2.5" />
                          <span>Last accessed: {formatLastAccessed(file.lastAccessedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-white/50">
                          <Activity className="h-2.5 w-2.5" />
                          <span>Last synced: {formatLastAccessed(file.lastSyncedAt)}</span>
                        </div>
                        {file.metadata?.tableName && (
                          <div className="flex items-center gap-2 text-[9px] text-white/50">
                            <FileText className="h-2.5 w-2.5" />
                            <span>Table: {file.metadata.tableName}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Share Project Modal */}
      {currentCloudProject && (
        <ShareProjectModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          projectId={currentCloudProject.id}
          projectName={currentCloudProject.name}
        />
      )}
    </div>
  );
};