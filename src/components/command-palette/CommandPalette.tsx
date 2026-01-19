import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconSearch,
  IconLayoutGrid,
  IconChartBar,
  IconTable,
  IconTypography,
  IconDatabase,
  IconSparkles,
  IconPalette,
  IconFileUpload
} from "@tabler/icons-react";
import { useAppStore } from "@/store/appStore";
import { useBoardStore } from "@/store/boardStore";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const { isCommandPaletteOpen, closeCommandPalette, openAIPanel, openSettings } = useAppStore();
  const { addWidget } = useBoardStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { id: "add-metric", label: "Add Metric Widget", description: "Display a single metric value", icon: <IconLayoutGrid size={18} stroke={1.5} />, action: () => { addWidget("metric"); closeCommandPalette(); }, category: "Widgets" },
    { id: "add-chart", label: "Add Chart Widget", description: "Visualize data with charts", icon: <IconChartBar size={18} stroke={1.5} />, action: () => { addWidget("chart"); closeCommandPalette(); }, category: "Widgets" },
    { id: "add-table", label: "Add Table Widget", description: "Display data in a table", icon: <IconTable size={18} stroke={1.5} />, action: () => { addWidget("table"); closeCommandPalette(); }, category: "Widgets" },
    { id: "add-text", label: "Add Text Widget", description: "Add text or markdown", icon: <IconTypography size={18} stroke={1.5} />, action: () => { addWidget("text"); closeCommandPalette(); }, category: "Widgets" },
    { id: "import-data", label: "Import Data", description: "CSV, JSON, Excel files", icon: <IconFileUpload size={18} stroke={1.5} />, action: () => { closeCommandPalette(); }, category: "Data" },
    { id: "connect-db", label: "Connect Database", description: "PostgreSQL, DuckDB", icon: <IconDatabase size={18} stroke={1.5} />, action: () => { closeCommandPalette(); }, category: "Data" },
    { id: "ask-ai", label: "Ask AI", description: "Chat with AI about your data", icon: <IconSparkles size={18} stroke={1.5} />, shortcut: "J", action: () => { closeCommandPalette(); openAIPanel(); }, category: "AI" },
    { id: "theme", label: "Theme Settings", description: "Customize colors and appearance", icon: <IconPalette size={18} stroke={1.5} />, action: () => { closeCommandPalette(); openSettings(); }, category: "Settings" },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(query.toLowerCase())
  );

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filteredCommands[selectedIndex]?.action();
    }
  };

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={closeCommandPalette}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
          >
            <div className="command-palette mx-4">
              <div className="flex items-center gap-3 px-4 border-b border-border">
                <IconSearch size={18} stroke={2} className="text-foreground-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a command or search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="command-input"
                />
              </div>

              <div className="command-list">
                {Object.entries(groupedCommands).map(([category, items], catIndex) => (
                  <motion.div 
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: catIndex * 0.05 }}
                  >
                    <div className="px-3 py-2 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
                      {category}
                    </div>
                    {items.map((cmd, itemIndex) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      return (
                        <motion.div
                          key={cmd.id}
                          onClick={cmd.action}
                          data-selected={globalIndex === selectedIndex}
                          className="command-item"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: catIndex * 0.05 + itemIndex * 0.02 }}
                          whileHover={{ x: 2 }}
                        >
                          <div className="command-item-icon">{cmd.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="command-item-label">{cmd.label}</div>
                            {cmd.description && (
                              <div className="text-xs text-foreground-subtle truncate">{cmd.description}</div>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <div className="command-item-shortcut">{cmd.shortcut}</div>
                          )}
                        </motion.div>
                      );
                    })}
                  </motion.div>
                ))}

                {filteredCommands.length === 0 && (
                  <motion.div 
                    className="px-4 py-8 text-center text-foreground-muted text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    No commands found
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
