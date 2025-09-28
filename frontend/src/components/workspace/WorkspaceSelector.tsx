import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  FolderOpen,
  Check,
  X,
  Edit2,
  Trash2,
  Save,
  HelpCircle,
  Shield,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/auth/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import AuthModal from '@/components/auth/AuthModal';

export const WorkspaceSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveName, setDraftSaveName] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get workspace state from appStore
  const {
    workspaces,
    activeWorkspaceId,
    workspaceFiles,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    deleteWorkspace,
    saveDraftWorkspace,
  } = useAppStore();

  // Get authentication state
  const { isAuthenticated } = useAuth();
  
  // Get notifications
  const { showSuccess } = useNotifications();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Calculate non-draft workspace count for limit checking
  const nonDraftWorkspaceCount = workspaces.filter((w) => !w.isDraft).length;

  // Calculate dropdown position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(320, rect.width), // Ensure at least 320px width
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      updateDropdownPosition();
      // Update position on scroll/resize
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) return;

    // Check workspace limit for non-authenticated users
    if (!isAuthenticated && nonDraftWorkspaceCount >= 1) {
      console.log(
        '[WorkspaceSelector] Workspace limit reached for non-authenticated user'
      );
      setShowAuthModal(true);
      return;
    }

    // Create workspace if under limit or authenticated
    const workspaceName = newWorkspaceName.trim();
    createWorkspace(workspaceName);
    
    // Show success notification
    showSuccess(
      'Workspace Created',
      `"${workspaceName}" workspace has been created successfully`,
      { icon: 'check', duration: 4000 }
    );
    
    setNewWorkspaceName('');
    setIsCreating(false);
    setIsOpen(false);
  };

  const handleRenameWorkspace = (id: string) => {
    if (editingName.trim()) {
      const oldName = workspaces.find(w => w.id === id)?.name;
      const newName = editingName.trim();
      
      renameWorkspace(id, newName);
      
      // Show success notification
      showSuccess(
        'Workspace Renamed',
        `Workspace renamed from "${oldName}" to "${newName}"`,
        { icon: 'check', duration: 4000 }
      );
      
      setEditingId(null);
    }
  };

  const handleDeleteWorkspace = (id: string) => {
    if (id === 'draft') return; // Can't delete draft

    const workspace = workspaces.find((w) => w.id === id);
    const confirmed = confirm(
      `Delete workspace "${workspace?.name}"? This action cannot be undone.`
    );
    if (confirmed && workspace) {
      deleteWorkspace(id);
      
      // Show success notification
      showSuccess(
        'Workspace Deleted',
        `"${workspace.name}" workspace has been deleted`,
        { icon: 'check', duration: 4000 }
      );
    }
  };

  const handleSwitchWorkspace = (id: string) => {
    switchWorkspace(id);
    setIsOpen(false);
  };

  const handleToggleDropdown = () => {
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  };

  const handleSaveDraft = () => {
    if (!draftSaveName.trim()) return;

    // Check workspace limit for non-authenticated users
    // When saving draft, this would create a new non-draft workspace
    if (!isAuthenticated && nonDraftWorkspaceCount >= 1) {
      console.log('[WorkspaceSelector] Cannot save draft - workspace limit reached for non-authenticated user');
      setIsOpen(false);
      setShowAuthModal(true);
      return;
    }

    // Save draft if under limit or authenticated
    const workspaceName = draftSaveName.trim();
    const fileCount = workspaceFiles.length;
    
    saveDraftWorkspace(workspaceName);
    
    // Show success notification
    showSuccess(
      'Workspace Saved',
      `Draft workspace saved as "${workspaceName}" with ${fileCount} file${fileCount !== 1 ? 's' : ''}`,
      { icon: 'check', duration: 5000 }
    );
    
    setDraftSaveName('');
    setIsSavingDraft(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Workspace Selector Button */}
      <button
        ref={buttonRef}
        onClick={handleToggleDropdown}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-accent/5 hover:bg-accent/10 border border-border rounded-lg transition-all duration-200 group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary/70" />
          <span className="text-sm font-medium text-foreground">
            {activeWorkspace?.name || 'Select Workspace'}
          </span>
          {activeWorkspace?.isDraft && (
            <span className="text-[10px] text-muted-foreground bg-accent/10 px-1.5 py-0.5 rounded">
              unsaved
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Portal Dropdown Menu */}
      {isOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-50"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
            >
              {/* Header with explanation and help */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground tracking-wide">
                      Workspaces
                    </h3>
                    {!isAuthenticated && nonDraftWorkspaceCount >= 1 && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-400/10 text-amber-400 rounded">
                        {nonDraftWorkspaceCount}/1
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      className="p-1 hover:bg-accent/10 rounded-full transition-colors"
                    >
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {showTooltip && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-lg p-3 text-xs text-muted-foreground shadow-xl z-50"
                        >
                          <div className="space-y-2">
                            <p>
                              <strong className="text-foreground">Workspaces</strong>{' '}
                              organize your files without storing actual data -
                              only references for privacy.
                            </p>
                            <p>
                              <strong className="text-primary">Draft:</strong>{' '}
                              Temporary workspace for files before saving to a
                              named workspace.
                            </p>
                            <p>
                              <strong className="text-foreground">Benefits:</strong>{' '}
                              Keep projects organized, switch between datasets.
                            </p>
                            {!isAuthenticated && (
                              <p>
                                <strong className="text-amber-400">
                                  Limit:
                                </strong>{' '}
                                Create up to 1 workspaces.{' '}
                                <span className="text-primary">Sign up</span>{' '}
                                for unlimited workspaces.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Organize your files into workspaces. Files are referenced, not
                  stored.
                </p>
              </div>
              {/* Workspace List */}
              <div className="max-h-64 min-h-32 overflow-y-auto">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className={`group flex items-center justify-between px-3 py-2 hover:bg-accent/5 transition-colors ${
                      workspace.id === activeWorkspaceId ? 'bg-primary/10' : ''
                    }`}
                  >
                    {editingId === workspace.id ? (
                      // Edit mode
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              handleRenameWorkspace(workspace.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 bg-accent/10 border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameWorkspace(workspace.id)}
                          className="p-1 hover:bg-accent/10 rounded"
                        >
                          <Check className="h-3 w-3 text-green-400" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 hover:bg-accent/10 rounded"
                        >
                          <X className="h-3 w-3 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      // Normal mode
                      <>
                        <button
                          onClick={() => handleSwitchWorkspace(workspace.id)}
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-foreground">
                                {workspace.name}
                              </span>
                              {workspace.isDraft && (
                                <span className="text-[10px] text-muted-foreground">
                                  draft
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {workspace.files.length} files
                            </div>
                          </div>
                          {workspace.id === activeWorkspaceId && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                        </button>

                        {/* Action buttons (only show on hover, not for draft) */}
                        {!workspace.isDraft && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingId(workspace.id);
                                setEditingName(workspace.name);
                              }}
                              className="p-1 hover:bg-accent/10 rounded"
                            >
                              <Edit2 className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteWorkspace(workspace.id)
                              }
                              className="p-1 hover:bg-accent/10 rounded"
                            >
                              <Trash2 className="h-3 w-3 text-destructive/60" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Save Draft Workspace */}
              {activeWorkspace?.isDraft && activeWorkspace.files.length > 0 && (
                <div className="border-t border-border p-2">
                  {isSavingDraft ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draftSaveName}
                        onChange={(e) => setDraftSaveName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDraft();
                          if (e.key === 'Escape') {
                            setIsSavingDraft(false);
                            setDraftSaveName('');
                          }
                        }}
                        placeholder="Workspace name..."
                        className="flex-1 bg-accent/10 border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveDraft}
                        className="p-1.5 hover:bg-white/10 rounded"
                      >
                        <Check className="h-4 w-4 text-green-400" />
                      </button>
                      <button
                        onClick={() => {
                          setIsSavingDraft(false);
                          setDraftSaveName('');
                        }}
                        className="p-1.5 hover:bg-white/10 rounded"
                      >
                        <X className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsSavingDraft(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Save className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-white">
                        Save Draft as Workspace
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Create New Workspace */}
              <div className="border-t border-white/10 p-2">
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateWorkspace();
                        if (e.key === 'Escape') {
                          setIsCreating(false);
                          setNewWorkspaceName('');
                        }
                      }}
                      placeholder="Workspace name..."
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-primary"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateWorkspace}
                      className="p-1.5 hover:bg-white/10 rounded"
                    >
                      <Check className="h-4 w-4 text-green-400" />
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewWorkspaceName('');
                      }}
                      className="p-1.5 hover:bg-white/10 rounded"
                    >
                      <X className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      // Check workspace limit for non-authenticated users
                      if (!isAuthenticated && nonDraftWorkspaceCount >= 1) {
                        console.log(
                          '[WorkspaceSelector] Workspace limit reached, showing auth modal'
                        );
                        setShowAuthModal(true);
                        setIsOpen(false);
                        return;
                      }
                      setIsCreating(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="text-sm text-white">New Workspace</span>
                    </div>
                    {/* Show premium indicator for non-authenticated users at limit */}
                    {!isAuthenticated && nonDraftWorkspaceCount >= 1 && (
                      <Shield className="h-4 w-4 text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* Auth Modal for workspace limit */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signup"
        onLoginSuccess={() => {
          setShowAuthModal(false);
          // After successful auth, allow workspace creation
          if (newWorkspaceName.trim()) {
            setIsCreating(true);
          }
        }}
      />
    </div>
  );
};
