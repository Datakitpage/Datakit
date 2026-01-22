import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// Custom IndexedDB storage adapter for better persistence
const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await get(name);
      return value ?? null;
    } catch (error) {
      console.error('[SettingsStore] IndexedDB getItem error:', error);
      // Fallback to localStorage
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await set(name, value);
    } catch (error) {
      console.error('[SettingsStore] IndexedDB setItem error:', error);
      // Fallback to localStorage
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name);
    } catch (error) {
      console.error('[SettingsStore] IndexedDB removeItem error:', error);
      localStorage.removeItem(name);
    }
  },
};

// Preset accent colors
export const ACCENT_PRESETS = [
  { name: 'Blue', hue: 221, saturation: 83, lightness: 53 },
  { name: 'Purple', hue: 262, saturation: 83, lightness: 58 },
  { name: 'Violet', hue: 250, saturation: 95, lightness: 62 },
  { name: 'Pink', hue: 330, saturation: 81, lightness: 60 },
  { name: 'Rose', hue: 350, saturation: 89, lightness: 60 },
  { name: 'Orange', hue: 24, saturation: 95, lightness: 53 },
  { name: 'Amber', hue: 38, saturation: 92, lightness: 50 },
  { name: 'Green', hue: 142, saturation: 76, lightness: 36 },
  { name: 'Emerald', hue: 160, saturation: 84, lightness: 39 },
  { name: 'Teal', hue: 172, saturation: 66, lightness: 50 },
  { name: 'Cyan', hue: 189, saturation: 94, lightness: 43 },
  { name: 'Sky', hue: 199, saturation: 89, lightness: 48 },
] as const;

export interface AccentColor {
  hue: number;
  saturation: number;
  lightness: number;
}

interface SettingsState {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Accent Color
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  setAccentPreset: (presetName: string) => void;

  // AI Config
  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  clearAnthropicApiKey: () => void;
}

// Apply accent color to CSS variables
function applyAccentColor(color: AccentColor) {
  const root = document.documentElement;
  root.style.setProperty('--accent-hue', String(color.hue));
  root.style.setProperty('--accent-saturation', `${color.saturation}%`);
  root.style.setProperty('--accent-lightness', `${color.lightness}%`);
}

// Apply theme class
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'light',
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        set({ theme: newTheme });
      },
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      // Accent Color
      accentColor: ACCENT_PRESETS[0], // Blue default
      setAccentColor: (color) => {
        applyAccentColor(color);
        set({ accentColor: color });
      },
      setAccentPreset: (presetName) => {
        const preset = ACCENT_PRESETS.find(p => p.name === presetName);
        if (preset) {
          applyAccentColor(preset);
          set({ accentColor: preset });
        }
      },

      // AI Config
      anthropicApiKey: '',
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
      clearAnthropicApiKey: () => set({ anthropicApiKey: '' }),
    }),
    {
      name: 'board-settings',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        theme: state.theme,
        accentColor: state.accentColor,
        anthropicApiKey: state.anthropicApiKey,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply stored settings on app load
        console.log('[SettingsStore] Rehydrating settings:', {
          hasState: !!state,
          hasApiKey: !!state?.anthropicApiKey,
          theme: state?.theme,
        });
        if (state) {
          applyTheme(state.theme);
          applyAccentColor(state.accentColor);
        }
      },
    }
  )
);
