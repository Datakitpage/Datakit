import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentType } from './ContentNode';

interface FileContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  file: {
    id: string;
    name: string;
    type: ContentType;
    size: number;
    rowCount?: number;
    columnCount?: number;
  };
  onOpen: () => void;
  onRename: (newName: string) => void;
  onDelete?: () => void;
}

// Format file size helper
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Type label map
const typeLabels: Record<ContentType, string> = {
  csv: 'CSV Spreadsheet',
  json: 'JSON Data',
  xlsx: 'Excel Spreadsheet',
  parquet: 'Parquet File',
  txt: 'Text File',
  md: 'Markdown',
  image: 'Image',
  pdf: 'PDF Document',
  unknown: 'File',
};

export function FileContextMenu({
  isOpen,
  onClose,
  position,
  file,
  onOpen,
  onRename,
  onDelete,
}: FileContextMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(file.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // Select filename without extension
      const dotIndex = renameValue.lastIndexOf('.');
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming, renameValue]);

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
          setRenameValue(file.name);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isRenaming, file.name, onClose]);

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== file.name) {
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
      setRenameValue(file.name);
    }
  };

  // Use portal to render at body level, fixing positioning inside transformed containers
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          className="fixed z-[9999] min-w-[200px] max-w-[280px] rounded-xl overflow-hidden backdrop-blur-xl"
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
          {/* File info header */}
          <div
            className="px-3 py-2.5 border-b"
            style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}
          >
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
                className="w-full text-sm font-medium px-1.5 py-0.5 rounded-md outline-none"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  color: '#1a1a1a',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                }}
              />
            ) : (
              <div
                className="text-sm font-medium truncate max-w-[230px]"
                style={{ color: '#1a1a1a' }}
                title={file.name}
              >
                {file.name}
              </div>
            )}
            <div className="text-[11px] mt-1" style={{ color: '#8b8b8b' }}>
              {typeLabels[file.type]}
            </div>
          </div>

          {/* File details */}
          <div
            className="px-3 py-2 text-[11px] grid grid-cols-2 gap-x-4 gap-y-1 border-b"
            style={{
              borderColor: 'rgba(0, 0, 0, 0.06)',
              color: '#4a4a4a',
            }}
          >
            <span style={{ color: '#8b8b8b' }}>Size</span>
            <span>{formatFileSize(file.size)}</span>
            {file.rowCount !== undefined && (
              <>
                <span style={{ color: '#8b8b8b' }}>Rows</span>
                <span>{file.rowCount.toLocaleString()}</span>
              </>
            )}
            {file.columnCount !== undefined && (
              <>
                <span style={{ color: '#8b8b8b' }}>Columns</span>
                <span>{file.columnCount}</span>
              </>
            )}
          </div>

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
            {onDelete && (
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
                Delete
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default FileContextMenu;
