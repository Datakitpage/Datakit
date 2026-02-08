import { motion, AnimatePresence } from 'framer-motion';

interface SyncConflictDialogProps {
  isOpen: boolean;
  localChangeCount: number;
  remoteModifiedTime: string;
  onPush: () => void;
  onPull: () => void;
  onCancel: () => void;
}

export function SyncConflictDialog({
  isOpen,
  localChangeCount,
  remoteModifiedTime,
  onPush,
  onPull,
  onCancel,
}: SyncConflictDialogProps) {
  const remoteDate = new Date(remoteModifiedTime);
  const relativeTime = (() => {
    const mins = Math.floor((Date.now() - remoteDate.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            className="fixed z-[101] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--surface-primary)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                >
                  !
                </span>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Sync Conflict
                </h3>
              </div>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Both you and someone else have made changes since the last sync.
              </p>
            </div>

            {/* Info cards */}
            <div className="px-5 pb-4 flex flex-col gap-2">
              {/* Local changes */}
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D40' }}
              >
                <span className="text-xs" style={{ color: '#D97706' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
                <div>
                  <div className="text-xs font-medium" style={{ color: '#92400E' }}>
                    {localChangeCount} local {localChangeCount === 1 ? 'change' : 'changes'}
                  </div>
                  <div className="text-[10px]" style={{ color: '#B45309' }}>Your edits</div>
                </div>
              </div>

              {/* Remote changes */}
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: '#EFF6FF', border: '1px solid #93C5FD40' }}
              >
                <span className="text-xs" style={{ color: '#2563EB' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                <div>
                  <div className="text-xs font-medium" style={{ color: '#1E40AF' }}>
                    Remote modified
                  </div>
                  <div className="text-[10px]" style={{ color: '#1D4ED8' }}>
                    Updated {relativeTime}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <button
                onClick={onCancel}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors hover:bg-[var(--surface-secondary)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={onPull}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
                style={{
                  color: '#2563EB',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #93C5FD40',
                }}
              >
                Use Remote
              </button>
              <button
                onClick={onPush}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
                style={{
                  color: '#D97706',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D40',
                }}
              >
                Push Mine
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
