import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDuckDBViewStore } from '@/store/duckDBViewStore';
import { useSyncStore } from '@/store/syncStore';
import type { CommittedVersion } from '@/store/duckDBViewStore';

// Mock DuckDB initialization
vi.mock('@/lib/duckdb/init', () => ({
  initializeDuckDB: vi.fn(),
  cleanup: vi.fn(),
}));

/**
 * These tests verify the sync status lifecycle for Google Sheet nodes.
 *
 * The key fix: FocusedFileView now uses a reactive Zustand selector
 * `committedChangeCount` instead of a local boolean `hasCommittedChanges`.
 * This ensures the sync status effect fires on EVERY commit (not just the first)
 * and also fires when committed versions are cleared after a push.
 *
 * Lifecycle: edit → commit → Push button appears → push → Push button gone → edit → commit → Push button reappears
 */

const viewName = 'gsheet_test_view';
const fileId = 'file-gsheet-1';

function makeVersion(changeCount: number, id?: string): CommittedVersion {
  return {
    id: id || `v_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    changes: Array.from({ length: changeCount }, (_, i) => ({
      id: `change-${i}`,
      viewName,
      rowId: i + 1,
      column: 'Name',
      oldValue: `old-${i}`,
      newValue: `new-${i}`,
      changeType: 'update' as const,
      timestamp: Date.now(),
      source: 'user' as const,
    })),
    timestamp: Date.now(),
    description: `Version with ${changeCount} changes`,
  };
}

function resetStores() {
  useDuckDBViewStore.setState({
    committedVersions: new Map(),
    currentVersionIndex: new Map(),
    pendingChanges: new Map(),
    dataVersion: new Map(),
  });
  useSyncStore.setState({
    nodes: {},
    activeConflict: null,
  });
}

/**
 * Simulates the useEffect in FocusedFileView that updates sync status
 * based on committedChangeCount. This is the core logic we're testing.
 */
function runSyncStatusEffect(nodeFileId: string) {
  const committedVersions = useDuckDBViewStore.getState().committedVersions.get(viewName) || [];
  const committedChangeCount = committedVersions.reduce((sum, v) => sum + v.changes.length, 0);

  const syncStore = useSyncStore.getState();
  if (committedChangeCount > 0 && syncStore.nodes[nodeFileId]?.syncStatus !== 'conflict') {
    syncStore.setSyncStatus(nodeFileId, 'local_changes');
  } else if (committedChangeCount === 0 && syncStore.nodes[nodeFileId]?.syncStatus === 'local_changes') {
    syncStore.setSyncStatus(nodeFileId, 'synced');
  }
}

describe('FocusedFileView — sync status lifecycle', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('committedChangeCount selector', () => {
    it('should return 0 when no committed versions exist', () => {
      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(0);
    });

    it('should return correct count for a single committed version', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(3)]);
        return { committedVersions: cv };
      });

      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(3);
    });

    it('should sum changes across multiple committed versions', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2), makeVersion(5), makeVersion(1)]);
        return { committedVersions: cv };
      });

      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(8);
    });

    it('should return 0 after clearCommittedVersions', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(5)]);
        return { committedVersions: cv };
      });

      // Simulate push → clearCommittedVersions
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(0);
    });

    it('should be isolated per view (clearing one view does not affect another)', () => {
      const otherView = 'gsheet_other_view';

      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(3)]);
        cv.set(otherView, [makeVersion(7)]);
        return { committedVersions: cv };
      });

      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      const mainCount = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      const otherCount = (useDuckDBViewStore.getState().committedVersions.get(otherView) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);

      expect(mainCount).toBe(0);
      expect(otherCount).toBe(7);
    });
  });

  describe('sync status effect — first commit', () => {
    it('should set status to local_changes after first commit', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2)]);
        return { committedVersions: cv };
      });

      runSyncStatusEffect(fileId);

      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');
    });

    it('should set status to local_changes even for single-cell edit', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1)]);
        return { committedVersions: cv };
      });

      runSyncStatusEffect(fileId);

      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');
    });
  });

  describe('sync status effect — push clears status', () => {
    it('should set status back to synced after push clears committed versions', () => {
      // Step 1: Commit changes
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(3)]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');

      // Step 2: Simulate push → clearCommittedVersions
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      runSyncStatusEffect(fileId);

      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('synced');
    });
  });

  describe('sync status effect — FULL LIFECYCLE (the bug fix)', () => {
    it('should show Push button after SECOND commit (edit → commit → push → edit → commit)', () => {
      // === Commit 1 ===
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2, 'v1')]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');

      // === Push (clears committed versions) ===
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('synced');

      // === Commit 2 ===
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1, 'v2')]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);

      // THIS IS THE BUG FIX: with old boolean, this would stay 'synced'
      // because setHasCommittedChanges(true) was a no-op when already true
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');
    });

    it('should handle multiple push cycles correctly', () => {
      for (let cycle = 1; cycle <= 5; cycle++) {
        // Commit
        useDuckDBViewStore.setState(state => {
          const cv = new Map(state.committedVersions);
          cv.set(viewName, [makeVersion(cycle, `v-cycle-${cycle}`)]);
          return { committedVersions: cv };
        });
        runSyncStatusEffect(fileId);
        expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');

        // Push
        useDuckDBViewStore.getState().clearCommittedVersions(viewName);
        runSyncStatusEffect(fileId);
        expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('synced');
      }
    });

    it('should handle commit → commit → push (accumulating changes before push)', () => {
      // Commit 1: 2 changes
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2, 'v1')]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');

      // Commit 2: 3 more changes (total 5)
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        const existing = cv.get(viewName) || [];
        cv.set(viewName, [...existing, makeVersion(3, 'v2')]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');

      // Check count is 5
      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(5);

      // Push clears all
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('synced');

      // New commit after push
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1, 'v3')]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');
    });
  });

  describe('sync status effect — conflict handling', () => {
    it('should NOT override conflict status even if committed changes exist', () => {
      useSyncStore.getState().setSyncStatus(fileId, 'conflict');

      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(3)]);
        return { committedVersions: cv };
      });

      runSyncStatusEffect(fileId);

      // Conflict should NOT be overridden
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('conflict');
    });

    it('should NOT set to synced when in conflict and versions are cleared', () => {
      useSyncStore.getState().setSyncStatus(fileId, 'conflict');

      // Clear committed versions (e.g. force-pull discards local)
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      runSyncStatusEffect(fileId);

      // Conflict stays — it's not 'local_changes' so the else-if doesn't match
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('conflict');
    });

    it('should resume normal lifecycle after conflict is resolved', () => {
      // Start in conflict
      useSyncStore.getState().setSyncStatus(fileId, 'conflict');

      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2)]);
        return { committedVersions: cv };
      });

      // Conflict blocks override
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('conflict');

      // Resolve conflict → set to synced
      useSyncStore.getState().setSyncStatus(fileId, 'synced');
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      // New edit → commit cycle works again
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1)]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');
    });
  });

  describe('sync status effect — remote_changes handling', () => {
    it('should NOT set to synced when status is remote_changes and committed versions are cleared', () => {
      useSyncStore.getState().setSyncStatus(fileId, 'remote_changes');

      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      runSyncStatusEffect(fileId);

      // remote_changes is not 'local_changes', so else-if doesn't match
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('remote_changes');
    });

    it('should override remote_changes with local_changes when user commits', () => {
      useSyncStore.getState().setSyncStatus(fileId, 'remote_changes');

      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1)]);
        return { committedVersions: cv };
      });

      runSyncStatusEffect(fileId);

      // remote_changes is not 'conflict', so it gets overridden
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');
    });
  });

  describe('sync status effect — edge cases', () => {
    it('should handle empty committed version (0 changes)', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(0)]);
        return { committedVersions: cv };
      });

      runSyncStatusEffect(fileId);

      // 0 changes in version → count is 0 → should not set to local_changes
      // But since status isn't 'local_changes', else-if won't set to synced either
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBeUndefined();
    });

    it('should handle node that has never been synced (no entry in syncStore)', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2)]);
        return { committedVersions: cv };
      });

      // No prior syncStore entry — should still set local_changes
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');
    });

    it('should not throw when view has no committed versions at all', () => {
      expect(() => runSyncStatusEffect(fileId)).not.toThrow();
    });

    it('should handle rapid commit-push-commit cycles without losing state', () => {
      // Rapid cycle 1
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1, 'rapid-1')]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');

      // Immediate push
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('synced');

      // Immediate commit again (no delay)
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1, 'rapid-2')]);
        return { committedVersions: cv };
      });
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('local_changes');

      // Immediate push again
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      runSyncStatusEffect(fileId);
      expect(useSyncStore.getState().nodes[fileId]?.syncStatus).toBe('synced');
    });
  });

  describe('committedChangeCount reactivity (Zustand selector)', () => {
    it('should produce different Map references when committed versions change', () => {
      const mapBefore = useDuckDBViewStore.getState().committedVersions;

      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1)]);
        return { committedVersions: cv };
      });

      const mapAfter = useDuckDBViewStore.getState().committedVersions;

      // New Map reference — Zustand will detect this as a change and re-render
      expect(mapBefore).not.toBe(mapAfter);
    });

    it('should produce different Map reference when clearCommittedVersions is called', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2)]);
        return { committedVersions: cv };
      });

      const mapBefore = useDuckDBViewStore.getState().committedVersions;

      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      const mapAfter = useDuckDBViewStore.getState().committedVersions;

      // New Map reference after clear
      expect(mapBefore).not.toBe(mapAfter);
    });

    it('should produce different Map reference on each commit (not just first)', () => {
      // First commit
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1, 'v1')]);
        return { committedVersions: cv };
      });
      const map1 = useDuckDBViewStore.getState().committedVersions;

      // Push
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      const map2 = useDuckDBViewStore.getState().committedVersions;

      // Second commit
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1, 'v2')]);
        return { committedVersions: cv };
      });
      const map3 = useDuckDBViewStore.getState().committedVersions;

      // Every step produces a new Map — Zustand will re-render each time
      expect(map1).not.toBe(map2);
      expect(map2).not.toBe(map3);
      expect(map1).not.toBe(map3);
    });
  });

  describe('localChangeCount prop derivation', () => {
    it('should compute localChangeCount as total changes across all versions', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(3, 'v1'), makeVersion(2, 'v2')]);
        return { committedVersions: cv };
      });

      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(5);
    });

    it('should return 0 for localChangeCount after push', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(10)]);
        return { committedVersions: cv };
      });

      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(0);
    });

    it('should update localChangeCount incrementally as versions accumulate', () => {
      // Version 1
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2, 'v1')]);
        return { committedVersions: cv };
      });

      let count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(2);

      // Version 2 (appended)
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        const existing = cv.get(viewName) || [];
        cv.set(viewName, [...existing, makeVersion(4, 'v2')]);
        return { committedVersions: cv };
      });

      count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(6);

      // Version 3 (appended)
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        const existing = cv.get(viewName) || [];
        cv.set(viewName, [...existing, makeVersion(1, 'v3')]);
        return { committedVersions: cv };
      });

      count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count).toBe(7);
    });
  });

  describe('hasCommittedChanges prop derivation', () => {
    it('should be false when committedChangeCount is 0', () => {
      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count > 0).toBe(false);
    });

    it('should be true when committedChangeCount is > 0', () => {
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1)]);
        return { committedVersions: cv };
      });

      const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
        .reduce((sum, v) => sum + v.changes.length, 0);
      expect(count > 0).toBe(true);
    });

    it('should toggle correctly through commit-push-commit cycle', () => {
      const getHasCommitted = () => {
        const count = (useDuckDBViewStore.getState().committedVersions.get(viewName) || [])
          .reduce((sum, v) => sum + v.changes.length, 0);
        return count > 0;
      };

      // Initially false
      expect(getHasCommitted()).toBe(false);

      // Commit → true
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(2)]);
        return { committedVersions: cv };
      });
      expect(getHasCommitted()).toBe(true);

      // Push → false
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      expect(getHasCommitted()).toBe(false);

      // Commit again → true
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [makeVersion(1)]);
        return { committedVersions: cv };
      });
      expect(getHasCommitted()).toBe(true);

      // Push again → false
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);
      expect(getHasCommitted()).toBe(false);
    });
  });
});
