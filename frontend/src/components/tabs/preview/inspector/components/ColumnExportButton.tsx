import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  FileText, 
  Table, 
  Code,
  ChevronDown,
  Lock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/auth/useAuth';

interface ColumnExportButtonProps {
  columnName: string;
  columnType: string;
  onExport: (format: string, columnName: string) => Promise<void>;
  onAuthRequired?: () => void;
  disabled?: boolean;
  className?: string;
}

type ExportFormat = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  extension: string;
  requiresAuth?: boolean;
};

const exportFormats: ExportFormat[] = [
  {
    id: 'csv',
    name: 'CSV',
    description: 'Unique values',
    icon: <Table className="h-4 w-4" />,
    extension: '.csv',
     requiresAuth: true
  },
  {
    id: 'json',
    name: 'JSON',
    description: 'Unique values',
    icon: <Code className="h-4 w-4" />,
    extension: '.json',
    requiresAuth: true,
  },
  {
    id: 'txt',
    name: 'Text',
    description: 'Unique values',
    icon: <FileText className="h-4 w-4" />,
    extension: '.txt',
  },
  // {
  //   id: 'excel',
  //   name: 'Excel',
  //   description: 'Excel spreadsheet',
  //   icon: <Table className="h-4 w-4" />,
  //   extension: '.xlsx',
  //   requiresAuth: true,
  // },
];

const ColumnExportButton: React.FC<ColumnExportButtonProps> = ({
  columnName,
  columnType,
  onExport,
  onAuthRequired,
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{
    format: string;
    status: 'success' | 'error';
    message: string;
  } | null>(null);

  const { isAuthenticated } = useAuth();

  const handleExport = async (format: ExportFormat) => {
    // Check if authentication is required
    if (format.requiresAuth && !isAuthenticated) {
      onAuthRequired?.();
      setIsOpen(false);
      return;
    }

    setIsExporting(format.id);
    setExportStatus(null);

    try {
      await onExport(format.id, columnName);
      setExportStatus({
        format: format.name,
        status: 'success',
        message: `${format.name} exported successfully`
      });
    } catch (error) {
      setExportStatus({
        format: format.name,
        status: 'error',
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsExporting(null);
      // Clear status after 3 seconds
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const getAvailableFormats = () => {
    // Filter formats based on column type
    return exportFormats.filter(format => {
      if (format.id === 'chart') {
        // Only show chart option for numeric or categorical columns
        return columnType.includes('int') || 
               columnType.includes('double') || 
               columnType.includes('varchar') ||
               columnType.includes('text');
      }
      return true;
    });
  };

  const availableFormats = getAvailableFormats();

  return (
    <div className={cn("relative", className)}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-all duration-200",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "bg-accent/20"
        )}
      >
        <Download className="h-4 w-4" />
        <span>Export</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3 w-3" />
        </motion.div>
      </button>

      {/* Export Status */}
      <AnimatePresence>
        {exportStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "absolute top-full right-0 mt-2 px-3 py-2 rounded-lg border text-sm z-50",
              exportStatus.status === 'success' 
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/20 border-red-500/30 text-red-300"
            )}
          >
            <div className="flex items-center gap-2">
              {exportStatus.status === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {exportStatus.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 w-64 bg-popover backdrop-blur-xl border border-border rounded-lg shadow-xl z-50"
          >
            <div className="p-3">
              <div className="text-sm font-medium text-foreground mb-2">
                Export "{columnName}"
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                Type: {columnType}
              </div>
              
              <div className="space-y-1">
                {availableFormats.map(format => (
                  <button
                    key={format.id}
                    onClick={() => handleExport(format)}
                    disabled={isExporting === format.id}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                      isExporting === format.id
                        ? "bg-accent/10 cursor-not-allowed"
                        : "hover:bg-accent/10"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {isExporting === format.id ? (
                        <div className="h-4 w-4 border-2 border-border border-t-foreground rounded-full animate-spin" />
                      ) : (
                        format.icon
                      )}
                      <div>
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                          {format.name}
                          {format.requiresAuth && !isAuthenticated && (
                            <Lock className="h-3 w-3 text-yellow-400" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format.extension}
                    </div>
                  </button>
                ))}
              </div>

              {/* Auth Notice */}
              {!isAuthenticated && availableFormats.some(f => f.requiresAuth) && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-yellow-400">
                    <Lock className="h-3 w-3" />
                    <span>Downloading requires sign-in</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default ColumnExportButton;