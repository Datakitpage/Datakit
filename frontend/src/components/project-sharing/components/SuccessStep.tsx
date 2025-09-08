import React from 'react';
import { motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProjectShare } from '@/lib/api/projectSharingService';

interface SuccessStepProps {
  currentShare: ProjectShare;
  expirationDays: number;
  copied: boolean;
  onCopyLink: () => void;
  onClose: () => void;
}

export const SuccessStep: React.FC<SuccessStepProps> = ({
  currentShare,
  expirationDays,
  copied,
  onCopyLink,
  onClose,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      {/* Success Animation */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Check className="h-10 w-10 text-green-400" />
        </motion.div>
        <h3 className="text-xl font-medium text-white mb-2">
          Successfully Shared!
        </h3>
        <p className="text-sm text-white/60">
          Your project is now accessible via the link below
        </p>
      </div>

      {/* Share Link */}
      <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="text-xs text-white/60 mb-1">Share URL</div>
            <div className="font-mono text-sm text-white break-all">
              {currentShare.shareUrl}
            </div>
          </div>
          <button
            onClick={onCopyLink}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4 text-white/60" />
            )}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">0</div>
            <div className="text-xs text-white/60">Views</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">
              {currentShare.permissions.length}
            </div>
            <div className="text-xs text-white/60">Permissions</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">
              {expirationDays || '∞'}
            </div>
            <div className="text-xs text-white/60">Days</div>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={onClose}
        className="w-full"
      >
        Done
      </Button>
    </motion.div>
  );
};