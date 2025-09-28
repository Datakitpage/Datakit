import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Hash,
  Type,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Eye,
} from 'lucide-react';
import { InspectorMetrics } from '@/store/inspectorStore';
import EnhancedMiniChart from './charts/MiniChart';
import ColumnExportButton from './ColumnExportButton';

interface ColumnRowProps {
  column: InspectorMetrics['columnMetrics'][0];
  metrics: InspectorMetrics;
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetails: (columnName: string, type: 'nulls' | 'outliers' | 'duplicates') => void;
  onExportColumn: (format: string, columnName: string) => Promise<void>;
  onAuthRequired?: () => void;
  // onGenerateQuery: (query: string, description: string) => void;
}

const ColumnRow: React.FC<ColumnRowProps> = ({
  column,
  metrics,
  isExpanded,
  onToggle,
  onViewDetails,
  onExportColumn,
  onAuthRequired
}) => {
  const getColumnIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('double') || lowerType.includes('numeric')) {
      return <Hash className="h-4 w-4 text-tertiary" />;
    }
    if (lowerType.includes('varchar') || lowerType.includes('text')) {
      return <Type className="h-4 w-4 text-blue-400" />;
    }
    if (lowerType.includes('date') || lowerType.includes('time')) {
      return <Calendar className="h-4 w-4 text-purple-400" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const getQuickStat = () => {
    if (column.numericStats) {
      return `${column.numericStats.min} - ${column.numericStats.max}`;
    }
    if (column.nullCount > 0) {
      return `${column.nullCount} nulls`;
    }
    return `${column.uniqueCount} distinct`;
  };

  const getQualityIndicator = () => {
    const nullPercentage = column.nullPercentage;
    const cardinality = column.cardinality;
    
    if (nullPercentage > 20) {
      return { icon: <AlertTriangle className="h-4 w-4 text-red-400" />, level: 'critical' };
    }
    if (nullPercentage > 10 || cardinality > 0.9) {
      return { icon: <AlertTriangle className="h-4 w-4 text-yellow-400" />, level: 'warning' };
    }
    return { icon: <CheckCircle className="h-4 w-4 text-emerald-400" />, level: 'good' };
  };

  const qualityIndicator = getQualityIndicator();

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border"
    >
      <motion.div
        whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
        className="p-4 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 p-1">
              
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.div>
              {getColumnIcon(column.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-medium text-foreground truncate">{column.name}</div>
                {qualityIndicator.icon}
                
              </div>
              <div className="text-xs text-muted-foreground">{column.type}</div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-foreground font-mono">{getQuickStat()}</div>
              <div className="text-xs text-muted-foreground">
                {column.uniqueCount} distinct
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
            <ColumnExportButton
              columnName={column.name}
              columnType={column.type}
              onExport={onExportColumn}
              onAuthRequired={onAuthRequired}
            />
            
            <button
              onClick={() => onViewDetails(column.name, 'nulls')}
              className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Enhanced Chart */}
              <EnhancedMiniChart
                column={column}
                metrics={metrics}
                onExport={(format) => onExportColumn(format, column.name)}
                onViewDetails={() => onViewDetails(column.name, 'nulls')}
              />

              {/* Quick Actions */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => onViewDetails(column.name, 'nulls')}
                  className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View Nulls ({column.nullCount})
                </button>
                
                {column.numericStats && column.numericStats.outliers > 0 && (
                  <button
                    onClick={() => onViewDetails(column.name, 'outliers')}
                    className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View Outliers ({column.numericStats.outliers})
                  </button>
                )}
              </div>

              {/* Suggested Queries */}
              {/* <div className="mt-4">
                <div className="text-xs text-white/60 mb-2">Suggested Queries</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {generateSuggestedQueries().slice(0, 3).map((item, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onGenerateQuery(item.query, item.description)}
                      className="flex items-center gap-2 w-full p-2 bg-primary/5 hover:bg-primary/10 rounded text-xs text-left transition-colors"
                    >
                      <span className="text-white/80">{item.description}</span>
                    </motion.button>
                  ))}
                </div>
              </div> */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ColumnRow;