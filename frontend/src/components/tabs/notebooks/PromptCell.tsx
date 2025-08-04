import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles,
  Play,
  Square,
  Trash2,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  Eye,
  ChevronRight,
  Wand2,
  Brain,
  Lock,
  Check,
  X,
  Code2,
  ArrowDown,
  Zap,
} from 'lucide-react';

import { usePythonStore } from '@/store/pythonStore';
import { useAuth } from '@/hooks/auth/useAuth';
import { useNotebookContext } from '@/hooks/notebooks/useNotebookContext';
import { useNotebookAI } from '@/hooks/notebooks/useNotebookAI';
import { Button } from '@/components/ui/Button';
import AuthModal from '@/components/auth/AuthModal';
import MonacoEditor from '../query/MonacoEditor';
import MonacoErrorBoundary from './MonacoErrorBoundary';
import type { PythonCell as PythonCellType } from '@/lib/python/types';
import Tooltip from '@/components/ui/Tooltip';

interface PromptCellProps {
  cell: PythonCellType;
  isActive: boolean;
  onActivate: () => void;
  cellNumber: number;
}

const PromptCell: React.FC<PromptCellProps> = ({
  cell,
  isActive,
  onActivate,
  cellNumber,
}) => {
  const {
    updateCell,
    deleteCell,
    moveCell,
    toggleCellInputCollapse,
    createCell,
    executeCell,
    cells,
  } = usePythonStore();

  // Helper function to update prompt cell properties
  const updatePromptCell = (cellId: string, code: string, additionalProps?: Partial<PythonCellType>) => {
    const state = usePythonStore.getState();
    const updatedCells = state.cells.map((c) =>
      c.id === cellId 
        ? { ...c, code, updatedAt: new Date(), ...additionalProps }
        : c
    );
    usePythonStore.setState({ cells: updatedCells });
    // Mark as unsaved
    state.markAsUnsaved();
  };

  // Helper function to split generated code into executable blocks
  const splitCodeIntoBlocks = (code: string): string[] => {
    if (!code) return [];
    
    // Split by comment separator or natural code blocks
    const blocks = code.split(/\n\n# --- Next Code Block ---\n\n/);
    
    // Further split by logical breaks (imports, function definitions, etc.)
    const splitBlocks: string[] = [];
    
    blocks.forEach(block => {
      const lines = block.split('\n');
      let currentBlock: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Check if this line should start a new block
        const isNewBlockTrigger = 
          (trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) && currentBlock.length > 0 ||
          (trimmedLine.startsWith('def ') || trimmedLine.startsWith('class ')) && currentBlock.length > 0 ||
          (trimmedLine.startsWith('# ') && trimmedLine.length > 10) && currentBlock.length > 0;
        
        if (isNewBlockTrigger) {
          // Save current block and start new one
          if (currentBlock.length > 0) {
            splitBlocks.push(currentBlock.join('\n').trim());
            currentBlock = [];
          }
        }
        
        currentBlock.push(line);
      }
      
      // Add remaining block
      if (currentBlock.length > 0) {
        splitBlocks.push(currentBlock.join('\n').trim());
      }
    });
    
    return splitBlocks.filter(block => block.trim().length > 0);
  };

  // Create executable code cells from generated code
  const createCodeCells = () => {
    if (!cell.generatedCode) return;
    
    const codeBlocks = splitCodeIntoBlocks(cell.generatedCode);
    if (codeBlocks.length === 0) return;
    
    // Find the current cell index
    const currentIndex = cells.findIndex(c => c.id === cell.id);
    if (currentIndex === -1) return;
    
    // Create cells after the current prompt cell
    codeBlocks.forEach((code, index) => {
      const insertIndex = currentIndex + 1 + index;
      createCell('code', code, insertIndex);
    });
  };

  // Execute all generated code cells
  const executeGeneratedCode = async () => {
    if (!cell.generatedCode) return;
    
    // First create the code cells
    createCodeCells();
    
    // Wait a bit for cells to be created, then execute them
    setTimeout(async () => {
      const currentIndex = cells.findIndex(c => c.id === cell.id);
      if (currentIndex === -1) return;
      
      const codeBlocks = splitCodeIntoBlocks(cell.generatedCode || '');
      
      // Execute each created cell sequentially
      for (let i = 0; i < codeBlocks.length; i++) {
        const cellIndex = currentIndex + 1 + i;
        const updatedCells = usePythonStore.getState().cells;
        
        if (cellIndex < updatedCells.length) {
          const cellToExecute = updatedCells[cellIndex];
          try {
            await executeCell(cellToExecute.id);
            // Small delay between executions
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Error executing cell ${i + 1}:`, error);
            // Continue with next cell even if one fails
          }
        }
      }
    }, 100);
  };

  const { isAuthenticated } = useAuth();
  const { 
    context, 
    getAIContext, 
    refreshContext, 
    toggleTableSelection, 
    toggleVariableSelection,
    toggleAllTables,
    toggleAllVariables 
  } = useNotebookContext();
  
  const { status: aiStatus, processAIRequest, resetStatus } = useNotebookAI();
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateCell(cell.id, e.target.value);
    adjustTextareaHeight();
  };

  const handleCodeChange = (value: string | undefined) => {
    updateCell(cell.id, value || '');
  };

  // Parse AI response to show code blocks and explanations separately
  const parseAIOutput = (response: string) => {
    if (!response) return [];
    
    const parts = [];
    const lines = response.split('\n');
    let currentPart = { type: 'text', content: '' };
    let inCodeBlock = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('```python')) {
        // Starting a code block
        if (currentPart.content.trim()) {
          parts.push(currentPart);
        }
        currentPart = { type: 'code', content: '' };
        inCodeBlock = true;
      } else if (line.trim() === '```' && inCodeBlock) {
        // Ending a code block
        parts.push(currentPart);
        currentPart = { type: 'text', content: '' };
        inCodeBlock = false;
      } else {
        // Regular line
        if (currentPart.content) {
          currentPart.content += '\n';
        }
        currentPart.content += line;
      }
    }
    
    if (currentPart.content.trim()) {
      parts.push(currentPart);
    }
    
    return parts.filter(part => part.content.trim());
  };

  const handleExecutePrompt = async () => {
    if (!cell.code.trim()) return;
    
    // Phase 2: Authentication check
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Phase 3: Get current context
    const aiContext = getAIContext();
    
    // Mark cell as processing
    updatePromptCell(cell.id, cell.code, {
      isProcessing: true,
      generatedCode: undefined,
      aiResponse: undefined,
    });
    
    try {
      // Phase 4: Real AI processing with DataKit
      console.log('Processing AI request with context:', aiContext);
      
      const aiResponse = await processAIRequest(
        {
          prompt: cell.code,
          context: aiContext,
        },
        // Streaming callback for real-time updates
        (chunk) => {
          updatePromptCell(cell.id, cell.code, {
            isProcessing: true,
            aiResponse: aiStatus.currentResponse,
          });
        }
      );
      
      if (aiResponse.error) {
        // Handle AI errors
        updatePromptCell(cell.id, cell.code, {
          isProcessing: false,
          aiResponse: `❌ AI Error: ${aiResponse.error}\n\nPlease try again or check your connection.`,
        });
        return;
      }
      
      // Update cell with successful AI response - put code directly in the cell
      updatePromptCell(cell.id, aiResponse.generatedCode || cell.code, {
        isProcessing: false,
        generatedCode: aiResponse.generatedCode,
        aiResponse: aiResponse.explanation || 'AI processing completed.',
      });
      
      // Log usage information
      if (aiResponse.tokensUsed || aiResponse.creditsUsed) {
        console.log('AI Usage:', {
          tokens: aiResponse.tokensUsed,
          credits: aiResponse.creditsUsed,
        });
      }
      
    } catch (error) {
      console.error('Error executing AI prompt:', error);
      updatePromptCell(cell.id, cell.code, {
        isProcessing: false,
        aiResponse: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`,
      });
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Reset AI status after auth
    resetStatus();
    // After successful auth, automatically execute the prompt
    setTimeout(() => {
      handleExecutePrompt();
    }, 100);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(cell.code);
    setShowMenu(false);
  };

  // Auto-adjust height on mount and content change
  React.useEffect(() => {
    adjustTextareaHeight();
  }, [cell.code, adjustTextareaHeight]);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={cellRef}
      className={`border rounded-lg overflow-visible transition-colors ${
        isActive
          ? 'border-primary/50 bg-primary/5'
          : 'border-white/10 bg-black/20'
      }`}
      onClick={onActivate}
    >
      {/* Cell Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-white/10 relative">
        <div className="flex items-center gap-3">
          {/* Collapse/Expand Input Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCellInputCollapse(cell.id);
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title={cell.isInputCollapsed ? 'Expand input' : 'Collapse input'}
          >
            <ChevronRight
              size={14}
              className={`text-white/50 transition-transform ${
                cell.isInputCollapsed ? '' : 'rotate-90'
              }`}
            />
          </button>

          {/* Cell Number with AI Icon */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-white/50">Prompt</span>
            <span className="text-xs font-mono bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2 py-1 rounded">
              {cellNumber}
            </span>
          </div>

          {/* Processing Status */}
          {cell.isProcessing && (
            <div className="flex items-center gap-2 text-xs text-purple-400">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span>{aiStatus.currentResponse ? 'AI responding...' : 'AI thinking...'}</span>
            </div>
          )}
          
          {/* Context Status */}
          {isAuthenticated && !cell.isProcessing && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                title="Toggle context information"
              >
                <span>📊</span>
                <span>{context.selectedTables.size + context.selectedVariables.size}/{context.tables.length + context.variables.length} selected</span>
              </button>
              
              {/* Code Ready Indicator */}
              {cell.generatedCode && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <Code2 size={12} />
                  <span>Code generated</span>
                </div>
              )}
            </div>
          )}
          
          {/* Authentication Status */}
          {!isAuthenticated && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              <Lock size={12} />
              <span>Sign in required</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Execute Button */}
          <Tooltip 
            content={isAuthenticated ? "Execute Prompt (AI)" : "Sign in required to use AI features"} 
            placement="bottom"
          >
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 ${
                !isAuthenticated ? 'opacity-75' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleExecutePrompt();
              }}
              disabled={cell.isProcessing || (!isAuthenticated && !cell.code.trim())}
            >
              {cell.isProcessing ? (
                <Square size={14} />
              ) : !isAuthenticated ? (
                <Lock size={14} className="text-purple-400" />
              ) : (
                <Brain size={14} className="text-purple-400" />
              )}
            </Button>
          </Tooltip>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation();
              deleteCell(cell.id);
            }}
            title="Delete Cell"
          >
            <Trash2 size={14} />
          </Button>

          {/* Menu Button */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
            >
              <MoreVertical size={14} />
            </Button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-black border border-white/10 rounded shadow-xl z-50 min-w-40">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCell(cell.id, 'up');
                    setTimeout(() => setShowMenu(false), 100);
                  }}
                >
                  <ChevronUp size={14} />
                  Move Up
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCell(cell.id, 'down');
                    setTimeout(() => setShowMenu(false), 100);
                  }}
                >
                  <ChevronDown size={14} />
                  Move Down
                </button>
                <div className="border-t border-white/10" />
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={handleCopyPrompt}
                >
                  <Copy size={14} />
                  Copy Prompt
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                  onClick={() => {
                    toggleCellInputCollapse(cell.id);
                    setShowMenu(false);
                  }}
                >
                  <Eye size={14} />
                  {cell.isInputCollapsed ? 'Show' : 'Hide'} Input
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cell Input Area */}
      {!cell.isInputCollapsed && (
        <div className="border-b border-white/10">
          {/* Show original prompt as textarea when no code is generated, otherwise show Monaco editor */}
          {!cell.generatedCode ? (
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={cell.code}
                onChange={handleInputChange}
                placeholder={isAuthenticated 
                  ? "What do you want DataKit to do?\n\nExamples:\n• Analyze the sales data and create a chart showing trends\n• Find customers with orders > $1000 and their contact info  \n• Install matplotlib and create a scatter plot of price vs quantity\n• Show me the top 10 products by revenue this quarter"
                  : "Sign in to use AI-powered data analysis and code generation.\n\nOnce authenticated, you can:\n• Ask questions about your data in natural language\n• Generate Python code automatically\n• Create visualizations with simple prompts\n• Install packages and run complex analysis"
                }
                className={`w-full min-h-[120px] p-3 bg-black/20 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/50 transition-colors resize-none font-mono text-sm leading-relaxed ${
                  !isAuthenticated ? 'opacity-75' : ''
                }`}
                style={{ height: 'auto' }}
                disabled={!isAuthenticated}
              />
            </div>
          ) : (
            <MonacoErrorBoundary cellId={cell.id}>
              <MonacoEditor
                key={`monaco-${cell.id}`}
                value={cell.code}
                onChange={handleCodeChange}
                onExecute={() => {/* TODO: Add execution for prompt cells */}}
                language="python"
                height="auto"
                minHeight={80}
                maxHeight={2000}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  folding: true,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 4,
                  insertSpaces: true,
                  renderWhitespace: 'boundary',
                  bracketPairColorization: { enabled: true },
                }}
              />
            </MonacoErrorBoundary>
          )}

          {/* Context Information */}
          {showContext && isAuthenticated && (
            <div className="mt-4 p-3 bg-black/30 border border-blue-500/20 rounded-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">📊</span>
                  <span className="text-xs text-blue-400 font-medium">Context Selection</span>
                </div>
                <button
                  onClick={refreshContext}
                  className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
                  disabled={context.isLoading}
                >
                  {context.isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              
              <div className="space-y-3">
                {/* Tables Section */}
                {context.tables.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-400 font-medium">DuckDB Tables ({context.tables.length})</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleAllTables(true)}
                          className="text-xs text-green-400/70 hover:text-green-400 transition-colors px-1"
                          title="Select all tables"
                        >
                          All
                        </button>
                        <span className="text-white/30">|</span>
                        <button
                          onClick={() => toggleAllTables(false)}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-1"
                          title="Deselect all tables"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {context.tables.map(table => (
                        <div key={table.name} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleTableSelection(table.name)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              context.selectedTables.has(table.name)
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-white/30 hover:border-green-400'
                            }`}
                          >
                            {context.selectedTables.has(table.name) && <Check size={10} />}
                          </button>
                          <span className="text-xs text-white/80 flex-1">
                            {table.name} <span className="text-white/50">({table.schema.length} cols)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* DataFrames Section */}
                {context.variables.filter(v => v.type === 'DataFrame').length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-blue-400 font-medium">DataFrames ({context.variables.filter(v => v.type === 'DataFrame').length})</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            context.variables.filter(v => v.type === 'DataFrame').forEach(v => {
                              if (!context.selectedVariables.has(v.name)) {
                                toggleVariableSelection(v.name);
                              }
                            });
                          }}
                          className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors px-1"
                          title="Select all DataFrames"
                        >
                          All
                        </button>
                        <span className="text-white/30">|</span>
                        <button
                          onClick={() => {
                            context.variables.filter(v => v.type === 'DataFrame').forEach(v => {
                              if (context.selectedVariables.has(v.name)) {
                                toggleVariableSelection(v.name);
                              }
                            });
                          }}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-1"
                          title="Deselect all DataFrames"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {context.variables.filter(v => v.type === 'DataFrame').map(variable => (
                        <div key={variable.name} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleVariableSelection(variable.name)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              context.selectedVariables.has(variable.name)
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-white/30 hover:border-blue-400'
                            }`}
                          >
                            {context.selectedVariables.has(variable.name) && <Check size={10} />}
                          </button>
                          <span className="text-xs text-white/80 flex-1">
                            {variable.name} <span className="text-white/50">({variable.shape?.[0]}×{variable.shape?.[1]})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Other Variables Section */}
                {context.variables.filter(v => v.type !== 'DataFrame').length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-yellow-400 font-medium">Variables ({context.variables.filter(v => v.type !== 'DataFrame').length})</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            context.variables.filter(v => v.type !== 'DataFrame').forEach(v => {
                              if (!context.selectedVariables.has(v.name)) {
                                toggleVariableSelection(v.name);
                              }
                            });
                          }}
                          className="text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors px-1"
                          title="Select all variables"
                        >
                          All
                        </button>
                        <span className="text-white/30">|</span>
                        <button
                          onClick={() => {
                            context.variables.filter(v => v.type !== 'DataFrame').forEach(v => {
                              if (context.selectedVariables.has(v.name)) {
                                toggleVariableSelection(v.name);
                              }
                            });
                          }}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-1"
                          title="Deselect all variables"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {context.variables.filter(v => v.type !== 'DataFrame').map(variable => (
                        <div key={variable.name} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleVariableSelection(variable.name)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              context.selectedVariables.has(variable.name)
                                ? 'bg-yellow-500 border-yellow-500 text-white'
                                : 'border-white/30 hover:border-yellow-400'
                            }`}
                          >
                            {context.selectedVariables.has(variable.name) && <Check size={10} />}
                          </button>
                          <span className="text-xs text-white/80 flex-1">
                            {variable.name} <span className="text-white/50">({variable.type})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {context.tables.length === 0 && context.variables.length === 0 && (
                  <div className="text-white/50 italic text-xs">No context detected</div>
                )}
              </div>
            </div>
          )}
          

        </div>
      )}
      
      {/* AI Output Area - shows parsed response with code blocks and explanations */}
      {cell.aiResponse && (
        <div className="border-t border-white/5">
          <div className="p-4 space-y-4">
            {parseAIOutput(cell.aiResponse).map((part, index) => (
              <div key={index}>
                {part.type === 'code' ? (
                  <div className="bg-black/30 border border-green-500/20 rounded-md overflow-hidden">
                    <div className="px-3 py-2 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2">
                      <Code2 size={12} className="text-green-400" />
                      <span className="text-xs text-green-400 font-medium">Generated Code</span>
                    </div>
                    <div className="p-3">
                      <pre className="text-sm text-white/90 whitespace-pre-wrap font-mono">
                        {part.content.trim()}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/20 border border-blue-500/20 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain size={12} className="text-blue-400" />
                      <span className="text-xs text-blue-400 font-medium">AI Explanation</span>
                    </div>
                    <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                      {part.content.trim()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleAuthSuccess}
        defaultMode="login"
      />
    </div>
  );
};

export default PromptCell;