import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, Download, Database, Sparkles, Check, Lock, Globe, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SharePermission, ShareAccessType } from '@/lib/api/projectSharingService';

interface PermissionsStepProps {
  permissions: SharePermission[];
  onPermissionChange: (permissions: SharePermission[]) => void;
  accessType: ShareAccessType;
  onAccessTypeChange: (accessType: ShareAccessType) => void;
  allowedEmails: string;
  onAllowedEmailsChange: (emails: string) => void;
  expirationDays: number;
  onExpirationChange: (days: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export const PermissionsStep: React.FC<PermissionsStepProps> = ({
  permissions,
  onPermissionChange,
  accessType,
  onAccessTypeChange,
  allowedEmails,
  onAllowedEmailsChange,
  expirationDays,
  onExpirationChange,
  onBack,
  onNext,
}) => {
  const handlePermissionToggle = (permission: SharePermission, isRequired = false) => {
    if (isRequired) return;
    
    if (permissions.includes(permission)) {
      onPermissionChange(permissions.filter(p => p !== permission));
    } else {
      onPermissionChange([...permissions, permission]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-white mb-2">
          Set permissions
        </h3>
        <p className="text-sm text-white/60">
          Control what viewers can do with your data
        </p>
      </div>

      {/* Permission Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            id: SharePermission.VIEW,
            icon: Eye,
            title: 'View',
            description: 'See data & charts',
            required: true,
            color: 'blue',
          },
          {
            id: SharePermission.EXPORT,
            icon: Download,
            title: 'Export',
            description: 'Download files',
            color: 'green',
          },
          {
            id: SharePermission.QUERY,
            icon: Database,
            title: 'Query',
            description: 'Run SQL queries',
            color: 'purple',
          },
          {
            id: SharePermission.AI,
            icon: Sparkles,
            title: 'AI Analysis',
            description: 'Use AI features',
            color: 'pink',
          },
        ].map((perm) => (
          <button
            key={perm.id}
            onClick={() => handlePermissionToggle(perm.id, perm.required)}
            disabled={perm.required}
            className={`
              relative p-4 rounded-lg border transition-all duration-200
              ${permissions.includes(perm.id)
                ? `bg-${perm.color}-500/10 border-${perm.color}-500/30`
                : 'bg-white/5 border-white/10 hover:border-white/20'
              }
              ${perm.required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex flex-col items-center gap-2">
              <perm.icon className={`h-5 w-5 ${
                permissions.includes(perm.id) ? `text-${perm.color}-400` : 'text-white/60'
              }`} />
              <div>
                <div className="text-sm font-medium text-white">
                  {perm.title}
                </div>
                <div className="text-xs text-white/50">
                  {perm.description}
                </div>
              </div>
            </div>
            {permissions.includes(perm.id) && (
              <div className="absolute top-2 right-2">
                <Check className="h-3 w-3 text-green-400" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Access Level */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white">Who can access?</label>
        <div className="grid grid-cols-1 gap-3">
          {/* All DataKit Users */}
          <button
            onClick={() => onAccessTypeChange(ShareAccessType.AUTHENTICATED)}
            className={`
              p-3 rounded-lg border transition-all duration-200 text-left
              ${accessType === ShareAccessType.AUTHENTICATED
                ? 'bg-primary/10 border-primary/30'
                : 'bg-white/5 border-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-white/60 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-white">All DataKit Users</div>
                <div className="text-xs text-white/50">Anyone with a DataKit account can access</div>
              </div>
            </div>
          </button>

          {/* Specific DataKit Users */}
          <button
            onClick={() => onAccessTypeChange(ShareAccessType.EMAIL_LIST)}
            className={`
              p-3 rounded-lg border transition-all duration-200 text-left
              ${accessType === ShareAccessType.EMAIL_LIST
                ? 'bg-primary/10 border-primary/30'
                : 'bg-white/5 border-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-white/60 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-white">Specific DataKit Users</div>
                <div className="text-xs text-white/50">Only specific email addresses can access</div>
              </div>
            </div>
          </button>

          {/* Public Access */}
          <button
            onClick={() => onAccessTypeChange(ShareAccessType.PUBLIC)}
            className={`
              p-3 rounded-lg border transition-all duration-200 text-left
              ${accessType === ShareAccessType.PUBLIC
                ? 'bg-primary/10 border-primary/30'
                : 'bg-white/5 border-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-white/60 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-white">Anyone with the link</div>
                <div className="text-xs text-white/50">Public access (not recommended for sensitive data)</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Email Input for Specific Users */}
      {accessType === ShareAccessType.EMAIL_LIST && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-white">Allowed Email Addresses</label>
          <textarea
            value={allowedEmails}
            onChange={(e) => onAllowedEmailsChange(e.target.value)}
            placeholder="user1@company.com, user2@company.com, user3@company.com"
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-primary/50 resize-none"
            rows={3}
          />
          <p className="text-xs text-white/60">
            Separate multiple email addresses with commas. Only users with DataKit accounts using these emails can access.
          </p>
        </div>
      )}

      {/* Expiration */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white">Link expires in</label>
        <select
          value={expirationDays}
          onChange={(e) => onExpirationChange(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-primary/50"
        >
          <option value={1}>1 day</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={0}>Never</option>
        </select>
      </div>

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
          variant="primary"
          onClick={onNext}
          className="flex-1"
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
};