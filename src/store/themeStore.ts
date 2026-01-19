import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Theme {
  name: string;
  primary: string;
  background: string;
  backgroundSubtle: string;
  backgroundElevated: string;
  foreground: string;
  foregroundMuted: string;
  border: string;
  card: string;
  radius: string;
}

const DEFAULT_THEMES: Record<string, Theme> = {
  dark: {
    name: "Dark",
    primary: "221 83% 53%",
    background: "220 13% 5%",
    backgroundSubtle: "220 13% 8%",
    backgroundElevated: "220 13% 10%",
    foreground: "0 0% 98%",
    foregroundMuted: "0 0% 63%",
    border: "0 0% 100% / 0.08",
    card: "220 13% 8%",
    radius: "0.5rem",
  },
  midnight: {
    name: "Midnight",
    primary: "262 83% 58%",
    background: "240 10% 4%",
    backgroundSubtle: "240 10% 7%",
    backgroundElevated: "240 10% 9%",
    foreground: "0 0% 98%",
    foregroundMuted: "240 5% 65%",
    border: "240 5% 20%",
    card: "240 10% 7%",
    radius: "0.75rem",
  },
  forest: {
    name: "Forest",
    primary: "142 76% 36%",
    background: "150 10% 5%",
    backgroundSubtle: "150 10% 8%",
    backgroundElevated: "150 10% 10%",
    foreground: "0 0% 98%",
    foregroundMuted: "150 5% 60%",
    border: "150 5% 18%",
    card: "150 10% 8%",
    radius: "0.5rem",
  },
  ocean: {
    name: "Ocean",
    primary: "199 89% 48%",
    background: "210 15% 5%",
    backgroundSubtle: "210 15% 8%",
    backgroundElevated: "210 15% 10%",
    foreground: "0 0% 98%",
    foregroundMuted: "210 10% 60%",
    border: "210 10% 18%",
    card: "210 15% 8%",
    radius: "0.625rem",
  },
};

interface ThemeState {
  activeTheme: string;
  themes: Record<string, Theme>;
  customTheme: Theme | null;
  
  setTheme: (themeName: string) => void;
  updateCustomTheme: (updates: Partial<Theme>) => void;
  applyTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activeTheme: "dark",
      themes: DEFAULT_THEMES,
      customTheme: null,

      setTheme: (themeName: string) => {
        const theme = get().themes[themeName];
        if (theme) {
          set({ activeTheme: themeName });
          get().applyTheme(theme);
        }
      },

      updateCustomTheme: (updates: Partial<Theme>) => {
        const current = get().customTheme || { ...DEFAULT_THEMES.dark, name: "Custom" };
        const newTheme = { ...current, ...updates };
        set({ customTheme: newTheme, activeTheme: "custom" });
        get().applyTheme(newTheme);
      },

      applyTheme: (theme: Theme) => {
        const root = document.documentElement;
        root.style.setProperty("--primary", "hsl(" + theme.primary + ")");
        root.style.setProperty("--background", "hsl(" + theme.background + ")");
        root.style.setProperty("--background-subtle", "hsl(" + theme.backgroundSubtle + ")");
        root.style.setProperty("--background-elevated", "hsl(" + theme.backgroundElevated + ")");
        root.style.setProperty("--foreground", "hsl(" + theme.foreground + ")");
        root.style.setProperty("--foreground-muted", "hsl(" + theme.foregroundMuted + ")");
        root.style.setProperty("--border", "hsl(" + theme.border + ")");
        root.style.setProperty("--card", "hsl(" + theme.card + ")");
        root.style.setProperty("--radius", theme.radius);
      },
    }),
    {
      name: "board-theme-storage",
      partialize: (state) => ({ activeTheme: state.activeTheme, customTheme: state.customTheme }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const theme = state.activeTheme === "custom" 
            ? state.customTheme 
            : state.themes[state.activeTheme];
          if (theme) {
            state.applyTheme(theme);
          }
        }
      },
    }
  )
);
