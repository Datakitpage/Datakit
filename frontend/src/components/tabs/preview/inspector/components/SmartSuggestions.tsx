import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Clock,
  Trophy,
  Target,
  MapPin,
  Search,
  Play,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartSuggestion } from '../utils/smartSuggestions';
import { useDuckDBStore } from '@/store/duckDBStore';

interface SmartSuggestionsProps {
  suggestions: SmartSuggestion[];
  isLoading: boolean;
  onRunSuggestion: (suggestion: SmartSuggestion) => void;
  className?: string;
}

const getCategoryIcon = (category: SmartSuggestion['category']) => {
  switch (category) {
    case 'timeline': return TrendingUp;
    case 'ranking': return Trophy;
    case 'distribution': return PieChart;
    case 'comparison': return BarChart3;
    case 'quality': return Search;
    case 'exploration': return Target;
    default: return Sparkles;
  }
};

const getCategoryColor = (category: SmartSuggestion['category']) => {
  switch (category) {
    case 'timeline': return 'from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30';
    case 'ranking': return 'from-yellow-500/20 to-yellow-600/20 hover:from-yellow-500/30 hover:to-yellow-600/30';
    case 'distribution': return 'from-purple-500/20 to-purple-600/20 hover:from-purple-500/30 hover:to-purple-600/30';
    case 'comparison': return 'from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30';
    case 'quality': return 'from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30';
    case 'exploration': return 'from-indigo-500/20 to-indigo-600/20 hover:from-indigo-500/30 hover:to-indigo-600/30';
    default: return 'from-gray-500/20 to-gray-600/20 hover:from-gray-500/30 hover:to-gray-600/30';
  }
};

const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  suggestions,
  isLoading,
  onRunSuggestion,
  className,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const categories = [
    { id: 'all', label: 'All', count: suggestions.length },
    ...Array.from(new Set(suggestions.map(s => s.category))).map(cat => ({
      id: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: suggestions.filter(s => s.category === cat).length,
    })),
  ];

  const filteredSuggestions = selectedCategory === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.category === selectedCategory);

  const executeQuery = useDuckDBStore(state => state.executeQuery);

  const handleRunSuggestion = async (suggestion: SmartSuggestion) => {
    setRunningIds(prev => new Set(prev).add(suggestion.id));
    try {
      // Execute the SQL query using DuckDB
      const result = await executeQuery(suggestion.query);
      console.log('Query result:', result);
      // You can add more handling here like showing results in a modal or sidebar
      await onRunSuggestion(suggestion);
    } catch (error) {
      console.error('Error executing suggestion query:', error);
    } finally {
      setRunningIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className={cn("p-6", className)}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
            <div>
              <p className="text-sm text-white/80 font-medium">Analyzing your data patterns...</p>
              <p className="text-xs text-white/60 mt-1">This will just take a moment</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className={cn("p-6", className)}>
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/60">No suggestions available yet</p>
          <p className="text-sm text-white/40 mt-2">
            Load some data to see smart suggestions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-4 space-y-4", className)}>
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Smart Insights
        </h3>
        <p className="text-xs text-white/70 mt-1">
          Pattern-based suggestions to explore your data
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {categories.map(cat => (
          <motion.button
            key={cat.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-all",
              selectedCategory === cat.id
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
            )}
          >
            {cat.label}
            <span className="ml-1 opacity-60">({cat.count})</span>
          </motion.button>
        ))}
      </div>

      {/* Suggestions Grid */}
      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {filteredSuggestions.map((suggestion, index) => {
            const Icon = getCategoryIcon(suggestion.category);
            const isRunning = runningIds.has(suggestion.id);
            
            return (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: index * 0.03 }}
                className="relative group"
              >
                <button
                  onClick={() => handleRunSuggestion(suggestion)}
                  disabled={isRunning}
                  className={cn(
                    "w-full p-3 rounded-lg border border-white/10",
                    "bg-gradient-to-br transition-all duration-200",
                    getCategoryColor(suggestion.category),
                    "hover:border-white/20 hover:shadow-md hover:scale-[1.01]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "text-left"
                  )}
                >
                  {/* Confidence indicator */}
                  <div className="absolute top-2 right-2">
                    <div className="flex gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1 h-2.5 rounded-full",
                            i < Math.ceil(suggestion.confidence * 3)
                              ? "bg-primary/80"
                              : "bg-white/20"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-white/10 rounded">
                      <Icon className="h-4 w-4 text-white/90" />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <h4 className="text-sm font-medium text-white/95">
                        {suggestion.title}
                      </h4>
                      <p className="text-xs text-white/65 leading-relaxed">
                        {suggestion.description}
                      </p>
                      
                      {/* Required columns */}
                      {suggestion.requiredColumns.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-xs text-white/45">Uses:</span>
                          {suggestion.requiredColumns.slice(0, 2).map(col => (
                            <span
                              key={col}
                              className="text-xs px-1.5 py-0.5 bg-white/10 rounded text-white/70"
                            >
                              {col}
                            </span>
                          ))}
                          {suggestion.requiredColumns.length > 2 && (
                            <span className="text-xs text-white/45">
                              +{suggestion.requiredColumns.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                      {isRunning ? (
                        <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Tips */}
      <div className="mt-4 p-3 bg-white/5 rounded border border-white/10">
        <p className="text-xs text-white/60">
          💡 <span className="font-medium text-white/70">Tip:</span> These suggestions analyze your column names and data patterns. 
          Click any suggestion to run the query.
        </p>
      </div>
    </div>
  );
};

export default SmartSuggestions;