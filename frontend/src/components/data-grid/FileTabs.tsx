import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  XCircle,
  Users,
  FileText,
  Table,
  BarChart3,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Database,
  SplitSquareVertical,
  FileSpreadsheet,
  Braces,
  Package,
  Cloud,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';
import { FileTab } from '@/types/multiFile';
import { DataSourceType } from '@/types/json';
import { useAppStore } from '@/store/appStore';
import { useFileUpload } from '@/components/data-grid/hooks';
import DropZonesOverlay from './DropZonesOverlay';

interface FileTabsProps {
  tabs: FileTab[];
  onTabClick: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
  onCloseAll: () => void;
  onCloseOthers: (fileId: string) => void;
  className?: string;
  maxVisibleTabs?: number;
}

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  fileId: string | null;
}

/**
 * Get the appropriate icon for a file type - aligned with FileTreeView
 */
const getFileIcon = (
  sourceType: DataSourceType,
  remoteProvider?: string,
  isActive: boolean = false
) => {
  const iconClass = cn(
    'h-4 w-4 mr-2 flex-shrink-0 transition-colors duration-200',
    isActive ? 'opacity-100' : 'opacity-70'
  );

  if (remoteProvider === 'google_sheets') {
    return <GoogleSheetsIcon className={iconClass} />;
  }

  // Align with FileTreeView icon mapping and colors
  switch (sourceType) {
    case DataSourceType.CSV:
    case DataSourceType.XLSX:
      return <FileSpreadsheet className={cn(iconClass, 'text-emerald-400')} />;
    case DataSourceType.JSON:
      return <Braces className={cn(iconClass, 'text-amber-400')} />;
    case DataSourceType.PARQUET:
      return <Package className={cn(iconClass, 'text-cyan-400')} />;
    case DataSourceType.TXT:
    case DataSourceType.TSV:
      return <FileText className={cn(iconClass, 'text-slate-400')} />;
    default:
      // For remote files or unknown types
      if (remoteProvider) {
        return <Cloud className={cn(iconClass, 'text-blue-400')} />;
      }
      return <FileText className={cn(iconClass, 'text-muted-foreground')} />;
  }
};

/**
 * Individual file tab component with enhanced UX
 */
const FileTabItem: React.FC<{
  tab: FileTab;
  onTabClick: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
  onContextMenu: (e: React.MouseEvent, fileId: string) => void;
  onDragStart: (fileId: string) => void;
  onDragEnd: () => void;
  isOverflowing?: boolean;
}> = ({
  tab,
  onTabClick,
  onTabClose,
  onContextMenu,
  onDragStart,
  onDragEnd,
  isOverflowing = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Enhanced visual feedback for different states
  const getTabStyles = () => {
    if (tab.isActive) {
      return 'border-primary bg-primary/10 text-foreground shadow-lg';
    }
    if (isHovered) {
      return 'border-border bg-accent/10 text-foreground';
    }
    return 'border-transparent text-muted-foreground hover:text-foreground';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{
        opacity: 1,
        scale: isDragging ? 1.05 : 1,
        y: 0,
        rotateX: isDragging ? 5 : 0,
      }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{
        duration: 0.2,
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      className={cn(
        'group relative flex items-center h-11 px-3 py-2 border-b-2 transition-all duration-200 cursor-pointer select-none',
        'hover:bg-accent/5 rounded-t-lg mx-0.5',
        isOverflowing ? 'min-w-fit' : 'min-w-0 max-w-64',
        getTabStyles()
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onTabClick(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab.id)}
      // Drag and drop for split view
      draggable={!tab.isActive}
      onDragStart={(e) => {
        if (!tab.isActive) {
          setIsDragging(true);
          onDragStart(tab.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', tab.id);
        } else {
          e.preventDefault();
        }
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
    >
      {/* File Icon with enhanced styling - hide when overflowing */}
      {!isOverflowing && getFileIcon(tab.sourceType, tab.remoteProvider, tab.isActive)}

      {/* File Name with better typography */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'truncate text-sm font-medium transition-colors',
              tab.isActive ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {tab.fileName}
          </span>
          {/* Split view indicator */}
          {tab.splitView?.isActive && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex-shrink-0"
              title={`Split with ${tab.splitView.partnerId}`}
            >
              <SplitSquareVertical className="h-3 w-3 text-primary" />
            </motion.div>
          )}
        </div>

        {/* Subtle file info - only show on hover or when active */}
        <AnimatePresence>
          {(isHovered || tab.isActive) && !isOverflowing && (
            <motion.span
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-muted-foreground truncate"
            >
              {tab.sourceType}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-1 ml-1">
        {/* Google Sheets Indicator */}
        {tab.hasGoogleSheetsMetadata && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 rounded-full bg-green-400 shadow-lg"
            title="Google Sheets"
          />
        )}

        {/* Processing indicator (could show loading state) */}
        {/* <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-2 h-2 rounded-full bg-blue-400"
        /> */}
      </div>

      {/* Enhanced Close Button */}
      <motion.button
        initial={false}
        animate={{
          opacity: isHovered || tab.isActive ? 1 : 0,
          scale: isHovered || tab.isActive ? 1 : 0.8,
          rotate: isHovered ? 90 : 0,
        }}
        whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => {
          e.stopPropagation();
          onTabClose(tab.id);
        }}
        className="ml-2 p-1 rounded-full text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
        title="Close file"
      >
        <X className="h-3 w-3" />
      </motion.button>

      {/* Active tab indicator */}
      {tab.isActive && (
        <motion.div
          layoutId="activeTabIndicator"
          className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}

      {/* Split view connection line */}
      {tab.splitView?.isActive && tab.splitView.partnerId && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          className="absolute -bottom-[3px] left-0 right-0 h-[2px] bg-primary/30"
          style={{ originX: tab.splitView.partnerId > tab.id ? 1 : 0 }}
        />
      )}
    </motion.div>
  );
};

/**
 * Enhanced Context menu with more options
 */
const ContextMenu: React.FC<{
  isOpen: boolean;
  position: { x: number; y: number };
  tab: FileTab | null;
  onClose: () => void;
  onCloseAll: () => void;
  onCloseOthers: () => void;
  onDuplicate?: (fileId: string) => void;
  onRename?: (fileId: string) => void;
}> = ({
  isOpen,
  position,
  tab,
  onClose,
  onCloseAll,
  onCloseOthers,
  onDuplicate,
  onRename,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !tab) return null;

  const menuItems = [
    {
      label: 'Rename',
      icon: FileText,
      action: () => onRename?.(tab.id),
      disabled: true,
    },
    {
      label: 'Duplicate',
      icon: Plus,
      action: () => onDuplicate?.(tab.id),
      disabled: true,
    },
    { type: 'separator' },
    {
      label: 'Close Others',
      icon: Users,
      action: onCloseOthers,
      disabled: false,
    },
    {
      label: 'Close All',
      icon: XCircle,
      action: onCloseAll,
      disabled: false,
    },
  ];

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 5 }}
      transition={{ duration: 0.15 }}
      className="fixed z-50 bg-popover backdrop-blur-sm border border-border rounded-xl shadow-2xl py-2 min-w-44"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Context menu header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          {getFileIcon(tab.sourceType, tab.remoteProvider, true)}
          <span className="text-xs text-foreground font-medium truncate">
            {tab.fileName}
          </span>
        </div>
      </div>

      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={index} className="my-1 border-t border-border" />;
        }

        const Icon = item.icon;
        return (
          <motion.button
            key={item.label}
            whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            onClick={() => {
              item.action();
              onClose();
            }}
            disabled={item.disabled}
            className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Icon className="h-4 w-4 mr-3" />
            {item.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
};

/**
 * Overflow menu for when there are too many tabs
 */
const OverflowMenu: React.FC<{
  hiddenTabs: FileTab[];
  onTabClick: (fileId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ hiddenTabs, onTabClick, isOpen, onToggle }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className="flex items-center h-11 px-2 text-muted-foreground hover:text-foreground rounded-lg"
        title={`${hiddenTabs.length} more tabs`}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="ml-1 text-xs">{hiddenTabs.length}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute right-0 top-full mt-1 bg-popover backdrop-blur-sm border border-border rounded-lg shadow-xl py-2 min-w-48 max-h-64 overflow-y-auto"
          >
            {hiddenTabs.map((tab) => (
              <motion.button
                key={tab.id}
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                onClick={() => {
                  onTabClick(tab.id);
                  onToggle();
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                {getFileIcon(tab.sourceType, tab.remoteProvider)}
                <span className="truncate text-sm">{tab.fileName}</span>
                {tab.isActive && (
                  <div className="w-2 h-2 rounded-full bg-primary ml-auto" />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Main FileTabs component with enhanced UX
 */
const FileTabs: React.FC<FileTabsProps> = ({
  tabs,
  onTabClick,
  onTabClose,
  onCloseAll,
  onCloseOthers,
  className = '',
  maxVisibleTabs = 8,
}) => {
  const { setSplitView } = useAppStore();
  const { fileInputRef, handleButtonClick, handleFileSelect, isProcessing } = useFileUpload();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    fileId: null,
  });
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group tabs with split partners together
  const groupedTabs = React.useMemo(() => {
    const grouped: FileTab[] = [];
    const processed = new Set<string>();

    tabs.forEach((tab) => {
      if (processed.has(tab.id)) return;

      grouped.push(tab);
      processed.add(tab.id);

      // If this tab has a split partner, add it next
      if (tab.splitView?.partnerId) {
        const partner = tabs.find((t) => t.id === tab.splitView?.partnerId);
        if (partner && !processed.has(partner.id)) {
          grouped.push(partner);
          processed.add(partner.id);
        }
      }
    });

    return grouped;
  }, [tabs]);

  // Determine if we should show compact mode (many tabs)
  const isCompactMode = groupedTabs.length > 6; // Trigger compact mode with more than 6 tabs
  
  // In compact mode, show all tabs scrollable, otherwise use the old system
  const visibleTabs = isCompactMode ? groupedTabs : groupedTabs.slice(0, maxVisibleTabs);
  const hiddenTabs = isCompactMode ? [] : groupedTabs.slice(maxVisibleTabs);

  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      fileId,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, fileId: null });
  };

  const handleCloseOthers = () => {
    if (contextMenu.fileId) {
      onCloseOthers(contextMenu.fileId);
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      const newPosition =
        direction === 'left'
          ? Math.max(0, scrollPosition - scrollAmount)
          : scrollPosition + scrollAmount;

      scrollRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const handleDragStart = (fileId: string) => {
    setIsDragging(true);
    setDraggedTabId(fileId);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedTabId(null);
  };

  const handleDropLeft = () => {
    if (draggedTabId) {
      const activeTab = tabs.find((tab) => tab.isActive);
      if (activeTab && activeTab.id !== draggedTabId) {
        setSplitView(draggedTabId, activeTab.id);
      }
    }
    handleDragEnd();
  };

  const handleDropRight = () => {
    if (draggedTabId) {
      const activeTab = tabs.find((tab) => tab.isActive);
      if (activeTab && activeTab.id !== draggedTabId) {
        setSplitView(activeTab.id, draggedTabId);
      }
    }
    handleDragEnd();
  };

  if (tabs.length === 0) {
    return null;
  }

  const contextTab = tabs.find((tab) => tab.id === contextMenu.fileId) || null;

  return (
    <>
      <div
        className={cn(
          'relative flex items-center bg-background backdrop-blur-sm border-b border-border',
          className
        )}
      >
        {/* Scroll left button - only show in compact mode */}
        {isCompactMode && scrollPosition > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => handleScroll('left')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
        )}

        {/* Tabs container */}
        <div
          ref={scrollRef}
          className={cn(
            "flex items-center overflow-x-auto scrollbar-none flex-1",
            isCompactMode && "scroll-smooth"
          )}
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            // Add some padding for better scroll experience
            paddingRight: isCompactMode ? '8px' : '0'
          }}
        >
          <AnimatePresence mode="popLayout">
            {visibleTabs.map((tab, index) => {
              const prevTab = index > 0 ? visibleTabs[index - 1] : null;
              const nextTab =
                index < visibleTabs.length - 1 ? visibleTabs[index + 1] : null;
              const isPartOfSplitGroup =
                prevTab?.splitView?.partnerId === tab.id ||
                tab.splitView?.partnerId === nextTab?.id;

              return (
                <FileTabItem
                  key={tab.id}
                  tab={tab}
                  onTabClick={onTabClick}
                  onTabClose={onTabClose}
                  onContextMenu={handleContextMenu}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isOverflowing={isCompactMode}
                />
              );
            })}
          </AnimatePresence>
          
          {/* Import file button - positioned right after the last tab */}
          <motion.button
            onClick={handleButtonClick}
            disabled={isProcessing}
            whileHover={{ 
              scale: 1.02,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderColor: 'rgba(255, 255, 255, 0.25)'
            }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              "group relative flex items-center gap-2 ml-2 text-xs rounded-lg bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/15 shadow-lg transition-all duration-300 cursor-pointer disabled:opacity-50 hover:shadow-xl flex-shrink-0",
              isCompactMode ? "px-2.5 py-1.5" : "px-3 py-1.5"
            )}
            type="button"
          >
            {/* Background glow effect */}
            <motion.div
              className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              layoutId="importButtonGlow"
            />
            
            <motion.div
              animate={isProcessing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.8, repeat: isProcessing ? Infinity : 0, ease: "linear" }}
            >
              <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground relative z-10 transition-colors duration-200" />
            </motion.div>
            {!isCompactMode && (
              <span className="text-muted-foreground group-hover:text-foreground relative z-10 font-medium transition-colors duration-200">
                {isProcessing ? 'Loading...' : 'Import'}
              </span>
            )}
          </motion.button>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.json,.xlsx,.xls,.parquet,.duckdb"
            onChange={handleFileSelect}
            disabled={isProcessing}
          />
        </div>

        {/* Scroll right button - only show in compact mode */}
        {isCompactMode && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => handleScroll('right')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        )}

        {/* Overflow menu - only show when not in compact mode */}
        {!isCompactMode && hiddenTabs.length > 0 && (
          <OverflowMenu
            hiddenTabs={hiddenTabs}
            onTabClick={onTabClick}
            isOpen={overflowMenuOpen}
            onToggle={() => setOverflowMenuOpen(!overflowMenuOpen)}
          />
        )}
      </div>

      {/* Drop Zones Overlay for Split View */}
      <DropZonesOverlay
        isDragging={isDragging}
        draggedTabId={draggedTabId || undefined}
        onDropLeft={handleDropLeft}
        onDropRight={handleDropRight}
      />

      {/* Enhanced Context Menu */}
      <AnimatePresence>
        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          tab={contextTab}
          onClose={closeContextMenu}
          onCloseAll={onCloseAll}
          onCloseOthers={handleCloseOthers}
          onDuplicate={(fileId) => console.log('Duplicate:', fileId)}
          onRename={(fileId) => console.log('Rename:', fileId)}
        />
      </AnimatePresence>
    </>
  );
};

export default FileTabs;
