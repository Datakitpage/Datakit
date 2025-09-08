import React, { useState } from 'react';
import { Save, Check, X } from 'lucide-react';

interface DraftSaverProps {
  onSave: (name: string) => void;
  fileCount: number;
}

export const DraftSaver: React.FC<DraftSaverProps> = ({ onSave, fileCount }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [draftName, setDraftName] = useState('');

  const handleSave = () => {
    if (!draftName.trim()) return;
    onSave(draftName.trim());
    setDraftName('');
    setIsSaving(false);
  };

  const handleCancel = () => {
    setIsSaving(false);
    setDraftName('');
  };

  if (isSaving) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="project name..."
          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-primary"
          autoFocus
        />
        <button
          onClick={handleSave}
          className="p-1.5 hover:bg-white/10 rounded"
        >
          <Check className="h-4 w-4 text-green-400" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 hover:bg-white/10 rounded"
        >
          <X className="h-4 w-4 text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsSaving(true)}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
    >
      <Save className="h-4 w-4 text-green-400" />
      <span className="text-sm text-white">
        Keep This Work
      </span>
      <span className="text-xs text-white/50">
        ({fileCount} file{fileCount !== 1 ? 's' : ''})
      </span>
    </button>
  );
};