import { motion } from 'framer-motion';
import { isTauri } from '@/lib/platform';

export function DownloadButton() {
  // Don't show in desktop app
  if (isTauri()) {
    return null;
  }

  // Always show as disabled with "coming soon" tooltip
  return (
    <motion.div
      className="px-2 py-1 rounded-md text-xs cursor-not-allowed flex items-center gap-1.5"
      style={{
        color: 'var(--text-tertiary)',
        backgroundColor: 'var(--surface-secondary)',
        opacity: 0.6,
      }}
      title="Download Desktop soon, native speed"
      whileHover={{ opacity: 0.8 }}
    >
      <span>↓</span>
      <span>Desktop</span>
    </motion.div>
  );
}
