import { create } from 'zustand';

/**
 * Connection port info
 */
export interface Port {
  nodeId: string;
  type: 'input' | 'output';
  position: { x: number; y: number };
  dataType?: string; // For type validation
}

/**
 * Active connection being dragged
 */
export interface ActiveConnection {
  fromPort: Port;
  currentPosition: { x: number; y: number };
  snappedTarget?: Port;
}

/**
 * Connection store state
 */
interface ConnectionState {
  // Active drag connection
  activeConnection: ActiveConnection | null;

  // All registered ports (updated by nodes)
  ports: Map<string, Port>;

  // Snapping settings
  snapDistance: number;

  // Actions
  startConnection: (fromPort: Port) => void;
  updateConnectionPosition: (position: { x: number; y: number }) => void;
  completeConnection: () => { from: Port; to: Port } | null;
  cancelConnection: () => void;

  // Port registration
  registerPort: (id: string, port: Port) => void;
  unregisterPort: (id: string) => void;
  updatePortPosition: (id: string, position: { x: number; y: number }) => void;

  // Helpers
  getValidTargets: () => Port[];
  findSnapTarget: (position: { x: number; y: number }) => Port | null;
  isValidConnection: (from: Port, to: Port) => boolean;
}

/**
 * Connection store for managing drag-to-connect interactions
 */
export const useConnectionStore = create<ConnectionState>((set, get) => ({
  activeConnection: null,
  ports: new Map(),
  snapDistance: 50,

  startConnection: (fromPort) => {
    set({
      activeConnection: {
        fromPort,
        currentPosition: fromPort.position,
        snappedTarget: undefined,
      },
    });
  },

  updateConnectionPosition: (position) => {
    const state = get();
    if (!state.activeConnection) return;

    // Find snap target
    const snappedTarget = state.findSnapTarget(position);

    set({
      activeConnection: {
        ...state.activeConnection,
        currentPosition: position,
        snappedTarget: snappedTarget ?? undefined,
      },
    });
  },

  completeConnection: () => {
    const state = get();
    if (!state.activeConnection) return null;

    const { fromPort, snappedTarget } = state.activeConnection;

    // Clear active connection
    set({ activeConnection: null });

    // Return connection if we have a valid target
    if (snappedTarget && state.isValidConnection(fromPort, snappedTarget)) {
      return { from: fromPort, to: snappedTarget };
    }

    return null;
  },

  cancelConnection: () => {
    set({ activeConnection: null });
  },

  registerPort: (id, port) => {
    const ports = new Map(get().ports);
    ports.set(id, port);
    set({ ports });
  },

  unregisterPort: (id) => {
    const ports = new Map(get().ports);
    ports.delete(id);
    set({ ports });
  },

  updatePortPosition: (id, position) => {
    const ports = new Map(get().ports);
    const port = ports.get(id);
    if (port) {
      ports.set(id, { ...port, position });
      set({ ports });
    }
  },

  getValidTargets: () => {
    const state = get();
    if (!state.activeConnection) return [];

    const { fromPort } = state.activeConnection;
    const targets: Port[] = [];

    state.ports.forEach((port) => {
      if (state.isValidConnection(fromPort, port)) {
        targets.push(port);
      }
    });

    return targets;
  },

  findSnapTarget: (position) => {
    const state = get();
    if (!state.activeConnection) return null;

    const { fromPort } = state.activeConnection;
    const { snapDistance, ports } = state;

    let closestTarget: Port | null = null;
    let closestDistance = snapDistance;

    ports.forEach((port) => {
      if (!state.isValidConnection(fromPort, port)) return;

      const distance = Math.hypot(
        port.position.x - position.x,
        port.position.y - position.y
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestTarget = port;
      }
    });

    return closestTarget;
  },

  isValidConnection: (from, to) => {
    // Can't connect to self
    if (from.nodeId === to.nodeId) return false;

    // Must connect output to input
    if (from.type === to.type) return false;

    // Type validation (if types are specified)
    if (from.dataType && to.dataType && from.dataType !== to.dataType) {
      return false;
    }

    return true;
  },
}));

/**
 * Hook for checking if a port is being hovered during connection
 */
export function usePortHoverState(portId: string) {
  const activeConnection = useConnectionStore((state) => state.activeConnection);

  if (!activeConnection) return { isConnecting: false, isSnapped: false, isValidTarget: false };

  const port = useConnectionStore.getState().ports.get(portId);
  if (!port) return { isConnecting: true, isSnapped: false, isValidTarget: false };

  const isSnapped = activeConnection.snappedTarget?.nodeId === port.nodeId &&
    activeConnection.snappedTarget?.type === port.type;

  const isValidTarget = useConnectionStore.getState().isValidConnection(
    activeConnection.fromPort,
    port
  );

  return { isConnecting: true, isSnapped, isValidTarget };
}

export default useConnectionStore;
