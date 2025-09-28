import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  MoreVertical,
  Image,
  FileText,
  AlertCircle,
  Table,
  Clock,
  Edit3,
  Eye,
  Code2,
  Bold,
  Italic,
  List,
  Link,
  Quote,
  ChevronRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { usePythonStore } from '@/store/pythonStore';
import { Button } from '@/components/ui/Button';
import MonacoEditor from '../query/MonacoEditor';
import MonacoErrorBoundary from './MonacoErrorBoundary';
import type {
  PythonCell as PythonCellType,
  CellOutput,
} from '@/lib/python/types';
import { formatDataFrame } from '@/lib/python/executor';
import Tooltip from '@/components/ui/Tooltip';

interface PythonCellProps {
  cell: PythonCellType;
  isActive: boolean;
  onActivate: () => void;
  cellNumber: number;
}

/**
 * Individual Python cell component with editor and output display
 */
const PythonCell: React.FC<PythonCellProps> = ({
  cell,
  isActive,
  onActivate,
  cellNumber,
}) => {
  const {
    updateCell,
    deleteCell,
    executeCell,
    moveCell,
    clearCell,
    toggleCellEditMode,
    toggleCellInputCollapse,
    toggleCellOutputCollapse,
    isExecuting: globalExecuting,
  } = usePythonStore();

  const [showMenu, setShowMenu] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside and exit markdown edit mode when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close dropdown menu if clicking outside
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }

      // Exit markdown edit mode if clicking outside the cell
      if (
        cell.type === 'markdown' &&
        cell.isEditing &&
        cellRef.current &&
        !cellRef.current.contains(event.target as Node)
      ) {
        toggleCellEditMode(cell.id);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [cell.type, cell.isEditing, cell.id, toggleCellEditMode]);

  const handleExecute = async () => {
    const startTime = performance.now();
    await executeCell(cell.id);
    const endTime = performance.now();
    setExecutionTime(endTime - startTime);
  };

  const handleCopyCell = () => {
    navigator.clipboard.writeText(cell.code);
    setShowMenu(false);
  };

  const handleToggleEdit = () => {
    if (cell.type === 'markdown') {
      toggleCellEditMode(cell.id);
    }
  };

  const insertMarkdownFormat = (format: string) => {
    const formats = {
      bold: '**text**',
      italic: '*text*',
      h1: '# ',
      h2: '## ',
      h3: '### ',
      list: '- ',
      quote: '> ',
      link: '[text](url)',
      code: '`code`',
    };

    const insertion = formats[format as keyof typeof formats] || format;
    const newCode = cell.code + insertion;
    updateCell(cell.id, newCode);
  };

  // Debounced update to prevent rapid Monaco Editor re-renders
  const debouncedUpdateCell = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (cellId: string, code: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          updateCell(cellId, code);
        }, 100);
      };
    })(),
    [updateCell]
  );

  const renderOutput = (output: CellOutput) => {
    switch (output.type) {
      case 'text':
        return (
          <div className="font-mono text-sm text-foreground whitespace-pre-wrap">
            {output.content}
          </div>
        );

      case 'error':
        return (
          <div className="font-mono text-sm text-red-400 whitespace-pre-wrap bg-red-500/10 p-3 rounded border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle
                size={16}
                className="text-red-400 mt-0.5 flex-shrink-0"
              />
              <div>{output.content}</div>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="bg-accent/5 p-3 rounded border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Image size={16} className="text-blue-400" />
              <span className="text-sm text-muted-foreground">Plot Output</span>
            </div>
            <img
              src={output.content}
              alt="Python plot output"
              className="max-w-full h-auto rounded border border-border"
            />
          </div>
        );

      case 'dataframe':
        const dfInfo = formatDataFrame(output.content);
        return (
          <div className="bg-accent/5 p-3 rounded border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Table size={16} className="text-green-400" />
              <span className="text-sm text-muted-foreground">
                DataFrame ({dfInfo.shape[0]} rows × {dfInfo.shape[1]} columns)
              </span>
              {dfInfo.memory_usage && (
                <span className="text-xs text-muted-foreground">
                  {(dfInfo.memory_usage / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>

            {/* Column info */}
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Columns:</div>
              <div className="flex flex-wrap gap-1">
                {dfInfo.columns.map((col, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-accent/10 px-2 py-1 rounded"
                    title={`${col}: ${dfInfo.dtypes[col] || 'unknown'}`}
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Data preview */}
            {dfInfo.preview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {dfInfo.columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="text-left p-2 text-foreground font-medium"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dfInfo.preview.slice(0, 10).map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-border">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="p-2 text-muted-foreground">
                            {String(cell).length > 50
                              ? String(cell).substring(0, 50) + '...'
                              : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dfInfo.preview.length > 10 && (
                  <div className="text-xs text-muted-foreground p-2">
                    ... and {dfInfo.preview.length - 10} more rows
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'html':
        return (
          <div className="bg-accent/5 p-3 rounded border border-border">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-purple-400" />
              <span className="text-sm text-muted-foreground">HTML Output</span>
            </div>
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: output.content }}
            />
          </div>
        );

      default:
        return (
          <div className="font-mono text-sm text-muted-foreground whitespace-pre-wrap">
            {output.content}
          </div>
        );
    }
  };

  return (
    <div
      ref={cellRef}
      className={`border rounded-lg overflow-visible transition-colors ${
        isActive
          ? 'border-primary/50 bg-primary/5'
          : 'border-border bg-background/20'
      }`}
      onClick={onActivate}
    >
      {/* Cell Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-popover/50 border-b border-border relative">
        <div className="flex items-center gap-3">
          {/* Collapse/Expand Input Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCellInputCollapse(cell.id);
            }}
            className="p-1 hover:bg-accent/10 rounded transition-colors"
            title={cell.isInputCollapsed ? "Expand input" : "Collapse input"}
          >
            <ChevronRight 
              size={14} 
              className={`text-muted-foreground transition-transform ${
                cell.isInputCollapsed ? '' : 'rotate-90'
              }`}
            />
          </button>

          {/* Cell Number */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">In</span>
            <span className="text-xs font-mono bg-accent/10 px-2 py-1 rounded">
              {cell.executionCount || cellNumber}
            </span>
          </div>

          {/* Execution Status */}
          {cell.isExecuting && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span>Executing...</span>
            </div>
          )}

          {executionTime && !cell.isExecuting && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} />
              <span>{executionTime.toFixed(0)}ms</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Execute Button (only for code cells) */}
          {cell.type === 'code' && (
            <Tooltip content="Execute Cell (Shift+Enter)" placement="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExecute();
                }}
                disabled={
                  cell.isExecuting || globalExecuting || !cell.code.trim()
                }
                title=""
              >
                {cell.isExecuting ? <Square size={14} /> : <Play size={14} />}
              </Button>
            </Tooltip>
          )}

          {/* Edit/View Button (only for markdown cells) */}
          {cell.type === 'markdown' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleEdit();
              }}
              title={cell.isEditing ? 'Preview Markdown' : 'Edit Markdown'}
            >
              {cell.isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
            </Button>
          )}

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
              <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded shadow-xl z-50 min-w-40">
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent/10 flex items-center gap-2"
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
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent/10 flex items-center gap-2"
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
                <div className="border-t border-border" />
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent/10 flex items-center gap-2"
                  onClick={handleCopyCell}
                >
                  <Copy size={14} />
                  Copy Code
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent/10 flex items-center gap-2"
                  onClick={() => {
                    clearCell(cell.id);
                    setShowMenu(false);
                  }}
                >
                  <Square size={14} />
                  Clear Output
                </button>
                <div className="border-t border-border" />
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent/10 flex items-center gap-2"
                  onClick={() => {
                    toggleCellInputCollapse(cell.id);
                    setShowMenu(false);
                  }}
                >
                  <Eye size={14} />
                  {cell.isInputCollapsed ? 'Show' : 'Hide'} Input
                </button>
                {cell.type === 'code' && cell.output.length > 0 && (
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent/10 flex items-center gap-2"
                    onClick={() => {
                      toggleCellOutputCollapse(cell.id);
                      setShowMenu(false);
                    }}
                  >
                    <Eye size={14} />
                    {cell.isOutputCollapsed ? 'Show' : 'Hide'} Output
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Markdown Toolbar (for markdown cells in edit mode) */}
      {cell.type === 'markdown' && cell.isEditing && (
        <div className="px-3 py-2 bg-popover/30 border-b border-border">
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => insertMarkdownFormat('bold')}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
              title="Bold"
            >
              <Bold size={12} />
            </button>
            <button
              onClick={() => insertMarkdownFormat('italic')}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
              title="Italic"
            >
              <Italic size={12} />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => insertMarkdownFormat('h1')}
              className="px-2 py-1 hover:bg-accent/10 rounded transition-colors font-mono"
              title="Header 1"
            >
              H1
            </button>
            <button
              onClick={() => insertMarkdownFormat('h2')}
              className="px-2 py-1 hover:bg-accent/10 rounded transition-colors font-mono"
              title="Header 2"
            >
              H2
            </button>
            <button
              onClick={() => insertMarkdownFormat('h3')}
              className="px-2 py-1 hover:bg-accent/10 rounded transition-colors font-mono"
              title="Header 3"
            >
              H3
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => insertMarkdownFormat('list')}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
              title="List"
            >
              <List size={12} />
            </button>
            <button
              onClick={() => insertMarkdownFormat('quote')}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
              title="Quote"
            >
              <Quote size={12} />
            </button>
            <button
              onClick={() => insertMarkdownFormat('link')}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
              title="Link"
            >
              <Link size={12} />
            </button>
            <button
              onClick={() => insertMarkdownFormat('code')}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
              title="Inline Code"
            >
              <Code2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Code Editor or Markdown Content */}
      {!cell.isInputCollapsed && (
        <div className="border-b border-border">
          {cell.type === 'code' ||
          (cell.type === 'markdown' && cell.isEditing) ? (
            <MonacoErrorBoundary cellId={cell.id}>
              <MonacoEditor
                key={`monaco-${cell.id}`}
                value={cell.code}
                onChange={(value) => debouncedUpdateCell(cell.id, value || '')}
                onExecute={() => handleExecute()}
                language={cell.type === 'code' ? 'python' : 'markdown'}
                height="auto"
                minHeight={80}
                maxHeight={2000}
              />
            </MonacoErrorBoundary>
          ) : (
            <div
              className="p-4 min-h-[100px] cursor-text"
              onClick={handleToggleEdit}
            >
            {cell.code.trim() ? (
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold text-foreground font-heading mb-4">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-semibold text-foreground font-heading mb-3">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-medium text-foreground font-heading mb-2">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-foreground leading-relaxed mb-3">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-foreground font-semibold">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="text-foreground italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="text-foreground list-disc list-inside mb-3 space-y-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="text-foreground list-decimal list-inside mb-3 space-y-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-foreground">{children}</li>
                    ),
                    code: ({ children }) => (
                      <code className="text-green-400 bg-accent/10 px-1 py-0.5 rounded text-sm font-mono">
                        {children}
                      </code>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-primary bg-accent/5 p-3 rounded-r mb-3">
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        className="text-primary underline decoration-primary/50 hover:decoration-primary"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {cell.code}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-muted-foreground italic">
                Click to edit markdown...
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Output Area (only for code cells) */}
      {cell.type === 'code' && cell.output.length > 0 && (
        <>
          {/* Output Header with Collapse Button */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-popover/30 border-b border-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCellOutputCollapse(cell.id);
              }}
              className="p-1 hover:bg-accent/10 rounded transition-colors"
              title={cell.isOutputCollapsed ? "Expand output" : "Collapse output"}
            >
              <ChevronRight 
                size={14} 
                className={`text-muted-foreground transition-transform ${
                  cell.isOutputCollapsed ? '' : 'rotate-90'
                }`}
              />
            </button>
            <span className="text-xs text-muted-foreground">Output</span>
          </div>

          {/* Output Content */}
          {!cell.isOutputCollapsed && (
            <div className="p-3 space-y-3">
              {cell.output.map((output) => (
                <div key={output.id} className="overflow-x-auto">
                  {renderOutput(output)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PythonCell;
