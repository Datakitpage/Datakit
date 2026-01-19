import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // App initialization
  isInitialized: boolean;
  
  // Command palette
  isCommandPaletteOpen: boolean;
  
  // AI Panel
  isAIPanelOpen: boolean;
  
  // Settings Modal
  isSettingsOpen: boolean;
  
  // Theme customization
  theme: {
    primaryColor: string;
    accentColor: string;
    borderRadius: 'none' | 'sm' | 'md' | 'lg';
  };

  // Actions
  initializeApp: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openAIPanel: () => void;
  closeAIPanel: () => void;
  toggleAIPanel: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  updateTheme: (theme: Partial<AppState['theme']>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isInitialized: false,
      isCommandPaletteOpen: false,
      isAIPanelOpen: false,
      isSettingsOpen: false,
      
      theme: {
        primaryColor: 'hsl(221 83% 53%)',
        accentColor: 'hsl(220 13% 15%)',
        borderRadius: 'md',
      },

      initializeApp: () => {
        set({ isInitialized: true });
      },

      openCommandPalette: () => set({ isCommandPaletteOpen: true }),
      closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
      toggleCommandPalette: () => set((state) => ({ 
        isCommandPaletteOpen: !state.isCommandPaletteOpen 
      })),

      openAIPanel: () => set({ isAIPanelOpen: true }),
      closeAIPanel: () => set({ isAIPanelOpen: false }),
      toggleAIPanel: () => set((state) => ({
        isAIPanelOpen: !state.isAIPanelOpen
      })),

      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),

      updateTheme: (themeUpdate) => set((state) => ({
        theme: { ...state.theme, ...themeUpdate }
      })),
    }),
    {
      name: 'board-app-storage',
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);
