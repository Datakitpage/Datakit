import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, ArrowUp, ArrowDown } from 'lucide-react';

interface CellContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onCopy: () => void;
  isHeader?: boolean;
  onSort?: (direction: 'asc' | 'desc') => void;
  cellValue?: string;
}

const CellContextMenu: React.FC<CellContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onCopy,
  isHeader = false,
  onSort,
  cellValue = ''
}) => {
  if (!isOpen) return null;

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Context Menu */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-50 bg-popover backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {isHeader ? (
            // Header context menu - sorting options
            <>
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleItemClick(() => onSort?.('asc'))}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowUp size={14} />
                Sort Ascending
              </motion.button>
              
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleItemClick(() => onSort?.('desc'))}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowDown size={14} />
                Sort Descending
              </motion.button>
            </>
          ) : (
            // Regular cell context menu - copy option
            <motion.button
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleItemClick(onCopy)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy size={14} />
              Copy "{cellValue.length > 15 ? cellValue.substring(0, 15) + '...' : cellValue}"
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default CellContextMenu;