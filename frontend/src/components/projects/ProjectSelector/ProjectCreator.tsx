import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, X, HardDrive, Cloud, Shield } from 'lucide-react';

interface ProjectCreatorProps {
  isAuthenticated: boolean;
  nonDraftProjectCount: number;
  onCreateProject: (name: string, type: 'local' | 'cloud') => void;
  onShowAuthModal: () => void;
}

export const ProjectCreator: React.FC<ProjectCreatorProps> = ({
  isAuthenticated,
  nonDraftProjectCount,
  onCreateProject,
  onShowAuthModal,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectType, setProjectType] = useState<'local' | 'cloud'>('local');

  const handleCreate = () => {
    if (!newProjectName.trim()) return;

    if (!isAuthenticated && nonDraftProjectCount >= 1 && projectType === 'local') {
      onShowAuthModal();
      return;
    }

    onCreateProject(newProjectName.trim(), projectType);
    setNewProjectName('');
    setProjectType('local');
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewProjectName('');
    setProjectType('local');
  };

  if (isCreating) {
    return (
      <div className="space-y-3">
        {isAuthenticated && (
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
            <button
              onClick={() => setProjectType('local')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded text-xs transition-all
                ${projectType === 'local'
                  ? 'bg-white/10 text-white scale-105'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                }
              `}
            >
              <HardDrive className="h-3.5 w-3.5" />
              <span className="font-medium">Local</span>
            </button>
            <button
              onClick={() => setProjectType('cloud')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded text-xs transition-all
                ${projectType === 'cloud'
                  ? 'bg-white/10 text-white scale-105'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                }
              `}
            >
              <Cloud className="h-3.5 w-3.5" />
              <span className="font-medium">Cloud</span>
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder={`${projectType === 'cloud' ? 'Cloud' : 'Local'} project name...`}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
          >
            <Check className="h-4 w-4 text-green-400" />
          </button>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-red-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      onClick={() => {
        if (!isAuthenticated && nonDraftProjectCount >= 1) {
          onShowAuthModal();
          return;
        }
        setIsCreating(true);
      }}
      className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-all duration-200 group cursor-pointer border border-dashed border-white/20 hover:border-white/30"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center gap-2.5">
        <div className="p-1 bg-primary/20 rounded">
          <Plus className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium text-white">New Project</span>
      </div>
      {!isAuthenticated && nonDraftProjectCount >= 1 && (
        <Shield className="h-4 w-4 text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
      )}
    </motion.button>
  );
};