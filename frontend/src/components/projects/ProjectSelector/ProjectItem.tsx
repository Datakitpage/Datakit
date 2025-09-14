import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Edit2, Trash2, Cloud, FolderOpen, FileText, Share2 } from 'lucide-react';

interface ProjectItemProps {
  project: any;
  isActive: boolean;
  isCloud?: boolean;
  onSelect: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onShare?: (project: any) => void;
}

export const ProjectItem: React.FC<ProjectItemProps> = ({
  project,
  isActive,
  isCloud,
  onSelect,
  onRename,
  onDelete,
  onShare,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(project.name);


  const handleRename = () => {
    if (editingName.trim()) {
      onRename(project.id, editingName.trim());
      setIsEditing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(project.id);
  };

  const getIcon = () => {
    if (isCloud) return <Cloud className="h-4 w-4 text-white/60" />;
    if (project.isDraft) return <FileText className="h-4 w-4 text-white/60" />;
    return <FolderOpen className="h-4 w-4 text-white/60" />;
  };

  const getBadge = () => {
    if (project.isDraft) {
      return (
        <span className="text-[10px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded">
          unsaved
        </span>
      );
    }
    return null;
  };

  const getDescription = () => {
    if (isCloud) {
      return project.lastModified 
        ? `Updated ${new Date(project.lastModified).toLocaleDateString()}`
        : 'Cloud project';
    }
    if (project.isDraft) {
      return `${project.files?.length || 0} file${project.files?.length !== 1 ? 's' : ''} • Temporary`;
    }
    return `${project.files?.length || 0} file${project.files?.length !== 1 ? 's' : ''}`;
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/20 rounded-lg">
        <input
          type="text"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white outline-none focus:border-primary"
          autoFocus
        />
        <button
          onClick={handleRename}
          className="p-1 hover:bg-white/10 rounded"
        >
          <Check className="h-3 w-3 text-green-400" />
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className="p-1 hover:bg-white/10 rounded"
        >
          <X className="h-3 w-3 text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <motion.button
      onClick={onSelect}
      className={`
        w-full text-left p-3 rounded-lg border transition-all duration-300 relative overflow-hidden
        cursor-pointer group
        ${isActive 
          ? 'bg-gradient-to-br from-blue-500/15 via-indigo-500/15 to-purple-500/15 border-indigo-400/30' 
          : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
        }
      `}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 flex-1 pr-4">
          <div className="flex-shrink-0 p-1.5 bg-white/10 rounded-lg">
            {getIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-white truncate">
                {project.name}
              </span>
              {getBadge()}
            </div>
            <p className="text-[10px] text-white/50 truncate">
              {getDescription()}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {!project.isDraft && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {/* TODO: To introduce the sharing in next iterations */}
              {/*  */}
              {/* {isCloud && onShare && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(project);
                  }}
                  className="p-1 hover:bg-white/20 rounded cursor-pointer transition-colors"
                  title="Share project"
                >
                  <Share2 className="h-3 w-3 text-white/80" />
                </div>
              )} */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                  setEditingName(project.name);
                }}
                className="p-1 hover:bg-white/20 rounded cursor-pointer transition-colors"
                title={isCloud ? "Rename cloud project" : "Rename project"}
              >
                <Edit2 className="h-3 w-3 text-white/80" />
              </div>
              <div
                onClick={handleDelete}
                className="p-1 hover:bg-white/20 rounded cursor-pointer transition-colors"
                title={isCloud ? "Delete cloud project" : "Delete project"}
              >
                <Trash2 className="h-3 w-3 text-red-400/80" />
              </div>
            </div>
          )}
          
          {isActive && (
            <Check className="h-3.5 w-3.5 text-blue-400" />
          )}
        </div>
      </div>
    </motion.button>
  );
};