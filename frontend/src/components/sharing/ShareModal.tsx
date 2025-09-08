import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Users,
  Globe,
  Clock,
  Shield,
  AlertCircle,
  Loader2,
  Link2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useShareStore, ShareAccessType, ShareOptions } from '@/store/shareStore';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/auth/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, fileId }) => {
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const { files } = useAppStore();
  const {
    isSharing,
    shareProgress,
    shareError,
    currentShare,
    createShare,
    copyShareLink,
    clearShareError,
  } = useShareStore();

  const [accessType, setAccessType] = useState<ShareAccessType>(ShareAccessType.PUBLIC);
  const [emailList, setEmailList] = useState<string>('');
  const [expirationDays, setExpirationDays] = useState<number>(7);
  const [copied, setCopied] = useState(false);

  const file = files.find(f => f.id === fileId);

  useEffect(() => {
    if (shareError) {
      showError('Share Failed', shareError);
      clearShareError();
    }
  }, [shareError, showError, clearShareError]);

  const handleCreateShare = async () => {
    if (!file || !isAuthenticated) return;

    const options: ShareOptions = {
      accessType,
      requireAuth: true,
      expirationDays,
    };

    if (accessType === ShareAccessType.EMAIL_LIST && emailList) {
      const emails = emailList.split(',').map(e => e.trim()).filter(e => e);
      if (emails.length === 0) {
        showError('Invalid Emails', 'Please enter at least one valid email address');
        return;
      }
      options.allowedEmails = emails;
    }

    try {
      const share = await createShare(file.id, options);
      showSuccess(
        'Share Created!',
        'Your file has been shared successfully. Copy the link below.',
        { icon: 'link', duration: 5000 }
      );
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleCopyLink = async () => {
    if (!currentShare) return;

    await copyShareLink(currentShare.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    showSuccess('Link Copied!', 'Share link has been copied to clipboard', {
      icon: 'copy',
      duration: 3000,
    });
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatExpiryDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (!file) return null;

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="bg-black backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-medium text-white">Share File</h2>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {!currentShare ? (
                // Share creation form
                <div className="space-y-4">
                  {/* File info */}
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-sm font-medium text-white mb-2">File Details</h3>
                    <div className="space-y-1 text-xs text-white/70">
                      <div className="flex justify-between">
                        <span>Name:</span>
                        <span className="text-white/90">{file.fileName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span className="text-white/90">{formatFileSize(file.fileSize || 0)}</span>
                      </div>
                      {file.rowCount && (
                        <div className="flex justify-between">
                          <span>Rows:</span>
                          <span className="text-white/90">{file.rowCount.toLocaleString()}</span>
                        </div>
                      )}
                      {file.columnCount && (
                        <div className="flex justify-between">
                          <span>Columns:</span>
                          <span className="text-white/90">{file.columnCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Access type selector */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Access Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAccessType(ShareAccessType.PUBLIC)}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                          accessType === ShareAccessType.PUBLIC
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-white/20 text-white/70 hover:border-white/30'
                        }`}
                      >
                        <Globe size={16} />
                        <span className="text-xs">Public</span>
                      </button>
                      <button
                        onClick={() => setAccessType(ShareAccessType.EMAIL_LIST)}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                          accessType === ShareAccessType.EMAIL_LIST
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-white/20 text-white/70 hover:border-white/30'
                        }`}
                      >
                        <Users size={16} />
                        <span className="text-xs">Specific Users</span>
                      </button>
                    </div>
                  </div>

                  {/* Email list input */}
                  {accessType === ShareAccessType.EMAIL_LIST && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-sm font-medium text-white/90 mb-2">
                        Allowed Emails (comma-separated)
                      </label>
                      <textarea
                        value={emailList}
                        onChange={(e) => setEmailList(e.target.value)}
                        placeholder="user1@example.com, user2@example.com"
                        className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-primary resize-none"
                        rows={3}
                      />
                    </motion.div>
                  )}

                  {/* Expiration selector */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Link Expiration
                    </label>
                    <select
                      value={expirationDays}
                      onChange={(e) => setExpirationDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                      <option value={7}>7 days ({formatExpiryDate(7)})</option>
                      <option value={30}>30 days ({formatExpiryDate(30)})</option>
                      <option value={90}>90 days ({formatExpiryDate(90)})</option>
                    </select>
                  </div>

                  {/* Info box */}
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-primary mt-0.5" />
                      <div className="text-xs text-white/80">
                        <p className="font-medium text-white/90 mb-1">Secure Sharing</p>
                        <p>Recipients must be signed in to DataKit to access shared files.</p>
                      </div>
                    </div>
                  </div>

                  {/* Create button */}
                  <Button
                    variant="outline"
                    onClick={handleCreateShare}
                    disabled={isSharing}
                    className="w-full"
                  >
                    {isSharing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating Share... {Math.round(shareProgress)}%
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 mr-2" />
                        Create Share Link
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                // Share success view
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="h-6 w-6 text-green-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Share Created!</h3>
                    <p className="text-sm text-white/70">Your file is now accessible via the link below</p>
                  </div>

                  {/* Share link */}
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <label className="block text-xs font-medium text-white/70 mb-2">Share Link</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentShare.shareUrl}
                        readOnly
                        className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded text-xs text-white/90 font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                        className="px-3"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Share details */}
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-white/50" />
                      <span className="text-white/70">
                        Expires on {new Date(currentShare.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {currentShare.accessType === ShareAccessType.PUBLIC ? (
                        <>
                          <Globe className="h-3 w-3 text-white/50" />
                          <span className="text-white/70">Public (DataKit users only)</span>
                        </>
                      ) : (
                        <>
                          <Users className="h-3 w-3 text-white/50" />
                          <span className="text-white/70">Restricted to specific users</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(currentShare.shareUrl, '_blank')}
                      className="flex-1"
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Open Link
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="flex-1"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareModal;