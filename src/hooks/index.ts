// Canvas and keyboard hooks
export { useCanvas } from './useCanvas';
export { useKeyboard } from './useKeyboard';

// DuckDB data hooks
export { useDuckDBView, default as useDuckDBViewDefault } from './useDuckDBView';
export type { SQLValidationResult } from '@/store/duckDBViewStore';

// AI Command hooks
export {
  useAICommandExecution,
  type ExecutionStatus,
  type ExecutionResult,
  type CommandHistoryEntry,
  type DuckDBViewActions,
  type UseAICommandExecutionOptions,
} from './useAICommandExecution';

export {
  useCommandHistory,
  useAICommandHistory,
  type HistoryEntry,
  type UseCommandHistoryOptions,
} from './useCommandHistory';

// View State History (undo/redo for read operations)
export {
  useViewStateHistory,
  generateChangeDescription,
  type ViewState,
  type FilterState,
  type ViewStateChange,
  type UseViewStateHistoryOptions,
  type UseViewStateHistoryReturn,
} from './useViewStateHistory';

// Operation Feedback (toast notifications)
export {
  useOperationFeedback,
  FEEDBACK_TYPE_CONFIG,
  type FeedbackType,
  type FeedbackItem,
  type UseOperationFeedbackOptions,
  type UseOperationFeedbackReturn,
  type ShowFeedbackOptions,
} from './useOperationFeedback';
