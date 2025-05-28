// components/navigation/EnhancedChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Lightbulb, 
  Code, 
  BarChart3, 
  Filter,
  TrendingUp,
  Search,
  HelpCircle,
  Sparkles,
  Clock,
  User,
  Bot,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  Copy,
  ExternalLink
} from 'lucide-react';

import { useEnhancedText2SQL, Text2SQLResult, Text2SQLError } from '@/hooks/ai/useEnhancedText2SQL';
import { useAIAssistantStore } from '@/store/aiAssistantStore';
import { useAppStore } from '@/store/appStore';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sqlResult?: Text2SQLResult;
  error?: Text2SQLError;
  isProcessing?: boolean;
  actions?: ChatAction[];
}

interface ChatAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
}

const EnhancedChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [exampleQueries, setExampleQueries] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { activeFileIds } = useAIAssistantStore();
  const { files, setActiveTab } = useAppStore();
  
  const {
    processQuery,
    executeLastSQL,
    validateSQL,
    getDataContext,
    getExampleQueries,
    isProcessing,
    lastResult,
    lastError,
    processingStats,
    cancelProcessing,
    hasAvailableData,
    canProcess
  } = useEnhancedText2SQL();
  
  // Get current file context
  const currentFile = files.find(f => activeFileIds.includes(f.id));
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load example queries when data changes
  useEffect(() => {
    if (hasAvailableData) {
      getExampleQueries().then(setExampleQueries);
      
      // Add welcome message if no messages yet
      if (messages.length === 0) {
        addWelcomeMessage();
      }
    }
  }, [hasAvailableData, getExampleQueries]);

  const addWelcomeMessage = async () => {
    const context = await getDataContext();
    
    const welcomeContent = context 
      ? `Hi! I can help you query your data using natural language. I found ${context.tables.length} table(s) with ${context.tables.reduce((sum, t) => sum + t.columns.length, 0)} columns. What would you like to explore?`
      : "Hi! I'm ready to help you analyze your data. Upload a file to get started!";

    const welcomeMessage: ChatMessage = {
      id: `welcome-${Date.now()}`,
      type: 'assistant',
      content: welcomeContent,
      timestamp: Date.now(),
      actions: hasAvailableData ? getWelcomeActions() : []
    };
    
    setMessages([welcomeMessage]);
  };

  const getWelcomeActions = (): ChatAction[] => [
    {
      id: 'show-data',
      label: 'Show my data',
      icon: <Search size={14} />,
      onClick: () => handleQuickQuery('Show me the data'),
      variant: 'primary'
    },
    {
      id: 'create-chart',
      label: 'Create a chart',
      icon: <BarChart3 size={14} />,
      onClick: () => handleQuickQuery('Create a chart'),
      variant: 'secondary'
    },
    {
      id: 'get-insights',
      label: 'Find insights',
      icon: <Sparkles size={14} />,
      onClick: () => handleQuickQuery('What insights can you find?'),
      variant: 'secondary'
    },
    {
      id: 'get-help',
      label: 'Get help',
      icon: <HelpCircle size={14} />,
      onClick: () => handleQuickQuery('What can you help me with?'),
      variant: 'secondary'
    }
  ];

  const handleQuickQuery = (query: string) => {
    setInputValue(query);
    handleSubmit(query);
  };

  const handleSubmit = async (queryText?: string) => {
    const query = queryText || inputValue.trim();
    if (!query || !canProcess) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: query,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setShowSuggestions(false);

    // Add processing message
    const processingMessage: ChatMessage = {
      id: `processing-${Date.now()}`,
      type: 'assistant',
      content: 'Analyzing your query and generating SQL...',
      timestamp: Date.now(),
      isProcessing: true
    };

    setMessages(prev => [...prev, processingMessage]);

    try {
      // Process the query with our enhanced text-to-SQL system
      const result = await processQuery(query, {
        maxRows: 100,
        preferredApproach: 'auto',
        includeOptimizations: true,
        executeImmediately: false
      });

      // Remove processing message and add result
      setMessages(prev => prev.filter(m => m.id !== processingMessage.id));
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: generateResponseContent(result),
        timestamp: Date.now(),
        sqlResult: result,
        actions: generateResultActions(result)
      };

      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      // Remove processing message and add error
      setMessages(prev => prev.filter(m => m.id !== processingMessage.id));
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: generateErrorContent(error as Text2SQLError),
        timestamp: Date.now(),
        error: error as Text2SQLError,
        actions: generateErrorActions(error as Text2SQLError)
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const generateResponseContent = (result: Text2SQLResult): string => {
    let content = `I understand you want to: **${result.explanation}**\n\n`;
    
    // Add confidence and approach info
    content += `**Generated SQL** (${Math.round(result.confidence * 100)}% confidence, ${result.approach} approach):\n`;
    content += `\`\`\`sql\n${result.sql}\n\`\`\`\n\n`;
    
    // Add complexity and performance info
    content += `**Query Details:**\n`;
    content += `• Complexity: ${result.complexity}\n`;
    content += `• Processing time: ${result.processingTime}ms\n`;
    if (result.usedTables.length > 0) {
      content += `• Tables: ${result.usedTables.join(', ')}\n`;
    }
    if (result.usedColumns.length > 0) {
      content += `• Columns: ${result.usedColumns.join(', ')}\n`;
    }
    
    // Add warnings if any
    if (result.warnings.length > 0) {
      content += `\n**⚠️ Warnings:**\n`;
      result.warnings.forEach(warning => {
        content += `• ${warning}\n`;
      });
    }
    
    // Add suggestions if any
    if (result.suggestions.length > 0) {
      content += `\n**💡 Suggestions:**\n`;
      result.suggestions.forEach(suggestion => {
        content += `• ${suggestion}\n`;
      });
    }

    return content;
  };

  const generateResultActions = (result: Text2SQLResult): ChatAction[] => {
    const actions: ChatAction[] = [];

    // Execute SQL action
    if (result.canExecute) {
      actions.push({
        id: 'execute-sql',
        label: 'Run Query',
        icon: <Play size={14} />,
        onClick: async () => {
          try {
            await executeLastSQL();
            setActiveTab('query'); // Switch to query tab to see results
            
            // Add success message
            const successMessage: ChatMessage = {
              id: `success-${Date.now()}`,
              type: 'system',
              content: '✅ Query executed successfully! Check the Query tab for results.',
              timestamp: Date.now()
            };
            setMessages(prev => [...prev, successMessage]);
            
          } catch (error) {
            // Add error message
            const errorMessage: ChatMessage = {
              id: `exec-error-${Date.now()}`,
              type: 'system',
              content: `❌ Execution failed: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        },
        variant: result.confidence > 0.8 ? 'success' : 'primary'
      });
    }

    // Copy SQL action
    actions.push({
      id: 'copy-sql',
      label: 'Copy SQL',
      icon: <Copy size={14} />,
      onClick: () => {
        navigator.clipboard.writeText(result.sql);
        // Could add a toast notification here
      },
      variant: 'secondary'
    });

    // Open in query editor action
    actions.push({
      id: 'open-editor',
      label: 'Edit in Query Tab',
      icon: <ExternalLink size={14} />,
      onClick: () => {
        // This would require exposing a way to set the query in the editor
        // For now, just switch to the query tab
        setActiveTab('query');
      },
      variant: 'secondary'
    });

    // Validate SQL action if confidence is low
    if (result.confidence < 0.7) {
      actions.push({
        id: 'validate-sql',
        label: 'Validate SQL',
        icon: <CheckCircle size={14} />,
        onClick: async () => {
          try {
            const validation = await validateSQL(result.sql);
            const validationMessage: ChatMessage = {
              id: `validation-${Date.now()}`,
              type: 'system',
              content: validation.isValid 
                ? '✅ SQL syntax is valid!'
                : `❌ SQL validation failed:\n${validation.errors.join('\n')}`,
              timestamp: Date.now()
            };
            setMessages(prev => [...prev, validationMessage]);
          } catch (error) {
            console.error('Validation failed:', error);
          }
        },
        variant: 'warning'
      });
    }

    return actions;
  };

  const generateErrorContent = (error: Text2SQLError): string => {
    let content = `❌ **${error.type.charAt(0).toUpperCase() + error.type.slice(1)} Error**\n\n`;
    content += `${error.message}\n\n`;
    
    if (error.suggestions && error.suggestions.length > 0) {
      content += `**💡 Suggestions:**\n`;
      error.suggestions.forEach(suggestion => {
        content += `• ${suggestion}\n`;
      });
    }
    
    return content;
  };

  const generateErrorActions = (error: Text2SQLError): ChatAction[] => {
    const actions: ChatAction[] = [];

    // Get help action
    actions.push({
      id: 'get-help',
      label: 'Get Help',
      icon: <HelpCircle size={14} />,
      onClick: () => handleQuickQuery('What can you help me with?'),
      variant: 'primary'
    });

    // Show examples action
    actions.push({
      id: 'show-examples',
      label: 'Show Examples',
      icon: <Lightbulb size={14} />,
      onClick: () => setShowSuggestions(true),
      variant: 'secondary'
    });

    return actions;
  };

  const formatMessage = (content: string) => {
    // Enhanced markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```sql\n(.*?)\n```/gs, '<pre class="bg-gray-800 p-3 rounded mt-2 mb-2 overflow-x-auto"><code class="text-green-400">$1</code></pre>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-96">
      {/* Processing Stats (only show if user has made queries) */}
      {processingStats.totalQueries > 0 && (
        <div className="px-3 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>
              {processingStats.totalQueries} queries • {processingStats.successfulQueries} successful
            </span>
            <span>
              Avg: {Math.round(processingStats.averageProcessingTime)}ms
            </span>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950 border border-gray-800 rounded-lg">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                {/* Message bubble */}
                <div
                  className={`px-4 py-3 rounded-lg text-sm ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'system'
                      ? 'bg-gray-800 border border-gray-700 text-gray-300'
                      : 'bg-gray-900 border border-gray-800 text-gray-200'
                  }`}
                >
                  {/* Avatar and content */}
                  <div className={`flex items-start space-x-3 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.type === 'user' 
                        ? 'bg-blue-700' 
                        : message.type === 'system'
                        ? 'bg-gray-700'
                        : 'bg-purple-600'
                    }`}>
                      {message.type === 'user' ? (
                        <User size={12} />
                      ) : message.type === 'system' ? (
                        <Database size={12} />
                      ) : (
                        <Bot size={12} />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Processing indicator */}
                      {message.isProcessing ? (
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-sm text-gray-400">Processing...</span>
                          <button
                            onClick={cancelProcessing}
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded ml-2"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Message content */}
                          <div 
                            dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                            className="prose prose-sm prose-invert max-w-none"
                          />
                          
                          {/* SQL Result metadata */}
                          {message.sqlResult && (
                            <div className="mt-3 p-2 bg-gray-800 rounded text-xs">
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center">
                                  <Zap size={10} className="mr-1 text-yellow-400" />
                                  <span>Confidence: {Math.round(message.sqlResult.confidence * 100)}%</span>
                                </div>
                                <div className="flex items-center">
                                  <Clock size={10} className="mr-1 text-blue-400" />
                                  <span>{message.sqlResult.processingTime}ms</span>
                                </div>
                                <div className="flex items-center">
                                  <Database size={10} className="mr-1 text-green-400" />
                                  <span>{message.sqlResult.approach}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Action buttons */}
                          {message.actions && message.actions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.actions.map((action) => (
                                <button
                                  key={action.id}
                                  onClick={action.onClick}
                                  disabled={action.disabled}
                                  className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    action.variant === 'primary'
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600'
                                      : action.variant === 'success'
                                      ? 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600'
                                      : action.variant === 'warning'
                                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-gray-600'
                                      : action.variant === 'danger'
                                      ? 'bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-600'
                                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 disabled:bg-gray-800'
                                  }`}
                                >
                                  {action.icon}
                                  <span className="ml-1">{action.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* Timestamp */}
                          <div className={`mt-2 text-xs flex items-center ${
                            message.type === 'user' ? 'justify-end text-blue-200' : 'text-gray-600'
                          }`}>
                            <Clock size={10} className="mr-1" />
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Example Queries */}
      {showSuggestions && messages.length > 0 && exampleQueries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-3 bg-gray-900 border border-gray-800 rounded-lg mt-2"
        >
          <div className="text-xs text-gray-500 mb-2 flex items-center">
            <Lightbulb size={12} className="mr-1" />
            Try these examples:
          </div>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((query, index) => (
              <button
                key={index}
                onClick={() => {
                  setInputValue(query);
                  setShowSuggestions(false);
                }}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
              >
                {query}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Input Area */}
      <div className="mt-4 flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={hasAvailableData ? "Ask about your data..." : "Upload a file to start chatting"}
          disabled={!hasAvailableData || isProcessing}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={!inputValue.trim() || !canProcess || isProcessing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      {/* Help text */}
      {!hasAvailableData && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          Upload a data file to start asking questions about your data
        </div>
      )}
      
      {hasAvailableData && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          Ask questions like "show me the data", "create a chart", or "find patterns"
        </div>
      )}
    </div>
  );
};

export default EnhancedChatInterface;