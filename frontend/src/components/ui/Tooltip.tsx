import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'bottom-left';
  delay?: number;
  color?: 'primary' | 'secondary' | 'default';
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  placement = 'right',
  delay = 300,
  color = 'default',
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Color variants for the tooltip
  const colorStyles = {
    default: 'bg-popover/90',
    primary: 'bg-primary/90',
    secondary: 'bg-secondary/90',
  };

  // Placement styles with higher z-index to prevent overlapping
  const placementStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    'bottom-left': 'top-full right-0 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  // Arrow styles matching the tooltip color
  const arrowStyles = {
    top: {
      default: 'top-full left-1/2 -translate-x-1/2 border-t-popover/90 border-l-transparent border-r-transparent border-b-transparent',
      primary: 'top-full left-1/2 -translate-x-1/2 border-t-primary/90 border-l-transparent border-r-transparent border-b-transparent',
      secondary: 'top-full left-1/2 -translate-x-1/2 border-t-secondary/90 border-l-transparent border-r-transparent border-b-transparent',
    },
    right: {
      default: 'right-full top-1/2 -translate-y-1/2 border-r-popover/90 border-t-transparent border-b-transparent border-l-transparent',
      primary: 'right-full top-1/2 -translate-y-1/2 border-r-primary/90 border-t-transparent border-b-transparent border-l-transparent',
      secondary: 'right-full top-1/2 -translate-y-1/2 border-r-secondary/90 border-t-transparent border-b-transparent border-l-transparent',
    },
    bottom: {
      default: 'bottom-full left-1/2 -translate-x-1/2 border-b-popover/90 border-l-transparent border-r-transparent border-t-transparent',
      primary: 'bottom-full left-1/2 -translate-x-1/2 border-b-primary/90 border-l-transparent border-r-transparent border-t-transparent',
      secondary: 'bottom-full left-1/2 -translate-x-1/2 border-b-secondary/90 border-l-transparent border-r-transparent border-t-transparent',
    },
    left: {
      default: 'left-full top-1/2 -translate-y-1/2 border-l-popover/90 border-t-transparent border-b-transparent border-r-transparent',
      primary: 'left-full top-1/2 -translate-y-1/2 border-l-primary/90 border-t-transparent border-b-transparent border-r-transparent',
      secondary: 'left-full top-1/2 -translate-y-1/2 border-l-secondary/90 border-t-transparent border-b-transparent border-r-transparent',
    },
    'bottom-left': {
      default: 'bottom-full right-2 border-b-popover/90 border-l-transparent border-r-transparent border-t-transparent',
      primary: 'bottom-full right-2 border-b-primary/90 border-l-transparent border-r-transparent border-t-transparent',
      secondary: 'bottom-full right-2 border-b-secondary/90 border-l-transparent border-r-transparent border-t-transparent',
    },
  };

  const showTooltip = () => {
    setHovering(true);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    setHovering(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-block" onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      
      <AnimatePresence>
        {isVisible && hovering && (
          <motion.div
            className={`absolute ${placementStyles[placement]} z-[1000]`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <div className={`${colorStyles[color]} text-foreground rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg border border-border`}>
              {content}
            </div>
            <div 
              className={`absolute w-0 h-0 border-4 ${arrowStyles[placement][color]}`} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip;