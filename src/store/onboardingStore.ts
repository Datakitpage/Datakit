import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OnboardingStep =
  | 'welcome'
  | 'double-click-file'
  | 'command-bar'
  | 'ai-mode'
  | 'complete';

interface OnboardingProgress {
  hasOpenedFile: boolean;
  hasUsedCommandBar: boolean;
  hasTriedAI: boolean;
  hasDroppedFile: boolean;
}

interface OnboardingState {
  // Whether user has completed or dismissed onboarding
  hasCompletedOnboarding: boolean;
  hasDismissedOnboarding: boolean;

  // Current step in the guided tour
  currentStep: OnboardingStep;

  // Feature discovery progress
  progress: OnboardingProgress;

  // Is the demo animation currently playing
  isDemoPlaying: boolean;

  // Actions
  startOnboarding: () => void;
  dismissOnboarding: () => void;
  completeOnboarding: () => void;
  setCurrentStep: (step: OnboardingStep) => void;
  nextStep: () => void;

  // Progress tracking
  markFileOpened: () => void;
  markCommandBarUsed: () => void;
  markAIUsed: () => void;
  markFileDropped: () => void;

  // Demo control
  setDemoPlaying: (playing: boolean) => void;

  // Reset (for testing)
  resetOnboarding: () => void;
}

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'double-click-file',
  'command-bar',
  'ai-mode',
  'complete',
];

const initialProgress: OnboardingProgress = {
  hasOpenedFile: false,
  hasUsedCommandBar: false,
  hasTriedAI: false,
  hasDroppedFile: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      hasDismissedOnboarding: false,
      currentStep: 'welcome',
      progress: initialProgress,
      isDemoPlaying: false,

      startOnboarding: () => {
        set({
          currentStep: 'welcome',
          isDemoPlaying: true,
          hasDismissedOnboarding: false,
        });
      },

      dismissOnboarding: () => {
        set({
          hasDismissedOnboarding: true,
          isDemoPlaying: false,
        });
      },

      completeOnboarding: () => {
        set({
          hasCompletedOnboarding: true,
          hasDismissedOnboarding: false,
          currentStep: 'complete',
          isDemoPlaying: false,
        });
      },

      setCurrentStep: (step) => {
        set({ currentStep: step });
      },

      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        if (currentIndex < STEP_ORDER.length - 1) {
          const nextStep = STEP_ORDER[currentIndex + 1];
          set({ currentStep: nextStep });

          // Auto-complete when reaching the end
          if (nextStep === 'complete') {
            set({
              hasCompletedOnboarding: true,
              isDemoPlaying: false,
            });
          }
        }
      },

      markFileOpened: () => {
        set(state => ({
          progress: { ...state.progress, hasOpenedFile: true },
        }));
      },

      markCommandBarUsed: () => {
        set(state => ({
          progress: { ...state.progress, hasUsedCommandBar: true },
        }));
      },

      markAIUsed: () => {
        set(state => ({
          progress: { ...state.progress, hasTriedAI: true },
        }));
      },

      markFileDropped: () => {
        set(state => ({
          progress: { ...state.progress, hasDroppedFile: true },
        }));
      },

      setDemoPlaying: (playing) => {
        set({ isDemoPlaying: playing });
      },

      resetOnboarding: () => {
        set({
          hasCompletedOnboarding: false,
          hasDismissedOnboarding: false,
          currentStep: 'welcome',
          progress: initialProgress,
          isDemoPlaying: false,
        });
      },
    }),
    {
      name: 'opensheet-onboarding',
      // Use localStorage (default, synchronous) - more reliable than IndexedDB for simple state
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasDismissedOnboarding: state.hasDismissedOnboarding,
        progress: state.progress,
      }),
    }
  )
);
