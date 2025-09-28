import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Code2, FileText, BarChart3, UserPen } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode =
  | 'preview'
  | 'query'
  | 'notebook'
  | 'visualization'
  | 'ai';

interface ViewModeSelectorProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  className?: string;
}

const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({
  currentMode,
  onModeChange,
  className
}) => {
  // Always keep expanded, no collapsing behavior

  const modes: {
    value: ViewMode;
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      value: 'preview',
      label: 'Preview',
      icon: <Eye size={16} />,
      description: 'View and explore your data',
    },
    {
      value: 'query',
      label: 'SQL',
      icon: <Code2 size={16} />,
      description: 'Query with SQL',
    },
    {
      value: 'notebook',
      label: 'Notebook',
      icon: <FileText size={16} />,
      description: 'Analyze with Jupyter notebook',
    },
    {
      value: 'visualization',
      label: 'Visualize',
      icon: <BarChart3 size={16} />,
      description: 'Create charts and graphs',
    },
    {
      value: 'ai',
      label: 'Assistant',
      icon: <UserPen size={16} />,
      description: 'AI-powered insights',
    },
  ];


  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Always show expanded state - all options visible */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: 0.25,
          ease: [0.23, 1, 0.32, 1], // Custom easing for smoother feel
          scale: { duration: 0.2 },
          opacity: { duration: 0.15 },
        }}
        className="flex items-center gap-0.5 bg-card/50 backdrop-blur-sm border border-border rounded-lg p-0.5 shadow-xl"
      >
        {modes.map((mode) => (
          <motion.button
            onClick={() => onModeChange(mode.value)}
            disabled={false} // Always clickable
            className={cn(
              'relative group flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md',
              'transition-all duration-200 cursor-pointer',
              currentMode === mode.value
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {currentMode === mode.value && (
              <motion.div
                layoutId="activeMode"
                className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/25 via-primary/20 to-primary/15 border border-primary/30 shadow-lg shadow-primary/10"
                transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              />
            )}
            <span
              className={cn(
                'relative z-10',
                currentMode === mode.value ? 'text-foreground' : ''
              )}
            >
              {mode.icon}
            </span>
            <span
              className={cn(
                'relative z-10 font-medium',
                currentMode === mode.value ? 'text-foreground' : ''
              )}
            >
              {mode.label}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

export default ViewModeSelector;
