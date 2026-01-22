/**
 * Operation Feedback Hook
 *
 * Manages toast notifications for operation results.
 * Provides a simple API to show success, error, and info messages.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type FeedbackType = 'success' | 'error' | 'info' | 'warning';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  message: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration: number;
  timestamp: number;
}

export interface UseOperationFeedbackOptions {
  maxItems?: number;
  defaultDuration?: number;
}

export interface UseOperationFeedbackReturn {
  items: FeedbackItem[];
  show: (options: ShowFeedbackOptions) => string;
  showSuccess: (message: string, description?: string, action?: FeedbackItem['action']) => string;
  showError: (message: string, description?: string) => string;
  showInfo: (message: string, description?: string) => string;
  showWarning: (message: string, description?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface ShowFeedbackOptions {
  type: FeedbackType;
  message: string;
  description?: string;
  action?: FeedbackItem['action'];
  duration?: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

let feedbackIdCounter = 0;

export function useOperationFeedback(
  options: UseOperationFeedbackOptions = {}
): UseOperationFeedbackReturn {
  const { maxItems = 5, defaultDuration = 4000 } = options;

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up timeouts on unmount
  useEffect(() => {
    // Copy ref value to local variable for cleanup
    const timeouts = timeoutRefs.current;
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Dismiss a specific item
  const dismiss = useCallback((id: string) => {
    // Clear the timeout
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }

    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Dismiss all items
  const dismissAll = useCallback(() => {
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current.clear();
    setItems([]);
  }, []);

  // Show a new feedback item
  const show = useCallback((showOptions: ShowFeedbackOptions): string => {
    const id = `feedback-${++feedbackIdCounter}`;
    const duration = showOptions.duration ?? defaultDuration;

    const newItem: FeedbackItem = {
      id,
      type: showOptions.type,
      message: showOptions.message,
      description: showOptions.description,
      action: showOptions.action,
      duration,
      timestamp: Date.now(),
    };

    setItems(prev => {
      // Add new item at the start
      const updated = [newItem, ...prev];
      // Trim if exceeds max
      return updated.slice(0, maxItems);
    });

    // Set auto-dismiss timeout
    if (duration > 0) {
      const timeout = setTimeout(() => {
        dismiss(id);
      }, duration);
      timeoutRefs.current.set(id, timeout);
    }

    return id;
  }, [defaultDuration, maxItems, dismiss]);

  // Convenience methods
  const showSuccess = useCallback((
    message: string,
    description?: string,
    action?: FeedbackItem['action']
  ): string => {
    return show({ type: 'success', message, description, action });
  }, [show]);

  const showError = useCallback((message: string, description?: string): string => {
    return show({ type: 'error', message, description, duration: 6000 }); // Errors stay longer
  }, [show]);

  const showInfo = useCallback((message: string, description?: string): string => {
    return show({ type: 'info', message, description });
  }, [show]);

  const showWarning = useCallback((message: string, description?: string): string => {
    return show({ type: 'warning', message, description, duration: 5000 });
  }, [show]);

  return {
    items,
    show,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    dismiss,
    dismissAll,
  };
}

// ============================================================================
// Feedback Type Configurations
// ============================================================================

export const FEEDBACK_TYPE_CONFIG: Record<FeedbackType, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  success: {
    icon: '✓',
    color: 'var(--success)',
    bgColor: 'var(--success-subtle)',
  },
  error: {
    icon: '✕',
    color: 'var(--error)',
    bgColor: 'var(--error-subtle)',
  },
  info: {
    icon: 'ℹ',
    color: 'var(--info)',
    bgColor: 'var(--info-subtle)',
  },
  warning: {
    icon: '⚠',
    color: 'var(--warning)',
    bgColor: 'var(--warning-subtle)',
  },
};

export default useOperationFeedback;
