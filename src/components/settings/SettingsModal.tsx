import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconX, IconPalette, IconCheck } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useAppStore } from "@/store/appStore";

const ACCENT_COLORS = [
  { name: "Blue", value: "hsl(221 83% 53%)", class: "bg-blue-500" },
  { name: "Purple", value: "hsl(271 81% 56%)", class: "bg-purple-500" },
  { name: "Green", value: "hsl(142 71% 45%)", class: "bg-green-500" },
  { name: "Orange", value: "hsl(24 95% 53%)", class: "bg-orange-500" },
  { name: "Pink", value: "hsl(330 81% 60%)", class: "bg-pink-500" },
  { name: "Cyan", value: "hsl(186 94% 41%)", class: "bg-cyan-500" },
];

const BORDER_RADIUS_OPTIONS = [
  { name: "None", value: "none", preview: "rounded-none" },
  { name: "Small", value: "sm", preview: "rounded-sm" },
  { name: "Medium", value: "md", preview: "rounded-md" },
  { name: "Large", value: "lg", preview: "rounded-lg" },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, updateTheme } = useAppStore();
  const [localTheme, setLocalTheme] = useState(theme);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme, isOpen]);

  useEffect(() => {
    if (localTheme.primaryColor) {
      document.documentElement.style.setProperty("--primary", localTheme.primaryColor);
      document.documentElement.style.setProperty("--primary-hover", localTheme.primaryColor.replace("53%", "60%"));
    }
    
    const radiusMap = { none: "0", sm: "0.25rem", md: "0.5rem", lg: "0.75rem" };
    document.documentElement.style.setProperty("--radius", radiusMap[localTheme.borderRadius] || "0.5rem");
  }, [localTheme]);

  const handleSave = () => {
    updateTheme(localTheme);
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
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-md z-50"
          >
            <div className="mx-4 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <IconPalette size={20} stroke={1.5} className="text-primary" />
                  <h2 className="text-base font-medium text-foreground">Theme Settings</h2>
                </div>
                <motion.button
                  onClick={onClose}
                  className="p-1.5 hover:bg-secondary rounded-lg text-foreground-muted hover:text-foreground"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <IconX size={16} stroke={2} />
                </motion.button>
              </div>

              <div className="p-5 space-y-6">
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Accent Color
                  </label>
                  <div className="flex gap-2">
                    {ACCENT_COLORS.map((color) => (
                      <motion.button
                        key={color.name}
                        onClick={() => setLocalTheme({ ...localTheme, primaryColor: color.value })}
                        className={clsx(
                          "w-9 h-9 rounded-full relative",
                          "ring-2 ring-offset-2 ring-offset-popover",
                          localTheme.primaryColor === color.value
                            ? "ring-foreground scale-110"
                            : "ring-transparent"
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {localTheme.primaryColor === color.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <IconCheck size={16} stroke={3} className="text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Border Radius
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {BORDER_RADIUS_OPTIONS.map((option) => (
                      <motion.button
                        key={option.value}
                        onClick={() => setLocalTheme({ ...localTheme, borderRadius: option.value as any })}
                        className={clsx(
                          "p-3 border text-center",
                          option.preview,
                          localTheme.borderRadius === option.value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border hover:border-border-hover text-foreground-muted hover:text-foreground"
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={clsx("w-6 h-6 bg-foreground-muted/30 mx-auto mb-2", option.preview)} />
                        <span className="text-xs">{option.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="p-4 border border-border rounded-xl bg-background">
                  <p className="text-xs text-foreground-muted mb-2">Preview</p>
                  <motion.button
                    className="px-4 py-2 text-sm font-medium text-primary-foreground"
                    style={{ 
                      backgroundColor: localTheme.primaryColor,
                      borderRadius: { none: "0", sm: "0.25rem", md: "0.5rem", lg: "0.75rem" }[localTheme.borderRadius]
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sample Button
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-secondary/30">
                <motion.button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground"
                  whileHover={{ x: -2 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Save Changes
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
