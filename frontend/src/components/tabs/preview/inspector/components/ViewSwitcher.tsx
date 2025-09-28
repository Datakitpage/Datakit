import React from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Download, 
  BarChart3,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewType = 'overview' | 'columns' | 'problems' | 'export';

interface ViewOption {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  description: string;
  badge?: number;
  disabled?: boolean;
}

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  problemCount?: number;
  columnCount?: number;
  rowCount?: number;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  onViewChange,
  problemCount = 0,
  columnCount = 0
}) => {
  const viewOptions: ViewOption[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <BarChart3 className="h-4 w-4" />,
      description: 'Data summary and health'
    },
    {
      id: 'columns',
      label: 'Columns',
      icon: <List className="h-4 w-4" />,
      description: 'Column-by-column analysis',
      badge: columnCount
    },
    {
      id: 'problems',
      label: 'Problems',
      icon: <AlertTriangle className="h-4 w-4" />,
      description: 'Quality issues and fixes',
      badge: problemCount
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download className="h-4 w-4" />,
      description: 'Export options'
    }
  ];

  const formatBadge = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  return (
    <div className="flex items-center gap-1 p-2 bg-card/10 rounded-lg border border-border">
      {viewOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => onViewChange(option.id)}
          disabled={option.disabled}
          className={cn(
            "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            currentView === option.id
              ? "text-primary shadow-sm" 
              : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
            option.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Selection indicator */}
          {currentView === option.id && (
            <motion.div
              layoutId="viewSwitcher"
              className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}

          {/* Icon and label */}
          <div className="relative flex items-center gap-2">
            {option.icon}
            <span className="hidden sm:inline">{option.label}</span>
          </div>

          {/* Badge */}
          {option.badge !== undefined && option.badge > 0 && (
            <div className={cn(
              "relative flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-medium",
              currentView === option.id
                ? "text-foreground"
                : option.id === 'problems' && option.badge > 0
                ? "bg-red-500 text-foreground"
                : "bg-accent/20 text-muted-foreground"
            )}>
              {formatBadge(option.badge)}
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

export default ViewSwitcher;