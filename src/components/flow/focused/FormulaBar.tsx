/**
 * FormulaBar Component
 *
 * Excel-style formula bar that appears above the data grid.
 * Shows the current cell reference and allows entering formulas.
 *
 * Features:
 * - Displays current cell value or formula
 * - Syntax highlighting for formulas
 * - Formula editing with Enter to apply, Escape to cancel
 * - Shows cell reference (column @ row N)
 * - Loading and error states
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ColumnSchema } from '@/store/duckDBViewStore';
import { isFormula, validateFormula, getSupportedFunctions } from '@/lib/formulas';

interface SelectedCell {
  rowIdx: number;
  column: string;
  value: unknown;
  rowId: number;
  formula?: string;
}

interface FormulaBarProps {
  selectedCell: SelectedCell | null;
  schema: ColumnSchema[];
  onFormulaSubmit: (rowId: number, column: string, formula: string) => Promise<void>;
  onValueSubmit?: (rowId: number, column: string, value: unknown) => void;
  onCancel?: () => void;
  accentColor?: string;
  isLoading?: boolean;
  error?: string | null;
  pendingFormulas?: Map<string, string>; // Map of "rowId:column" -> formula
}

// Token types for syntax highlighting
type TokenType = 'operator' | 'number' | 'string' | 'function' | 'column' | 'paren' | 'comma' | 'comparison' | 'logical' | 'text';

interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

// Tokenize formula for syntax highlighting
function tokenizeForHighlight(input: string, _columnNames: Set<string>, functionNames: Set<string>): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  // Skip leading =
  if (input.startsWith('=')) {
    tokens.push({ type: 'operator', value: '=', start: 0, end: 1 });
    pos = 1;
  }

  while (pos < input.length) {
    const char = input[pos];

    // Whitespace - include as text to preserve spacing
    if (/\s/.test(char)) {
      const start = pos;
      while (pos < input.length && /\s/.test(input[pos])) {
        pos++;
      }
      tokens.push({ type: 'text', value: input.slice(start, pos), start, end: pos });
      continue;
    }

    // Number
    if (/[0-9]/.test(char) || (char === '.' && pos + 1 < input.length && /[0-9]/.test(input[pos + 1]))) {
      const start = pos;
      while (pos < input.length && /[0-9.]/.test(input[pos])) {
        pos++;
      }
      tokens.push({ type: 'number', value: input.slice(start, pos), start, end: pos });
      continue;
    }

    // String literal (single quotes)
    if (char === "'") {
      const start = pos;
      pos++; // skip opening quote
      while (pos < input.length && input[pos] !== "'") {
        pos++;
      }
      pos++; // skip closing quote
      tokens.push({ type: 'string', value: input.slice(start, pos), start, end: pos });
      continue;
    }

    // String literal (double quotes - for column names with spaces)
    if (char === '"') {
      const start = pos;
      pos++; // skip opening quote
      while (pos < input.length && input[pos] !== '"') {
        pos++;
      }
      pos++; // skip closing quote
      tokens.push({ type: 'column', value: input.slice(start, pos), start, end: pos });
      continue;
    }

    // Identifier (function, logical operator, or column)
    if (/[a-zA-Z_]/.test(char)) {
      const start = pos;
      while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos])) {
        pos++;
      }
      const value = input.slice(start, pos);
      const upperValue = value.toUpperCase();

      // Check if it's a logical operator (AND/OR)
      if (upperValue === 'AND' || upperValue === 'OR') {
        tokens.push({ type: 'logical', value, start, end: pos });
        continue;
      }

      // Check if it's a function (followed by parenthesis or known function name)
      const isFunction = functionNames.has(upperValue) ||
        (pos < input.length && input[pos] === '(');

      if (isFunction) {
        tokens.push({ type: 'function', value, start, end: pos });
      } else {
        // Treat all other identifiers as columns (valid or not - validation handles errors)
        // This gives immediate color feedback while typing
        tokens.push({ type: 'column', value, start, end: pos });
      }
      continue;
    }

    // Parentheses
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char, start: pos, end: pos + 1 });
      pos++;
      continue;
    }

    // Comma
    if (char === ',') {
      tokens.push({ type: 'comma', value: char, start: pos, end: pos + 1 });
      pos++;
      continue;
    }

    // Comparison operators
    if (char === '<' || char === '>' || char === '!' || char === '=') {
      const start = pos;
      // Check for two-character operators
      if (pos + 1 < input.length) {
        const twoChar = input.slice(pos, pos + 2);
        if (['<=', '>=', '<>', '!='].includes(twoChar)) {
          tokens.push({ type: 'comparison', value: twoChar, start, end: pos + 2 });
          pos += 2;
          continue;
        }
      }
      tokens.push({ type: 'comparison', value: char, start: pos, end: pos + 1 });
      pos++;
      continue;
    }

    // Arithmetic operators
    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'operator', value: char, start: pos, end: pos + 1 });
      pos++;
      continue;
    }

    // Unknown character - treat as text
    tokens.push({ type: 'text', value: char, start: pos, end: pos + 1 });
    pos++;
  }

  return tokens;
}

// Get color for token type
function getTokenColor(type: TokenType, accentColor: string): string {
  switch (type) {
    case 'function':
      return '#8b5cf6'; // Purple for functions
    case 'column':
      return accentColor; // Accent color for columns
    case 'number':
      return '#f59e0b'; // Amber for numbers
    case 'string':
      return '#10b981'; // Green for strings
    case 'operator':
      return '#ef4444'; // Red for operators
    case 'comparison':
      return '#ef4444'; // Red for comparisons
    case 'logical':
      return '#ec4899'; // Pink for logical operators (AND/OR)
    case 'paren':
      return '#6b7280'; // Gray for parentheses
    case 'comma':
      return '#6b7280'; // Gray for commas
    default:
      return 'inherit';
  }
}

export function FormulaBar({
  selectedCell,
  schema,
  onFormulaSubmit,
  onValueSubmit,
  onCancel,
  accentColor = '#6366f1',
  isLoading = false,
  error = null,
  pendingFormulas,
}: FormulaBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build sets for faster lookup
  const columnNames = useMemo(() => {
    return new Set(schema.map(c => c.name.toLowerCase()));
  }, [schema]);

  const functionNames = useMemo(() => {
    return new Set(getSupportedFunctions());
  }, []);

  // Get the formula for the current cell if it exists
  const getCellFormula = useCallback((): string | undefined => {
    if (!selectedCell) return undefined;
    if (selectedCell.formula) return selectedCell.formula;
    if (pendingFormulas) {
      const key = `${selectedCell.rowId}:${selectedCell.column}`;
      return pendingFormulas.get(key);
    }
    return undefined;
  }, [selectedCell, pendingFormulas]);

  // Local input state
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update input when selected cell changes
  useEffect(() => {
    if (selectedCell) {
      const formula = getCellFormula();
      if (formula) {
        setInputValue(formula);
      } else {
        // Show the current value
        const value = selectedCell.value;
        setInputValue(value === null || value === undefined ? '' : String(value));
      }
      setIsEditing(false);
      setValidationError(null);
    } else {
      setInputValue('');
      setIsEditing(false);
      setValidationError(null);
    }
  }, [selectedCell, getCellFormula]);

  // Validate formula as user types
  useEffect(() => {
    if (!isEditing || !inputValue.trim()) {
      setValidationError(null);
      return;
    }

    // Only validate if it looks like a formula
    if (isFormula(inputValue)) {
      const result = validateFormula(inputValue, schema);
      if (!result.valid) {
        setValidationError(result.error || 'Invalid formula');
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [inputValue, isEditing, schema]);

  // Tokenize for highlighting
  const tokens = useMemo(() => {
    if (!isFormula(inputValue)) return [];
    return tokenizeForHighlight(inputValue, columnNames, functionNames);
  }, [inputValue, columnNames, functionNames]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsEditing(true);
  };

  // Handle key down
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedCell || isLoading) return;

    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    if (isFormula(trimmedValue)) {
      // It's a formula - validate and submit
      const result = validateFormula(trimmedValue, schema);
      if (!result.valid) {
        setValidationError(result.error || 'Invalid formula');
        return;
      }
      await onFormulaSubmit(selectedCell.rowId, selectedCell.column, trimmedValue);
    } else {
      // It's a regular value - submit as value
      if (onValueSubmit) {
        onValueSubmit(selectedCell.rowId, selectedCell.column, trimmedValue);
      }
    }

    setIsEditing(false);
  };

  // Handle cancel
  const handleCancel = () => {
    if (selectedCell) {
      const formula = getCellFormula();
      if (formula) {
        setInputValue(formula);
      } else {
        const value = selectedCell.value;
        setInputValue(value === null || value === undefined ? '' : String(value));
      }
    }
    setIsEditing(false);
    setValidationError(null);
    onCancel?.();
  };

  // Focus input when clicking the bar
  const handleBarClick = () => {
    inputRef.current?.focus();
    setIsEditing(true);
  };

  // Don't render if no cell is selected
  if (!selectedCell) {
    return null;
  }

  const displayError = error || validationError;
  const hasFormula = isFormula(inputValue);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-sm"
      style={{
        backgroundColor: 'var(--surface-secondary)',
        borderBottom: '2px solid var(--border-default)',
        minHeight: '40px',
        boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      }}
      onClick={handleBarClick}
    >
      {/* Formula indicator */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded text-xs font-bold"
        style={{
          backgroundColor: hasFormula ? `${accentColor}20` : 'var(--surface-tertiary)',
          color: hasFormula ? accentColor : 'var(--text-secondary)',
          border: hasFormula ? `1px solid ${accentColor}40` : '1px solid var(--border-subtle)',
        }}
        title={hasFormula ? 'Formula mode' : 'Value mode'}
      >
        {hasFormula ? 'fx' : '='}
      </div>

      {/* Cell reference */}
      <div
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono"
        style={{
          backgroundColor: 'var(--surface-tertiary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ color: accentColor, fontWeight: 600 }}>{selectedCell.column}</span>
        <span style={{ opacity: 0.6 }}>@</span>
        <span>row {selectedCell.rowId}</span>
      </div>

      {/* Divider */}
      <div
        className="w-px h-6"
        style={{ backgroundColor: 'var(--border-default)' }}
      />

      {/* Input field with syntax highlighting */}
      <div className="flex-1 relative" ref={containerRef}>
        {/* Highlighted overlay (visible, non-interactive) */}
        {hasFormula && tokens.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none whitespace-pre overflow-hidden"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '13px',
              lineHeight: '24px',
              padding: '0',
              color: 'transparent',
            }}
            aria-hidden="true"
          >
            {tokens.map((token, idx) => (
              <span
                key={idx}
                style={{
                  color: getTokenColor(token.type, accentColor),
                  fontWeight: token.type === 'function' ? 600 : 'normal',
                }}
              >
                {token.value}
              </span>
            ))}
          </div>
        )}

        {/* Actual input (handles editing) */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsEditing(true)}
          placeholder="Enter value or formula (start with =)"
          className="w-full bg-transparent outline-none"
          style={{
            color: hasFormula ? 'transparent' : 'var(--text-primary)',
            caretColor: 'var(--text-primary)',
            fontFamily: hasFormula
              ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
              : 'inherit',
            fontSize: '13px',
            lineHeight: '24px',
          }}
          disabled={isLoading}
        />

        {/* Show plain text on top when formula but tokens empty (typing new formula) */}
        {hasFormula && tokens.length === 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '13px',
              lineHeight: '24px',
              color: 'var(--text-primary)',
            }}
          >
            {inputValue}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isEditing && (
        <div className="flex items-center gap-1">
          {/* Apply button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !!validationError}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{
              backgroundColor: validationError ? 'var(--surface-tertiary)' : `${accentColor}20`,
              color: validationError ? 'var(--text-tertiary)' : accentColor,
              cursor: validationError ? 'not-allowed' : 'pointer',
              border: validationError ? '1px solid var(--border-subtle)' : `1px solid ${accentColor}40`,
            }}
            title="Apply (Enter)"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Cancel button */}
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{
              backgroundColor: 'var(--surface-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
            title="Cancel (Escape)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error indicator */}
      {displayError && (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
          title={displayError}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="max-w-[200px] truncate">{displayError}</span>
        </div>
      )}
    </div>
  );
}

export default FormulaBar;
