import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, User, Shield } from 'lucide-react';

interface SuccessSnackbarProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: 'check' | 'user' | 'shield';
  duration?: number; // Auto-close duration in ms
}

const SuccessSnackbar: React.FC<SuccessSnackbarProps> = ({
  isVisible,
  onClose,
  title,
  message,
  icon = 'check',
  duration = 5000,
}) => {
  React.useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const getIcon = () => {
    switch (icon) {
      case 'user':
        return <User className="w-4 h-4 text-green-400" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-green-400" />;
      case 'check':
      default:
        return <Check className="w-4 h-4 text-green-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -50, x: 20 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 25,
            opacity: { duration: 0.3 }
          }}
          className="max-w-sm"
        >
          <div className="bg-popover border border-green-500/20 rounded-lg shadow-2xl p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                {getIcon()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-sm text-foreground mb-1">
                      {title}
                    </h4>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {message}
                    </p>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-2 flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {duration > 0 && (
              <div className="mt-3 h-0.5 bg-border rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: duration / 1000, ease: "linear" }}
                  className="h-full bg-green-500/50"
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessSnackbar;