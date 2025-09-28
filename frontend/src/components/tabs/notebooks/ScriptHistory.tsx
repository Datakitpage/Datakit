import React, { useState } from 'react';
import {
  History,
  Play,
  Trash2,
  Copy,
  Download,
  Upload,
  Search,
  Calendar,
  FileText,
  MoreVertical,
  Edit3,
  Notebook,
  FilePlus,
} from 'lucide-react';


import { useNotebooksActions } from '@/hooks/notebooks/useNotebooksActions';
import { useNotebookManagement } from '@/hooks/notebooks/useNotebookManagement';
import { Button } from '@/components/ui/Button';
import { SaveDialog } from '@/components/ui/SaveDialog';
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog';

/**
 * Script history component for managing saved Python scripts
 */
const ScriptHistory: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScript, setSelectedScript] = useState<string | null>(null);

  // Use notebook actions hook
  const {
    showSaveDialog,
    showSaveConfirm: showNewNotebookConfirm,
    handleCreateNewNotebook,
    handleSaveDialogComplete,
    handleCloseSaveDialog,
    handleSaveAndContinue,
    handleDiscardAndContinue,
    handleCloseSaveConfirm,
  } = useNotebooksActions();

  // Use script management hook
  const {
    editingName,
    newName,
    showMenu,
    setNewName,
    setShowMenu,
    handleLoadScript,
    handleDeleteScript,
    handleDuplicateScript,
    handleExportScript,
    handleImportScript,
    startRenaming,
    saveRename,
    cancelRename,
    savedScripts,
    currentScript,
  } = useNotebookManagement();

  // Filter scripts based on search query
  const filteredScripts = savedScripts.filter(
    (script) =>
      script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (script.description &&
        script.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return formatDate(date);
    }
  };


  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Notebook className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Notebooks</h3>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Notebooks..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* New Notebook Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateNewNotebook}
          className="w-full mb-3 h-8 border-border30 text-muted-foreground hover:bg-accent/10 hover:border-border30"
          title="Create New Notebook"
        >
          <FilePlus className="w-4 h-4 mr-2" />
          New Notebook
        </Button>

        {/* Import button */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {savedScripts.length} saved scripts
          </span>

          <div className="relative">
            <input
              type="file"
              accept=".ipynb,.py"
              onChange={handleImportScript}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Import script"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              title="Import Script"
            >
              <Upload className="w-3 h-3 mr-1" />
              Import
            </Button>
          </div>
        </div>
      </div>

      {/* Script list */}
      <div className="flex-1 overflow-y-auto">
        {filteredScripts.length === 0 ? (
          <div className="p-4 text-center">
            <History className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No scripts found' : 'No saved scripts'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Save your first script to see it here
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredScripts.map((script) => (
              <div
                key={script.id}
                className={`relative group rounded-lg p-3 transition-colors ${
                  currentScript?.id === script.id
                    ? 'bg-primary/20 border border-primary/30'
                    : 'bg-accent/5 hover:bg-accent/10'
                }`}
                onClick={() =>
                  setSelectedScript(
                    selectedScript === script.id ? null : script.id
                  )
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {editingName === script.id ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-background border border-border20 rounded text-sm text-foreground focus:outline-none focus:border-primary/50"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(script.id);
                            if (e.key === 'Escape') cancelRename();
                          }}
                          onBlur={() => cancelRename()}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground text-sm truncate">
                          {script.name}
                        </h4>
                        {currentScript?.id === script.id && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                    )}

                    {script.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {script.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatRelativeTime(script.updatedAt)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>{script.cells.length} cells</span>
                      </div>

                      {script.cells.some((cell) => cell.executionCount) && (
                        <div className="flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          <span>Executed</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(showMenu === script.id ? null : script.id);
                      }}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>

                    {/* Dropdown menu */}
                    {showMenu === script.id && (
                      <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded shadow-lg z-20 min-w-40">
                        <button
                          className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/10 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadScript(script);
                          }}
                        >
                          <Play className="w-4 h-4" />
                          Load Script
                        </button>

                        <button
                          className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/10 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRenaming(script);
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                          Rename
                        </button>

                        <button
                          className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/10 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateScript(script.id);
                          }}
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </button>

                        <button
                          className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/10 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportScript(script);
                          }}
                        >
                          <Download className="w-4 h-4" />
                          Export
                        </button>

                        <div className="border-t border-border" />

                        <button
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScript(script.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(null)} />
      )}

      {/* New Notebook Confirmation Dialog */}
      <UnsavedChangesDialog
        isOpen={showNewNotebookConfirm}
        onClose={handleCloseSaveConfirm}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscardAndContinue}
        saveButtonText="Save and Create New"
      />

      {/* Save Dialog */}
      <SaveDialog
        isOpen={showSaveDialog}
        title="Save Notebook"
        placeholder="Enter notebook name"
        onSave={handleSaveDialogComplete}
        onClose={handleCloseSaveDialog}
      />
    </div>
  );
};

export default ScriptHistory;
