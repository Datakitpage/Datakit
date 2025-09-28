import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SourceTypeOption {
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface SourceTypeSelectorProps {
  sourceTypes: SourceTypeOption[];
  activeType: string;
  onTypeSelect: (type: string) => void;
}

export const SourceTypeSelector: React.FC<SourceTypeSelectorProps> = ({
  sourceTypes,
  activeType,
  onTypeSelect
}) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-accent/5 rounded-lg">
      {sourceTypes.map((sourceType) => {
        const Icon = sourceType.icon;
        const isActive = activeType === sourceType.type;
        
        return (
          <button
            key={sourceType.type}
            onClick={() => onTypeSelect(sourceType.type)}
            className={`flex-1 flex items-center justify-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer ${
              isActive
                ? 'bg-accent/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">
              {sourceType.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};