import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Available column types that users can select
export const COLUMN_TYPES = [
  {
    type: "VARCHAR",
    icon: "Aa",
    label: "Text",
    color: "#6B7280",
    description: "Preserves leading zeros, special characters",
  },
  {
    type: "BIGINT",
    icon: "#",
    label: "Integer",
    color: "#3B82F6",
    description: "Whole numbers only",
  },
  {
    type: "DOUBLE",
    icon: "#.#",
    label: "Decimal",
    color: "#3B82F6",
    description: "Numbers with decimals",
  },
  {
    type: "BOOLEAN",
    icon: "◉",
    label: "Boolean",
    color: "#8B5CF6",
    description: "True/false values",
  },
  {
    type: "DATE",
    icon: "◷",
    label: "Date",
    color: "#F59E0B",
    description: "Date values (YYYY-MM-DD)",
  },
  {
    type: "TIMESTAMP",
    icon: "◷",
    label: "Timestamp",
    color: "#F59E0B",
    description: "Date and time",
  },
] as const;

export type ColumnTypeOption = (typeof COLUMN_TYPES)[number]["type"];

interface ColumnTypePopoverProps {
  /** Whether the popover is open */
  isOpen: boolean;
  /** Current column type */
  currentType: string;
  /** Column name for display */
  columnName: string;
  /** Position for the popover */
  anchorRect: DOMRect | null;
  /** Callback when a new type is selected */
  onTypeChange: (newType: ColumnTypeOption) => void;
  /** Callback to close the popover */
  onClose: () => void;
  /** Accent color for theming */
  accentColor?: string;
}

export function ColumnTypePopover({
  isOpen,
  currentType,
  columnName,
  anchorRect,
  onTypeChange,
  onClose,
  accentColor = "#8B5CF6",
}: ColumnTypePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selectedType, setSelectedType] = useState<ColumnTypeOption | null>(
    null,
  );

  // Normalize current type for comparison
  const normalizedCurrentType = currentType.toUpperCase();
  const matchedCurrentType =
    COLUMN_TYPES.find(
      (t) =>
        normalizedCurrentType.includes(t.type) ||
        (t.type === "VARCHAR" && normalizedCurrentType.includes("TEXT")) ||
        (t.type === "BIGINT" && normalizedCurrentType.includes("INTEGER")),
    )?.type || "VARCHAR";

  // Reset selection when popover opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(null);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      // Small delay to avoid immediate close from the trigger click
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Calculate position
  const getPosition = () => {
    if (!anchorRect) return { top: 0, left: 0 };

    // Position below the anchor, aligned to left
    return {
      top: anchorRect.bottom + 4,
      left: Math.max(8, anchorRect.left - 8),
    };
  };

  const position = getPosition();
  const isChangingToText =
    selectedType === "VARCHAR" && matchedCurrentType !== "VARCHAR";
  const willReimport = selectedType && selectedType !== matchedCurrentType;

  const handleApply = () => {
    if (selectedType && selectedType !== matchedCurrentType) {
      onTypeChange(selectedType);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && anchorRect && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
          className="fixed z-[200] rounded-lg overflow-hidden"
          style={{
            top: position.top,
            left: position.left,
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
            minWidth: 240,
            maxWidth: 300,
          }}
          data-column-type-popover
        >
          {/* Header */}
          <div
            className="px-3 py-2 text-xs font-medium"
            style={{
              borderBottom: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            Column Type:{" "}
            <span style={{ color: "var(--text-primary)" }}>{columnName}</span>
          </div>

          {/* Type options */}
          <div className="p-1.5">
            {COLUMN_TYPES.map((typeOption) => {
              const isSelected = selectedType === typeOption.type;
              const isCurrent =
                matchedCurrentType === typeOption.type && !selectedType;
              const isActive = isSelected || isCurrent;

              return (
                <motion.button
                  key={typeOption.type}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left"
                  style={{
                    backgroundColor: isActive
                      ? `${typeOption.color}15`
                      : "transparent",
                    color: "var(--text-primary)",
                  }}
                  onClick={() => setSelectedType(typeOption.type)}
                  whileHover={{ backgroundColor: `${typeOption.color}10` }}
                  whileTap={{ scale: 0.99 }}
                >
                  {/* Type icon badge */}
                  <span
                    className="w-7 h-7 flex items-center justify-center rounded text-xs font-semibold shrink-0"
                    style={{
                      backgroundColor: `${typeOption.color}20`,
                      color: typeOption.color,
                    }}
                  >
                    {typeOption.icon}
                  </span>

                  {/* Label and description */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium flex items-center gap-1.5">
                      {typeOption.label}
                      {isCurrent && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: "var(--surface-tertiary)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          current
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[10px] mt-0.5 truncate"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {typeOption.description}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && <span style={{ color: accentColor }}>✓</span>}
                </motion.button>
              );
            })}
          </div>

          {/* Warning/info message */}
          {willReimport && (
            <div
              className="mx-3 mb-2 p-2 rounded text-[11px]"
              style={{
                backgroundColor: isChangingToText
                  ? "rgba(245, 158, 11, 0.1)"
                  : "var(--surface-secondary)",
                color: isChangingToText ? "#D97706" : "var(--text-secondary)",
              }}
            >
              {isChangingToText ? (
                <>
                  <span className="font-medium">Re-import required</span>
                  <br />
                  Column will be re-imported from source to preserve original
                  values (leading zeros, etc.)
                </>
              ) : (
                <>
                  <span className="font-medium">Type conversion</span>
                  <br />
                  Values will be converted to the new type. Invalid values
                  become null.
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div
            className="flex items-center justify-end gap-2 px-3 py-2"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <button
              className="px-3 py-1.5 text-xs rounded hover:bg-[var(--surface-secondary)] transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onClick={onClose}
            >
              Cancel
            </button>
            <motion.button
              className="px-3 py-1.5 text-xs rounded font-medium disabled:opacity-40 transition-colors"
              style={{
                backgroundColor: willReimport
                  ? accentColor
                  : "var(--surface-tertiary)",
                color: willReimport ? "white" : "var(--text-tertiary)",
              }}
              disabled={!willReimport}
              onClick={handleApply}
              whileHover={willReimport ? { scale: 1.02 } : {}}
              whileTap={willReimport ? { scale: 0.98 } : {}}
            >
              {isChangingToText ? "Re-import as Text" : "Change Type"}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ColumnTypePopover;
