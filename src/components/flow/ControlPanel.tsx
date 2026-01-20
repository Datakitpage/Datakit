import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ControlPanelProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomToFit: () => void;
  onCenterCanvas: () => void;
  nodeCount: number;
  connectionCount: number;
  onToggleAI: () => void;
  aiActive?: boolean;
}

export function ControlPanel({
  zoom,
  onZoomChange,
  onZoomToFit,
  onCenterCanvas,
  nodeCount,
  connectionCount,
  onToggleAI,
  aiActive,
}: ControlPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Main panel */}
      <motion.div
        className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden"
        style={{
          border: '1px solid rgba(0,0,0,0.06)',
        }}
        layout
      >
        {/* Collapsed: Quick actions */}
        <div className="flex items-center gap-1 p-2">
          {/* Zoom out */}
          <motion.button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const idx = zoomLevels.findIndex(z => z >= zoom);
              if (idx > 0) onZoomChange(zoomLevels[idx - 1]);
            }}
          >
            <span className="text-sm">−</span>
          </motion.button>

          {/* Zoom level */}
          <motion.button
            className="px-2 h-8 rounded-lg flex items-center justify-center text-xs font-mono text-stone-600 hover:bg-stone-100 min-w-[48px]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onZoomChange(1)}
          >
            {Math.round(zoom * 100)}%
          </motion.button>

          {/* Zoom in */}
          <motion.button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const idx = zoomLevels.findIndex(z => z > zoom);
              if (idx !== -1) onZoomChange(zoomLevels[idx]);
            }}
          >
            <span className="text-sm">+</span>
          </motion.button>

          {/* Divider */}
          <div className="w-px h-5 bg-stone-200 mx-1" />

          {/* Fit to screen */}
          <motion.button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onZoomToFit}
            title="Fit to screen"
          >
            <span className="text-xs">⊡</span>
          </motion.button>

          {/* Center */}
          <motion.button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCenterCanvas}
            title="Center canvas"
          >
            <span className="text-xs">◎</span>
          </motion.button>

          {/* Divider */}
          <div className="w-px h-5 bg-stone-200 mx-1" />

          {/* AI Toggle */}
          <motion.button
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              aiActive ? 'bg-violet-100 text-violet-600' : 'text-stone-500 hover:bg-stone-100'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleAI}
            title="AI Assistant (⌘J)"
          >
            <span className="text-sm">✦</span>
          </motion.button>

          {/* Expand */}
          <motion.button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setExpanded(!expanded)}
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              className="text-xs"
            >
              ▴
            </motion.span>
          </motion.button>
        </div>

        {/* Expanded section */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-1 border-t border-stone-100">
                {/* Stats */}
                <div className="flex gap-4 text-xs text-stone-500 mb-3">
                  <span>{nodeCount} nodes</span>
                  <span>{connectionCount} connections</span>
                </div>

                {/* Minimap placeholder */}
                <div
                  className="w-full h-24 rounded-lg bg-stone-50 flex items-center justify-center text-xs text-stone-300"
                  style={{ border: '1px solid rgba(0,0,0,0.04)' }}
                >
                  Minimap coming soon
                </div>

                {/* Keyboard hints */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Command palette</span>
                    <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] text-stone-500">⌘K</kbd>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">AI assistant</span>
                    <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] text-stone-500">⌘J</kbd>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Delete selected</span>
                    <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] text-stone-500">⌫</kbd>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Performance indicator */}
      <motion.div
        className="absolute -top-2 -right-2 w-3 h-3 rounded-full"
        style={{ backgroundColor: '#22C55E' }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [1, 0.7, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        title="System healthy"
      />
    </motion.div>
  );
}

// Quick action floating button (for AI)
interface QuickActionButtonProps {
  icon: string;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  position?: 'left' | 'right';
}

export function QuickActionButton({
  icon,
  label,
  shortcut,
  onClick,
  active,
  position = 'right',
}: QuickActionButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      className={`fixed bottom-6 ${position === 'right' ? 'right-6' : 'left-6'} z-40`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
          active
            ? 'bg-violet-500 text-white'
            : 'bg-white text-stone-700'
        }`}
        style={{
          border: active ? 'none' : '1px solid rgba(0,0,0,0.06)',
        }}
        layout
      >
        <span>{icon}</span>
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="text-sm whitespace-nowrap overflow-hidden"
            >
              {label}
              {shortcut && (
                <span className="ml-2 opacity-60">{shortcut}</span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.button>
  );
}
