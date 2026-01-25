import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Folder } from '@/store/boardStore';

interface FolderContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  folder: Folder;
  fileCount: number;
  onOpen: () => void;
  onRename: (newName: string) => void;
  onChangeColor: (color: string) => void;
  onDelete: () => void;
}

// Folder color presets
const FOLDER_COLORS = [
  { name: 'Purple', color: '#6366F1' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Green', color: '#10B981' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Orange', color: '#F59E0B' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Gray', color: '#6B7280' },
];

export function FolderContextMenu({
  isOpen,
  onClose,
  position,
  folder,
  fileCount,
  onOpen,
  onRename,
  onChangeColor,
  onDelete,
}: FolderContextMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when menu opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Resetting state when menu opens is intentional
      setIsRenaming(false);
      setShowColorPicker(false);
      setRenameValue(folder.name);
    }
  }, [isOpen, folder.name]);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRenaming) {
          setIsRenaming(false);
          setRenameValue(folder.name);
        } else if (showColorPicker) {
          setShowColorPicker(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isRenaming, showColorPicker, folder.name, onClose]);

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      onRename(renameValue.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setRenameValue(folder.name);
    }
  };

  const handleColorSelect = (color: string) => {
    onChangeColor(color);
    setShowColorPicker(false);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          className="fixed z-[9999] min-w-[220px] max-w-[280px] rounded-xl overflow-hidden backdrop-blur-xl"
          style={{
            left: position.x,
            top: position.y,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.05)',
          }}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.1 }}
        >
          {/* Folder info header */}
          <div
            className="px-3 py-2.5 border-b"
            style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}
          >
            <div className="flex items-center gap-2">
              {/* Folder icon with current color */}
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-white text-xs"
                style={{ backgroundColor: folder.color || '#6366F1' }}
              >
                📁
              </div>
              {isRenaming ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={handleRenameSubmit}
                  className="flex-1 text-sm font-medium px-1.5 py-0.5 rounded-md outline-none"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    color: '#1a1a1a',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                  }}
                />
              ) : (
                <div
                  className="flex-1 text-sm font-medium truncate max-w-[200px]"
                  style={{ color: '#1a1a1a' }}
                  title={folder.name}
                >
                  {folder.name}
                </div>
              )}
            </div>
            <div className="text-[11px] mt-1 ml-7" style={{ color: '#8b8b8b' }}>
              {fileCount} file{fileCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Color picker section */}
          <AnimatePresence>
            {showColorPicker && (
              <motion.div
                className="px-3 py-2 border-b"
                style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="text-[11px] mb-2" style={{ color: '#8b8b8b' }}>
                  Choose color
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {FOLDER_COLORS.map(({ name, color }) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded-lg transition-transform hover:scale-110 relative"
                      style={{
                        backgroundColor: color,
                        boxShadow: folder.color === color
                          ? `0 0 0 2px white, 0 0 0 4px ${color}`
                          : '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                      onClick={() => handleColorSelect(color)}
                      title={name}
                    >
                      {folder.color === color && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-sm">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="py-1 px-1">
            <button
              className="w-full px-2 py-1.5 text-left text-[13px] flex items-center gap-2 rounded-md transition-colors"
              style={{ color: '#1a1a1a' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => {
                onOpen();
                onClose();
              }}
            >
              <span className="text-xs w-4 text-center opacity-50">↵</span>
              Open
            </button>
            <button
              className="w-full px-2 py-1.5 text-left text-[13px] flex items-center gap-2 rounded-md transition-colors"
              style={{ color: '#1a1a1a' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => setIsRenaming(true)}
            >
              <span className="text-xs w-4 text-center opacity-50">✎</span>
              Rename
            </button>
            <button
              className="w-full px-2 py-1.5 text-left text-[13px] flex items-center justify-between rounded-md transition-colors"
              style={{ color: '#1a1a1a' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs w-4 text-center opacity-50">◐</span>
                Change Color
              </span>
              <span
                className="w-4 h-4 rounded"
                style={{ backgroundColor: folder.color || '#6366F1' }}
              />
            </button>
            <div
              className="my-1 mx-2 border-t"
              style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}
            />
            <button
              className="w-full px-2 py-1.5 text-left text-[13px] flex items-center gap-2 rounded-md transition-colors"
              style={{ color: '#dc2626' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <span className="text-xs w-4 text-center opacity-50">×</span>
              Delete Folder
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default FolderContextMenu;
