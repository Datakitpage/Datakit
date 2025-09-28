import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link } from 'lucide-react';

import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/auth/useAuth';

import { Button } from '@/components/ui/Button';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';

import { cn } from '@/lib/utils';

import S3ImportPanel from './import-modal/S3ImportPanel';
import { CustomURLPanel } from './import-modal/CustomURLPanel';
import GoogleSheetsPanel from './import-modal/GoogleSheetsPanel';
import HuggingFacePanel from './import-modal/HuggingFacePanel';
import MotherDuckPanel from './import-modal/MotherDuckPanel';
import PostgreSQLPanel from './import-modal/PostgreSQLPanel';

import GCSImportPanel from './import-modal/GCSImportPanel';
import GoogleDrivePanel from './import-modal/GoogleDrivePanel';
import AuthModal from '@/components/auth/AuthModal';

import S3 from '@/assets/s3.png';
import GCS from '@/assets/gcs.svg';
import Drive from '@/assets/drive.svg';
import HuggingFace from '@/assets/huggingface.png';
import MotherDuckIcon from '@/assets/md.png';
import PostgreSQLIcon from '@/assets/postgres.png';
import { ImportProvider } from '@/types/remoteImport';

export interface RemoteDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: any) => void;
}

interface ProviderTab {
  id: ImportProvider;
  label: string;
  icon: React.ReactNode;
  description: string;
  comingSoon?: boolean;
  featured?: boolean;
  requiresAuth?: boolean;
}

const PROVIDER_TABS: ProviderTab[] = [
  {
    id: 'custom-url',
    label: 'Custom URL',
    icon: <Link color="white" className="h-4 w-4" />,
    description: 'Import from any public URL',
  },
  {
    id: 's3',
    label: 'Amazon S3',
    icon: <img src={S3} className="h-4 w-4" />,
    description: 'Public S3 buckets',
  },
  {
    id: 'huggingface',
    label: 'HuggingFace',
    icon: <img src={HuggingFace} className="h-5 w-5" />,
    description: 'ML datasets',
  },
  {
    id: 'motherduck',
    label: 'MotherDuck',
    icon: <img src={MotherDuckIcon} className="h-5 w-5" alt="MotherDuck" />,
    description: 'Cloud DuckDB',
    featured: true,
    requiresAuth: false,
  },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    icon: <img src={PostgreSQLIcon} className="h-5 w-5" alt="PostgreSQL" />,
    description: 'PG databases',
    featured: true,
    requiresAuth: true,
  },
  {
    id: 'google-sheets',
    label: 'Google Sheets',
    icon: <GoogleSheetsIcon className="h-5 w-5" />,
    description: 'Published Google Sheets',
  },
  {
    id: 'gcs',
    label: 'Google Cloud',
    icon: <img src={GCS} className="h-6 w-6" />,
    description: 'Public GCS buckets',
    comingSoon: true,
  },
  {
    id: 'google-drive',
    label: 'Google Drive',
    icon: <img src={Drive} className="h-6 w-6" />,
    description: 'Files from Google Drive',
    comingSoon: true,
  },
];

const RemoteDataImportModal: React.FC<RemoteDataImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const {
    activeProviderRemoteModal: activeProvider,
    setActiveProviderRemoteModal: setActiveProvider,
  } = useAppStore();

  const { isAuthenticated } = useAuth();

  // Load last used provider from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('datakit-last-import-provider');
    if (saved && PROVIDER_TABS.find((tab) => tab.id === saved)) {
      setActiveProvider(saved as ImportProvider);
    }
  }, []);

  // Save provider choice to localStorage
  const handleProviderChange = (provider: ImportProvider) => {
    const providerTab = PROVIDER_TABS.find((tab) => tab.id === provider);

    if (providerTab?.comingSoon) {
      return; // Don't allow switching to coming soon providers
    }

    setActiveProvider(provider);
    localStorage.setItem('datakit-last-import-provider', provider);
  };

  const handleImportSuccess = (result: any) => {
    onImport(result);
    onClose();
  };

  const renderProviderPanel = () => {
    switch (activeProvider) {
      case 'huggingface': // Add HF case
        return <HuggingFacePanel onImport={handleImportSuccess} />;
      case 's3':
        return <S3ImportPanel onImport={handleImportSuccess} />;
      case 'custom-url':
        return <CustomURLPanel onImport={handleImportSuccess} />;
      case 'google-sheets':
        return <GoogleSheetsPanel onImport={handleImportSuccess} />;
      case 'motherduck':
        return <MotherDuckPanel onImport={onClose} />;
      case 'postgresql':
        return <PostgreSQLPanel onImport={handleImportSuccess} />;
      default:
        return (
          <div className="p-8 text-center text-muted-foreground">
            Select a provider to continue
          </div>
        );
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
          className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-background/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="w-full max-w-6xl h-[85vh] bg-popover border border-border rounded-lg shadow-xl shadow-black/30 overflow-hidden flex"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Sidebar */}
            <div className="w-64 bg-gradient-to-b from-popover to-background border-r border-border flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-heading font-medium text-foreground">
                    Import Remote Sources
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect to various data sources
                </p>
              </div>

              {/* Provider Navigation */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  {PROVIDER_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleProviderChange(tab.id)}
                      disabled={tab.comingSoon}
                      className={cn(
                        'w-full text-left p-3 rounded-lg mb-1 transition-all duration-200 group relative',
                        activeProvider === tab.id && !tab.comingSoon
                          ? tab.id === 'huggingface'
                            ? 'bg-yellow-400/10 border border-yellow-400/20 text-white' // HF yellow
                            : tab.id === 's3'
                            ? 'bg-orange-500/10 border border-orange-500/20 text-white' // AWS orange
                            : tab.id === 'google-sheets'
                            ? 'bg-green-500/15 border border-green-500/20 text-white' // Google green
                            : tab.id === 'custom-url'
                            ? 'bg-blue-500/15 border border-blue-500/20 text-white' // Generic blue
                            : tab.id === 'gcs'
                            ? 'bg-sky-500/15 border border-sky-500/20 text-white' // Google Cloud blue
                            : tab.id === 'google-drive'
                            ? 'bg-blue-600/20 border border-blue-600/30 text-white' // Drive blue
                            : tab.id === 'motherduck'
                            ? 'bg-orange-300/10 border border-orange-300/20 text-white' // Light orange
                            : tab.id === 'postgresql'
                            ? 'bg-blue-600/10 border border-blue-600/20 text-white' // PostgreSQL blue
                            : 'bg-primary/20 border border-primary/30 text-white'
                          : tab.comingSoon
                          ? 'text-muted-foreground cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                      )}
                    >
                      <div className="flex items-center">
                        <div
                          className={cn(
                            'h-8 w-8 rounded-md flex items-center justify-center mr-3 border',
                            activeProvider === tab.id && !tab.comingSoon
                              ? tab.id === 'huggingface'
                                ? 'border-yellow-400/50 text-yellow-400'
                                : tab.id === 's3'
                                ? 'border-orange-500/50 text-orange-500'
                                : tab.id === 'google-sheets'
                                ? 'bg-green-500/30 border-green-500/50 text-green-500'
                                : tab.id === 'custom-url'
                                ? 'bg-blue-500/30 border-blue-500/50 text-blue-500'
                                : tab.id === 'gcs'
                                ? 'bg-sky-500/30 border-sky-500/50 text-sky-500'
                                : tab.id === 'google-drive'
                                ? 'bg-blue-600/30 border-blue-600/50 text-blue-600'
                                : tab.id === 'motherduck'
                                ? 'border-orange-300/50 text-orange-300'
                                : tab.id === 'postgresql'
                                ? 'border-blue-600/50 text-blue-600'
                                : 'bg-primary/30 border-primary/50 text-primary'
                              : tab.comingSoon
                              ? 'bg-accent/5 border-border text-muted-foreground'
                              : 'bg-accent/5 border-border text-muted-foreground group-hover:border-border/60'
                          )}
                        >
                          {tab.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <p className="text-sm font-medium truncate">
                              {tab.label}
                            </p>
                            {tab.comingSoon && (
                              <span className="ml-2 text-xs bg-accent/10 text-muted-foreground px-1.5 py-0.5 rounded">
                                Soon
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5 truncate opacity-80">
                            {tab.description}
                            {tab.requiresAuth && !isAuthenticated && (
                              <span className="text-[10px] text-amber-400/60">
                                {' '}
                                • Sign in required
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Active indicator */}
                      {activeProvider === tab.id && !tab.comingSoon && (
                        <motion.div
                          layoutId="activeProvider"
                          className={cn(
                            'absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 rounded-r',
                            tab.id === 'huggingface'
                              ? 'bg-yellow-400'
                              : tab.id === 's3'
                              ? 'bg-orange-500'
                              : tab.id === 'google-sheets'
                              ? 'bg-green-500'
                              : tab.id === 'custom-url'
                              ? 'bg-blue-500'
                              : tab.id === 'gcs'
                              ? 'bg-sky-500'
                              : tab.id === 'google-drive'
                              ? 'bg-blue-600'
                              : tab.id === 'motherduck'
                              ? 'bg-orange-300'
                              : tab.id === 'postgresql'
                              ? 'bg-blue-600'
                              : 'bg-primary'
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
              <div className="p-4 border-b border-border bg-gradient-to-r from-background/50 to-background/30">
                <div className="flex items-center">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-md flex items-center justify-center mr-3 border',
                      activeProvider === 'huggingface'
                        ? 'border-yellow-400/30'
                        : activeProvider === 's3'
                        ? 'border-orange-500/30'
                        : activeProvider === 'google-sheets'
                        ? 'bg-green-500/20 border-green-500/30'
                        : activeProvider === 'custom-url'
                        ? 'bg-blue-500/20 border-blue-500/30'
                        : activeProvider === 'gcs'
                        ? 'bg-sky-500/20 border-sky-500/30'
                        : activeProvider === 'google-drive'
                        ? 'bg-blue-600/20 border-blue-600/30'
                        : activeProvider === 'motherduck'
                        ? 'border-orange-300/50'
                        : activeProvider === 'postgresql'
                        ? 'bg-blue-600/20 border-blue-600/30'
                        : 'bg-primary/20 border-primary/30'
                    )}
                  >
                    {
                      PROVIDER_TABS.find((tab) => tab.id === activeProvider)
                        ?.icon
                    }
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-foreground">
                      {
                        PROVIDER_TABS.find((tab) => tab.id === activeProvider)
                          ?.label
                      }
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {
                        PROVIDER_TABS.find((tab) => tab.id === activeProvider)
                          ?.description
                      }
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
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

export default RemoteDataImportModal;
