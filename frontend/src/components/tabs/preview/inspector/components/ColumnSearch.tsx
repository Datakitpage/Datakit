import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronDown,
  Hash,
  Type,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterType = "all" | "numeric" | "text" | "date" | "name";

interface FilterOption {
  value: FilterType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface ColumnSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterType: FilterType;
  onFilterChange: (type: FilterType) => void;
  totalColumns: number;
  filteredCount: number;
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    value: "all",
    label: "Default",
    icon: <FileText className="h-3 w-3" />,
    description: "Show all columns",
  },
  {
    value: "numeric",
    label: "Numeric",
    icon: <Hash className="h-3 w-3" />,
    description: "INTEGER, DOUBLE, NUMERIC types",
  },
  {
    value: "text",
    label: "Text",
    icon: <Type className="h-3 w-3" />,
    description: "VARCHAR, TEXT types",
  },
  {
    value: "date",
    label: "Date/Time",
    icon: <Calendar className="h-3 w-3" />,
    description: "DATE, TIMESTAMP types",
  },
  // TODO: DO we need?
  // {
  //   value: "name",
  //   label: "Search Name",
  //   icon: <Search className="h-3 w-3" />,
  //   description: "Filter by column name",
  // },
];

export const ColumnSearch: React.FC<ColumnSearchProps> = ({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  totalColumns,
  filteredCount,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const currentFilter =
    FILTER_OPTIONS.find((opt) => opt.value === filterType) || FILTER_OPTIONS[0];
  const showSearchInput = filterType === "name" || searchTerm.length > 0;

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Columns</h3>
          <span className="text-xs text-muted-foreground">
            {filteredCount !== totalColumns ? `${filteredCount} of ` : ""}
            {totalColumns}
          </span>
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-card/30 hover:bg-card/50 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {currentFilter.icon}
            <span>{currentFilter.label}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                isDropdownOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 bg-popover backdrop-blur-sm border border-border rounded-lg shadow-xl z-50 min-w-48"
              >
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onFilterChange(option.value);
                      setIsDropdownOpen(false);
                      // Clear search when switching filters
                      if (option.value !== "name" && searchTerm) {
                        onSearchChange("");
                      }
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 text-left hover:bg-accent/10 transition-colors first:rounded-t-lg last:rounded-b-lg",
                      filterType === option.value &&
                        "bg-primary/20 text-primary"
                    )}
                  >
                    <div className="mt-0.5">{option.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Search Input - appears when "Search Name" is selected */}
      <AnimatePresence>
        {showSearchInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search column names..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className={cn(
                  "w-full pl-9 pr-3 py-2 bg-card/20 border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground transition-all duration-200",
                  "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/50",
                  isSearchFocused && "bg-card/30"
                )}
                autoFocus={filterType === "name"}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results summary for name search */}
      {filterType === "name" && searchTerm.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-xs text-muted-foreground"
        >
          {filteredCount === 0 ? (
            <span className="text-yellow-400">
              No columns match "{searchTerm}"
            </span>
          ) : filteredCount === 1 ? (
            <span>Found 1 column matching "{searchTerm}"</span>
          ) : (
            <span>
              Found {filteredCount} columns matching "{searchTerm}"
            </span>
          )}
        </motion.div>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Click columns to explore patterns
      </p>
    </div>
  );
};
