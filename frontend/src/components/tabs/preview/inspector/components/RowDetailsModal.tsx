import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Copy, 
  Filter, 
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RowData {
  [key: string]: any;
}

interface RowDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'duplicates' | 'nulls' | 'outliers' | 'type_issues';
  columnName?: string;
  data: RowData[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const RowDetailsModal: React.FC<RowDetailsModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  columnName,
  data,
  isLoading = false,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Initialize visible columns
  useEffect(() => {
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      setVisibleColumns(new Set(columns.slice(0, 10))); // Show first 10 columns by default
    }
  }, [data]);

  // Filter data based on search
  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Paginate data
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const allColumns = data.length > 0 ? Object.keys(data[0]) : [];
  const visibleColumnList = allColumns.filter(col => visibleColumns.has(col));

  const toggleColumn = (columnName: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnName)) {
      newVisible.delete(columnName);
    } else {
      newVisible.add(columnName);
    }
    setVisibleColumns(newVisible);
  };

  const copyValue = (value: any) => {
    navigator.clipboard.writeText(String(value));
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'duplicates': return <Copy className="h-5 w-5 text-orange-400" />;
      case 'nulls': return <AlertTriangle className="h-5 w-5 text-red-400" />;
      case 'outliers': return <Hash className="h-5 w-5 text-purple-400" />;
      case 'type_issues': return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      default: return <CheckCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-red-400 italic">null</span>;
    }
    if (value === '') {
      return <span className="text-yellow-400 italic">empty</span>;
    }
    if (typeof value === 'string' && value.length > 50) {
      return (
        <span className="font-mono text-sm" title={value}>
          {value.slice(0, 50)}...
        </span>
      );
    }
    return <span className="font-mono text-sm">{String(value)}</span>;
  };

  const getColumnTypeColor = (columnName: string) => {
    if (columnName === columnName) return 'text-primary';
    return 'text-muted-foreground';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-black/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              {getTypeIcon()}
              <div>
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                <div className="text-sm text-muted-foreground">
                  {filteredData.length} rows {columnName && `• Column: ${columnName}`}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-2 hover:bg-accent/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </button>
              )}
              
             
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-4 mb-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search rows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-accent/10 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Column Filter */}
              <div className="relative">
                <details className="group">
                  <summary className="flex items-center gap-2 px-3 py-2 bg-accent/10 hover:bg-accent/20 rounded-lg text-sm text-muted-foreground cursor-pointer">
                    <Filter className="h-4 w-4" />
                    Columns ({visibleColumns.size})
                  </summary>
                  <div className="absolute right-0 top-full mt-1 w-64 bg-black/95 border border-border rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                    <div className="p-3">
                      {allColumns.map(col => (
                        <label key={col} className="flex items-center gap-2 p-1 hover:bg-accent/10 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(col)}
                            onChange={() => toggleColumn(col)}
                            className="rounded border-border bg-accent/10 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-muted-foreground truncate">{col}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-accent/10 hover:bg-accent/20 rounded text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1">
                    {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-accent/10 hover:bg-accent/20 rounded text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading rows...
                </div>
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-muted-foreground mb-2">No rows found</div>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-border">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground w-12">#</th>
                    {visibleColumnList.map(col => (
                      <th
                        key={col}
                        className={cn(
                          "text-left p-3 text-xs font-medium min-w-32",
                          getColumnTypeColor(col)
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className="border-b border-border hover:bg-accent/5 transition-colors"
                    >
                      <td className="p-3 text-xs text-muted-foreground">
                        {startIndex + i + 1}
                      </td>
                      {visibleColumnList.map(col => (
                        <td
                          key={col}
                          className="p-3 text-muted-foreground cursor-pointer group relative"
                          onClick={() => copyValue(row[col])}
                          title="Click to copy"
                        >
                          {formatValue(row[col])}
                          <Copy className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RowDetailsModal;