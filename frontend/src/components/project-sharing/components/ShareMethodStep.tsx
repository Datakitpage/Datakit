import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Link2, ChevronRight } from 'lucide-react';

interface ShareMethodStepProps {
  workspaceSlug: string;
  onMethodSelect: (method: 'quick' | 'custom') => void;
}

export const ShareMethodStep: React.FC<ShareMethodStepProps> = ({
  workspaceSlug,
  onMethodSelect,
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
          How would you like to share?
        </h3>
        <p className="text-sm text-white/60">
          Choose your sharing method
        </p>
      </div>

      <div className="grid gap-4">
        {/* Quick Share Option */}
        <button
          onClick={() => onMethodSelect('quick')}
          className="group relative p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/20 rounded-xl hover:border-primary/50 transition-all duration-300"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-medium text-white mb-1">Quick Share</h4>
              <p className="text-sm text-white/60 mb-3">
                Get a shareable link instantly with default settings
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                <span className="text-xs font-mono text-white/80">
                  share.datakit.page/p/abc123
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-white/60 transition-colors" />
          </div>
        </button>

        {/* Custom URL Option - Disabled */}
        <div className="group relative p-6 bg-gradient-to-br from-gray-500/5 to-gray-600/5 border border-white/10 rounded-xl opacity-60">
          {/* Coming Soon Badge */}
          <div className="absolute top-3 right-3 px-2 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full">
            <span className="text-xs font-medium text-yellow-400">Coming Soon</span>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-500/20 rounded-lg">
              <Link2 className="h-6 w-6 text-gray-400" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-medium text-white/60 mb-1">Custom URL</h4>
              <p className="text-sm text-white/40 mb-3">
                Create a branded URL with your workspace name
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                <span className="text-xs font-mono text-white/50">
                  project.{workspaceSlug || 'workspace'}.datakit.page
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};