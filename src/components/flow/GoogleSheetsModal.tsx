import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGoogleSheetsStore } from '@/store/googleSheetsStore';
import { initiateOAuth, fetchUserInfo, revokeToken, isOAuthConfigured } from '@/lib/google/oauth';
import {
  listSpreadsheets,
  getSpreadsheetMetadata,
  getSheetData,
  formatRelativeTime,
  TokenExpiredError,
  type SpreadsheetListItem,
  type SheetTab,
} from '@/lib/google/sheetsApi';

// --- Inline icons (consolidated from both old modals) ---

const IconX = ({ size = 24, stroke = 2 }: { size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconSearch = ({ size = 24, stroke = 2 }: { size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconLoader2 = ({ size = 24, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const IconChevronLeft = ({ size = 24, stroke = 2 }: { size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronDown = ({ size = 24, stroke = 2 }: { size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const GoogleSheetsIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z" fill="#0F9D58"/>
    <path d="M7 7H17V9H7V7ZM7 11H17V13H7V11ZM7 15H13V17H7V15Z" fill="white"/>
  </svg>
);

// --- Types ---

type ModalStep = 'connect' | 'browse' | 'preview';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: {
    spreadsheetId: string;
    spreadsheetName: string;
    sheetId: number;
    sheetName: string;
    headers: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    columnCount: number;
    isTruncated: boolean;
  }) => void;
}

// --- Component ---

export function GoogleSheetsModal({ isOpen, onClose, onImport }: GoogleSheetsModalProps) {
  const {
    accessToken,
    userEmail,
    userPhoto,
    isConnecting,
    error: authError,
    setTokens,
    setUserInfo,
    setConnecting,
    setError: setAuthError,
    disconnect,
  } = useGoogleSheetsStore();

  // Step management
  const [step, setStep] = useState<ModalStep>('connect');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [sessionExpired, setSessionExpired] = useState(false);

  // Browse state
  const [searchQuery, setSearchQuery] = useState('');
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetListItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Sheet selection
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<SpreadsheetListItem | null>(null);
  const [sheetTabs, setSheetTabs] = useState<SheetTab[]>([]);
  const [selectedSheetTab, setSelectedSheetTab] = useState<SheetTab | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);

  // Preview state
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Navigation helpers ---

  const goForward = useCallback((nextStep: ModalStep) => {
    setDirection('forward');
    setStep(nextStep);
  }, []);

  const goBack = useCallback((prevStep: ModalStep) => {
    setDirection('back');
    setStep(prevStep);
  }, []);

  // --- Token expiry handler ---

  const handleTokenExpired = useCallback(() => {
    setSessionExpired(true);
    disconnect();
    setDirection('back');
    setStep('connect');
  }, [disconnect]);

  // --- Reset state on close ---

  const resetState = useCallback(() => {
    setSearchQuery('');
    setSpreadsheets([]);
    setNextPageToken(null);
    setSelectedSpreadsheet(null);
    setSheetTabs([]);
    setSelectedSheetTab(null);
    setPreviewRows([]);
    setPreviewHeaders([]);
    setPreviewError(null);
    setImportError(null);
    setSessionExpired(false);
    setIsLoadingPreview(false);
    setTabDropdownOpen(false);
  }, []);

  // --- Determine initial step on open ---

  useEffect(() => {
    if (isOpen) {
      if (accessToken) {
        setStep('browse');
      } else {
        setStep('connect');
      }
      setDirection('forward');
    } else {
      resetState();
    }
  }, [isOpen, accessToken, resetState]);

  // --- OAuth connect ---

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setAuthError(null);

    try {
      const result = await initiateOAuth();
      const expiresAt = Date.now() + result.expiresIn * 1000;
      setTokens({ accessToken: result.accessToken, expiresAt });

      const userInfo = await fetchUserInfo(result.accessToken);
      setUserInfo(userInfo.email, userInfo.name, userInfo.picture);
      setSessionExpired(false);
      // accessToken change will trigger the useEffect above, which sets step to 'browse'
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, [setConnecting, setAuthError, setTokens, setUserInfo]);

  const handleDisconnect = useCallback(async () => {
    if (accessToken) {
      await revokeToken(accessToken);
    }
    disconnect();
    // accessToken change will trigger the useEffect above, which sets step to 'connect'
  }, [accessToken, disconnect]);

  // --- Spreadsheet list ---

  const loadSpreadsheets = useCallback(async (query?: string) => {
    if (!accessToken) return;

    setIsLoadingList(true);
    setListError(null);

    try {
      const result = await listSpreadsheets(accessToken, query);
      setSpreadsheets(result.spreadsheets);
      setNextPageToken(result.nextPageToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        handleTokenExpired();
        return;
      }
      setListError(error instanceof Error ? error.message : 'Failed to load spreadsheets');
    } finally {
      setIsLoadingList(false);
    }
  }, [accessToken, handleTokenExpired]);

  const loadMore = useCallback(async () => {
    if (!accessToken || !nextPageToken) return;

    setIsLoadingMore(true);

    try {
      const result = await listSpreadsheets(accessToken, searchQuery || undefined, 100, nextPageToken);
      setSpreadsheets((prev) => [...prev, ...result.spreadsheets]);
      setNextPageToken(result.nextPageToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        handleTokenExpired();
        return;
      }
      setListError(error instanceof Error ? error.message : 'Failed to load more');
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, nextPageToken, searchQuery, handleTokenExpired]);

  // Load spreadsheets when entering browse step
  useEffect(() => {
    if (isOpen && step === 'browse' && accessToken && spreadsheets.length === 0 && !isLoadingList) {
      loadSpreadsheets();
    }
  }, [isOpen, step, accessToken, spreadsheets.length, isLoadingList, loadSpreadsheets]);

  // Debounced search
  useEffect(() => {
    if (!isOpen || step !== 'browse' || !accessToken) return;

    const timer = setTimeout(() => {
      loadSpreadsheets(searchQuery || undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Spreadsheet selection ---

  const handleSelectSpreadsheet = useCallback(async (spreadsheet: SpreadsheetListItem) => {
    if (!accessToken) return;

    setSelectedSpreadsheet(spreadsheet);
    setIsLoadingMeta(true);
    setSheetTabs([]);
    setSelectedSheetTab(null);

    try {
      const metadata = await getSpreadsheetMetadata(accessToken, spreadsheet.id);
      setSheetTabs(metadata.sheets);
      if (metadata.sheets.length === 1) {
        // Auto-select the only tab and go to preview
        handleSelectTab(metadata.sheets[0]);
      }
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        handleTokenExpired();
        return;
      }
      console.error('Failed to load sheet metadata:', error);
    } finally {
      setIsLoadingMeta(false);
    }
  }, [accessToken, handleTokenExpired]);

  // --- Tab selection (triggers preview) ---

  const handleSelectTab = useCallback(async (tab: SheetTab) => {
    if (!accessToken || !selectedSpreadsheet) return;

    setSelectedSheetTab(tab);
    setTabDropdownOpen(false);
    goForward('preview');
    setIsLoadingPreview(true);
    setPreviewError(null);
    setPreviewRows([]);
    setPreviewHeaders([]);

    try {
      const data = await getSheetData(accessToken, selectedSpreadsheet.id, tab.title, 5);
      setPreviewHeaders(data.headers);
      setPreviewRows(data.rows);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        handleTokenExpired();
        return;
      }
      setPreviewError(error instanceof Error ? error.message : 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [accessToken, selectedSpreadsheet, handleTokenExpired, goForward]);

  // --- Import ---

  const handleImport = useCallback(async () => {
    if (!accessToken || !selectedSpreadsheet || !selectedSheetTab) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const data = await getSheetData(accessToken, selectedSpreadsheet.id, selectedSheetTab.title);

      onImport({
        spreadsheetId: selectedSpreadsheet.id,
        spreadsheetName: selectedSpreadsheet.name,
        sheetId: selectedSheetTab.sheetId,
        sheetName: selectedSheetTab.title,
        headers: data.headers,
        rows: data.rows,
        rowCount: data.rowCount,
        columnCount: data.columnCount,
        isTruncated: data.isTruncated,
      });

      onClose();
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        handleTokenExpired();
        return;
      }
      setImportError(error instanceof Error ? error.message : 'Failed to import sheet');
    } finally {
      setIsImporting(false);
    }
  }, [accessToken, selectedSpreadsheet, selectedSheetTab, onImport, onClose, handleTokenExpired]);

  // --- Back from preview ---

  const handleBackToBrowse = useCallback(() => {
    setPreviewRows([]);
    setPreviewHeaders([]);
    setPreviewError(null);
    setImportError(null);
    setSelectedSheetTab(null);
    goBack('browse');
  }, [goBack]);

  // --- Keyboard handling ---

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'preview') {
          handleBackToBrowse();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose, handleBackToBrowse]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!tabDropdownOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTabDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [tabDropdownOpen]);

  // --- Animation variants ---

  const contentVariants = {
    enter: (dir: 'forward' | 'back') => ({
      opacity: 0,
      x: dir === 'forward' ? 20 : -20,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: 'forward' | 'back') => ({
      opacity: 0,
      x: dir === 'forward' ? -20 : 20,
    }),
  };

  // --- Dynamic header ---

  const headerTitle = step === 'connect'
    ? 'Google Sheets'
    : step === 'browse'
      ? 'Import from Google Sheets'
      : selectedSpreadsheet?.name || 'Preview';

  const headerSubtitle = step === 'connect'
    ? 'Connect your Google account to import spreadsheets'
    : step === 'browse'
      ? 'Select a spreadsheet to add to your canvas'
      : selectedSheetTab
        ? `${selectedSheetTab.title} \u00b7 ${selectedSheetTab.rowCount.toLocaleString()} rows`
        : 'Loading...';

  // --- Sheet tab selector (shared between browse and preview) ---

  const renderTabSelector = () => {
    if (sheetTabs.length === 0 || isLoadingMeta) return null;

    // Pill buttons for <= 4 tabs
    if (sheetTabs.length <= 4) {
      return (
        <div className="flex gap-1.5 flex-wrap">
          {sheetTabs.map(tab => (
            <motion.button
              key={tab.sheetId}
              onClick={() => handleSelectTab(tab)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: selectedSheetTab?.sheetId === tab.sheetId
                  ? 'rgba(15, 157, 88, 0.12)'
                  : 'var(--surface-primary)',
                color: selectedSheetTab?.sheetId === tab.sheetId
                  ? '#0F9D58'
                  : 'var(--text-secondary)',
                border: selectedSheetTab?.sheetId === tab.sheetId
                  ? '1px solid rgba(15, 157, 88, 0.3)'
                  : '1px solid var(--border-default)',
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {tab.title}
              <span className="ml-1.5 opacity-60">{tab.rowCount.toLocaleString()}</span>
            </motion.button>
          ))}
        </div>
      );
    }

    // Custom dropdown for > 4 tabs
    return (
      <div className="relative" ref={dropdownRef}>
        <motion.button
          onClick={() => setTabDropdownOpen(!tabDropdownOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full"
          style={{
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
          whileTap={{ scale: 0.99 }}
        >
          <span className="flex-1 text-left truncate">
            {selectedSheetTab?.title || 'Select a sheet...'}
            {selectedSheetTab && (
              <span className="ml-2 text-xs opacity-50">
                ({selectedSheetTab.rowCount.toLocaleString()} rows)
              </span>
            )}
          </span>
          <motion.span
            animate={{ rotate: tabDropdownOpen ? 180 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <IconChevronDown size={14} stroke={2} />
          </motion.span>
        </motion.button>

        <AnimatePresence>
          {tabDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden shadow-lg"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-default)',
                transformOrigin: 'top',
              }}
            >
              <div className="max-h-[200px] overflow-y-auto py-1">
                {sheetTabs.map(tab => (
                  <button
                    key={tab.sheetId}
                    onClick={() => handleSelectTab(tab)}
                    className="w-full text-left px-3 py-2 text-sm transition-colors"
                    style={{
                      color: selectedSheetTab?.sheetId === tab.sheetId ? '#0F9D58' : 'var(--text-primary)',
                      backgroundColor: selectedSheetTab?.sheetId === tab.sheetId ? 'rgba(15, 157, 88, 0.06)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSheetTab?.sheetId !== tab.sheetId) {
                        e.currentTarget.style.backgroundColor = 'var(--surface-secondary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = selectedSheetTab?.sheetId === tab.sheetId ? 'rgba(15, 157, 88, 0.06)' : 'transparent';
                    }}
                  >
                    {tab.title}
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      ({tab.rowCount.toLocaleString()} rows)
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // --- Inline preview table ---

  const renderPreviewTable = () => {
    if (isLoadingPreview) {
      return (
        <div className="flex items-center justify-center py-10">
          <IconLoader2 size={20} className="animate-spin" style={{ color: '#0F9D58' } as React.CSSProperties} />
        </div>
      );
    }

    if (previewError) {
      return (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: 'var(--destructive, #ef4444)' }}>{previewError}</p>
          <button
            onClick={() => selectedSheetTab && handleSelectTab(selectedSheetTab)}
            className="mt-2 text-xs underline"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Try again
          </button>
        </div>
      );
    }

    if (previewRows.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            This sheet has no data
          </p>
        </div>
      );
    }

    const maxCols = 6;
    const visibleHeaders = previewHeaders.slice(0, maxCols);
    const extraCols = previewHeaders.length - maxCols;

    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--surface-secondary)',
        }}
      >
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Preview
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
            {previewHeaders.length} columns
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {visibleHeaders.map(col => (
                  <th
                    key={col}
                    className="px-2.5 py-2 text-left font-medium whitespace-nowrap"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {col}
                  </th>
                ))}
                {extraCols > 0 && (
                  <th className="px-2.5 py-2 text-left font-medium" style={{ color: 'var(--text-disabled)' }}>
                    +{extraCols} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    borderBottom: i < previewRows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  {visibleHeaders.map(col => (
                    <td
                      key={col}
                      className="px-2.5 py-1.5 truncate max-w-[120px]"
                      style={{ color: 'var(--text-primary)' }}
                      title={String(row[col] ?? '')}
                    >
                      {row[col] === null || row[col] === undefined ? (
                        <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>null</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                  {extraCols > 0 && (
                    <td className="px-2.5 py-1.5" style={{ color: 'var(--text-disabled)' }}>...</td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-[520px] z-[100] mx-4"
          >
            <motion.div
              layout
              transition={{ layout: { type: 'spring', stiffness: 400, damping: 35 } }}
              className="rounded-2xl shadow-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {step === 'preview' && (
                    <motion.button
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={handleBackToBrowse}
                      className="p-1 rounded-lg flex-shrink-0"
                      style={{ color: 'var(--text-tertiary)' }}
                      whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <IconChevronLeft size={18} stroke={2} />
                    </motion.button>
                  )}
                  <div
                    className="p-2 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: 'rgba(15, 157, 88, 0.1)' }}
                  >
                    <GoogleSheetsIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {headerTitle}
                    </h2>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {headerSubtitle}
                    </p>
                  </div>
                </div>
                <motion.button
                  onClick={onClose}
                  className="p-2 rounded-lg transition-colors flex-shrink-0"
                  style={{ color: 'var(--text-tertiary)' }}
                  whileHover={{ backgroundColor: 'var(--surface-secondary)' }}
                  whileTap={{ scale: 0.95 }}
                >
                  <IconX size={18} stroke={2} />
                </motion.button>
              </div>

              {/* Session expired banner */}
              <AnimatePresence>
                {sessionExpired && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-4 py-3 flex items-center gap-2 text-xs"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        color: 'var(--warning, #f59e0b)',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
                      }}
                    >
                      Session expired. Please sign in again.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Content area with step transitions */}
              <AnimatePresence mode="wait" custom={direction}>
                {/* ====== CONNECT STEP ====== */}
                {step === 'connect' && (
                  <motion.div
                    key="connect"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15 }}
                  >
                    <div className="p-6 space-y-4">
                      {/* User info (shown if previously connected) */}
                      {userEmail && (
                        <div
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ backgroundColor: 'var(--surface-secondary)' }}
                        >
                          {userPhoto ? (
                            <img
                              src={userPhoto}
                              alt=""
                              className="w-9 h-9 rounded-full"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium"
                              style={{ backgroundColor: '#0F9D58', color: 'white' }}
                            >
                              {userEmail[0]?.toUpperCase() || 'G'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {userEmail}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                              Session expired
                            </p>
                          </div>
                        </div>
                      )}

                      {!isOAuthConfigured() && (
                        <div
                          className="p-3 rounded-lg text-[11px] flex items-start gap-2"
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            color: 'var(--warning, #f59e0b)',
                            border: '1px solid rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          <span className="text-sm leading-none">!</span>
                          <span>Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID in your environment.</span>
                        </div>
                      )}

                      <motion.button
                        onClick={handleConnect}
                        disabled={isConnecting || !isOAuthConfigured()}
                        className="w-full px-4 py-3 text-sm font-medium rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#0F9D58', color: 'white' }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {isConnecting && <IconLoader2 size={16} className="animate-spin" />}
                        {isConnecting ? 'Connecting...' : 'Sign in with Google'}
                      </motion.button>

                      {authError && (
                        <p className="text-xs text-center" style={{ color: 'var(--destructive, #ef4444)' }}>
                          {authError}
                        </p>
                      )}
                    </div>

                    {/* Footer */}
                    <div
                      className="px-6 py-3 flex items-center justify-between"
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--surface-secondary)',
                      }}
                    >
                      <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                        Your data stays in your browser
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                        esc to close
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* ====== BROWSE STEP ====== */}
                {step === 'browse' && (
                  <motion.div
                    key="browse"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15 }}
                  >
                    {/* Account bar */}
                    <div
                      className="flex items-center gap-3 px-4 py-2.5"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      {userPhoto ? (
                        <img
                          src={userPhoto}
                          alt=""
                          className="w-6 h-6 rounded-full"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium"
                          style={{ backgroundColor: '#0F9D58', color: 'white' }}
                        >
                          {userEmail?.[0]?.toUpperCase() || 'G'}
                        </div>
                      )}
                      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                        {userEmail}
                      </span>
                      <button
                        onClick={handleDisconnect}
                        className="text-[11px] px-2 py-1 rounded-md transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-secondary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        Disconnect
                      </button>
                    </div>

                    {/* Search */}
                    <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="relative">
                        <div
                          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          <IconSearch size={15} stroke={2} />
                        </div>
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search spreadsheets..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                          style={{
                            backgroundColor: 'var(--surface-secondary)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)',
                          }}
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Spreadsheet list */}
                    <div
                      className="max-h-[280px] overflow-y-auto"
                      style={{ backgroundColor: 'var(--surface-secondary)' }}
                    >
                      {isLoadingList ? (
                        <div className="flex items-center justify-center py-12">
                          <IconLoader2 size={24} className="animate-spin" style={{ color: '#0F9D58' } as React.CSSProperties} />
                        </div>
                      ) : listError ? (
                        <div className="p-4 text-center">
                          <p className="text-sm" style={{ color: 'var(--destructive, #ef4444)' }}>
                            {listError}
                          </p>
                          <button
                            onClick={() => loadSpreadsheets()}
                            className="mt-2 text-xs underline"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            Try again
                          </button>
                        </div>
                      ) : spreadsheets.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            {searchQuery ? 'No spreadsheets found' : 'No spreadsheets in your Drive'}
                          </p>
                        </div>
                      ) : (
                        <div className="p-2">
                          {spreadsheets.map((spreadsheet) => (
                            <motion.button
                              key={spreadsheet.id}
                              onClick={() => handleSelectSpreadsheet(spreadsheet)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                              style={{
                                backgroundColor: selectedSpreadsheet?.id === spreadsheet.id
                                  ? 'var(--surface-primary)' : 'transparent',
                                border: selectedSpreadsheet?.id === spreadsheet.id
                                  ? '1px solid rgba(15, 157, 88, 0.3)' : '1px solid transparent',
                              }}
                              whileHover={{ backgroundColor: 'var(--surface-primary)' }}
                            >
                              <GoogleSheetsIcon size={24} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {spreadsheet.name}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                  Modified {formatRelativeTime(spreadsheet.modifiedTime)}
                                </p>
                              </div>
                            </motion.button>
                          ))}

                          {/* Load more */}
                          {nextPageToken && (
                            <div className="pt-2 pb-1 px-3">
                              <button
                                onClick={loadMore}
                                disabled={isLoadingMore}
                                className="w-full py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                style={{
                                  color: 'var(--text-secondary)',
                                  backgroundColor: 'var(--surface-primary)',
                                  border: '1px solid var(--border-default)',
                                }}
                              >
                                {isLoadingMore ? (
                                  <>
                                    <IconLoader2 size={12} className="animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  'Load more spreadsheets'
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sheet tabs (shown after selecting a spreadsheet with multiple tabs) */}
                    {selectedSpreadsheet && (
                      <div
                        className="p-4 space-y-3"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {selectedSpreadsheet.name}
                          </span>
                          {isLoadingMeta && (
                            <IconLoader2 size={14} className="animate-spin" style={{ color: 'var(--text-tertiary)' } as React.CSSProperties} />
                          )}
                        </div>

                        {!isLoadingMeta && sheetTabs.length > 1 && (
                          <div>
                            <span className="text-[11px] mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                              Select a sheet tab
                            </span>
                            {renderTabSelector()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div
                      className="px-5 py-3 flex items-center justify-between"
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--surface-secondary)',
                      }}
                    >
                      <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                        Your data stays in your browser
                      </span>
                      <motion.button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs rounded-lg"
                        style={{ color: 'var(--text-secondary)' }}
                        whileHover={{ backgroundColor: 'var(--surface-primary)' }}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* ====== PREVIEW STEP ====== */}
                {step === 'preview' && (
                  <motion.div
                    key="preview"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15 }}
                  >
                    <div className="p-4 space-y-3">
                      {/* Tab selector in preview (allows switching without going back) */}
                      {sheetTabs.length > 1 && (
                        <div>
                          <span className="text-[11px] mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                            Sheet
                          </span>
                          {renderTabSelector()}
                        </div>
                      )}

                      {/* Truncation warning */}
                      {selectedSheetTab && selectedSheetTab.rowCount > 10000 && (
                        <div
                          className="p-2.5 rounded-lg text-[11px] flex items-start gap-2"
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            color: 'var(--warning, #f59e0b)',
                            border: '1px solid rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          <span className="text-sm leading-none mt-px">!</span>
                          <span>
                            This sheet has {selectedSheetTab.rowCount.toLocaleString()} rows. Only the first 10,000 will be imported.
                          </span>
                        </div>
                      )}

                      {/* Preview table */}
                      {renderPreviewTable()}

                      {/* Import error */}
                      {importError && (
                        <p className="text-xs" style={{ color: 'var(--destructive, #ef4444)' }}>
                          {importError}
                        </p>
                      )}
                    </div>

                    {/* Footer with actions */}
                    <div
                      className="flex items-center justify-between px-5 py-3"
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--surface-secondary)',
                      }}
                    >
                      <motion.button
                        onClick={handleBackToBrowse}
                        className="px-3 py-1.5 text-xs rounded-lg flex items-center gap-1"
                        style={{ color: 'var(--text-secondary)' }}
                        whileHover={{ backgroundColor: 'var(--surface-primary)' }}
                      >
                        <IconChevronLeft size={14} stroke={2} />
                        Back
                      </motion.button>
                      <div className="flex gap-2">
                        <motion.button
                          onClick={onClose}
                          className="px-3 py-1.5 text-xs rounded-lg"
                          style={{ color: 'var(--text-tertiary)' }}
                          whileHover={{ backgroundColor: 'var(--surface-primary)' }}
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          onClick={handleImport}
                          disabled={isImporting || isLoadingPreview}
                          className="px-4 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 disabled:opacity-40"
                          style={{ backgroundColor: '#0F9D58', color: 'white' }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {isImporting && <IconLoader2 size={12} className="animate-spin" />}
                          {isImporting ? 'Adding...' : 'Add to Canvas'}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
