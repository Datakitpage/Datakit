import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconX } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useAppStore } from "@/store/appStore";

const ACCENT_COLORS = [
  { name: "Gray", value: "hsl(240 5% 46%)" },
  { name: "Blue", value: "hsl(221 83% 53%)" },
  { name: "Purple", value: "hsl(271 81% 56%)" },
  { name: "Green", value: "hsl(142 71% 45%)" },
  { name: "Orange", value: "hsl(24 95% 53%)" },
  { name: "Pink", value: "hsl(330 81% 60%)" },
];

const RADIUS_OPTIONS = ["none", "sm", "md", "lg"] as const;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, updateTheme } = useAppStore();
  const [localTheme, setLocalTheme] = useState(theme);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional prop-to-state sync when modal opens
    setLocalTheme(theme);
  }, [theme, isOpen]);

  useEffect(() => {
    if (localTheme.primaryColor) {
      document.documentElement.style.setProperty("--primary", localTheme.primaryColor);
      document.documentElement.style.setProperty("--primary-hover", localTheme.primaryColor.replace("53%", "60%"));
    }

    const radiusMap = { none: "0", sm: "0.125rem", md: "0.375rem", lg: "0.5rem" };
    document.documentElement.style.setProperty("--radius", radiusMap[localTheme.borderRadius] || "0.375rem");
  }, [localTheme]);

  const handleSave = useCallback(() => {
    updateTheme(localTheme);
    onClose();
  }, [localTheme, updateTheme, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, handleSave]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[380px] z-50"
          >
            <div className="mx-4 bg-popover border border-border/50 rounded-xl shadow-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <span className="text-sm font-medium text-foreground">Settings</span>
                <button
                  onClick={onClose}
                  className="p-1.5 -mr-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <IconX size={16} stroke={2} />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 py-6 space-y-6">
                {/* Accent Color */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-foreground-muted">Accent</span>
                  <div className="flex gap-2.5">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setLocalTheme({ ...localTheme, primaryColor: color.value })}
                        className={clsx(
                          "w-7 h-7 rounded-full transition-all",
                          localTheme.primaryColor === color.value
                            ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-popover"
                            : "hover:ring-2 hover:ring-foreground/20 hover:ring-offset-2 hover:ring-offset-popover"
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Border Radius */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-foreground-muted">Corners</span>
                  <div className="flex bg-secondary/50 rounded-lg p-1">
                    {RADIUS_OPTIONS.map((radius) => (
                      <button
                        key={radius}
                        onClick={() => setLocalTheme({ ...localTheme, borderRadius: radius })}
                        className={clsx(
                          "px-3 py-1.5 text-xs rounded-md transition-colors",
                          localTheme.borderRadius === radius
                            ? "bg-popover text-foreground shadow-sm"
                            : "text-foreground-muted hover:text-foreground"
                        )}
                      >
                        {radius === "none" ? "Sharp" : radius.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-secondary/20">
                <span className="text-[11px] text-foreground-muted/60">⌘↵ to save</span>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-3.5 py-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-3.5 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
