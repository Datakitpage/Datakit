import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Canvas } from '../canvas/Canvas';
import { CommandPalette } from '../command-palette/CommandPalette';
import { AIPanel } from '../ai/AIPanel';
import { SettingsModal } from '../settings/SettingsModal';
import { useAppStore } from '@/store/appStore';

export function Layout() {
  const { 
    toggleCommandPalette, 
    toggleAIPanel,
    isCommandPaletteOpen, 
    isSettingsOpen, 
    closeSettings,
    theme 
  } = useAppStore();

  // Apply theme on mount and when it changes
  useEffect(() => {
    if (theme.primaryColor) {
      document.documentElement.style.setProperty("--primary", theme.primaryColor);
    }
    const radiusMap = { none: "0", sm: "0.25rem", md: "0.5rem", lg: "0.75rem" };
    document.documentElement.style.setProperty("--radius", radiusMap[theme.borderRadius] || "0.5rem");
  }, [theme]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + K for command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    }
    
    // Cmd/Ctrl + J for AI panel
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      toggleAIPanel();
    }
    
    // Escape to close command palette
    if (e.key === 'Escape' && isCommandPaletteOpen) {
      e.preventDefault();
      useAppStore.getState().closeCommandPalette();
    }
  }, [toggleCommandPalette, toggleAIPanel, isCommandPaletteOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <motion.main 
        className="flex-1 flex flex-col overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Top Bar */}
        <motion.header 
          className="h-12 border-b border-border flex items-center px-4 justify-between bg-background/80 backdrop-blur-sm"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-foreground">My Board</h1>
          </div>
          
          <motion.button
            onClick={toggleCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground-muted 
                       bg-secondary hover:bg-secondary-hover rounded-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>Search or command...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-background rounded-md border border-border font-mono">
              K
            </kbd>
          </motion.button>
        </motion.header>

        {/* Canvas Area */}
        <Canvas />
      </motion.main>

      {/* Command Palette Modal */}
      <CommandPalette />

      {/* AI Panel */}
      <AIPanel />

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}
