import React from 'react';
import { ChevronUp } from 'lucide-react';

interface ResultsExpandButtonProps {
  isVisible: boolean;
  onExpand: () => void;
}

const ResultsExpandButton: React.FC<ResultsExpandButtonProps> = ({
  isVisible,
  onExpand
}) => {
  if (!isVisible) return null;

  return (
    <button
      onClick={onExpand}
      className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-background border-l border-t border-r border-primary/90 rounded-t-lg px-4 py-1 hover:border-l-primary hover:border-t-primary hover:border-r-primary transition-colors flex items-center gap-2"
    >
      <ChevronUp className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Show Results</span>
    </button>
  );
};

export default ResultsExpandButton;