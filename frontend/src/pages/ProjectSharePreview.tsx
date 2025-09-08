import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download,
  FileText,
  Users,
  Clock,
  Eye,
  AlertTriangle,
  Loader2,
  ExternalLink,
  CheckCircle,
  Database,
  Calendar,
  HardDrive,
  Lock,
  Globe,
  Shield,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/auth/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useProjectSharingStore } from '@/store/projectSharingStore';
import { SharePermission } from '@/lib/api/projectSharingService';
import AuthModal from '@/components/auth/AuthModal';

const ProjectSharePreview: React.FC = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useNotifications();

  const {
    currentSharePreview,
    currentShareAccess,
    isLoading,
    shareError,
    getSharePreview,
    accessSharedProject,
    clearShareError,
  } = useProjectSharingStore();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAccessing, setIsAccessing] = useState(false);

  useEffect(() => {
    if (identifier) {
      loadSharePreview();
    }
  }, [identifier]);

  const loadSharePreview = async () => {
    if (!identifier) return;

    clearShareError();
    try {
      await getSharePreview(identifier);
    } catch (error) {
      console.error('[ProjectSharePreview] Error loading preview:', error);
    }
  };

  const handleAccessProject = async () => {
    if (!identifier || !currentSharePreview) return;

    // Check if authentication is required
    if (currentSharePreview.requireAuth && !isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setIsAccessing(true);

    try {
      const accessResult = await accessSharedProject(identifier);
      
      if (!accessResult.accessGranted) {
        showError('Access Denied', accessResult.message || 'You do not have permission to access this project');
        return;
      }

      // Success - navigate to main app with shared project data
      showSuccess(
        'Accessing Project',
        'The shared project is being loaded into DataKit',
        { icon: 'download', duration: 4000 }
      );

      // Navigate to main app with share data
      navigate('/', { 
        state: { 
          sharedProject: accessResult.projectData,
          shareMetadata: {
            shareId: currentSharePreview.shareId,
            projectName: currentSharePreview.projectName,
            workspaceName: currentSharePreview.workspaceName,
            permissions: currentSharePreview.permissions,
          }
        }
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to access project';
      showError('Access Failed', message);
    } finally {
      setIsAccessing(false);
    }
  };

  const formatFileSize = (sizeStr: string) => {
    const bytes = parseInt(sizeStr);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getPermissionIcon = (permission: SharePermission) => {
    switch (permission) {
      case SharePermission.VIEW: return Eye;
      case SharePermission.EXPORT: return Download;
      case SharePermission.QUERY: return Database;
      case SharePermission.AI: return Sparkles;
    }
  };

  const getPermissionLabel = (permission: SharePermission) => {
    switch (permission) {
      case SharePermission.VIEW: return 'View Data';
      case SharePermission.EXPORT: return 'Download Files';
      case SharePermission.QUERY: return 'Query Data';
      case SharePermission.AI: return 'AI Analysis';
    }
  };

  const getAccessTypeIcon = () => {
    if (!currentSharePreview) return Globe;
    
    switch (currentSharePreview.accessType) {
      case 'public': return Globe;
      case 'authenticated': return Shield;
      case 'email_list': return Users;
      default: return Globe;
    }
  };

  const getAccessTypeLabel = () => {
    if (!currentSharePreview) return 'Public';
    
    switch (currentSharePreview.accessType) {
      case 'public': return 'Public Access';
      case 'authenticated': return 'Requires DataKit Account';
      case 'email_list': return 'Restricted Access';
      default: return 'Public Access';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-white/60">Loading shared project...</p>
        </div>
      </div>
    );
  }

  if (shareError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center"
        >
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Project Not Found</h1>
          <p className="text-white/60 mb-6">{shareError}</p>
          <Button
            variant="primary"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Return to DataKit
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!currentSharePreview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  const customBranding = currentSharePreview.settings?.customBranding;
  const title = customBranding?.title || `${currentSharePreview.projectName} - DataKit`;
  const description = customBranding?.description || 
    `Shared data project from ${currentSharePreview.workspaceName}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent"
            >
              {title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-white/70 mb-6"
            >
              {description}
            </motion.p>

            {currentSharePreview.settings?.showOwnerInfo && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-full"
              >
                <Users className="h-4 w-4 text-primary" />
                <span className="text-white/80">
                  Shared by <span className="font-medium text-white">{currentSharePreview.workspaceName}</span>
                </span>
              </motion.div>
            )}
          </div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
          >
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{currentSharePreview.fileCount}</div>
              <div className="text-sm text-white/60">Files</div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 text-center">
              <HardDrive className="h-8 w-8 text-blue-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{currentSharePreview.totalSize}</div>
              <div className="text-sm text-white/60">Total Size</div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 text-center">
              <Calendar className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">
                {new Date(currentSharePreview.lastUpdated).toLocaleDateString()}
              </div>
              <div className="text-sm text-white/60">Last Updated</div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 text-center">
              {React.createElement(getAccessTypeIcon(), {
                className: "h-8 w-8 text-yellow-400 mx-auto mb-3"
              })}
              <div className="text-lg font-bold text-white mb-1">{getAccessTypeLabel()}</div>
              <div className="text-sm text-white/60">Access Level</div>
            </div>
          </motion.div>

          {/* Permissions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 mb-8"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              What you can do with this project
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {currentSharePreview.permissions.map((permission) => {
                const Icon = getPermissionIcon(permission);
                return (
                  <div
                    key={permission}
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-sm text-white/80">
                      {getPermissionLabel(permission)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Files Preview */}
          {currentSharePreview.files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 mb-8"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Files in this project ({currentSharePreview.files.length})
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {currentSharePreview.files.map((file, index) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-white font-medium">{file.fileName}</div>
                        <div className="text-xs text-white/60">
                          {formatFileSize(file.fileSize)}
                          {file.metadata?.rowCount && (
                            <> • {file.metadata.rowCount} rows</>
                          )}
                          {file.metadata?.columnCount && (
                            <> • {file.metadata.columnCount} columns</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-white/50">
                      {new Date(file.lastModified).toLocaleDateString()}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Authentication Warning */}
          {currentSharePreview.requireAuth && !isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 mb-8"
            >
              <div className="flex items-start gap-3">
                <Lock className="h-6 w-6 text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-yellow-200 mb-2">
                    Authentication Required
                  </h3>
                  <p className="text-yellow-100/80 mb-4">
                    This project requires you to sign in to DataKit to access the data and files.
                  </p>
                  <div className="text-sm text-yellow-100/60">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4" />
                      <span>Free DataKit account required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Secure access to shared data</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Expiration Warning */}
          {currentSharePreview.isExpired && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-8"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-400" />
                <div>
                  <h3 className="text-lg font-semibold text-red-200 mb-1">
                    Share Expired
                  </h3>
                  <p className="text-red-100/80">
                    This shared project has expired and is no longer accessible.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Access Button */}
          {!currentSharePreview.isExpired && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-center"
            >
              <Button
                variant="primary"
                size="lg"
                onClick={handleAccessProject}
                disabled={isAccessing}
                className="px-8 py-4 text-lg font-semibold min-w-64"
              >
                {isAccessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Accessing...
                  </>
                ) : currentSharePreview.requireAuth && !isAuthenticated ? (
                  <>
                    <Lock className="h-5 w-5 mr-2" />
                    Sign In to Access Project
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Access Project Data
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center mt-12 pt-8 border-t border-white/10"
          >
            <p className="text-white/40 text-sm mb-2">
              Powered by{' '}
              <a 
                href="https://datakit.page" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors font-medium"
              >
                DataKit
              </a>
            </p>
            <p className="text-white/30 text-xs">
              Shared on {new Date(currentSharePreview.createdAt).toLocaleDateString()}
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signin"
      />
    </div>
  );
};

export default ProjectSharePreview;