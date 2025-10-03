import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Grid3x3, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import LocalTablePanel from './export-panels/LocalTablePanel';
import RestAPIPanel from './export-panels/RestAPIPanel';

type ExportProvider = 
  | 'local-table'        // Current functionality
  | 'rest-api';          // API integration

interface ExportProviderConfig {
  id: ExportProvider;
  label: string;
  icon: React.ReactNode;
  description: string;
  badge?: string;
}

export interface ExportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (provider: ExportProvider, config: any) => void;
  isExporting: boolean;
  results: any[];
  columns: string[];
  query?: string;
  rowCount: number;
  columnCount: number;
  sourceFileName?: string;
}

const ExportResultsModal: React.FC<ExportResultsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isExporting,
  results,
  columns,
  query,
  rowCount,
  columnCount,
  sourceFileName
}) => {
  const { t } = useTranslation();
  const [activeProvider, setActiveProvider] = useState<ExportProvider>('local-table');

  const EXPORT_PROVIDERS: ExportProviderConfig[] = [
    {
      id: 'local-table',
      label: t('export.providers.localTable.label', { defaultValue: 'Local Table' }),
      icon: <Grid3x3 className="h-4 w-4" />,
      description: t('export.providers.localTable.description', { defaultValue: 'Save in browser' }),
    },
    {
      id: 'rest-api',
      label: t('export.providers.restApi.label', { defaultValue: 'REST API' }),
      icon: <Send className="h-4 w-4" />,
      description: t('export.providers.restApi.description', { defaultValue: 'Send to your API endpoint' }),
    },
  ];

  // Load last used provider
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('datakit-last-export-provider');
      if (saved === 'rest-api' || saved === 'local-table') {
        setActiveProvider(saved as ExportProvider);
      }
    }
  }, [isOpen]);

  const handleProviderChange = (provider: ExportProvider) => {
    setActiveProvider(provider);
    localStorage.setItem('datakit-last-export-provider', provider);
  };

  const handleExport = (config: any) => {
    onConfirm(activeProvider, config);
  };

  const renderProviderPanel = () => {
    const commonProps = {
      results,
      columns,
      query,
      rowCount,
      columnCount,
      sourceFileName,
      onExport: handleExport,
      isExporting,
    };

    switch (activeProvider) {
      case 'local-table':
        return <LocalTablePanel {...commonProps} />;
      case 'rest-api':
        return <RestAPIPanel {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="w-full max-w-5xl h-[75vh] bg-black border border-white/20 rounded-lg shadow-xl shadow-black/30 overflow-hidden flex"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Sidebar */}
            <div className="w-64 bg-gradient-to-b from-darkNav to-black border-r border-white/10 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-heading font-medium text-white">
                    {t('export.title', { defaultValue: 'Save Results' })}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60 mt-1">
                  <span>{rowCount.toLocaleString()} rows</span>
                  <span>•</span>
                  <span>{columnCount} columns</span>
                </div>
              </div>

              {/* Provider Selection */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  {EXPORT_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderChange(provider.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg mb-1 transition-all duration-200 group relative',
                        activeProvider === provider.id
                          ? provider.id === 'rest-api'
                            ? 'bg-primary/10 border border-primary/20 text-white'
                            : 'bg-primary/20 border border-primary/30 text-white'
                          : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                      )}
                    >
                      <div className="flex items-center">
                        <div
                          className={cn(
                            'h-8 w-8 rounded-md flex items-center justify-center mr-3 border',
                            activeProvider === provider.id
                              ? provider.id === 'rest-api'
                                ? 'border-primary/50'
                                : 'border-primary/50'
                              : 'bg-white/5 border-white/10 text-white/60 group-hover:border-white/20'
                          )}
                        >
                          {provider.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {provider.label}
                            </p>
                            {provider.badge && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                {provider.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5 truncate opacity-80">
                            {provider.description}
                          </p>
                        </div>
                      </div>

                      {/* Active indicator */}
                      {activeProvider === provider.id && (
                        <motion.div
                          layoutId="activeExportProvider"
                          className={cn(
                            'absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 rounded-r',
                            provider.id === 'rest-api' ? 'bg-primary' : 'bg-primary'
                          )}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 30,
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Content Header */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-background/50 to-background/30">
                <div className="flex items-center">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-md flex items-center justify-center mr-3 border',
                      activeProvider === 'rest-api'
                        ? 'border-primary/30'
                        : 'bg-primary/20 border-primary/30'
                    )}
                  >
                    {EXPORT_PROVIDERS.find((p) => p.id === activeProvider)?.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-white">
                      {EXPORT_PROVIDERS.find((p) => p.id === activeProvider)?.label}
                    </h3>
                    <p className="text-sm text-white/70">
                      {EXPORT_PROVIDERS.find((p) => p.id === activeProvider)?.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 w-8 p-0 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Dynamic Content */}
              <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeProvider}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    {renderProviderPanel()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExportResultsModal;