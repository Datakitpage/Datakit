import { create } from 'zustand';

export type SyncStatus = 'synced' | 'local_changes' | 'remote_changes' | 'conflict';

export interface ConflictInfo {
  fileId: string;
  localChangeCount: number;
  remoteModifiedTime: string;
}

interface SyncNodeState {
  syncStatus: SyncStatus;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedAt: number | null;
}

interface SyncState {
  // Per-node sync state, keyed by fileId
  nodes: Record<string, SyncNodeState>;

  // Active conflict dialog
  activeConflict: ConflictInfo | null;

  // Actions
  setSyncStatus: (fileId: string, status: SyncStatus) => void;
  setSyncing: (fileId: string, isSyncing: boolean) => void;
  setSyncError: (fileId: string, error: string | null) => void;
  setLastSyncedAt: (fileId: string, timestamp: number) => void;
  showConflict: (conflict: ConflictInfo) => void;
  dismissConflict: () => void;
  getNodeState: (fileId: string) => SyncNodeState;
  removeNode: (fileId: string) => void;
}

const defaultNodeState: SyncNodeState = {
  syncStatus: 'synced',
  isSyncing: false,
  syncError: null,
  lastSyncedAt: null,
};

export const useSyncStore = create<SyncState>((set, get) => ({
  nodes: {},
  activeConflict: null,

  setSyncStatus: (fileId, status) => {
    set(state => ({
      nodes: {
        ...state.nodes,
        [fileId]: { ...(state.nodes[fileId] || defaultNodeState), syncStatus: status },
      },
    }));
  },

  setSyncing: (fileId, isSyncing) => {
    set(state => ({
      nodes: {
        ...state.nodes,
        [fileId]: { ...(state.nodes[fileId] || defaultNodeState), isSyncing, syncError: isSyncing ? null : state.nodes[fileId]?.syncError ?? null },
      },
    }));
  },

  setSyncError: (fileId, error) => {
    set(state => ({
      nodes: {
        ...state.nodes,
        [fileId]: { ...(state.nodes[fileId] || defaultNodeState), syncError: error, isSyncing: false },
      },
    }));
  },

  setLastSyncedAt: (fileId, timestamp) => {
    set(state => ({
      nodes: {
        ...state.nodes,
        [fileId]: { ...(state.nodes[fileId] || defaultNodeState), lastSyncedAt: timestamp },
      },
    }));
  },

  showConflict: (conflict) => {
    set({ activeConflict: conflict });
  },

  dismissConflict: () => {
    set({ activeConflict: null });
  },

  getNodeState: (fileId) => {
    return get().nodes[fileId] || defaultNodeState;
  },

  removeNode: (fileId) => {
    set(state => {
      const { [fileId]: _, ...rest } = state.nodes;
      return { nodes: rest };
    });
  },
}));
