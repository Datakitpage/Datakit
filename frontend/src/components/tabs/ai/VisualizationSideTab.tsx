import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

interface VisualizationSideTabProps {
  isVisible: boolean;
  onToggle: () => void;
}

const VisualizationSideTab: React.FC<VisualizationSideTabProps> = ({
  isVisible,
  onToggle
}) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ x: 10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 10, opacity: 0 }}
      className="absolute right-0 top-1/2 -translate-y-1/2"
    >
      <button
        onClick={onToggle}
        className="bg-background border-l border-t border-b border-primary/80 rounded-l-lg p-3 hover:bg-primary/30 transition-colors group"
        title="Show Visualization"
      >
        <BarChart3 className="h-5 w-5 text-primary group-hover:text-foreground transition-colors" />
      </button>
    </motion.div>
  );
};

export default VisualizationSideTab;