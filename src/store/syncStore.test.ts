import { describe, it, expect, beforeEach } from 'vitest';
import { useSyncStore } from './syncStore';

function resetStore() {
  useSyncStore.setState({
    nodes: {},
    activeConflict: null,
  });
}

describe('syncStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('setSyncStatus', () => {
    it('should set sync status for a node', () => {
      useSyncStore.getState().setSyncStatus('file-1', 'local_changes');
      expect(useSyncStore.getState().nodes['file-1']?.syncStatus).toBe('local_changes');
    });

    it('should preserve other node state when setting status', () => {
      useSyncStore.getState().setSyncing('file-1', true);
      useSyncStore.getState().setSyncStatus('file-1', 'local_changes');

      const node = useSyncStore.getState().nodes['file-1'];
      expect(node?.syncStatus).toBe('local_changes');
      expect(node?.isSyncing).toBe(true);
    });

    it('should handle setting status on multiple nodes independently', () => {
      useSyncStore.getState().setSyncStatus('file-1', 'local_changes');
      useSyncStore.getState().setSyncStatus('file-2', 'synced');

      expect(useSyncStore.getState().nodes['file-1']?.syncStatus).toBe('local_changes');
      expect(useSyncStore.getState().nodes['file-2']?.syncStatus).toBe('synced');
    });
  });

  describe('setSyncing', () => {
    it('should set isSyncing to true', () => {
      useSyncStore.getState().setSyncing('file-1', true);
      expect(useSyncStore.getState().nodes['file-1']?.isSyncing).toBe(true);
    });

    it('should clear syncError when starting sync', () => {
      useSyncStore.getState().setSyncError('file-1', 'some error');
      useSyncStore.getState().setSyncing('file-1', true);
      expect(useSyncStore.getState().nodes['file-1']?.syncError).toBeNull();
    });

    it('should preserve syncError when stopping sync', () => {
      useSyncStore.getState().setSyncError('file-1', 'some error');
      useSyncStore.getState().setSyncing('file-1', false);
      expect(useSyncStore.getState().nodes['file-1']?.syncError).toBe('some error');
    });
  });

  describe('setSyncError', () => {
    it('should set error and stop syncing', () => {
      useSyncStore.getState().setSyncing('file-1', true);
      useSyncStore.getState().setSyncError('file-1', 'Push failed');

      const node = useSyncStore.getState().nodes['file-1'];
      expect(node?.syncError).toBe('Push failed');
      expect(node?.isSyncing).toBe(false);
    });

    it('should clear error when set to null', () => {
      useSyncStore.getState().setSyncError('file-1', 'error');
      useSyncStore.getState().setSyncError('file-1', null);
      expect(useSyncStore.getState().nodes['file-1']?.syncError).toBeNull();
    });
  });

  describe('setLastSyncedAt', () => {
    it('should set the last synced timestamp', () => {
      const now = Date.now();
      useSyncStore.getState().setLastSyncedAt('file-1', now);
      expect(useSyncStore.getState().nodes['file-1']?.lastSyncedAt).toBe(now);
    });
  });

  describe('conflict management', () => {
    it('should show a conflict', () => {
      const conflict = {
        fileId: 'file-1',
        localChangeCount: 5,
        remoteModifiedTime: '2025-01-01T00:00:00Z',
      };
      useSyncStore.getState().showConflict(conflict);
      expect(useSyncStore.getState().activeConflict).toEqual(conflict);
    });

    it('should dismiss a conflict', () => {
      useSyncStore.getState().showConflict({
        fileId: 'file-1',
        localChangeCount: 3,
        remoteModifiedTime: '2025-01-01T00:00:00Z',
      });
      useSyncStore.getState().dismissConflict();
      expect(useSyncStore.getState().activeConflict).toBeNull();
    });
  });

  describe('getNodeState', () => {
    it('should return default state for unknown node', () => {
      const state = useSyncStore.getState().getNodeState('nonexistent');
      expect(state.syncStatus).toBe('synced');
      expect(state.isSyncing).toBe(false);
      expect(state.syncError).toBeNull();
      expect(state.lastSyncedAt).toBeNull();
    });

    it('should return actual state for known node', () => {
      useSyncStore.getState().setSyncStatus('file-1', 'conflict');
      const state = useSyncStore.getState().getNodeState('file-1');
      expect(state.syncStatus).toBe('conflict');
    });
  });

  describe('removeNode', () => {
    it('should remove node state', () => {
      useSyncStore.getState().setSyncStatus('file-1', 'local_changes');
      useSyncStore.getState().removeNode('file-1');
      expect(useSyncStore.getState().nodes['file-1']).toBeUndefined();
    });

    it('should not affect other nodes', () => {
      useSyncStore.getState().setSyncStatus('file-1', 'local_changes');
      useSyncStore.getState().setSyncStatus('file-2', 'synced');
      useSyncStore.getState().removeNode('file-1');

      expect(useSyncStore.getState().nodes['file-1']).toBeUndefined();
      expect(useSyncStore.getState().nodes['file-2']?.syncStatus).toBe('synced');
    });
  });
});
