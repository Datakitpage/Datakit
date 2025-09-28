import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface QuickActionsBarProps {
  fileName: string;
  lastAnalyzed?: Date;
}

const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  fileName,
  lastAnalyzed,
}) => {
  const [actionStatus] = useState<{
    action: string;
    status: 'success' | 'error';
    message: string;
  } | null>(null);

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-background/50 backdrop-blur-sm">
      {/* Left side - File info */}
      <div className="flex items-center gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{fileName}</div>
          {lastAnalyzed && (
            <div className="text-xs text-muted-foreground">
              Last analyzed: {lastAnalyzed.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <AnimatePresence>
          {actionStatus && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
                actionStatus.status === 'success'
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/20 border-red-500/30 text-red-300'
              )}
            >
              {actionStatus.status === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {actionStatus.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuickActionsBar;
