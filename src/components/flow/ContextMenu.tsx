import { motion, AnimatePresence } from 'framer-motion';

interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  position: { x: number; y: number } | null;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  if (!position) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Menu */}
      <motion.div
        className="fixed z-50 bg-white rounded-lg shadow-xl overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          minWidth: 160,
          border: '1px solid rgba(0,0,0,0.06)',
        }}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.15 }}
      >
        <div className="py-1">
          {items.map((item, index) => (
            <motion.button
              key={index}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                item.disabled
                  ? 'text-stone-300 cursor-not-allowed'
                  : item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-stone-700 hover:bg-stone-50'
              }`}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              whileHover={!item.disabled ? { x: 2 } : undefined}
            >
              {item.icon && <span className="text-xs opacity-60">{item.icon}</span>}
              {item.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// Keyboard shortcut hints
interface ShortcutHintProps {
  keys: string[];
  label: string;
}

export function ShortcutHint({ keys, label }: ShortcutHintProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-stone-400">
      <div className="flex gap-0.5">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="px-1.5 py-0.5 bg-stone-100 rounded text-stone-500 font-mono text-[10px]"
          >
            {key}
          </kbd>
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
}
