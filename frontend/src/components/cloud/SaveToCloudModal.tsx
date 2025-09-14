import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  HardDrive,
  AlertCircle,
  CheckCircle,
  CloudOff,
  ArrowLeft,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCloudStore } from '@/store/cloudStore';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';

interface SaveToCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
}

type Step = 'project' | 'options' | 'upload';

const STEPS: Step[] = ['project', 'options', 'upload'];

const SaveToCloudModal: React.FC<SaveToCloudModalProps> = ({
  isOpen,
  onClose,
  fileId,
}) => {
  const { isAuthenticated } = useAuth();
  const { currentWorkspaceId } = useAuthStore();
  const { showSuccess, showError } = useNotifications();
  const { files } = useAppStore();
  const {
    cloudProjects,
    currentCloudProject,
    storageStats,
    isUploadingToCloud,
    uploadProgress,
    error,
    loadWorkspaceProjects,
    loadStorageStats,
    createCloudProject,
    saveToCloud,
    formatStorageSize,
    clearError,
  } = useCloudStore();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>('project');
  
  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [replaceIfExists, setReplaceIfExists] = useState(false);
  const [keepVersionHistory, setKeepVersionHistory] = useState(false);

  const file = files.find((f) => f.id === fileId);

  useEffect(() => {
    if (isOpen && isAuthenticated && currentWorkspaceId) {
      loadWorkspaceProjects(currentWorkspaceId);
      loadStorageStats();
    }
  }, [isOpen, isAuthenticated, currentWorkspaceId]);

  useEffect(() => {
    // Pre-select current cloud project or first available
    if (cloudProjects.length > 0 && !selectedProjectId) {
      const defaultProject =
        currentCloudProject?.id || cloudProjects[0].id;
      setSelectedProjectId(defaultProject);
    }
  }, [cloudProjects, currentCloudProject]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCurrentStep('project');
        setSelectedProjectId('');
        setIsCreatingProject(false);
        setNewProjectName('');
        setReplaceIfExists(false);
        setKeepVersionHistory(false);
      }, 300);
    }
  }, [isOpen]);

  const handleNext = () => {
    const stepIndex = STEPS.indexOf(currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepIndex = STEPS.indexOf(currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1]);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !currentWorkspaceId) return;

    try {
      const project = await createCloudProject(currentWorkspaceId, newProjectName);
      setSelectedProjectId(project.id);
      setIsCreatingProject(false);
      setNewProjectName('');
      showSuccess(
        'Project Created',
        `Created cloud project "${project.name}"`
      );
    } catch (error) {
      showError(
        'Failed to Create Project',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleStartUpload = () => {
    setCurrentStep('upload');
    handleSave();
  };

  const handleSave = async () => {
    if (!selectedProjectId || !file) return;

    try {
      await saveToCloud(fileId, selectedProjectId, {
        replaceIfExists,
        keepVersionHistory,
      });

      showSuccess(
        'Saved to Cloud',
        `${file.fileName} has been saved to cloud storage`,
        { duration: 5000 }
      );

      onClose();
    } catch (error) {
      showError(
        'Save Failed',
        error instanceof Error ? error.message : 'Failed to save to cloud'
      );
    }
  };

  const getStepProgress = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    return ((currentIndex + 1) / STEPS.length) * 100;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'project':
        return renderProjectStep();
      case 'options':
        return renderOptionsStep();
      case 'upload':
        return renderUploadStep();
      default:
        return null;
    }
  };

  if (!isOpen || !file) return null;

  const fileSize =
    typeof file.fileSize === 'bigint'
      ? Number(file.fileSize)
      : file.fileSize || 0;

  const storageUsedPercent = storageStats
    ? (parseInt(storageStats.totalStorageUsed) /
        parseInt(storageStats.storageLimit)) *
      100
    : 0;

  const willExceedLimit = storageStats
    ? parseInt(storageStats.totalStorageUsed) + fileSize >
      parseInt(storageStats.storageLimit)
    : false;

  const renderProjectStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-white mb-2">
          Select Project
        </h3>
        <p className="text-sm text-white/60">
          Choose where to save {file.fileName}
        </p>
      </div>

      {/* Storage Stats */}
      {storageStats && (
        <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Storage Usage</span>
            <span className="text-xs text-white/80">
              {formatStorageSize(storageStats.totalStorageUsed)} /{' '}
              {formatStorageSize(storageStats.storageLimit)}
            </span>
          </div>
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                storageUsedPercent > 90
                  ? 'bg-red-500'
                  : storageUsedPercent > 70
                  ? 'bg-yellow-500'
                  : 'bg-gradient-to-r from-primary to-blue-500'
              }`}
              style={{ width: `${storageUsedPercent}%` }}
            />
          </div>
          {willExceedLimit && (
            <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>This file will exceed your storage limit</span>
            </div>
          )}
        </div>
      )}

      {/* Project Selection */}
      <div className="space-y-3">
        {isCreatingProject ? (
          <div className="space-y-3">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCreatingProject(false);
                  setNewProjectName('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
              >
                Create Project
              </Button>
            </div>
          </div>
        ) : (
          <>
            {cloudProjects.length === 0 ? (
              <div className="text-center py-8 bg-white/5 rounded-lg border border-white/10">
                <CloudOff className="h-8 w-8 text-white/40 mx-auto mb-2" />
                <p className="text-sm text-white/60 mb-3">
                  No cloud projects yet
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsCreatingProject(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Project
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2">
                  {cloudProjects.map((project) => {
                                   const isSelected = selectedProjectId === project.id;

                    return (
                      <button
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/90">
                              {project.name}
                            </span>
                            {project.isDefault && (
                              <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-white/50">
                            <span>{project.fileCount} files</span>
                            <span>{formatStorageSize(project.storageUsed)}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setIsCreatingProject(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Project
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleNext}
          disabled={!selectedProjectId || willExceedLimit}
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );

  const renderOptionsStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-white mb-2">
          Save Options
        </h3>
        <p className="text-sm text-white/60">
          Configure how the file should be saved
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setReplaceIfExists(!replaceIfExists)}
          className="w-full flex items-start gap-3 p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          <div className={`h-4 w-4 rounded border-2 mt-0.5 transition-colors ${
            replaceIfExists ? 'bg-primary border-primary' : 'border-white/30'
          }`}>
            {replaceIfExists && (
              <CheckCircle className="h-3 w-3 text-black" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white mb-1">
              Replace if exists
            </div>
            <div className="text-xs text-white/50">
              Overwrite the file if it already exists in this project
            </div>
          </div>
        </button>

        <button
          onClick={() => setKeepVersionHistory(!keepVersionHistory)}
          disabled={!replaceIfExists}
          className={`w-full flex items-start gap-3 p-4 bg-white/5 rounded-lg border border-white/10 transition-colors text-left ${
            replaceIfExists ? 'hover:bg-white/10 cursor-pointer' : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <div className={`h-4 w-4 rounded border-2 mt-0.5 transition-colors ${
            keepVersionHistory && replaceIfExists ? 'bg-primary border-primary' : 'border-white/30'
          }`}>
            {keepVersionHistory && replaceIfExists && (
              <CheckCircle className="h-3 w-3 text-black m-0.5" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white mb-1">
              Keep version history
            </div>
            <div className="text-xs text-white/50">
              {replaceIfExists
                ? 'Save previous version before replacing'
                : "Enable 'Replace if exists' to use versioning"}
            </div>
          </div>
        </button>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button variant="outline" onClick={handleStartUpload} className="flex-1">
          Save to Cloud
          <Upload className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );

  const renderUploadStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-white mb-2">
          {isUploadingToCloud ? 'Uploading...' : 'Upload Complete!'}
        </h3>
        <p className="text-sm text-white/60">
          {isUploadingToCloud 
            ? `Saving ${file.fileName} to cloud storage`
            : `${file.fileName} has been saved successfully`
          }
        </p>
      </div>

      {/* Upload Progress */}
      {isUploadingToCloud && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Progress</span>
            <span className="text-white/80">
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-slate-500 via-cyan-500 to-green-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* File info */}
      <div className="p-4 bg-white/5 rounded-lg border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <HardDrive className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{file.fileName}</div>
            <div className="text-xs text-white/60">
              Size: {formatStorageSize(fileSize)}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {!isUploadingToCloud && (
        <Button variant="primary" onClick={onClose} className="w-full">
          Done
        </Button>
      )}
    </motion.div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-black backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Progress */}
          <div className="relative">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-slate-400 via-teal-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${getStepProgress()}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              disabled={isUploadingToCloud}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10 disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 pt-12">
            <AnimatePresence mode="wait">
              {renderStepContent()}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SaveToCloudModal;
