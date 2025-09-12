import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  projectSharingService,
  CreateProjectShareDto,
  ShareAccessType,
  SharePermission,
  ProjectShare,
} from '@/lib/api/projectSharingService';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/authStore';
import {
  ShareMethodStep,
  PermissionsStep,
  ReviewStep,
  SuccessStep,
} from './components';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

type ShareMethod = 'quick' | 'custom';
type Step = 'method' | 'permissions' | 'review' | 'success';

const STEPS: Step[] = ['method', 'permissions', 'review', 'success'];

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const { showSuccess, showError } = useNotifications();
  const { currentWorkspace } = useAuthStore();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>('method');
  const [shareMethod, setShareMethod] = useState<ShareMethod | null>(null);
  
  // Form state
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [accessType, setAccessType] = useState<ShareAccessType>(ShareAccessType.AUTHENTICATED);
  const [allowedEmails, setAllowedEmails] = useState('');
  const [permissions, setPermissions] = useState<SharePermission[]>([
    SharePermission.VIEW,
    SharePermission.EXPORT,
  ]);
  const [expirationDays, setExpirationDays] = useState<number>(7);
  
  // UI state
  const [isSharing, setIsSharing] = useState(false);
  const [currentShare, setCurrentShare] = useState<ProjectShare | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize workspace slug from workspace settings or name
  useEffect(() => {
    if (currentWorkspace && !workspaceSlug) {
      // Use existing workspace slug if available, otherwise generate from name
      const slug = currentWorkspace.slug || currentWorkspace.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setWorkspaceSlug(slug);
    }
  }, [currentWorkspace, workspaceSlug]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCurrentStep('method');
        setShareMethod(null);
        setAllowedEmails('');
        setCurrentShare(null);
        setCopied(false);
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

  const handleMethodSelect = (method: ShareMethod) => {
    setShareMethod(method);
    // For now, only quick share is available
    if (method === 'quick') {
      setCurrentStep('permissions');
    }
  };

  const handleCreateShare = async () => {
    setIsSharing(true);
    try {
      const dto: CreateProjectShareDto = {
        projectId,
        // Custom URL disabled for now
        customSlug: undefined,
        accessType,
        allowedEmails: accessType === ShareAccessType.EMAIL_LIST && allowedEmails ? 
          allowedEmails.split(',').map(email => email.trim()).filter(email => email) : undefined,
        requireAuth: accessType !== ShareAccessType.PUBLIC,
        permissions,
        expiresAt: expirationDays > 0 ? 
          new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
        settings: {
          showOwnerInfo: true,
          allowDownload: permissions.includes(SharePermission.EXPORT),
          allowQueryExecution: permissions.includes(SharePermission.QUERY),
          allowAIUsage: permissions.includes(SharePermission.AI),
        },
      };

      const share = await projectSharingService.createProjectShare(dto);
      setCurrentShare(share);
      setCurrentStep('success');
      
      showSuccess(
        'Project Shared!',
        'Your sharing link has been created successfully',
        { icon: 'link', duration: 5000 }
      );
    } catch (error) {
      showError(
        'Share Failed',
        error instanceof Error ? error.message : 'Failed to create share'
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!currentShare) return;
    
    await projectSharingService.copyShareLink(currentShare.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    showSuccess('Link Copied!', 'Share link copied to clipboard', {
      icon: 'copy',
      duration: 3000,
    });
  };

  const getStepProgress = () => {
    if (currentStep === 'success') return 100;
    const currentIndex = STEPS.indexOf(currentStep);
    const totalSteps = 3; // method, permissions, review (custom URL disabled)
    return ((currentIndex + 1) / totalSteps) * 100;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'method':
        return (
          <ShareMethodStep
            workspaceSlug={workspaceSlug}
            onMethodSelect={handleMethodSelect}
          />
        );

      case 'permissions':
        return (
          <PermissionsStep
            permissions={permissions}
            onPermissionChange={setPermissions}
            accessType={accessType}
            onAccessTypeChange={setAccessType}
            allowedEmails={allowedEmails}
            onAllowedEmailsChange={setAllowedEmails}
            expirationDays={expirationDays}
            onExpirationChange={setExpirationDays}
            onBack={handleBack}
            onNext={handleNext}
          />
        );

      case 'review':
        return (
          <ReviewStep
            projectName={projectName}
            shareMethod={shareMethod!}
            workspaceSlug={workspaceSlug}
            accessType={accessType}
            allowedEmails={allowedEmails}
            permissions={permissions}
            expirationDays={expirationDays}
            isSharing={isSharing}
            onBack={handleBack}
            onCreateShare={handleCreateShare}
          />
        );

      case 'success':
        return currentShare ? (
          <SuccessStep
            currentShare={currentShare}
            expirationDays={expirationDays}
            copied={copied}
            onCopyLink={handleCopyLink}
            onClose={onClose}
          />
        ) : null;

      default:
        return null;
    }
  };

  if (!isOpen) return null;

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
                className="h-full bg-gradient-to-r from-primary to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${getStepProgress()}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10"
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