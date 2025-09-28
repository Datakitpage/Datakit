import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/auth/useAuth';
import AuthModal from '@/components/auth/AuthModal';

interface SimpleColumnActionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  columnName: string;
  columnType: string;
  tableName: string;
  position: { x: number; y: number };
  onExecute: (prompt: string) => void;
}

const SimpleColumnActionPanel: React.FC<SimpleColumnActionPanelProps> = ({
  isOpen,
  onClose,
  columnName,
  columnType,
  tableName,
  position,
  onExecute,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const { isAuthenticated } = useAuth();

  // Smart suggestions based on column type and name
  const getSuggestions = () => {
    const suggestions = [];
    
    // Type-based suggestions
    if (['INTEGER', 'DOUBLE', 'DECIMAL', 'BIGINT', 'FLOAT'].some(type => columnType.toUpperCase().includes(type))) {
      suggestions.push(
        `Show statistics for ${columnName}`,
        `Find outliers in ${columnName}`,
        `Create buckets from ${columnName}`
      );
    } else if (['VARCHAR', 'TEXT', 'STRING'].some(type => columnType.toUpperCase().includes(type))) {
      suggestions.push(
        `Convert ${columnName} to uppercase`,
        `Remove empty values from ${columnName}`,
        `Count unique values in ${columnName}`
      );
    } else if (['DATE', 'TIMESTAMP', 'DATETIME'].some(type => columnType.toUpperCase().includes(type))) {
      suggestions.push(
        `Extract year from ${columnName}`,
        `Filter by recent ${columnName}`,
        `Group by month from ${columnName}`
      );
    } else {
      // Default suggestions
      suggestions.push(
        `Analyze ${columnName}`,
        `Clean ${columnName} data`,
        `Transform ${columnName}`
      );
    }

    // Common suggestions for all types
    suggestions.push(
      `Remove rows where ${columnName} is null`,
      `Rename ${columnName} column`
    );

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  };

  const suggestions = getSuggestions();

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isExecuting) return;
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    setIsExecuting(true);
    try {
      await onExecute(prompt.trim());
      setPrompt('');
      onClose();
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string) => {
    // Check authentication before setting prompt
    if (!isAuthenticated) {
      setPrompt(suggestionText); // Save the suggestion
      setShowAuthModal(true);
      return;
    }
    
    setPrompt(suggestionText);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // If user had typed something, keep it and focus
    if (prompt.trim() && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Calculate panel position
  const panelStyle = {
    left: Math.min(position.x, window.innerWidth - 360),
    top: Math.min(position.y, window.innerHeight - 320),
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl w-80"
        style={panelStyle}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground text-sm">
              AI Actions for <span className="text-primary">{columnName}</span>
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {columnType}
            {!isAuthenticated && (
              <span className="ml-2 text-yellow-400">• Sign in required</span>
            )}
          </p>
        </div>

        {/* Input */}
        <div className="p-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`What would you like to do with ${columnName}?`}
              className="w-full h-20 px-3 py-2 text-sm bg-background border border-border rounded-md resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none text-foreground placeholder-muted-foreground"
            />
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isExecuting}
              className="absolute bottom-2 right-2 p-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isExecuting ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            Press ⌘+Enter to execute
          </p>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Suggestions:</p>
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`suggestion-${index}-${suggestion.substring(0, 20)}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm rounded-md bg-accent/5 hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signup"
        onLoginSuccess={handleAuthSuccess}
      />
    </AnimatePresence>
  );
};

export default SimpleColumnActionPanel;