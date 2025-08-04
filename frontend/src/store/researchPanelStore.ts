import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ResearchPanelState {
  // Panel state
  isOpen: boolean;
  width: number;
  
  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setWidth: (width: number) => void;
}

export const useResearchPanelStore = create<ResearchPanelState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isOpen: false,
    width: 600, // Default width
    
    // Actions
    openPanel: () => set({ isOpen: true }),
    
    closePanel: () => set({ isOpen: false }),
    
    togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
    
    setWidth: (width: number) => {
      // Constrain width between min and max
      const constrainedWidth = Math.max(400, Math.min(1200, width));
      set({ width: constrainedWidth });
    },
  }))
);

// Persist panel width to localStorage
if (typeof window !== 'undefined') {
  const storedWidth = localStorage.getItem('datakit-research-panel-width');
  if (storedWidth) {
    const width = parseInt(storedWidth, 10);
    if (!isNaN(width)) {
      useResearchPanelStore.setState({ width });
    }
  }

  // Subscribe to width changes and persist
  useResearchPanelStore.subscribe(
    (state) => state.width,
    (width) => {
      localStorage.setItem('datakit-research-panel-width', width.toString());
    }
  );
}