import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StorageStats {
  totalStorageUsed: number;
  storageLimit: number;
  storagePercentage: number;
}

interface ProjectHeaderProps {
  isAuthenticated: boolean;
  nonDraftProjectCount: number;
  storageStats?: StorageStats | null;
  formatStorageSize: (size: number) => string;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  isAuthenticated,
  nonDraftProjectCount,
  storageStats,
  formatStorageSize,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="p-4 border-b border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white tracking-wide">
            Projects
          </h3>
          {!isAuthenticated && nonDraftProjectCount >= 1 && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-400/10 text-amber-400 rounded">
              {nonDraftProjectCount}/1
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <HelpCircle className="h-4 w-4 text-white/50" />
          </button>

          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-64 bg-stone-900 border border-white/20 rounded-lg p-3 text-xs text-white/80 shadow-xl z-50"
              >
                <div className="space-y-2">
                  <p>
                    <strong className="text-white">Projects</strong>{' '}
                    organize your data projects. Your files stay private - we only store references.
                  </p>
                  <p>
                    <strong className="text-primary">Draft:</strong>{' '}
                    Your temporary projects. Save it when you're ready to keep your work.
                  </p>
                  <p>
                    <strong className="text-purple-400">Cloud:</strong>{' '}
                    Access your data from anywhere. Perfect for collaboration and backup.
                  </p>
                  {!isAuthenticated && (
                    <p>
                      <strong className="text-amber-400">
                        Free Plan:
                      </strong>{' '}
                      1 workspace limit.{' '}
                      <span className="text-primary hover:underline cursor-pointer">Sign up</span>{' '}
                      for unlimited projects + cloud storage.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="text-xs text-white/60 leading-relaxed">
        Keep your data projects organized. Switch between datasets instantly.
      </p>

      {/* TODO: Next iterations */}
      {/*  */}
      {isAuthenticated && storageStats && (
        <div className="mt-3 p-2 bg-white/5 rounded-lg">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/60">Cloud Storage</span>
            <span className="text-white/80">
              {formatStorageSize(storageStats.totalStorageUsed)} / {formatStorageSize(storageStats.storageLimit)}
            </span>
          </div>
          <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                storageStats.storagePercentage > 90 ? 'bg-red-500' : 
                storageStats.storagePercentage > 70 ? 'bg-yellow-500' : 'bg-gradient-to-r from-primary to-blue-500'
              }`}
              style={{ width: `${storageStats.storagePercentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};