import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { isTauri } from '@/lib/platform';

interface Release {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export function DownloadButton() {
  const [release, setRelease] = useState<Release | null>(null);
  const isDev = import.meta.env.DEV;

  // Don't show in desktop app
  if (isTauri()) {
    console.log('[DownloadButton] Hidden - running in Tauri');
    return null;
  }

  console.log('[DownloadButton] Rendering - isDev:', isDev, 'hasRelease:', !!release);

  useEffect(() => {
    fetch('https://api.github.com/repos/Datakitpage/board/releases/latest')
      .then(res => {
        if (!res.ok) return null; // 404 = no releases
        return res.json();
      })
      .then(data => {
        if (data && data.assets) {
          setRelease(data);
        }
      })
      .catch(() => {});
  }, []);

  // Keyboard shortcut: Cmd+D or Ctrl+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        handleDownload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [release]);

  const handleDownload = () => {
    if (!release || !release.assets || release.assets.length === 0) return;

    // Detect platform
    const platform = navigator.platform.toUpperCase();
    const isMac = platform.includes('MAC');
    const isWindows = platform.includes('WIN');

    // Find the right asset
    const asset = release.assets.find(a =>
      isMac ? a.name.endsWith('.dmg') :
      isWindows ? a.name.endsWith('.msi') :
      a.name.endsWith('.deb') || a.name.endsWith('.AppImage')
    );

    if (asset) {
      window.open(asset.browser_download_url, '_blank');
    }
  };

  // In development, always show a demo button (even if fetching)
  if (isDev) {
    if (!release) {
      return (
        <motion.div
          className="px-2 py-1 rounded-md text-xs transition-colors opacity-50 cursor-not-allowed flex items-center gap-1.5"
          style={{
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--surface-secondary)',
          }}
          title="Desktop app will be available after first release (⌘D)"
          whileHover={{ opacity: 0.7 }}
        >
          <span>↓</span>
          <span>Desktop</span>
          <span className="opacity-60">⌘D</span>
        </motion.div>
      );
    }
  }

  if (!release || !release.assets || release.assets.length === 0) return null;

  // Detect platform
  const platform = navigator.platform.toUpperCase();
  const isMac = platform.includes('MAC');
  const isWindows = platform.includes('WIN');

  // Find the right asset
  const asset = release.assets.find(a =>
    isMac ? a.name.endsWith('.dmg') :
    isWindows ? a.name.endsWith('.msi') :
    a.name.endsWith('.deb') || a.name.endsWith('.AppImage')
  );

  if (!asset) return null;

  return (
    <motion.a
      href={asset.browser_download_url}
      download
      className="px-2 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5"
      style={{
        backgroundColor: 'var(--primary-subtle)',
        color: 'var(--primary)',
      }}
      whileHover={{
        backgroundColor: 'var(--primary)',
        color: 'white',
      }}
      whileTap={{ scale: 0.95 }}
      title="10x faster with native DuckDB (⌘D)"
    >
      <span>↓</span>
      <span>Desktop</span>
      <span className="opacity-60">⌘D</span>
    </motion.a>
  );
}
