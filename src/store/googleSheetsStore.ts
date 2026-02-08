import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// Custom IndexedDB storage adapter (same pattern as settingsStore)
const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await get(name);
      return value ?? null;
    } catch (error) {
      console.error('[GoogleSheetsStore] IndexedDB getItem error:', error);
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await set(name, value);
    } catch (error) {
      console.error('[GoogleSheetsStore] IndexedDB setItem error:', error);
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name);
    } catch (error) {
      console.error('[GoogleSheetsStore] IndexedDB removeItem error:', error);
      localStorage.removeItem(name);
    }
  },
};

export interface GoogleSheetMetadata {
  id: string; // Internal ID for the node
  spreadsheetId: string;
  spreadsheetName: string;
  sheetId: number;
  sheetName: string;
  rowCount: number;
  columnCount: number;
  lastSynced: number; // Timestamp
  remoteModifiedTime?: string; // ISO 8601 from Drive API, for conflict detection
}

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number; // Timestamp when token expires
}

interface GoogleSheetsState {
  // Auth state
  accessToken: string | null;
  expiresAt: number | null;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
  isConnecting: boolean;
  error: string | null;

  // Imported sheets metadata
  sheets: Record<string, GoogleSheetMetadata>;

  // Computed
  isConnected: boolean;
  isTokenExpired: boolean;

  // Actions
  setTokens: (tokens: GoogleTokens) => void;
  setUserInfo: (email: string, name?: string, photo?: string) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  disconnect: () => void;
  addSheet: (sheet: GoogleSheetMetadata) => void;
  updateSheetSyncTime: (id: string) => void;
  removeSheet: (id: string) => void;
  clearAllSheets: () => void;
}

export const useGoogleSheetsStore = create<GoogleSheetsState>()(
  persist(
    (set, get) => ({
      // Initial state
      accessToken: null,
      expiresAt: null,
      userEmail: null,
      userName: null,
      userPhoto: null,
      isConnecting: false,
      error: null,
      sheets: {},

      // Computed getters (implemented as getters in the object)
      get isConnected() {
        const state = get();
        return !!state.accessToken && !state.isTokenExpired;
      },

      get isTokenExpired() {
        const state = get();
        if (!state.expiresAt) return true;
        // Consider expired 5 minutes before actual expiry
        return Date.now() > state.expiresAt - 5 * 60 * 1000;
      },

      // Actions
      setTokens: (tokens) => {
        set({
          accessToken: tokens.accessToken,
          expiresAt: tokens.expiresAt,
          error: null,
        });
      },

      setUserInfo: (email, name, photo) => {
        set({
          userEmail: email,
          userName: name || null,
          userPhoto: photo || null,
        });
      },

      setConnecting: (connecting) => {
        set({ isConnecting: connecting });
      },

      setError: (error) => {
        set({ error, isConnecting: false });
      },

      disconnect: () => {
        set({
          accessToken: null,
          expiresAt: null,
          userEmail: null,
          userName: null,
          userPhoto: null,
          error: null,
          sheets: {},
        });
      },

      addSheet: (sheet) => {
        set((state) => ({
          sheets: {
            ...state.sheets,
            [sheet.id]: sheet,
          },
        }));
      },

      updateSheetSyncTime: (id) => {
        set((state) => {
          const sheet = state.sheets[id];
          if (!sheet) return state;
          return {
            sheets: {
              ...state.sheets,
              [id]: { ...sheet, lastSynced: Date.now() },
            },
          };
        });
      },

      removeSheet: (id) => {
        set((state) => {
          const { [id]: removed, ...rest } = state.sheets;
          return { sheets: rest };
        });
      },

      clearAllSheets: () => {
        set({ sheets: {} });
      },
    }),
    {
      name: 'google-sheets-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
        userEmail: state.userEmail,
        userName: state.userName,
        userPhoto: state.userPhoto,
        sheets: state.sheets,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[GoogleSheetsStore] Rehydrating:', {
          hasState: !!state,
          isConnected: state?.accessToken ? 'yes' : 'no',
          userEmail: state?.userEmail,
          sheetCount: state?.sheets ? Object.keys(state.sheets).length : 0,
        });
      },
    }
  )
);

// Helper to check if we need to refresh/reconnect
export function needsReconnect(): boolean {
  const state = useGoogleSheetsStore.getState();
  return state.accessToken !== null && state.isTokenExpired;
}

// Helper to get access token (throws if not available)
export function getAccessToken(): string {
  const state = useGoogleSheetsStore.getState();
  if (!state.accessToken) {
    throw new Error('Not connected to Google Sheets');
  }
  if (state.isTokenExpired) {
    throw new Error('Google Sheets token expired. Please reconnect.');
  }
  return state.accessToken;
}
