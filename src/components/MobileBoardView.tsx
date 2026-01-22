import { motion } from 'framer-motion';
import { useBoardStore } from '@/store/boardStore';
import { useMemo } from 'react';

export function MobileBoardView() {
  const { files, folders, focusFile } = useBoardStore();

  // Filter out sample files - only show user's actual files
  const userFiles = useMemo(
    () => files.filter(f => !f.id.startsWith('sample-')),
    [files]
  );

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'csv':
        return '⊞';
      case 'json':
        return '{ }';
      case 'xlsx':
        return '⊞';
      case 'parquet':
        return '◈';
      case 'txt':
      case 'md':
        return '≡';
      case 'image':
        return '◻';
      case 'pdf':
        return '◰';
      default:
        return '◎';
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ backgroundColor: 'var(--surface-primary)' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          className="text-base font-medium tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          OpenSheet
        </span>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-4 py-6">
        {/* Desktop message banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 p-4 rounded-xl"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                Best on desktop
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                For the full experience with drag-and-drop, zoom, and AI features, visit on a desktop browser.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Contact link */}
        <motion.a
          href="https://amin.contact"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 p-4 rounded-xl flex items-center gap-3"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex-1">
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              Say hello
            </p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              amin.contact
            </p>
          </div>
          <span style={{ color: 'var(--text-tertiary)' }}>→</span>
        </motion.a>

        {/* Divider with label if user has files */}
        {userFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 mb-4"
          >
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Your files
            </span>
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: 'var(--border-subtle)' }}
            />
          </motion.div>
        )}

        {/* User files list */}
        <div className="flex flex-col gap-2">
          {userFiles.map((file, index) => (
            <motion.button
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              onClick={() => focusFile(file.id)}
              className="w-full p-4 rounded-xl flex items-center gap-3 text-left transition-colors active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span
                className="text-xl w-8 h-8 flex items-center justify-center rounded-lg"
                style={{
                  backgroundColor: 'var(--surface-tertiary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {getFileIcon(file.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {file.rowCount ? `${file.rowCount} rows` : file.type.toUpperCase()}
                  {file.columnCount ? ` · ${file.columnCount} cols` : ''}
                </p>
              </div>
              <span style={{ color: 'var(--text-tertiary)' }}>→</span>
            </motion.button>
          ))}
        </div>

        {/* Folders */}
        {folders.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3 mt-6 mb-4"
            >
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Folders
              </span>
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              />
            </motion.div>
            <div className="flex flex-col gap-2">
              {folders.map((folder, index) => (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="w-full p-4 rounded-xl flex items-center gap-3"
                  style={{
                    backgroundColor: 'var(--surface-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span
                    className="text-xl w-8 h-8 flex items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: folder.color || 'var(--surface-tertiary)',
                      color: 'white',
                    }}
                  >
                    📁
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {folder.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {folder.fileIds.length} files
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Empty state when no user files */}
        {userFiles.length === 0 && folders.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-12"
          >
            <span
              className="text-5xl mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ◎
            </span>
            <p
              className="text-base font-light mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              No files yet
            </p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Drop files on desktop to get started
            </p>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="px-4 py-4 text-center"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          OpenSheet — Explore your data visually
        </p>
      </footer>
    </div>
  );
}
