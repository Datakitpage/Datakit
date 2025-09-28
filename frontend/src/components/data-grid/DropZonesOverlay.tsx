import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';

interface DropZonesOverlayProps {
  isDragging: boolean;
  draggedTabId?: string;
  onDropLeft: () => void;
  onDropRight: () => void;
  className?: string;
}

const DropZonesOverlay: React.FC<DropZonesOverlayProps> = ({
  isDragging,
  onDropLeft,
  onDropRight,
  className = '',
}) => {
  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`absolute inset-0 z-50 pointer-events-none ${className}`}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/20 backdrop-blur-sm" />

          {/* Drop zones container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center space-x-8">
              {/* Left Drop Zone */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ delay: 0.1, duration: 0.3, type: 'spring' }}
                className="drop-zone-left pointer-events-auto"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropLeft();
                }}
              >
                <div className="relative group cursor-pointer">
                  {/* Drop zone visual */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-48 h-32 bg-gradient-to-br from-blue-500/20 to-blue-600/30 border-2 border-dashed border-blue-400/50 rounded-2xl flex flex-col items-center justify-center group-hover:border-blue-400 transition-all duration-300"
                  >
                    <ArrowLeft className="h-8 w-8 text-blue-400 mb-2" />
                    <span className="text-sm font-medium text-blue-300">
                      Drop here for
                    </span>
                    <span className="text-lg font-bold text-blue-200">
                      Left Panel
                    </span>
                  </motion.div>

                  {/* Animated indicator */}
                  <motion.div
                    animate={{
                      x: [-20, 0, -20],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute -left-2 top-1/2 transform -translate-y-1/2"
                  >
                    <ArrowLeft className="h-6 w-6 text-blue-400" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Center instruction */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-center"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <ChevronDown className="h-8 w-8 text-white/60 mx-auto mb-2" />
                </motion.div>
                <p className="text-lg font-medium text-white/90">
                  Create Split View
                </p>
                <p className="text-sm text-white/60 max-w-xs">
                  Drag file to either side for side-by-side comparison
                </p>
              </motion.div>

              {/* Right Drop Zone */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ delay: 0.1, duration: 0.3, type: 'spring' }}
                className="drop-zone-right pointer-events-auto"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropRight();
                }}
              >
                <div className="relative group cursor-pointer">
                  {/* Drop zone visual */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-48 h-32 bg-gradient-to-br from-green-500/20 to-green-600/30 border-2 border-dashed border-green-400/50 rounded-2xl flex flex-col items-center justify-center group-hover:border-green-400 transition-all duration-300"
                  >
                    <ArrowRight className="h-8 w-8 text-green-400 mb-2" />
                    <span className="text-sm font-medium text-green-300">
                      Drop here for
                    </span>
                    <span className="text-lg font-bold text-green-200">
                      Right Panel
                    </span>
                  </motion.div>

                  {/* Animated indicator */}
                  <motion.div
                    animate={{
                      x: [20, 0, 20],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute -right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <ArrowRight className="h-6 w-6 text-green-400" />
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DropZonesOverlay;
