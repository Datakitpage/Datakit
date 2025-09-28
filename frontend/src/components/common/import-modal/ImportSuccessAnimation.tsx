import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, FileSpreadsheet } from 'lucide-react';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';

interface ImportSuccessAnimationProps {
  isVisible: boolean;
  onAnimationComplete?: () => void;
  fileName?: string;
  rowCount?: number;
}

const ImportSuccessAnimation: React.FC<ImportSuccessAnimationProps> = ({
  isVisible,
  onAnimationComplete,
  fileName = 'Google Sheet',
  rowCount = 0
}) => {
  // Call onAnimationComplete after animation finishes
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onAnimationComplete?.();
      }, 3000); // Animation + display time
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onAnimationComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-background/60"
        >
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="bg-popover rounded-lg border border-border shadow-xl overflow-hidden w-full max-w-sm"
          >
            {/* Success icon */}
            <div className="flex justify-center pt-6 pb-2">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 15,
                  delay: 0.2
                }}
                className="bg-green-500/20 rounded-full h-16 w-16 flex items-center justify-center"
              >
                <GoogleSheetsIcon className="h-8 w-8 text-green-500" />
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.2 }}
                  className="absolute -bottom-1 -right-1 bg-green-500 rounded-full h-6 w-6 flex items-center justify-center border-2 border-popover"
                >
                  <Check className="h-3.5 w-3.5 text-foreground" />
                </motion.div>
              </motion.div>
            </div>
            
            {/* Success message */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="px-6 pt-2 pb-5 text-center"
            >
              <h3 className="text-lg font-medium text-foreground font-heading">Import Successful!</h3>
              <p className="mt-1 text-muted-foreground text-sm">
                {fileName} has been imported successfully
              </p>
              
              {rowCount > 0 && (
                <div className="mt-3 inline-flex items-center bg-accent/10 px-3 py-1.5 rounded text-sm">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-foreground/90">{rowCount.toLocaleString()} rows imported</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImportSuccessAnimation;