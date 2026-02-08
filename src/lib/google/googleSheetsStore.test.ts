import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGoogleSheetsStore } from '@/store/googleSheetsStore';

// Mock idb-keyval since IndexedDB is not available in tests
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

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
      useGoogleSheetsStore.getState().setTokens({
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
      });

      const state = useGoogleSheetsStore.getState();
      expect(state.accessToken).toBe('test-token');
      expect(state.error).toBeNull();
    });
  });

  describe('setUserInfo', () => {
    it('should set email, name and photo', () => {
      useGoogleSheetsStore.getState().setUserInfo('user@test.com', 'Test User', 'https://photo.url');

      const state = useGoogleSheetsStore.getState();
      expect(state.userEmail).toBe('user@test.com');
      expect(state.userName).toBe('Test User');
      expect(state.userPhoto).toBe('https://photo.url');
    });

    it('should set photo and name to null when not provided', () => {
      useGoogleSheetsStore.getState().setUserInfo('user@test.com');
      expect(useGoogleSheetsStore.getState().userPhoto).toBeNull();
      expect(useGoogleSheetsStore.getState().userName).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should clear all auth state and sheets', () => {
      useGoogleSheetsStore.getState().setTokens({
        accessToken: 'token',
        expiresAt: Date.now() + 3600000,
      });
      useGoogleSheetsStore.getState().setUserInfo('user@test.com');
      useGoogleSheetsStore.getState().addSheet({
        id: 'sheet-1',
        spreadsheetId: 'spread-1',
        spreadsheetName: 'My Sheet',
        sheetId: 0,
        sheetName: 'Sheet1',
        rowCount: 100,
        columnCount: 5,
        lastSynced: Date.now(),
      });

      useGoogleSheetsStore.getState().disconnect();

      const state = useGoogleSheetsStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.userEmail).toBeNull();
      expect(Object.keys(state.sheets)).toHaveLength(0);
    });
  });

  describe('sheet management', () => {
    it('should add a sheet', () => {
      useGoogleSheetsStore.getState().addSheet({
        id: 'sheet-1',
        spreadsheetId: 'spread-1',
        spreadsheetName: 'Test',
        sheetId: 0,
        sheetName: 'Sheet1',
        rowCount: 50,
        columnCount: 3,
        lastSynced: Date.now(),
        remoteModifiedTime: '2025-01-01T00:00:00Z',
      });

      const sheets = useGoogleSheetsStore.getState().sheets;
      expect(sheets['sheet-1']).toBeDefined();
      expect(sheets['sheet-1'].spreadsheetName).toBe('Test');
      expect(sheets['sheet-1'].remoteModifiedTime).toBe('2025-01-01T00:00:00Z');
    });

    it('should update sheet sync time', () => {
      const before = Date.now();
      useGoogleSheetsStore.getState().addSheet({
        id: 'sheet-1',
        spreadsheetId: 'spread-1',
        spreadsheetName: 'Test',
        sheetId: 0,
        sheetName: 'Sheet1',
        rowCount: 50,
        columnCount: 3,
        lastSynced: before - 10000,
      });

      useGoogleSheetsStore.getState().updateSheetSyncTime('sheet-1');

      const sheet = useGoogleSheetsStore.getState().sheets['sheet-1'];
      expect(sheet.lastSynced).toBeGreaterThanOrEqual(before);
    });

    it('should remove a sheet', () => {
      useGoogleSheetsStore.getState().addSheet({
        id: 'sheet-1',
        spreadsheetId: 'spread-1',
        spreadsheetName: 'Test',
        sheetId: 0,
        sheetName: 'Sheet1',
        rowCount: 50,
        columnCount: 3,
        lastSynced: Date.now(),
      });

      useGoogleSheetsStore.getState().removeSheet('sheet-1');
      expect(useGoogleSheetsStore.getState().sheets['sheet-1']).toBeUndefined();
    });

    it('should clear all sheets', () => {
      useGoogleSheetsStore.getState().addSheet({
        id: 'sheet-1',
        spreadsheetId: 'spread-1',
        spreadsheetName: 'Test',
        sheetId: 0,
        sheetName: 'Sheet1',
        rowCount: 50,
        columnCount: 3,
        lastSynced: Date.now(),
      });
      useGoogleSheetsStore.getState().addSheet({
        id: 'sheet-2',
        spreadsheetId: 'spread-2',
        spreadsheetName: 'Test 2',
        sheetId: 0,
        sheetName: 'Sheet1',
        rowCount: 50,
        columnCount: 3,
        lastSynced: Date.now(),
      });

      useGoogleSheetsStore.getState().clearAllSheets();
      expect(Object.keys(useGoogleSheetsStore.getState().sheets)).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should set error and clear connecting state', () => {
      useGoogleSheetsStore.getState().setConnecting(true);
      useGoogleSheetsStore.getState().setError('Something failed');

      const state = useGoogleSheetsStore.getState();
      expect(state.error).toBe('Something failed');
      expect(state.isConnecting).toBe(false);
    });

    it('should clear error', () => {
      useGoogleSheetsStore.getState().setError('error');
      useGoogleSheetsStore.getState().setError(null);
      expect(useGoogleSheetsStore.getState().error).toBeNull();
    });
  });
});
