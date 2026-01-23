import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboardingStore } from '@/store/onboardingStore';
import { DemoCursor } from './DemoCursor';
import { PulsingHotspot } from './PulsingHotspot';

interface OnboardingOverlayProps {
  /** Whether only sample files exist (good time to show onboarding) */
  onlySampleFiles: boolean;
  /** Whether a file is currently focused/open */
  hasOpenFile: boolean;
  /** Whether command bar is open */
  commandBarOpen: boolean;
}

export function OnboardingOverlay({
  onlySampleFiles,
  hasOpenFile,
  commandBarOpen,
}: OnboardingOverlayProps) {
  const {
    hasCompletedOnboarding,
    hasDismissedOnboarding,
    isDemoPlaying,
    progress,
    startOnboarding,
    completeOnboarding,
    markFileOpened,
    markCommandBarUsed,
  } = useOnboardingStore();

  // Track when user opens a file
  useEffect(() => {
    if (hasOpenFile && !progress.hasOpenedFile) {
      markFileOpened();
    }
  }, [hasOpenFile, progress.hasOpenedFile, markFileOpened]);

  // Track when user opens command bar
  useEffect(() => {
    if (commandBarOpen && !progress.hasUsedCommandBar) {
      markCommandBarUsed();
    }
  }, [commandBarOpen, progress.hasUsedCommandBar, markCommandBarUsed]);

  // Track when to show completion message
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  // Mark onboarding complete when user has done both steps (opened file + used command bar)
  useEffect(() => {
    if (
      !hasCompletedOnboarding &&
      !hasDismissedOnboarding &&
      progress.hasOpenedFile &&
      progress.hasUsedCommandBar
    ) {
      // Show completion message briefly
      setShowCompletionMessage(true);
      const hideTimer = setTimeout(() => {
        setShowCompletionMessage(false);
        completeOnboarding();
      }, 2000);
      return () => clearTimeout(hideTimer);
    }
  }, [
    hasCompletedOnboarding,
    hasDismissedOnboarding,
    progress.hasOpenedFile,
    progress.hasUsedCommandBar,
    completeOnboarding,
  ]);

  // Complete onboarding if user leaves the tab (don't annoy returning users)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isDemoPlaying && !hasCompletedOnboarding) {
        completeOnboarding();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isDemoPlaying, hasCompletedOnboarding, completeOnboarding]);

  // Auto-start onboarding for first-time users with sample files
  useEffect(() => {
    if (
      onlySampleFiles &&
      !hasCompletedOnboarding &&
      !hasDismissedOnboarding &&
      !isDemoPlaying &&
      !hasOpenFile
    ) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        startOnboarding();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [
    onlySampleFiles,
    hasCompletedOnboarding,
    hasDismissedOnboarding,
    isDemoPlaying,
    hasOpenFile,
    startOnboarding,
  ]);

  // Determine current onboarding step based on user progress
  const getCurrentStep = (): 'file' | 'command-bar' | 'complete' => {
    if (!progress.hasOpenedFile) return 'file';
    if (!progress.hasUsedCommandBar) return 'command-bar';
    return 'complete';
  };
  const currentOnboardingStep = getCurrentStep();

  // Show hotspots on undiscovered features (only when not playing demo and not completed)
  const showFileHotspot =
    !isDemoPlaying &&
    !hasCompletedOnboarding &&
    !hasDismissedOnboarding &&
    onlySampleFiles &&
    !progress.hasOpenedFile &&
    !hasOpenFile;

  const showCommandBarHotspot =
    !isDemoPlaying &&
    !hasCompletedOnboarding &&
    !hasDismissedOnboarding &&
    progress.hasOpenedFile &&
    !progress.hasUsedCommandBar &&
    !commandBarOpen;

  return (
    <>
      {/* Demo cursor - waits for user to perform each action */}
      <AnimatePresence>
        {isDemoPlaying && <DemoCursor currentStep={currentOnboardingStep} />}
      </AnimatePresence>

      {/* Hotspots for undiscovered features */}
      <AnimatePresence>
        {showFileHotspot && (
          <motion.div
            key="file-hotspot-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.5 }}
            className="fixed z-40 pointer-events-none"
            style={{
              // Position near first sample file
              left: 85,
              top: 115,
            }}
          >
            <PulsingHotspot
              visible
              size={10}
              variant="primary"
            />
            {/* Floating hint */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 }}
              className="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <span className="font-medium">Double-click</span>
              <span style={{ color: 'var(--text-secondary)' }}> to explore</span>
            </motion.div>
          </motion.div>
        )}

        {showCommandBarHotspot && (
          <motion.div
            key="cmd-hotspot-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3 }}
            className="fixed z-40 pointer-events-none"
            style={{
              // Position near CMD+K button in header
              left: 140,
              top: 20,
            }}
          >
            <PulsingHotspot
              visible
              size={8}
              variant="primary"
            />
            {/* Floating hint */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute left-4 top-4 whitespace-nowrap px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <span className="font-medium">Try CMD+K</span>
              <span style={{ color: 'var(--text-secondary)' }}> to search or ask AI</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome tooltip when demo is not playing but user hasn't interacted */}
      <AnimatePresence>
        {!isDemoPlaying &&
          !hasCompletedOnboarding &&
          !hasDismissedOnboarding &&
          onlySampleFiles &&
          !hasOpenFile &&
          !progress.hasOpenedFile && (
            <motion.div
              key="welcome-hint"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 2, duration: 0.3 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2"
            >
              <div
                className="px-4 py-3 rounded-xl text-center"
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-xl)',
                }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Welcome to OpenSheet
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Double-click a file to get started, or drop your own data
                </p>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Completion celebration */}
      <AnimatePresence>
        {showCompletionMessage && (
          <motion.div
            key="completion-message"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
          >
            <div
              className="px-5 py-3 rounded-xl text-center"
              style={{
                backgroundColor: 'var(--success)',
                color: 'white',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <p className="text-sm font-medium">You're all set!</p>
              <p className="text-xs mt-0.5 opacity-90">Now explore your data</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default OnboardingOverlay;
