import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

export type WidgetType = "metric" | "chart" | "table" | "text" | "query";

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: string;
  borderWidth?: string;
  padding?: string;
  boxShadow?: string;
  opacity?: string;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  style?: WidgetStyle;
  config: Record<string, unknown>;
  dataSourceId?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle: "top" | "right" | "bottom" | "left";
  targetHandle: "top" | "right" | "bottom" | "left";
}

interface BoardState {
  boards: Array<{ id: string; name: string; createdAt: string }>;
  activeBoardId: string | null;
  widgets: Widget[];
  connections: Connection[];
  selectedWidgetId: string | null;
  connectingFrom: { widgetId: string; handle: Connection["sourceHandle"] } | null;
  
  addWidget: (type: WidgetType, title?: string) => string;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  selectWidget: (id: string | null) => void;
  moveWidget: (id: string, position: Partial<WidgetPosition>) => void;
  resizeWidget: (id: string, size: { width: number; height: number }) => void;
  
  addConnection: (sourceId: string, targetId: string, sourceHandle: Connection["sourceHandle"], targetHandle: Connection["targetHandle"]) => void;
  removeConnection: (id: string) => void;
  startConnecting: (widgetId: string, handle: Connection["sourceHandle"]) => void;
  endConnecting: () => void;
}

const getDefaultConfig = (type: WidgetType) => {
  const configs: Record<WidgetType, { position: WidgetPosition; config: Record<string, unknown> }> = {
    metric: { position: { x: 0, y: 0, width: 3, height: 2 }, config: { value: 0, label: "Metric", format: "number" } },
    chart: { position: { x: 0, y: 0, width: 6, height: 4 }, config: { chartType: "line", data: [] } },
    table: { position: { x: 0, y: 0, width: 6, height: 4 }, config: { columns: [], rows: [] } },
    text: { position: { x: 0, y: 0, width: 4, height: 2 }, config: { content: "" } },
    query: { position: { x: 0, y: 0, width: 6, height: 4 }, config: { sql: "", results: null } },
  };
  return configs[type];
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      boards: [],
      activeBoardId: null,
      widgets: [],
      connections: [],
      selectedWidgetId: null,
      connectingFrom: null,

      addWidget: (type, title) => {
        const id = uuidv4();
        const defaults = getDefaultConfig(type);
        const widgets = get().widgets;
        
        // Smart positioning: find empty spot
        let x = 0;
        let y = 0;
        const occupied = new Set(widgets.map(w => `${w.position.x},${w.position.y}`));
        while (occupied.has(`${x},${y}`)) {
          x += 3;
          if (x > 9) { x = 0; y += 2; }
        }
        
        const newWidget: Widget = {
          id,
          type,
          title: title || "New " + capitalize(type),
          position: { ...defaults.position, x, y },
          config: defaults.config,
        };
        set((state) => ({
          widgets: [...state.widgets, newWidget],
          selectedWidgetId: id,
        }));
        return id;
      },

      removeWidget: (id) => {
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
          connections: state.connections.filter((c) => c.sourceId !== id && c.targetId !== id),
          selectedWidgetId: state.selectedWidgetId === id ? null : state.selectedWidgetId,
        }));
      },

      updateWidget: (id, updates) => {
        set((state) => ({
          widgets: state.widgets.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        }));
      },

      selectWidget: (id) => set({ selectedWidgetId: id }),

      moveWidget: (id, position) => {
        set((state) => ({
          widgets: state.widgets.map((w) => (w.id === id ? { ...w, position: { ...w.position, ...position } } : w)),
        }));
      },

      resizeWidget: (id, size) => {
        set((state) => ({
          widgets: state.widgets.map((w) => (w.id === id ? { ...w, position: { ...w.position, ...size } } : w)),
        }));
      },

      addConnection: (sourceId, targetId, sourceHandle, targetHandle) => {
        if (sourceId === targetId) return;
        const existing = get().connections.find(
          c => c.sourceId === sourceId && c.targetId === targetId
        );
        if (existing) return;
        
        set((state) => ({
          connections: [...state.connections, {
            id: uuidv4(),
            sourceId,
            targetId,
            sourceHandle,
            targetHandle,
          }],
        }));
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
        }));
      },

      startConnecting: (widgetId, handle) => {
        set({ connectingFrom: { widgetId, handle } });
      },

      endConnecting: () => {
        set({ connectingFrom: null });
      },
    }),
    {
      name: "board-storage",
      partialize: (state) => ({ 
        boards: state.boards, 
        widgets: state.widgets, 
        connections: state.connections,
        activeBoardId: state.activeBoardId 
      }),
    }
  )
);
