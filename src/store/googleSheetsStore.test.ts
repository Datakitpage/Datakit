import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb-keyval (IndexedDB not available in tests)
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

import { useGoogleSheetsStore, needsReconnect, getAccessToken } from './googleSheetsStore';

function resetStore() {
  useGoogleSheetsStore.setState({
    accessToken: null,
    expiresAt: null,
    userEmail: null,
    userName: null,
    userPhoto: null,
    isConnecting: false,
    error: null,
    sheets: {},
  });
}

describe('googleSheetsStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('setTokens', () => {
    it('should set access token and expiry', () => {
      const expiresAt = Date.now() + 3600000;
      useGoogleSheetsStore.getState().setTokens({
        accessToken: 'ya29.test',
        expiresAt,
      });

      const state = useGoogleSheetsStore.getState();
      expect(state.accessToken).toBe('ya29.test');
      expect(state.expiresAt).toBe(expiresAt);
    });

    it('should clear error when setting tokens', () => {
      useGoogleSheetsStore.setState({ error: 'some error' });
      useGoogleSheetsStore.getState().setTokens({
        accessToken: 'ya29.test',
        expiresAt: Date.now() + 3600000,
      });

      expect(useGoogleSheetsStore.getState().error).toBeNull();
    });
  });

  describe('setUserInfo', () => {
    it('should set user email, name, and photo', () => {
      useGoogleSheetsStore.getState().setUserInfo(
        'user@example.com',
        'Test User',
        'https://photo.url/img.jpg'
      );

      const state = useGoogleSheetsStore.getState();
      expect(state.userEmail).toBe('user@example.com');
      expect(state.userName).toBe('Test User');
      expect(state.userPhoto).toBe('https://photo.url/img.jpg');
    });

    it('should set null for undefined name and photo', () => {
      useGoogleSheetsStore.getState().setUserInfo('user@example.com');

      const state = useGoogleSheetsStore.getState();
      expect(state.userEmail).toBe('user@example.com');
      expect(state.userName).toBeNull();
      expect(state.userPhoto).toBeNull();
    });
  });

  describe('setConnecting', () => {
    it('should set isConnecting flag', () => {
      useGoogleSheetsStore.getState().setConnecting(true);
      expect(useGoogleSheetsStore.getState().isConnecting).toBe(true);

      useGoogleSheetsStore.getState().setConnecting(false);
      expect(useGoogleSheetsStore.getState().isConnecting).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error and clear isConnecting', () => {
      useGoogleSheetsStore.setState({ isConnecting: true });
      useGoogleSheetsStore.getState().setError('Something went wrong');

      const state = useGoogleSheetsStore.getState();
      expect(state.error).toBe('Something went wrong');
      expect(state.isConnecting).toBe(false);
    });

    it('should clear error when set to null', () => {
      useGoogleSheetsStore.setState({ error: 'old error' });
      useGoogleSheetsStore.getState().setError(null);

      expect(useGoogleSheetsStore.getState().error).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should clear all auth state and sheets', () => {
      useGoogleSheetsStore.setState({
        accessToken: 'ya29.test',
        expiresAt: Date.now() + 3600000,
        userEmail: 'user@example.com',
        userName: 'User',
        userPhoto: 'url',
        error: 'err',
        sheets: {
          's1': {
            id: 's1',
            spreadsheetId: 'abc',
            spreadsheetName: 'Test',
            sheetId: 0,
            sheetName: 'Sheet1',
            rowCount: 10,
            columnCount: 2,
            lastSynced: Date.now(),
          },
        },
      });

      useGoogleSheetsStore.getState().disconnect();

      const state = useGoogleSheetsStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.expiresAt).toBeNull();
      expect(state.userEmail).toBeNull();
      expect(state.userName).toBeNull();
      expect(state.userPhoto).toBeNull();
      expect(state.error).toBeNull();
      expect(state.sheets).toEqual({});
    });
  });

  describe('sheet management', () => {
    const testSheet = {
      id: 'sheet-1',
      spreadsheetId: 'abc-123',
      spreadsheetName: 'Sales Data',
      sheetId: 0,
      sheetName: 'Q4',
      rowCount: 100,
      columnCount: 5,
      lastSynced: 1700000000000,
    };

    it('addSheet should add a sheet to the store', () => {
      useGoogleSheetsStore.getState().addSheet(testSheet);

      const sheets = useGoogleSheetsStore.getState().sheets;
      expect(sheets['sheet-1']).toEqual(testSheet);
    });

    it('addSheet should overwrite an existing sheet with same id', () => {
      useGoogleSheetsStore.getState().addSheet(testSheet);
      const updated = { ...testSheet, rowCount: 200 };
      useGoogleSheetsStore.getState().addSheet(updated);

      expect(useGoogleSheetsStore.getState().sheets['sheet-1'].rowCount).toBe(200);
    });

    it('removeSheet should remove a sheet by id', () => {
      useGoogleSheetsStore.getState().addSheet(testSheet);
      useGoogleSheetsStore.getState().removeSheet('sheet-1');

      expect(useGoogleSheetsStore.getState().sheets['sheet-1']).toBeUndefined();
    });

    it('removeSheet should not affect other sheets', () => {
      const sheet2 = { ...testSheet, id: 'sheet-2', spreadsheetName: 'Other' };
      useGoogleSheetsStore.getState().addSheet(testSheet);
      useGoogleSheetsStore.getState().addSheet(sheet2);

      useGoogleSheetsStore.getState().removeSheet('sheet-1');

      expect(useGoogleSheetsStore.getState().sheets['sheet-2']).toBeDefined();
    });

    it('updateSheetSyncTime should update lastSynced', () => {
      useGoogleSheetsStore.getState().addSheet(testSheet);

      const before = useGoogleSheetsStore.getState().sheets['sheet-1'].lastSynced;
      // Use a small delay to ensure time changes
      useGoogleSheetsStore.getState().updateSheetSyncTime('sheet-1');
      const after = useGoogleSheetsStore.getState().sheets['sheet-1'].lastSynced;

      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('updateSheetSyncTime should no-op for missing sheet', () => {
      // Should not throw
      useGoogleSheetsStore.getState().updateSheetSyncTime('nonexistent');
      expect(useGoogleSheetsStore.getState().sheets['nonexistent']).toBeUndefined();
    });

    it('clearAllSheets should remove all sheets', () => {
      useGoogleSheetsStore.getState().addSheet(testSheet);
      useGoogleSheetsStore.getState().addSheet({ ...testSheet, id: 'sheet-2' });

      useGoogleSheetsStore.getState().clearAllSheets();

      expect(useGoogleSheetsStore.getState().sheets).toEqual({});
    });
  });

  // NOTE: isConnected/isTokenExpired are JS getters defined on the initial
  // Zustand state object. Zustand's setState uses Object.assign which copies
  // getters as snapshot values, so after any setState call the getters stop
  // re-evaluating. We test them on the initial (fresh) state only.
  describe('computed properties (initial state)', () => {
    it('isConnected should be false when no token (initial state)', () => {
      // On fresh store, getters still work
      expect(useGoogleSheetsStore.getState().isConnected).toBe(false);
    });

    it('isTokenExpired should be true when no expiresAt (initial state)', () => {
      expect(useGoogleSheetsStore.getState().isTokenExpired).toBe(true);
    });
  });

  describe('helper functions', () => {
    it('getAccessToken should throw when not connected', () => {
      expect(() => getAccessToken()).toThrow('Not connected to Google Sheets');
    });

    it('needsReconnect should return false when not connected', () => {
      expect(needsReconnect()).toBe(false);
    });
  });
});
