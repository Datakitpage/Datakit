import React, { useState } from "react";
import { Code2, Type, Sparkles } from "lucide-react";
import { usePythonStore } from "@/store/pythonStore";

interface CellDividerProps {
  insertIndex: number;
  isLastCell?: boolean;
}

/**
 * Cell divider component that appears between cells and allows creating new cells
 */
const CellDivider: React.FC<CellDividerProps> = ({ insertIndex, isLastCell = false }) => {
  const { createCell } = usePythonStore();
  const [isHovered, setIsHovered] = useState(false);

  const handleCreateCell = (type: 'code' | 'markdown' | 'prompt') => {
    createCell(type, "", insertIndex);
  };

  return (
    <div 
      className={`relative flex items-center justify-center group transition-all duration-200 ${
        isLastCell ? 'py-4' : 'py-2'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Divider Line */}
      <div className={`absolute inset-x-0 h-px bg-white/10 transition-opacity ${
        isHovered || isLastCell ? 'opacity-100' : 'opacity-30'
      }`} />
      
      {/* Toggle Buttons */}
      <div className={`flex items-center bg-black border border-white/10 rounded-md shadow-lg transition-all duration-200 ${
        isHovered || isLastCell ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        <button
          onClick={() => handleCreateCell('code')}
          className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors rounded-l-md border-r border-white/10"
          title="Add Code Cell"
        >
          <Code2 size={12} />
          <span>Code</span>
        </button>
        <button
          onClick={() => handleCreateCell('markdown')}
          className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors border-r border-white/10"
          title="Add Text Cell"
        >
          <Type size={12} />
          <span>Text</span>
        </button>
        <button
          onClick={() => handleCreateCell('prompt')}
          className="flex items-center gap-2 px-3 py-2 text-xs text-purple-400/70 hover:text-purple-300 hover:bg-purple-500/10 transition-colors rounded-r-md"
          title="Add AI Prompt Cell"
        >
          <Sparkles size={12} />
          <span>Prompt</span>
        </button>
      </div>
    </div>
  );
};

export default CellDivider;