import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import type { PythonScript } from '@/lib/python/types';

interface NotebookEditorProps {
  isOpen: boolean;
  onClose: () => void;
  script: PythonScript | null;
  onUpdate: (updates: Partial<PythonScript>) => void;
  title?: string;
}

export const NotebookEditor: React.FC<NotebookEditorProps> = ({
  isOpen,
  onClose,
  script,
  onUpdate,
  title = "Edit Notebook",
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Update local state when script changes
  useEffect(() => {
    if (script) {
      setName(script.name || '');
      setDescription(script.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [script]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    onUpdate({ name: newName });
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    onUpdate({ description: newDescription });
  };

  if (!isOpen) return null;

  return (
    <div className="bg-popover border border-border rounded shadow-xl min-w-80 p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Untitled Notebook"
            className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:placeholder-muted-foreground focus:outline-none focus:border-primary/50"
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:placeholder-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
          />
        </div>
        
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Changes are saved automatically
          </p>
        </div>
      </div>
    </div>
  );
};