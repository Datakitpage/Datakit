import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info,
  Eye,
  Download,
  ChevronRight,
  X,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InspectorMetrics } from '@/store/inspectorStore';
import { useAuth } from '@/hooks/auth/useAuth';

interface ProblemsViewProps {
  metrics: InspectorMetrics;
  onViewDuplicates?: () => void;
  onViewNulls?: (columnName: string) => void;
  onViewIssues?: (columnName: string, issueType: string) => void;
  onExportProblems?: (type: string, columnName?: string) => void;
  onAuthRequired?: () => void;
}

type ProblemSeverity = 'critical' | 'warning' | 'info';
type ProblemFilter = 'all' | 'critical' | 'warning' | 'info';

interface ProblemItem {
  id: string;
  type: 'duplicates' | 'nulls' | 'type_issue';
  severity: ProblemSeverity;
  title: string;
  description: string;
  count: number;
  column?: string;
  examples?: string[];
  percentage?: number;
}

const ProblemsView: React.FC<ProblemsViewProps> = ({
  metrics,
  onViewDuplicates,
  onViewNulls,
  onViewIssues,
  onExportProblems,
  onAuthRequired
}) => {
  const { isAuthenticated } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ProblemFilter>('all');
  const [exportingItems, setExportingItems] = useState<Set<string>>(new Set());
  const [exportedItems, setExportedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Build problem items from metrics
  const buildProblemItems = (): ProblemItem[] => {
    const items: ProblemItem[] = [];

    // Add duplicates if any
    if (metrics.duplicateRows > 0) {
      items.push({
        id: 'duplicates',
        type: 'duplicates',
        severity: metrics.duplicatePercentage > 10 ? 'critical' : metrics.duplicatePercentage > 5 ? 'warning' : 'info',
        title: 'Duplicate Rows',
        description: `${metrics.duplicateRows} duplicate rows found (${metrics.duplicatePercentage.toFixed(1)}% of total)`,
        count: metrics.duplicateRows,
        percentage: metrics.duplicatePercentage
      });
    }

    // Add null value issues
    metrics.columnMetrics.forEach(column => {
      if (column.nullCount > 0) {
        const nullPercentage = column.nullPercentage;
        items.push({
          id: `nulls-${column.name}`,
          type: 'nulls',
          severity: nullPercentage > 20 ? 'critical' : nullPercentage > 10 ? 'warning' : 'info',
          title: `Missing Values in ${column.name}`,
          description: `${column.nullCount} null values (${nullPercentage.toFixed(1)}% of column)`,
          count: column.nullCount,
          column: column.name,
          percentage: nullPercentage
        });
      }
    });

    // Add type issues
    metrics.typeIssues.forEach((issue, index) => {
      items.push({
        id: `type-${issue.column}-${index}`,
        type: 'type_issue',
        severity: issue.severity === 'high' ? 'critical' : issue.severity === 'medium' ? 'warning' : 'info',
        title: `${issue.issue} in ${issue.column}`,
        description: `${issue.count} problematic values found`,
        count: issue.count,
        column: issue.column,
        examples: issue.examples
      });
    });

    // Sort by severity (critical first)
    return items.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };

  const problemItems = buildProblemItems();
  const filteredItems = problemItems.filter(item => 
    filter === 'all' || item.severity === filter
  );

  const getSeverityIcon = (severity: ProblemSeverity) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'info': return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: ProblemSeverity) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'info': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  const handleViewAction = (item: ProblemItem) => {
    switch (item.type) {
      case 'duplicates':
        onViewDuplicates?.();
        break;
      case 'nulls':
        if (item.column) onViewNulls?.(item.column);
        break;
      case 'type_issue':
        if (item.column) onViewIssues?.(item.column, item.title);
        break;
    }
  };

  const handleExportAction = async (item: ProblemItem) => {
    // Check authentication before allowing export
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    // Add item to exporting set
    setExportingItems(prev => new Set(prev).add(item.id));

    try {
      switch (item.type) {
        case 'duplicates':
          await onExportProblems?.('duplicates');
          break;
        case 'nulls':
          if (item.column) await onExportProblems?.('nulls', item.column);
          break;
        case 'type_issue':
          if (item.column) await onExportProblems?.('type_issues', item.column);
          break;
      }
      
      // Add to exported items for success feedback
      setExportedItems(prev => new Set(prev).add(item.id));
      
      // Remove success indicator after 3 seconds
      setTimeout(() => {
        setExportedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
      }, 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      // Remove item from exporting set
      setExportingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const criticalCount = problemItems.filter(item => item.severity === 'critical').length;
  const warningCount = problemItems.filter(item => item.severity === 'warning').length;
  const infoCount = problemItems.filter(item => item.severity === 'info').length;

  if (problemItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center p-8 text-center"
      >
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No Problems Found!</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Your data appears to be clean with no critical issues detected.
        </p>
        <div className="text-xs text-foreground/50">
          Health Score: {metrics.healthScore}%
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Data Quality Issues</h3>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {filteredItems.length} of {problemItems.length} issues
          </div>
        </div>
      </div>

      {/* Problem Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
          className={cn(
            "p-3 rounded-lg border transition-all duration-200 text-left",
            filter === 'critical' 
              ? "bg-red-500/20 border-red-500/30" 
              : "bg-red-500/10 border-red-500/20 hover:bg-red-500/15"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Critical</span>
          </div>
          <div className="text-lg font-bold text-foreground">{criticalCount}</div>
        </button>

        <button
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          className={cn(
            "p-3 rounded-lg border transition-all duration-200 text-left",
            filter === 'warning'
              ? "bg-yellow-500/20 border-yellow-500/30"
              : "bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/15"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">Warning</span>
          </div>
          <div className="text-lg font-bold text-foreground">{warningCount}</div>
        </button>

        <button
          onClick={() => setFilter(filter === 'info' ? 'all' : 'info')}
          className={cn(
            "p-3 rounded-lg border transition-all duration-200 text-left",
            filter === 'info'
              ? "bg-blue-500/20 border-blue-500/30"
              : "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <Info className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Info</span>
          </div>
          <div className="text-lg font-bold text-foreground">{infoCount}</div>
        </button>
      </div>

      {/* Filter Reset */}
      {filter !== 'all' && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Filtered by:</span>
          <button
            onClick={() => setFilter('all')}
            className="flex items-center gap-1 px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded text-sm text-muted-foreground transition-colors"
          >
            {filter}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Problem Items */}
      <div className="space-y-2">
        {filteredItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "border rounded-lg transition-all duration-200",
              getSeverityColor(item.severity)
            )}
          >
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggleExpanded(item.id)}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 p-1">
                  
                  <motion.div
                    animate={{ rotate: expandedItems.has(item.id) ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                  {getSeverityIcon(item.severity)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleViewAction(item)}
                  className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                  title="View details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleExportAction(item)}
                  disabled={exportingItems.has(item.id) || exportedItems.has(item.id)}
                  className={cn(
                    "p-1 rounded transition-colors",
                    exportingItems.has(item.id)
                      ? "cursor-not-allowed opacity-50"
                      : exportedItems.has(item.id)
                      ? "text-emerald-400"
                      : isAuthenticated
                      ? "hover:bg-accent/10 text-muted-foreground hover:text-foreground"
                      : "hover:bg-yellow-500/10 text-yellow-400/70 hover:text-yellow-400"
                  )}
                  title={
                    exportingItems.has(item.id)
                      ? "Exporting..."
                      : exportedItems.has(item.id)
                      ? "Export completed!"
                      : isAuthenticated 
                      ? "Export data" 
                      : "Sign in to export data"
                  }
                >
                  {exportingItems.has(item.id) ? (
                    <div className="h-4 w-4 border-2 border-border border-t-foreground rounded-full animate-spin" />
                  ) : exportedItems.has(item.id) ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : isAuthenticated ? (
                    <Download className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <Download className="text-muted-foreground h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expandedItems.has(item.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 border-t border-border">
                    <div className="pt-3">
                      {item.examples && item.examples.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground mb-2">Examples:</div>
                          <div className="space-y-1">
                            {item.examples.map((example, i) => (
                              <div
                                key={i}
                                className="text-xs font-mono bg-black/20 px-2 py-1 rounded text-muted-foreground"
                              >
                                {example}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div>Count: {item.count.toLocaleString()}</div>
                        {item.percentage && (
                          <div>Percentage: {item.percentage.toFixed(1)}%</div>
                        )}
                        {item.column && (
                          <div>Column: {item.column}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <div className="text-sm text-muted-foreground">
            No {filter} issues found
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProblemsView;