import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconSparkles,
  IconX,
  IconBolt,
  IconLoader2,
  IconArrowRight,
  IconCode,
  IconPlus,
  IconCircleCheckFilled
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useAppStore } from "@/store/appStore";
import { useAIStore } from "@/store/aiStore";
import { useDataStore } from "@/store/dataStore";
import { useBoardStore } from "@/store/boardStore";

interface AIAction {
  type: "chart" | "table" | "metric" | "query";
  label: string;
  config: any;
}

interface AIResponse {
  text: string;
  actions?: AIAction[];
  sql?: string;
}

export function AIPanel() {
  const { isAIPanelOpen, closeAIPanel } = useAppStore();
  const { isLoading, sendMessage, isConfigured, messages } = useAIStore();
  const { dataSources } = useDataStore();
  const { addWidget, updateWidget } = useBoardStore();

  const [input, setInput] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeDataSource = dataSources[0];

  useEffect(() => {
    if (isAIPanelOpen) {
      setInput("");
      setResponse(null);
      setExecutedActions(new Set());
      setLastMessageCount(messages.length);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isAIPanelOpen, messages.length]);

  // Watch for new assistant messages
  useEffect(() => {
    if (messages.length > lastMessageCount) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        const result = lastMessage.content;
        const actions: AIAction[] = [];
        
        const sqlMatch = result.match(/```sql\n([\s\S]*?)\n```/);
        const sql = sqlMatch ? sqlMatch[1].trim() : undefined;

        if (result.toLowerCase().includes("chart") || result.toLowerCase().includes("visualization")) {
          actions.push({
            type: "chart",
            label: "Add Chart",
            config: { chartType: "bar", sql: sql || "SELECT * FROM " + (activeDataSource?.tableName || "data") + " LIMIT 10" }
          });
        }
        if (result.toLowerCase().includes("table") || result.toLowerCase().includes("show data")) {
          actions.push({
            type: "table",
            label: "Add Table",
            config: { sql: sql || "SELECT * FROM " + (activeDataSource?.tableName || "data") + " LIMIT 100" }
          });
        }
        if (result.toLowerCase().includes("metric") || result.toLowerCase().includes("count") || result.toLowerCase().includes("total")) {
          actions.push({
            type: "metric",
            label: "Add Metric",
            config: { sql: sql || "SELECT COUNT(*) as value FROM " + (activeDataSource?.tableName || "data") }
          });
        }

        setResponse({ text: result, actions, sql });
        setLastMessageCount(messages.length);
      }
    }
  }, [messages, lastMessageCount, activeDataSource]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAIPanelOpen) {
        closeAIPanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAIPanelOpen, closeAIPanel]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    setInput("");

    const context = activeDataSource
      ? "Table: " + activeDataSource.tableName + ", Columns: " + activeDataSource.schema.map(c => c.name + " (" + c.type + ")").join(", ") + ", Rows: " + activeDataSource.rowCount
      : "No data loaded.";

    await sendMessage(prompt, context);
  }, [input, isLoading, activeDataSource, sendMessage]);

  const executeAction = (action: AIAction, index: number) => {
    const widgetId = addWidget(action.type, action.label.replace("Add ", ""));
    updateWidget(widgetId, {
      config: {
        ...action.config,
        dataSourceId: activeDataSource?.id,
      },
    });
    setExecutedActions(prev => new Set([...prev, String(index)]));
  };

  const suggestions = activeDataSource ? [
    "Show me the top 10 rows",
    "What are the key metrics?",
    "Create a chart showing distribution",
    "Summarize this data",
  ] : [
    "What can you help me with?",
  ];

  if (!isConfigured) {
    return (
      <AnimatePresence>
        {isAIPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={closeAIPanel}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
            >
              <div className="mx-4 bg-popover border border-border rounded-2xl shadow-2xl p-6 text-center">
                <IconSparkles size={32} stroke={1.5} className="text-primary mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">AI Not Configured</h3>
                <p className="text-sm text-foreground-muted mb-4">
                  Add your Anthropic API key in settings to use AI features.
                </p>
                <motion.button 
                  onClick={closeAIPanel} 
                  className="px-4 py-2 bg-secondary hover:bg-secondary-hover rounded-lg text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isAIPanelOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={closeAIPanel}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <div className="mx-4 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <IconSparkles size={18} stroke={1.5} className="text-primary" />
                  <span className="font-medium text-sm text-foreground">Ask AI</span>
                  {activeDataSource && (
                    <span className="text-[10px] px-2 py-0.5 bg-secondary rounded-full text-foreground-muted">
                      {activeDataSource.tableName}
                    </span>
                  )}
                </div>
                <motion.button 
                  onClick={closeAIPanel} 
                  className="p-1.5 hover:bg-accent rounded-lg"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <IconX size={14} stroke={2} />
                </motion.button>
              </div>

              <form onSubmit={handleSubmit} className="p-3 border-b border-border">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={activeDataSource ? "Ask about your data..." : "Drop a file first..."}
                    disabled={isLoading}
                    className="w-full px-4 py-3 pr-12 bg-background border border-border rounded-xl text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                  <motion.button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-30"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isLoading ? (
                      <IconLoader2 size={14} stroke={2} className="animate-spin" />
                    ) : (
                      <IconArrowRight size={14} stroke={2.5} />
                    )}
                  </motion.button>
                </div>
              </form>

              <div className="max-h-[400px] overflow-y-auto">
                <AnimatePresence mode="wait">
                  {response ? (
                    <motion.div 
                      className="p-4 space-y-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {response.text}
                      </div>

                      {response.sql && (
                        <motion.div 
                          className="p-3 bg-background rounded-xl border border-border"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <div className="flex items-center gap-2 mb-2 text-[10px] text-foreground-muted uppercase tracking-wider">
                            <IconCode size={12} stroke={1.5} />
                            SQL Query
                          </div>
                          <pre className="text-xs text-foreground-muted font-mono overflow-x-auto">
                            {response.sql}
                          </pre>
                        </motion.div>
                      )}

                      {response.actions && response.actions.length > 0 && (
                        <motion.div 
                          className="flex flex-wrap gap-2 pt-2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          {response.actions.map((action, i) => (
                            <motion.button
                              key={i}
                              onClick={() => executeAction(action, i)}
                              disabled={executedActions.has(String(i))}
                              className={clsx(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium",
                                executedActions.has(String(i))
                                  ? "bg-success/10 text-success border border-success/20"
                                  : "bg-primary text-primary-foreground hover:bg-primary-hover"
                              )}
                              whileHover={!executedActions.has(String(i)) ? { scale: 1.02 } : {}}
                              whileTap={!executedActions.has(String(i)) ? { scale: 0.98 } : {}}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 + i * 0.05 }}
                            >
                              {executedActions.has(String(i)) ? (
                                <>
                                  <IconCircleCheckFilled size={14} />
                                  Added
                                </>
                              ) : (
                                <>
                                  <IconPlus size={14} stroke={2.5} />
                                  {action.label}
                                </>
                              )}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}

                      <motion.button
                        onClick={() => {
                          setResponse(null);
                          setExecutedActions(new Set());
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        className="text-xs text-foreground-muted hover:text-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        whileHover={{ x: 3 }}
                      >
                        Ask another question
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      className="p-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <p className="text-[10px] text-foreground-muted uppercase tracking-wider px-1 mb-2">
                        Suggestions
                      </p>
                      <div className="space-y-1">
                        {suggestions.map((suggestion, i) => (
                          <motion.button
                            key={i}
                            onClick={() => {
                              setInput(suggestion);
                              inputRef.current?.focus();
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-foreground-muted hover:bg-accent hover:text-foreground"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            whileHover={{ x: 4 }}
                          >
                            <IconBolt size={12} stroke={2} className="inline mr-2 text-primary" />
                            {suggestion}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
