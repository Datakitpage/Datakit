export { chat, generateAutoDashboard, streamCommandAssistant, askCommandAssistant, generateSmartSuggestions, validateApiKey, askGlobalAssistant, streamGlobalAssistant, AI_MODELS } from "./anthropic";
export type { Message, DashboardSuggestion, AIResponse, CommandContext, CommandAssistantResponse, FileContext, GlobalSearchContext } from "./anthropic";

// Sample file AI support (proxy + fallback suggestions)
export {
  getSampleSuggestions,
  isSampleFile,
  isSampleProxyConfigured,
  callSampleAIProxy,
  generateSampleSuggestions,
  SAMPLE_FILE_SUGGESTIONS,
  SAMPLE_FILE_IDS,
} from "./sampleSuggestions";
export type { SampleFileId } from "./sampleSuggestions";

// AI Command parsing utilities
export {
  parseAICommand,
  findColumn,
  validateColumn,
  looksLikeCommand,
  isWriteOperation,
  getCommandPatterns,
} from "./parseAICommand";
export type {
  AICommand,
  CommandType,
  SortDirection,
  FilterOperator,
  FilterCondition,
  ParsedCommand,
  ParseContext,
  ParseResult,
} from "./parseAICommand";
