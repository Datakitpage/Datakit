import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconCloudUpload,
  IconFileUpload,
  IconCommand,
  IconDatabase,
  IconSparkles
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useDataStore } from "@/store/dataStore";
import { useBoardStore } from "@/store/boardStore";
import { generateAutoWidgets } from "@/lib/autoWidgets";

export function EmptyState() {
  const { importFile, isImporting, importProgress, initialize } = useDataStore();
  const { addWidget, updateWidget } = useBoardStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    setIsGenerating(true);
    setStatus("Importing data...");

    try {
      await initialize();
      const dataSource = await importFile(file);

      if (!dataSource) {
        setIsGenerating(false);
        setStatus("");
        return;
      }

      setStatus("Analyzing schema...");

      const { getTableSchema } = useDataStore.getState();
      const schema = await getTableSchema(dataSource.tableName);

      if (schema) {
        setStatus("Building dashboard...");

        const widgets = generateAutoWidgets(schema, dataSource.tableName, dataSource.rowCount);

        for (const widget of widgets) {
          const widgetId = addWidget(widget.type, widget.title);
          updateWidget(widgetId, {
            config: {
              ...widget.config,
              dataSourceId: dataSource.id,
            },
          });
        }
      } else {
        const widgetId = addWidget("table", dataSource.name);
        updateWidget(widgetId, {
          config: {
            dataSourceId: dataSource.id,
            sql: "SELECT * FROM " + dataSource.tableName + " LIMIT 100",
          },
        });
      }
    } catch (err) {
      console.error("[Board] Import failed:", err);
    }

    setIsGenerating(false);
    setStatus("");
  }, [initialize, importFile, addWidget, updateWidget]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const dataTransfer = new DataTransfer();
    Array.from(files).forEach(f => dataTransfer.items.add(f));
    await handleDrop({ preventDefault: () => {}, dataTransfer } as any);
  }, [handleDrop]);

  return (
    <div
      className="flex-1 flex flex-col bg-background relative overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground) / 0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Drop overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            className="absolute inset-4 bg-primary/5 border-2 border-dashed border-primary rounded-2xl z-10 flex items-center justify-center backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <motion.div 
              className="text-center"
              initial={{ y: 10 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <IconFileUpload size={48} stroke={1.5} className="text-primary mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">Drop to import</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {(isImporting || isGenerating) && (
          <motion.div 
            className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="text-center"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <motion.div 
                  className="absolute inset-0 border-3 border-primary/20 rounded-full"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                />
                <motion.div 
                  className="absolute inset-0 border-3 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <IconSparkles size={28} stroke={1.5} className="text-primary" />
                </motion.div>
              </div>
              <motion.p 
                className="text-sm font-medium text-foreground mb-1"
                key={status}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {status || "Processing..."}
              </motion.p>
              {isImporting && (
                <div className="w-48 h-1.5 bg-secondary rounded-full mx-auto mt-4 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: Math.round(importProgress) + "%" }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content - centered drop zone */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.label 
          className={clsx(
            "w-full max-w-md p-14 border-2 border-dashed rounded-2xl cursor-pointer",
            "hover:border-primary/40 hover:bg-primary/[0.02]",
            isDragging ? "border-primary bg-primary/5" : "border-border"
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
        >
          <input
            type="file"
            className="hidden"
            accept=".csv,.json,.xlsx,.xls,.parquet"
            onChange={handleFileInput}
          />
          <motion.div 
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <IconCloudUpload size={44} stroke={1.2} className="text-foreground-muted mb-5" />
            </motion.div>
            <p className="text-sm font-medium text-foreground mb-1.5">
              Drop a file to get started
            </p>
            <p className="text-xs text-foreground-muted mb-5">
              CSV, JSON, Excel, or Parquet
            </p>
            <div className="flex items-center gap-2 text-xs text-primary/80">
              <IconSparkles size={14} stroke={1.5} />
              <span>Auto-generates charts & metrics</span>
            </div>
          </motion.div>
        </motion.label>
      </div>

      {/* Bottom bar with shortcuts */}
      <motion.div 
        className="flex items-center justify-center gap-6 py-3.5 border-t border-border bg-background/80 backdrop-blur-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <kbd className="px-2 py-1 rounded-md bg-secondary border border-border font-mono text-[10px] flex items-center gap-1">
            <IconCommand size={10} stroke={2} /> K
          </kbd>
          <span>Commands</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <kbd className="px-2 py-1 rounded-md bg-secondary border border-border font-mono text-[10px] flex items-center gap-1">
            <IconCommand size={10} stroke={2} /> J
          </kbd>
          <span>AI</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <IconDatabase size={12} stroke={1.5} />
          <span>DuckDB</span>
        </div>
      </motion.div>
    </div>
  );
}
