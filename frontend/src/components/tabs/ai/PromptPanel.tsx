import React, { useState, useEffect, RefObject } from 'react';
import {
  Send,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Command
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import OpenAILogo from '@/assets/openai.webp';
import AnthropicLogo from '@/assets/anthropic.webp';
import OllamaLogo from '@/assets/ollama.webp';

import { useAIStore } from '@/store/aiStore';
import { useAIOperations } from '@/hooks/ai/useAIOperations';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { selectTableName, selectActiveFile } from '@/store/selectors/appSelectors';

import ModelSelector from './ModelSelector';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import ErrorDisplay from './ErrorDisplay';
import { validateAIInput } from './utils/validation';

interface PromptPanelProps {
  inputRef: RefObject<HTMLTextAreaElement>;
  showSetupPrompt: boolean;
  onSignUpClick?: () => void;
  onConfigureClick?: () => void;
  onToggleSchema?: () => void;
  schemaBrowserOpen?: boolean;
}

const PROMPT_SUGGESTIONS = [
  {
    title: 'Explore Data',
    prompt:
      'Give me an overview of this dataset - what columns do we have and what insights can you find?',
  },
  {
    title: 'Find Patterns',
    prompt: 'What are the most interesting patterns or trends in this data?',
  },
  {
    title: 'Data Quality',
    prompt:
      'Check this dataset for missing values, duplicates, or data quality issues',
  },
  {
    title: 'Quick Stats',
    prompt: 'Show me summary statistics for all numeric columns',
  },
];

const PromptPanel: React.FC<PromptPanelProps> = ({
  inputRef,
  showSetupPrompt,
  onSignUpClick,
  onConfigureClick,
  onToggleSchema,
  schemaBrowserOpen = false,
}) => {
  const [prompt, setPrompt] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const tableName = useAppStore(selectTableName);
  const activeFile = useAppStore(selectActiveFile);
  const { registeredTables } = useDuckDBStore();
  const {
    isProcessing,
    clearConversation,
    clearFileConversation,
    setQueryResults,
    currentConversation,
    currentError,
    setCurrentError,
    activeProvider,
    activeModel,
    currentMessageIndex,
    navigateToNextMessage,
    navigateToPreviousMessage,
    multiTableContexts,
  } = useAIStore();
  const { executeAIQueryStream, canExecute } = useAIOperations();

  // Get user messages for navigation
  const userMessages = currentConversation.filter((msg) => msg.role === 'user');

  // Update prompt when navigating to a different message
  useEffect(() => {
    if (currentMessageIndex >= 0 && currentMessageIndex < userMessages.length) {
      // Navigate to an existing message
      const selectedMessage = userMessages[currentMessageIndex];
      if (selectedMessage && selectedMessage.content !== prompt) {
        setPrompt(selectedMessage.content);
      }
    } else if (currentMessageIndex === userMessages.length) {
      // Navigate to the virtual "unsent" message (clear input for new message)
      if (prompt !== '') {
        setPrompt('');
      }
    }
  }, [currentMessageIndex, userMessages.length]);

  // Hide suggestions when user starts typing
  useEffect(() => {
    setShowSuggestions(prompt.length === 0);
  }, [prompt]);

  // Validate input and show warnings when user starts typing
  useEffect(() => {
    const hasRegisteredTables = registeredTables.size > 0;
    const validationError = validateAIInput(
      prompt,
      tableName,
      activeProvider,
      activeModel,
      multiTableContexts,
      hasRegisteredTables
    );
    setCurrentError(validationError);
  }, [
    prompt,
    tableName,
    activeProvider,
    activeModel,
    multiTableContexts,
    registeredTables,
    setCurrentError,
  ]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [prompt, inputRef]);

  const validateBeforeSubmit = () => {
    const hasRegisteredTables = registeredTables.size > 0;
    const validationError = validateAIInput(
      prompt,
      tableName,
      activeProvider,
      activeModel,
      multiTableContexts,
      hasRegisteredTables
    );

    if (validationError) {
      setCurrentError(validationError);
      return false;
    }

    // Check if provider is configured
    if (!canExecute) {
      if (activeProvider === 'datakit') {
        setCurrentError('authentication required');
      } else {
        setCurrentError(`AI provider ${activeProvider} not configured`);
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!prompt.trim() || isProcessing) return;

    if (!validateBeforeSubmit()) return;

    try {
      await executeAIQueryStream(prompt);
      setPrompt('');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      setCurrentError(errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestionPrompt: string) => {
    setPrompt(suggestionPrompt);
    inputRef.current?.focus();
  };

  const handleRefreshChat = () => {
    if (activeFile?.id) {
      // File-aware: clear only the current file's conversation
      clearFileConversation(activeFile.id);
    } else {
      // Fallback: clear global conversation if no active file
      clearConversation();
    }
    
    // Clear query results and other UI state
    setQueryResults(null);
    setPrompt('');
    setShowSuggestions(true);
    setCurrentError(null);
    inputRef.current?.focus();
  };

  // Determine placeholder text based on conversation state
  const getPlaceholderText = () => {
    if (!tableName) {
      return 'Ask about your data...';
    }

    // Check if there's an ongoing conversation (has user messages)
    const hasConversation = currentConversation.some(
      (msg) => msg.role === 'user'
    );

    if (hasConversation) {
      return `Ask follow up question...`;
    }

    return `Ask about ${tableName}...`;
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @property --angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
      }
      
      @keyframes rotate-border {
        0% {
          --angle: 0deg;
        }
        100% {
          --angle: 360deg;
        }
      }
      
      .animate-pulse-border {
        position: relative;
        background: rgb(23, 23, 23);
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      
      .animate-pulse-border::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        padding: 2px;
        background: conic-gradient(
          from var(--angle),
          transparent 0deg,
          transparent 60deg,
          rgba(139, 92, 246, 0.8) 90deg,
          rgba(139, 92, 246, 1) 120deg,
          rgba(139, 92, 246, 0.8) 150deg,
          transparent 180deg,
          transparent 360deg
        );
        -webkit-mask: 
          linear-gradient(#fff 0 0) content-box, 
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        animation: rotate-border 4s linear infinite;
      }
      
      .animate-pulse-border:hover::before {
        background: conic-gradient(
          from var(--angle),
          rgba(139, 92, 246, 0.3) 0deg,
          rgba(139, 92, 246, 1) 180deg,
          rgba(139, 92, 246, 0.3) 360deg
        );
        animation-duration: 2s;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          {/* Left side - Schema toggle */}
          <div className="flex items-center gap-3">
            {onToggleSchema && (
              <div className="flex items-center gap-2 bg-card/5 border border-border rounded-lg px-2 py-1">
                <button
                  onClick={onToggleSchema}
                  className="p-1 hover:bg-muted/50 rounded transition-colors"
                  title={schemaBrowserOpen ? 'Hide Schema' : 'Show Schema'}
                >
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      schemaBrowserOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <h3 className="text-sm font-medium text-foreground">Schemas</h3>
              </div>
            )}
          </div>

          {/* Right side - Controls group */}
          <div className="flex items-center gap-2">
            <div
              className={
                showSetupPrompt ? 'opacity-50 pointer-events-none' : ''
              }
            >
              <ModelSelector compact />
            </div>

            {/* Message Navigation */}
            {userMessages.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={navigateToPreviousMessage}
                  disabled={currentMessageIndex <= 0}
                  className="p-1 hover:bg-accent/50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous message"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>

                <span className="text-xs text-muted-foreground px-2">
                  {currentMessageIndex + 1} / {userMessages.length + 1}
                </span>

                <button
                  onClick={navigateToNextMessage}
                  disabled={currentMessageIndex >= userMessages.length}
                  className="p-1 hover:bg-accent/50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next message"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Refresh Button */}
            <Tooltip content="Start a new chat" placement="bottom">
              <button
                onClick={handleRefreshChat}
                disabled={showSetupPrompt || isProcessing}
                className={`p-1.5 rounded transition-all ${
                  showSetupPrompt || isProcessing
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-accent/10 text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Start new chat"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Prompt Input */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="space-y-3">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholderText()}
                className="w-full px-4 py-4 bg-accent/5 border border-border rounded-lg text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                rows={3}
                disabled={isProcessing || showSetupPrompt}
              />

              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {/* Keyboard shortcut hint */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/30 px-2 py-1 rounded border border-border">
                  <Command className="h-3 w-3" />
                  <span>K</span>
                </div>

                <button
                  type="submit"
                  disabled={
                    !prompt.trim() ||
                    !canExecute ||
                    isProcessing ||
                    showSetupPrompt
                  }
                  className={`p-2 rounded-md transition-all ${
                    prompt.trim() &&
                    canExecute &&
                    !isProcessing &&
                    !showSetupPrompt
                      ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                      : 'bg-accent/10 text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Error Display */}
            <ErrorDisplay
              error={currentError}
              onDismiss={() => setCurrentError(null)}
              onRetry={() => {
                setCurrentError(null);
                if (prompt.trim()) {
                  handleSubmit();
                }
              }}
            />

            {/* Setup Prompt - Integrated */}
            {showSetupPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <p className="text-xs text-muted-foreground text-center">
                  Configure your AI model to start asking questions
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={onSignUpClick}
                    variant="outline"
                    size="sm"
                    className="animate-pulse-border px-3 py-3 h-auto"
                  >
                    Sign Up for Free Credits
                  </Button>

                  <Button
                    onClick={onConfigureClick}
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2 py-3 h-auto"
                  >
                    <span>Use Your Own API Keys</span>
                    <div className="flex items-center gap-1">
                      <img
                        src={OpenAILogo}
                        className="h-4 w-4 opacity-60"
                        alt="OpenAI"
                      />
                      <img
                        src={AnthropicLogo}
                        className="h-4 w-4 opacity-60"
                        alt="Anthropic"
                      />
                      <img
                        src={OllamaLogo}
                        className="h-4 w-4 opacity-60"
                        alt="Ollama"
                      />
                    </div>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {/* Choose from OpenAI, Anthropic, Groq, or DataKit. */}
                  {/* <br /> */}
                  Models only see your table structure, not your actual data
                </p>
              </motion.div>
            )}
          </div>
        </form>

        {/* Suggestions */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <p className="text-xs text-muted-foreground mb-3">Suggestions:</p>
              {PROMPT_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() =>
                    !showSetupPrompt && handleSuggestionClick(suggestion.prompt)
                  }
                  disabled={showSetupPrompt}
                  className={`w-full text-left p-3 border rounded-lg transition-all cursor-pointer ${
                    showSetupPrompt
                      ? 'bg-accent/3 border-border cursor-not-allowed opacity-50'
                      : 'bg-accent/5 hover:bg-accent/10 border-border hover:border-border group'
                  }`}
                >
                  <div className="font-medium text-sm text-foreground mb-1">
                    {suggestion.title}
                  </div>
                  <div
                    className={`text-xs ${
                      showSetupPrompt
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    {suggestion.prompt}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status */}
      {isProcessing && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span>Thinking...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptPanel;
