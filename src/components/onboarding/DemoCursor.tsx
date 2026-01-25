import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/store/onboardingStore';

// Cursor SVG component
const CursorIcon = ({ clicking }: { clicking: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    style={{
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
      transform: clicking ? 'scale(0.9)' : 'scale(1)',
      transition: 'transform 0.1s ease',
    }}
  >
    <path
      d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-5.03h6.3c.45 0 .67-.54.35-.85L6.35 3.57a.5.5 0 00-.85.35z"
      fill="var(--text-primary)"
      stroke="var(--surface-primary)"
      strokeWidth="1.5"
    />
  </svg>
);

interface DemoCursorProps {
  /** Current step based on user progress */
  currentStep: 'file' | 'command-bar' | 'complete';
}

export function DemoCursor({ currentStep }: DemoCursorProps) {
  const { isDemoPlaying, setDemoPlaying, dismissOnboarding } = useOnboardingStore();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Calculate positions based on viewport
  const getStepPosition = useCallback((step: 'file' | 'command-bar') => {
    if (step === 'file') {
      // Position near first sample file
      return {
        x: 90,
        y: 150,
        message: 'Double-click to explore your file',
      };
    } else {
      // Position near CMD+K button
      return {
        x: 180,
        y: 35,
        message: 'Press CMD+K to search or ask AI',
      };
    }
  }, []);

  // Update position when step changes
  useEffect(() => {
    if (!isDemoPlaying || currentStep === 'complete') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing visibility with demo state
      setIsVisible(false);
      if (currentStep === 'complete') {
        setDemoPlaying(false);
      }
      return;
    }

    const stepData = getStepPosition(currentStep);

    // Brief delay before showing cursor at new position
    const showTimer = setTimeout(() => {
      setPosition({ x: stepData.x, y: stepData.y });
      setMessage(stepData.message);
      setIsVisible(true);
    }, currentStep === 'file' ? 800 : 500);

    return () => clearTimeout(showTimer);
  }, [isDemoPlaying, currentStep, getStepPosition, setDemoPlaying]);

  // Handle escape to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDemoPlaying) {
        setDemoPlaying(false);
        dismissOnboarding();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDemoPlaying, setDemoPlaying, dismissOnboarding]);

  if (!isDemoPlaying || !isVisible || currentStep === 'complete') return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      style={{ overflow: 'hidden' }}
    >
      {/* Skip hint */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
        style={{
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--text-tertiary)',
          border: '1px solid var(--border-default)',
        }}
      >
        <kbd
          className="px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ backgroundColor: 'var(--surface-secondary)' }}
        >
          Esc
        </kbd>
        <span>to skip</span>
      </motion.div>

      {/* Animated cursor */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: 1,
          scale: 1,
          x: position.x,
          y: position.y,
        }}
        transition={{
          x: { type: 'spring', stiffness: 100, damping: 20 },
          y: { type: 'spring', stiffness: 100, damping: 20 },
          opacity: { duration: 0.2 },
          scale: { duration: 0.2 },
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 101,
        }}
      >
        {/* Pulsing ring around cursor to draw attention */}
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -inset-2 rounded-full"
          style={{
            backgroundColor: 'var(--primary)',
          }}
        />

        <CursorIcon clicking={false} />

        {/* Message tooltip */}
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              key={message}
              initial={{ opacity: 0, y: 5, x: 10 }}
              animate={{ opacity: 1, y: 0, x: 30 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 top-0 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default DemoCursor;
