import { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AIPanel } from '@/components/ai/AIPanel';
import { useAppStore } from '@/store/appStore';

function App() {
  const { initializeApp, toggleCommandPalette, toggleAIPanel } = useAppStore();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K for command palette
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      // Cmd+J for AI panel
      if (e.metaKey && e.key === 'j') {
        e.preventDefault();
        toggleAIPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette, toggleAIPanel]);

  return (
    <>
      <Layout />
      <AIPanel />
    </>
  );
}

export default App;
