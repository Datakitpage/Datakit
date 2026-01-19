import { AnimatePresence, motion } from "framer-motion";
import { IconX, IconCheck } from "@tabler/icons-react";
import { useThemeStore } from "@/store/themeStore";
import { clsx } from "clsx";

interface ThemePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemePanel({ isOpen, onClose }: ThemePanelProps) {
  const { activeTheme, themes, setTheme } = useThemeStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">Theme</span>
              <motion.button 
                onClick={onClose} 
                className="p-1 hover:bg-accent rounded-lg text-foreground-muted"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <IconX size={16} stroke={2} />
              </motion.button>
            </div>

            <div className="p-4 space-y-3">
              {Object.entries(themes).map(([key, theme], index) => (
                <motion.button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={clsx(
                    "w-full flex items-center gap-3 p-3 rounded-xl border",
                    activeTheme === key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground-muted hover:bg-accent/50"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 2 }}
                >
                  <div className="flex gap-1">
                    <div 
                      className="w-5 h-5 rounded-full border border-white/10"
                      style={{ backgroundColor: "hsl(" + theme.background + ")" }}
                    />
                    <div 
                      className="w-5 h-5 rounded-full border border-white/10"
                      style={{ backgroundColor: "hsl(" + theme.primary + ")" }}
                    />
                  </div>
                  
                  <span className="flex-1 text-left text-sm text-foreground">{theme.name}</span>
                  
                  {activeTheme === key && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <IconCheck size={16} stroke={2.5} className="text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>

            <div className="px-4 pb-4">
              <p className="text-[10px] text-foreground-subtle text-center">
                Theme changes apply instantly
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
