import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ShareAccessType, SharePermission } from '@/lib/api/projectSharingService';

interface ReviewStepProps {
  projectName: string;
  shareMethod: 'quick' | 'custom';
  projectSlug?: string;
  workspaceSlug: string;
  accessType: ShareAccessType;
  allowedEmails: string;
  permissions: SharePermission[];
  expirationDays: number;
  isSharing: boolean;
  onBack: () => void;
  onCreateShare: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  projectName,
  shareMethod,
  projectSlug,
  workspaceSlug,
  accessType,
  allowedEmails,
  permissions,
  expirationDays,
  isSharing,
  onBack,
  onCreateShare,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-white mb-2">
          Review & Share
        </h3>
        <p className="text-sm text-white/60">
          Confirm your sharing settings
        </p>
      </div>

      {/* Summary Card */}
      <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/20 rounded-xl space-y-4">
        {/* Project Info */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <div className="text-xs text-white/60 mb-1">Sharing</div>
            <div className="font-medium text-white">{projectName}</div>
          </div>
          <div className="px-3 py-1 bg-primary/20 rounded-full">
            <span className="text-xs font-medium text-primary">
              {shareMethod === 'custom' ? 'Custom URL' : 'Quick Share'}
            </span>
          </div>
        </div>

        {/* URL Preview */}
        {shareMethod === 'custom' && projectSlug && (
          <div>
            <div className="text-xs text-white/60 mb-2">Your custom URL</div>
            <div className="px-3 py-2 bg-black/30 rounded-lg">
              <span className="font-mono text-sm text-white/90">
                {projectSlug}.{workspaceSlug}.datakit.page
              </span>
            </div>
          </div>
        )}

        {/* Settings Summary */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/60">Access:</span>
            <span className="text-white">
              {accessType === ShareAccessType.PUBLIC 
                ? 'Anyone' 
                : accessType === ShareAccessType.EMAIL_LIST 
                ? 'Specific Users' 
                : 'All DataKit Users'}
            </span>
          </div>
          
          {accessType === ShareAccessType.EMAIL_LIST && allowedEmails && (
            <div>
              <div className="text-white/60 mb-2">Allowed emails:</div>
              <div className="px-3 py-2 bg-black/30 rounded text-xs font-mono text-white/80 max-h-20 overflow-y-auto">
                {allowedEmails.split(',').map((email, index) => (
                  <div key={index}>{email.trim()}</div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-white/60">Expires:</span>
            <span className="text-white">
              {expirationDays === 0 ? 'Never' : `${expirationDays} days`}
            </span>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <div className="text-xs text-white/60 mb-2">Permissions</div>
          <div className="flex flex-wrap gap-2">
            {permissions.map(perm => (
              <div key={perm} className="px-2 py-1 bg-white/10 rounded text-xs text-white/80">
                {perm.charAt(0).toUpperCase() + perm.slice(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Warning for public access */}
      {accessType === ShareAccessType.PUBLIC && (
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
          <div className="text-xs text-white/70">
            <p className="font-medium text-yellow-400 mb-1">Public Access</p>
            <p>Anyone with the link can access this project. Make sure it doesn't contain sensitive data.</p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          variant="outline"
          onClick={onCreateShare}
          disabled={isSharing}
          className="flex-1"
        >
          {isSharing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating...
            </>
          ) : (
            <>
              Create Share Link
              <Check className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};