import * as Tooltip from '@radix-ui/react-tooltip';
import { isTauri } from '@/lib/platform';

export function DownloadButton() {
  // Don't show in desktop app
  if (isTauri()) {
    return null;
  }

  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {/* <motion.button
            className="flex items-center gap-2 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface-secondary)',
            }}
            whileHover={{
              backgroundColor: 'var(--surface-tertiary)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <svg width="13" height="16" viewBox="0 0 384 512" fill="currentColor">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
            </svg>
            <span>Download for Mac</span>
          </motion.button> */}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={8}
            className="px-3 py-2 rounded-lg text-xs max-w-[200px] text-center z-50"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="font-medium mb-0.5">Coming Soon</div>
            <div style={{ color: 'var(--text-tertiary)' }}>
              Native macOS app with offline support
            </div>
            <Tooltip.Arrow
              style={{ fill: 'var(--surface-elevated)' }}
            />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
