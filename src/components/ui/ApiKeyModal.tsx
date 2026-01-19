import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconX, IconKey, IconSparkles, IconExternalLink } from "@tabler/icons-react";
import { useAIStore } from "@/store/aiStore";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const { setApiKey, isConfigured, clearApiKey } = useAIStore();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!inputValue.trim()) {
      setError("Please enter an API key");
      return;
    }
    
    if (!inputValue.startsWith("sk-")) {
      setError("Invalid API key format");
      return;
    }

    setApiKey(inputValue.trim());
    setInputValue("");
    setError(null);
    onClose();
  };

  const handleRemove = () => {
    clearApiKey();
    setInputValue("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-md z-50 mx-4"
          >
            <div className="bg-popover border border-border rounded-2xl shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <IconSparkles size={20} stroke={1.5} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">AI Configuration</h3>
                    <p className="text-xs text-foreground-muted">Powered by Anthropic Claude</p>
                  </div>
                </div>
                <motion.button
                  onClick={onClose}
                  className="p-1.5 hover:bg-accent rounded-lg text-foreground-muted"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <IconX size={18} stroke={2} />
                </motion.button>
              </div>

              <div className="p-4 space-y-4">
                <p className="text-sm text-foreground-muted">
                  Enter your Anthropic API key to enable AI-powered dashboard generation.
                  Your key is stored locally and never sent to our servers.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    API Key
                  </label>
                  <div className="relative">
                    <IconKey size={16} stroke={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                    <input
                      type="password"
                      placeholder={isConfigured ? "sk-***********************" : "sk-ant-..."}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        setError(null);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  {error && (
                    <motion.p 
                      className="text-xs text-destructive"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                <motion.a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  whileHover={{ x: 2 }}
                >
                  Get an API key from Anthropic
                  <IconExternalLink size={12} stroke={2} />
                </motion.a>
              </div>

              <div className="flex items-center justify-between p-4 border-t border-border bg-background-subtle rounded-b-2xl">
                {isConfigured ? (
                  <motion.button
                    onClick={handleRemove}
                    className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Remove Key
                  </motion.button>
                ) : (
                  <div />
                )}
                
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground"
                    whileHover={{ x: -2 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isConfigured ? "Update" : "Save"}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
