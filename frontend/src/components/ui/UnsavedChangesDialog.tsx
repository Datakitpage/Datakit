import React from 'react';
import { Button } from './Button';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscard: () => void;
  title?: string;
  message?: string;
  saveButtonText?: string;
  discardButtonText?: string;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  title = 'Unsaved Changes',
  message = 'You have unsaved changes in your current notebook. What would you like to do?',
  saveButtonText = 'Save and Continue',
  discardButtonText = 'Discard Changes',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-background/60 flex items-center justify-center z-50">
      <div className="bg-popover p-6 rounded-lg shadow-lg w-96 max-w-[90vw]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <span className="text-yellow-400 text-sm">!</span>
          </div>
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
        </div>
        
        <p className="text-muted-foreground mb-6 leading-relaxed">
          {message}
        </p>
        
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="border-primary hover:border-primary/80 justify-center"
            onClick={onSave}
          >
            {saveButtonText}
          </Button>
          <Button
            variant="outline"
            className="justify-center"
            onClick={onDiscard}
          >
            {discardButtonText}
          </Button>
          <Button
            variant="ghost"
            className="justify-center"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};