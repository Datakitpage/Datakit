import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOperationFeedback,
  FEEDBACK_TYPE_CONFIG,
  type FeedbackType,
} from './useOperationFeedback';

describe('useOperationFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with empty items', () => {
      const { result } = renderHook(() => useOperationFeedback());

      expect(result.current.items).toEqual([]);
    });
  });

  describe('show', () => {
    it('should add a feedback item', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.show({
          type: 'success',
          message: 'Operation completed',
        });
      });

      expect(result.current.items.length).toBe(1);
      expect(result.current.items[0].message).toBe('Operation completed');
      expect(result.current.items[0].type).toBe('success');
    });

    it('should return the item id', () => {
      const { result } = renderHook(() => useOperationFeedback());

      let id: string = '';
      act(() => {
        id = result.current.show({
          type: 'info',
          message: 'Test',
        });
      });

      expect(id).toMatch(/^feedback-\d+$/);
      expect(result.current.items[0].id).toBe(id);
    });

    it('should include description and action when provided', () => {
      const { result } = renderHook(() => useOperationFeedback());
      const mockAction = vi.fn();

      act(() => {
        result.current.show({
          type: 'success',
          message: 'File saved',
          description: 'Your changes have been saved',
          action: {
            label: 'Undo',
            onClick: mockAction,
          },
        });
      });

      expect(result.current.items[0].description).toBe('Your changes have been saved');
      expect(result.current.items[0].action?.label).toBe('Undo');

      result.current.items[0].action?.onClick();
      expect(mockAction).toHaveBeenCalled();
    });

    it('should add items in reverse chronological order (newest first)', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.show({ type: 'info', message: 'First' });
        result.current.show({ type: 'info', message: 'Second' });
        result.current.show({ type: 'info', message: 'Third' });
      });

      expect(result.current.items[0].message).toBe('Third');
      expect(result.current.items[1].message).toBe('Second');
      expect(result.current.items[2].message).toBe('First');
    });
  });

  describe('convenience methods', () => {
    it('showSuccess should create success item', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showSuccess('Done!', 'All tasks completed');
      });

      expect(result.current.items[0].type).toBe('success');
      expect(result.current.items[0].message).toBe('Done!');
      expect(result.current.items[0].description).toBe('All tasks completed');
    });

    it('showSuccess should support action parameter', () => {
      const { result } = renderHook(() => useOperationFeedback());
      const mockAction = vi.fn();

      act(() => {
        result.current.showSuccess('Saved', undefined, {
          label: 'Undo',
          onClick: mockAction,
        });
      });

      expect(result.current.items[0].action?.label).toBe('Undo');
    });

    it('showError should create error item', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showError('Failed!', 'Network error occurred');
      });

      expect(result.current.items[0].type).toBe('error');
      expect(result.current.items[0].message).toBe('Failed!');
      expect(result.current.items[0].description).toBe('Network error occurred');
    });

    it('showInfo should create info item', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showInfo('Tip', 'Press Ctrl+S to save');
      });

      expect(result.current.items[0].type).toBe('info');
      expect(result.current.items[0].message).toBe('Tip');
    });

    it('showWarning should create warning item', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showWarning('Caution', 'This action cannot be undone');
      });

      expect(result.current.items[0].type).toBe('warning');
      expect(result.current.items[0].message).toBe('Caution');
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss after default duration (4000ms)', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showSuccess('Test');
      });

      expect(result.current.items.length).toBe(1);

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(result.current.items.length).toBe(0);
    });

    it('should use custom duration from show options', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.show({
          type: 'info',
          message: 'Quick message',
          duration: 1000,
        });
      });

      expect(result.current.items.length).toBe(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.items.length).toBe(0);
    });

    it('showError should use longer duration (6000ms)', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showError('Error occurred');
      });

      expect(result.current.items.length).toBe(1);

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Still there after 4 seconds
      expect(result.current.items.length).toBe(1);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Gone after 6 seconds
      expect(result.current.items.length).toBe(0);
    });

    it('showWarning should use 5000ms duration', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showWarning('Warning');
      });

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Still there after 4 seconds
      expect(result.current.items.length).toBe(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Gone after 5 seconds
      expect(result.current.items.length).toBe(0);
    });

    it('should not auto-dismiss when duration is 0', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.show({
          type: 'info',
          message: 'Persistent message',
          duration: 0,
        });
      });

      act(() => {
        vi.advanceTimersByTime(100000);
      });

      expect(result.current.items.length).toBe(1);
    });
  });

  describe('dismiss', () => {
    it('should dismiss specific item by id', () => {
      const { result } = renderHook(() => useOperationFeedback());

      let id1: string = '', id2: string = '', id3: string = '';
      act(() => {
        id1 = result.current.showInfo('First');
        id2 = result.current.showInfo('Second');
        id3 = result.current.showInfo('Third');
      });

      expect(result.current.items.length).toBe(3);

      act(() => {
        result.current.dismiss(id2);
      });

      expect(result.current.items.length).toBe(2);
      expect(result.current.items.map(i => i.id)).not.toContain(id2);
      expect(result.current.items.map(i => i.id)).toContain(id1);
      expect(result.current.items.map(i => i.id)).toContain(id3);
    });

    it('should clear timeout when dismissing', () => {
      const { result } = renderHook(() => useOperationFeedback());

      let id: string = '';
      act(() => {
        id = result.current.showInfo('Test');
      });

      // Dismiss before auto-dismiss would trigger
      act(() => {
        result.current.dismiss(id);
      });

      // Advance past original timeout
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not cause any issues
      expect(result.current.items.length).toBe(0);
    });
  });

  describe('dismissAll', () => {
    it('should dismiss all items', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showInfo('First');
        result.current.showInfo('Second');
        result.current.showInfo('Third');
      });

      expect(result.current.items.length).toBe(3);

      act(() => {
        result.current.dismissAll();
      });

      expect(result.current.items.length).toBe(0);
    });

    it('should clear all timeouts', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showInfo('First');
        result.current.showInfo('Second');
      });

      act(() => {
        result.current.dismissAll();
      });

      // Advance timers - should not cause issues
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.items.length).toBe(0);
    });
  });

  describe('maxItems option', () => {
    it('should limit number of items', () => {
      const { result } = renderHook(() => useOperationFeedback({ maxItems: 3 }));

      act(() => {
        result.current.showInfo('1');
        result.current.showInfo('2');
        result.current.showInfo('3');
        result.current.showInfo('4');
        result.current.showInfo('5');
      });

      expect(result.current.items.length).toBe(3);
      // Should have newest items
      expect(result.current.items[0].message).toBe('5');
      expect(result.current.items[1].message).toBe('4');
      expect(result.current.items[2].message).toBe('3');
    });

    it('should use default maxItems of 5', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        for (let i = 1; i <= 10; i++) {
          result.current.showInfo(`Item ${i}`);
        }
      });

      expect(result.current.items.length).toBe(5);
    });
  });

  describe('defaultDuration option', () => {
    it('should use custom default duration', () => {
      const { result } = renderHook(() => useOperationFeedback({ defaultDuration: 2000 }));

      act(() => {
        result.current.showInfo('Test');
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.items.length).toBe(0);
    });
  });

  describe('item properties', () => {
    it('should include timestamp', () => {
      const { result } = renderHook(() => useOperationFeedback());
      const beforeTime = Date.now();

      act(() => {
        result.current.showInfo('Test');
      });

      const afterTime = Date.now();
      const itemTime = result.current.items[0].timestamp;

      expect(itemTime).toBeGreaterThanOrEqual(beforeTime);
      expect(itemTime).toBeLessThanOrEqual(afterTime);
    });

    it('should include duration', () => {
      const { result } = renderHook(() => useOperationFeedback());

      act(() => {
        result.current.showInfo('Test');
      });

      expect(result.current.items[0].duration).toBe(4000); // default
    });
  });
});

describe('FEEDBACK_TYPE_CONFIG', () => {
  it('should have configuration for all feedback types', () => {
    const types: FeedbackType[] = ['success', 'error', 'info', 'warning'];

    types.forEach(type => {
      expect(FEEDBACK_TYPE_CONFIG[type]).toBeDefined();
      expect(FEEDBACK_TYPE_CONFIG[type].icon).toBeDefined();
      expect(FEEDBACK_TYPE_CONFIG[type].color).toBeDefined();
      expect(FEEDBACK_TYPE_CONFIG[type].bgColor).toBeDefined();
    });
  });

  it('should have expected icons', () => {
    expect(FEEDBACK_TYPE_CONFIG.success.icon).toBe('✓');
    expect(FEEDBACK_TYPE_CONFIG.error.icon).toBe('✕');
    expect(FEEDBACK_TYPE_CONFIG.info.icon).toBe('ℹ');
    expect(FEEDBACK_TYPE_CONFIG.warning.icon).toBe('⚠');
  });
});
