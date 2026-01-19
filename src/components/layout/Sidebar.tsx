import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconLayoutGrid,
  IconDatabase,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconSparkles,
  IconPalette
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useAppStore } from "@/store/appStore";
import { useAIStore } from "@/store/aiStore";
import { ThemePanel } from "../ui/ThemePanel";
import { ApiKeyModal } from "../ui/ApiKeyModal";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const { openCommandPalette } = useAppStore();
  const { isConfigured } = useAIStore();

  const mainItems: SidebarItem[] = [
    { id: "boards", label: "Canvas", icon: <IconLayoutGrid size={18} stroke={1.5} />, active: true },
    { id: "data", label: "Data", icon: <IconDatabase size={18} stroke={1.5} /> },
  ];

  const bottomItems: SidebarItem[] = [
    {
      id: "ai",
      label: isConfigured ? "AI Ready" : "Setup AI",
      icon: <IconSparkles size={18} stroke={1.5} className={isConfigured ? "text-success" : ""} />,
      onClick: () => setShowApiKeyModal(true),
    },
    {
      id: "theme",
      label: "Theme",
      icon: <IconPalette size={18} stroke={1.5} />,
      onClick: () => setShowThemePanel(true),
    },
  ];

  return (
    <>
      <motion.aside 
        className={clsx(
          "h-full bg-background-subtle border-r border-border flex flex-col"
        )}
        initial={false}
        animate={{ width: isCollapsed ? 56 : 192 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Logo */}
        <div className="h-12 flex items-center justify-between px-3 border-b border-border">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div 
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">B</span>
                </div>
                <span className="font-semibold text-sm">Board</span>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-accent text-foreground-muted hover:text-foreground"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isCollapsed ? <IconChevronRight size={16} stroke={2} /> : <IconChevronLeft size={16} stroke={2} />}
          </motion.button>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 py-3 px-2">
          <ul className="space-y-1">
            {mainItems.map((item, index) => (
              <motion.li 
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <motion.button
                  onClick={item.onClick}
                  className={clsx(
                    "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left",
                    item.active 
                      ? "bg-accent text-foreground" 
                      : "text-foreground-muted hover:text-foreground hover:bg-accent",
                    isCollapsed && "justify-center"
                  )}
                  whileHover={{ x: isCollapsed ? 0 : 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {item.icon}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span 
                        className="text-sm"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.li>
            ))}
          </ul>

          {/* Add Widget */}
          <div className="mt-4 px-0.5">
            <motion.button
              onClick={openCommandPalette}
              className={clsx(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg",
                "border border-dashed border-border hover:border-primary",
                "text-foreground-muted hover:text-primary",
                isCollapsed && "justify-center"
              )}
              whileHover={{ scale: 1.02, borderColor: "hsl(var(--primary))" }}
              whileTap={{ scale: 0.98 }}
            >
              <IconPlus size={16} stroke={2} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    className="text-sm"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                  >
                    Add Widget
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </nav>

        {/* Bottom Nav */}
        <div className="py-2 px-2 border-t border-border">
          <ul className="space-y-1">
            {bottomItems.map((item, index) => (
              <motion.li 
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
              >
                <motion.button
                  onClick={item.onClick}
                  className={clsx(
                    "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg",
                    "text-foreground-muted hover:text-foreground hover:bg-accent text-left",
                    isCollapsed && "justify-center"
                  )}
                  whileHover={{ x: isCollapsed ? 0 : 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {item.icon}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span 
                        className="text-sm"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.aside>

      <ThemePanel isOpen={showThemePanel} onClose={() => setShowThemePanel(false)} />
      <ApiKeyModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
    </>
  );
}
