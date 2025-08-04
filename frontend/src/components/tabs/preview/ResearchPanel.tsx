import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResearchPanelStore } from '@/store/researchPanelStore';
import ResearchView from './inspector/components/ResearchView';

interface ResearchPanelProps {
  className?: string;
}

const ResearchPanel: React.FC<ResearchPanelProps> = ({ className }) => {
  const {
    isOpen,
    width,
    setWidth,
    closePanel,
  } = useResearchPanelStore();

  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Resize handling
  useEffect(() => {
    let startX = 0;
    let startWidth = 0;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startX = e.clientX;
      startWidth = width;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = startWidth + deltaX;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const resizeHandle = resizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
      return () => {
        resizeHandle.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [width, setWidth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  if (!isOpen) return null;

  return (
    <div className={cn('fixed inset-y-0 right-0 z-40', className)}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={closePanel}
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        className="relative h-full bg-background/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex"
        style={{ width: `${Math.max(400, width)}px` }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {/* Resize Handle */}
        <div
          ref={resizeHandleRef}
          className="absolute left-0 top-0 bottom-0 w-1 hover:bg-primary/50 cursor-col-resize transition-colors"
          style={{
            opacity: isResizing ? 1 : 0,
            transition: isResizing ? 'none' : 'opacity 0.2s ease',
          }}
        />

        {/* Panel Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 border-b border-white/10 bg-card/20"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Research Canvas
                </h2>
                <p className="text-sm text-white/60">
                  AI-powered data exploration
                </p>
              </div>
            </div>
            <button
              onClick={closePanel}
              className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>

          {/* Research Canvas Content */}
          <div className="flex-1 overflow-hidden">
            <ResearchView />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResearchPanel;