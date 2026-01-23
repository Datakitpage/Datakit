import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard navigation and shortcuts hook
 *
 * Provides:
 * - Global keyboard shortcuts
 * - Vim-style navigation (hjkl)
 * - Selection management
 * - Quick actions
 */

interface KeyboardConfig {
  // Navigation
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;

  // Selection
  onSelectNext?: () => void;
  onSelectPrev?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;

  // Actions
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;

  // UI
  onToggleCommandPalette?: () => void;
  onToggleAI?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onEscape?: () => void;
  onEnter?: () => void;

  // Custom shortcuts
  customShortcuts?: {
    key: string;
    modifiers?: ('meta' | 'ctrl' | 'alt' | 'shift')[];
    action: () => void;
  }[];

  // Options
  enableVimMode?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
  /** When true, CMD+K won't trigger global command palette (for when a focused component has its own handler) */
  skipGlobalCmdK?: boolean;
}

export function useKeyboard(config: KeyboardConfig) {
  const configRef = useRef(config);

  // Update ref in useEffect instead of during render
  useEffect(() => {
    configRef.current = config;
  });

  // Separate handler for CMD+K in capture phase - ensures it ALWAYS works
  // even when other components capture keyboard events
  const handleCmdK = useCallback((e: KeyboardEvent) => {
    const cfg = configRef.current;
    const isMeta = e.metaKey || e.ctrlKey;

    if (isMeta && e.key === 'k') {
      // Skip global command palette when a focused component has its own CMD+K handler
      if (cfg.skipGlobalCmdK) return;

      e.preventDefault();
      cfg.onToggleCommandPalette?.();
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const cfg = configRef.current;

    // Exit early if hook is disabled
    if (!cfg.enabled && cfg.enabled !== undefined) return;

    // Don't capture when typing in inputs
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // But still allow Escape
      if (e.key === 'Escape' && cfg.onEscape) {
        cfg.onEscape();
      }
      return;
    }

    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    // AI panel
    if (isMeta && e.key === 'j') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onToggleAI?.();
      return;
    }

    // Zoom
    if (isMeta && (e.key === '=' || e.key === '+')) {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onZoomIn?.();
      return;
    }
    if (isMeta && e.key === '-') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onZoomOut?.();
      return;
    }
    if (isMeta && e.key === '0') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onZoomReset?.();
      return;
    }

    // Undo/Redo
    if (isMeta && e.key === 'z') {
      if (cfg.preventDefault !== false) e.preventDefault();
      if (isShift) {
        cfg.onRedo?.();
      } else {
        cfg.onUndo?.();
      }
      return;
    }

    // Copy/Paste/Duplicate
    if (isMeta && e.key === 'c') {
      cfg.onCopy?.();
      return;
    }
    if (isMeta && e.key === 'v') {
      cfg.onPaste?.();
      return;
    }
    if (isMeta && e.key === 'd') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onDuplicate?.();
      return;
    }

    // Select all
    if (isMeta && e.key === 'a') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onSelectAll?.();
      return;
    }

    // Delete
    if (e.key === 'Backspace' || e.key === 'Delete') {
      cfg.onDelete?.();
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      cfg.onEscape?.();
      return;
    }

    // Enter - open/activate selected item
    if (e.key === 'Enter') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onEnter?.();
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowUp') {
      if (cfg.preventDefault !== false) e.preventDefault();
      if (isShift) {
        cfg.onSelectPrev?.();
      } else {
        cfg.onMoveUp?.();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      if (cfg.preventDefault !== false) e.preventDefault();
      if (isShift) {
        cfg.onSelectNext?.();
      } else {
        cfg.onMoveDown?.();
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onMoveLeft?.();
      return;
    }
    if (e.key === 'ArrowRight') {
      if (cfg.preventDefault !== false) e.preventDefault();
      cfg.onMoveRight?.();
      return;
    }

    // Vim-style navigation
    if (cfg.enableVimMode) {
      switch (e.key) {
        case 'h':
          cfg.onMoveLeft?.();
          break;
        case 'j':
          cfg.onMoveDown?.();
          break;
        case 'k':
          cfg.onMoveUp?.();
          break;
        case 'l':
          cfg.onMoveRight?.();
          break;
        case 'x':
          cfg.onDelete?.();
          break;
      }
    }

    // Tab for next/prev selection
    if (e.key === 'Tab') {
      if (cfg.preventDefault !== false) e.preventDefault();
      if (isShift) {
        cfg.onSelectPrev?.();
      } else {
        cfg.onSelectNext?.();
      }
      return;
    }

    // Custom shortcuts
    cfg.customShortcuts?.forEach(shortcut => {
      const modifiersMatch = (shortcut.modifiers || []).every(mod => {
        switch (mod) {
          case 'meta':
            return e.metaKey;
          case 'ctrl':
            return e.ctrlKey;
          case 'alt':
            return e.altKey;
          case 'shift':
            return e.shiftKey;
          default:
            return true;
        }
      });

      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && modifiersMatch) {
        if (cfg.preventDefault !== false) e.preventDefault();
        shortcut.action();
      }
    });
  }, []);

  useEffect(() => {
    // CMD+K uses capture phase to fire BEFORE any component handlers
    // This ensures the command palette is always accessible
    window.addEventListener('keydown', handleCmdK, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleCmdK, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCmdK, handleKeyDown]);
}

/**
 * Hook for tracking key sequences (for vim-style commands like 'gg', 'dd')
 */
export function useKeySequence(
  sequences: Record<string, () => void>,
  timeout: number = 500
) {
  const bufferRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Add to buffer
      bufferRef.current += e.key;

      // Check for matches
      const matchedSequence = Object.keys(sequences).find(seq =>
        bufferRef.current.endsWith(seq)
      );

      if (matchedSequence) {
        sequences[matchedSequence]();
        bufferRef.current = '';
      } else {
        // Clear buffer after timeout
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, timeout);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [sequences, timeout]);
}
