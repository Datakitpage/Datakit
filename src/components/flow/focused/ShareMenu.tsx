import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gmailLogo from '@/assets/gmail.webp';

interface ShareMenuProps {
  fileName: string;
  onExport: (format: 'csv' | 'json' | 'parquet') => void;
  onCopyToClipboard?: () => Promise<boolean>;
  accentColor: string;
  disabled?: boolean;
  rowCount?: number;
}

export function ShareMenu({ fileName, onExport, onCopyToClipboard, accentColor, disabled, rowCount }: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle download CSV
  const handleDownload = () => {
    setDownloading(true);
    onExport('csv');
    // Brief visual feedback
    setTimeout(() => {
      setDownloading(false);
      setIsOpen(false);
    }, 500);
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (onCopyToClipboard) {
      const success = await onCopyToClipboard();
      if (success) {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          setIsOpen(false);
        }, 1500);
      }
    }
  };

  // Large dataset warning threshold
  const isLargeDataset = Boolean(rowCount && rowCount > 10000);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <motion.button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          backgroundColor: isOpen ? `${accentColor}15` : 'var(--surface-secondary)',
          color: isOpen ? accentColor : 'var(--text-secondary)',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        whileHover={!disabled ? { backgroundColor: `${accentColor}10` } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16,6 12,2 8,6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <span>Share</span>
      </motion.button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1 w-56 rounded-lg overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--surface-primary)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="p-1.5">
              {/* Download CSV - primary action */}
              <motion.button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors"
                style={{ backgroundColor: downloading ? `${accentColor}10` : 'transparent' }}
                whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                whileTap={{ scale: 0.99 }}
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-md"
                  style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                >
                  {downloading ? (
                    <motion.div
                      className="w-4 h-4 border-2 rounded-full"
                      style={{ borderColor: `${accentColor}40`, borderTopColor: accentColor }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {downloading ? 'Downloading...' : 'Download CSV'}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {fileName.replace(/\.[^/.]+$/, '')}.csv
                  </div>
                </div>
              </motion.button>

              {/* Copy to clipboard */}
              {onCopyToClipboard && (
                <motion.button
                  onClick={handleCopy}
                  disabled={copied || isLargeDataset}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors"
                  style={{
                    backgroundColor: copied ? `${accentColor}10` : 'transparent',
                    opacity: isLargeDataset ? 0.5 : 1,
                  }}
                  whileHover={!isLargeDataset ? { backgroundColor: 'var(--surface-secondary)' } : {}}
                  whileTap={!isLargeDataset ? { scale: 0.99 } : {}}
                  title={isLargeDataset ? 'Dataset too large for clipboard' : undefined}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-md"
                    style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {copied ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: copied ? accentColor : 'var(--text-primary)' }}>
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      {isLargeDataset ? 'Too large (>10k rows)' : 'Paste into Slack, email, etc.'}
                    </div>
                  </div>
                </motion.button>
              )}

              {/* Share via Email - disabled */}
              <div
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left cursor-not-allowed"
                style={{ opacity: 0.5 }}
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-md"
                  style={{ backgroundColor: '#f1f3f410' }}
                >
                  <img src={gmailLogo} alt="Gmail" className="w-5 h-5 grayscale" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                    Share
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: 'var(--surface-tertiary)', color: 'var(--text-tertiary)' }}
                    >
                      Soon
                    </span>
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    Opens Gmail or email client
                  </div>
                </div>
              </div>
            </div>

            {/* Keyboard shortcut hint */}
            <div
              className="px-3 py-2 text-[10px] flex items-center justify-between"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface-secondary)',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>Tip: Use AI command</span>
              <code
                className="px-1.5 py-0.5 rounded font-mono"
                style={{ backgroundColor: 'var(--surface-tertiary)' }}
              >
                /export csv
              </code>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ShareMenu;
