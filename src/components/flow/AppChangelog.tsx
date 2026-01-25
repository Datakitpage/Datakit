import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import changelog from '../../../CHANGELOG.json';

interface UpcomingItem {
  id: string;
  title: string;
  description: string;
  status: 'in-progress' | 'planned' | 'shipped';
  eta?: string;
}

interface RecentItem {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'feature' | 'fix' | 'improvement';
}

interface ChangelogData {
  version: string;
  tagline: string;
  upcoming: UpcomingItem[];
  recent: RecentItem[];
}

const data = changelog as ChangelogData;

// eslint-disable-next-line react-refresh/only-export-components -- Helper function used by other components
export function hasNewChangelogChanges(): boolean {
  const lastSeenVersion = localStorage.getItem('opensheet-changelog-version');
  return lastSeenVersion !== data.version;
}

// eslint-disable-next-line react-refresh/only-export-components -- Constant used by other components
export const currentVersion = data.version;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface AppChangelogProps {
  isMinimized?: boolean;
  onMinimize?: () => void;
  autoExpand?: boolean;
}

export function AppChangelog({ isMinimized = false, onMinimize, autoExpand = false }: AppChangelogProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [hasNewChanges, setHasNewChanges] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-expand when prop changes to true
  useEffect(() => {
    if (autoExpand) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing state with prop is intentional
      setIsExpanded(true);
    }
  }, [autoExpand]);

  // Check if there are new changes since last visit
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('opensheet-changelog-version');
    if (lastSeenVersion !== data.version) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Initializing state from localStorage on mount
      setHasNewChanges(true);
    }
  }, []);

  // Mark as seen when expanded
  useEffect(() => {
    if (isExpanded && hasNewChanges) {
      localStorage.setItem('opensheet-changelog-version', data.version);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Updating state after localStorage sync
      setHasNewChanges(false);
    }
  }, [isExpanded, hasNewChanges]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isExpanded]);

  return (
    <AnimatePresence mode="wait">
      {!isMinimized && (
        <motion.div
          ref={panelRef}
          className="fixed top-14 right-4 z-[35]"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Collapsed badge */}
          <AnimatePresence mode="wait">
            {!isExpanded && (
              <motion.div
                key="badge"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="relative group"
              >
                <button
                  onClick={() => setIsExpanded(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--surface-primary)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  {/* New indicator dot */}
                  {hasNewChanges && (
                    <motion.span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--success)' }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  )}
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    v{data.version}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    ·
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    What's New
                  </span>
                </button>
                {/* Minimize button - shows on hover */}
                {onMinimize && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMinimize();
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                    style={{
                      backgroundColor: 'var(--surface-tertiary)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-tertiary)',
                    }}
                    title="Hide changelog"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expanded panel */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="w-80 rounded-xl overflow-hidden"
                style={{
                  backgroundColor: 'var(--surface-primary)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-xl)',
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        OpenSheet
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: 'var(--surface-tertiary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        v{data.version}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {data.tagline}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1 rounded-md transition-colors duration-200 hover:bg-[var(--surface-secondary)]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[400px] overflow-y-auto">
                  {/* Coming Soon section */}
                  {data.upcoming.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                          Coming Soon
                        </span>
                      </div>
                      <div className="space-y-2">
                        {data.upcoming.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-lg"
                            style={{ backgroundColor: 'var(--surface-secondary)' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: 'var(--text-tertiary)',
                                    }}
                                  />
                                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {item.title}
                                  </span>
                                </div>
                                <p className="text-[11px] mt-1 ml-3.5" style={{ color: 'var(--text-tertiary)' }}>
                                  {item.description}
                                </p>
                              </div>
                              {item.eta && (
                                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                                  {item.eta}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recently Shipped section */}
                  {data.recent.length > 0 && (
                    <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                          Recently Shipped
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {data.recent.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md transition-colors duration-200 hover:bg-[var(--surface-secondary)]"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                {item.title}
                              </span>
                              {item.type === 'feature' && (
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                                  style={{
                                    backgroundColor: 'var(--success-subtle)',
                                    color: 'var(--success)',
                                  }}
                                >
                                  New
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                              {formatDate(item.date)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AppChangelog;
