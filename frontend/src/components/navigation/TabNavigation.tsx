import { useState, useEffect } from "react";
import { motion } from "framer-motion";

import AIAssistant from "./AIAssistant";

export type Tab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  isAI?: boolean;
};

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onChange,
  className = "",
}) => {
  const [indicatorPosition, setIndicatorPosition] = useState({
    left: 0,
    width: 0,
  });
  const [mounted, setMounted] = useState(false);

  // Separate regular tabs from AI assistant
  const regularTabs = tabs.filter((tab) => !tab.isAI);
  const hasAITab = tabs.some((tab) => tab.isAI);

  // Update indicator position when active tab changes
  useEffect(() => {
    if (mounted) {
      const activeEl = document.getElementById(`tab-${activeTab}`);
      if (activeEl) {
        setIndicatorPosition({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    }
  }, [activeTab, mounted]);

  // Initialize after mount
  useEffect(() => {
    setMounted(true);
    const activeEl = document.getElementById(`tab-${activeTab}`);
    if (activeEl) {
      setIndicatorPosition({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, []);

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Regular Tabs Container */}
      <div className="flex space-x-1 relative">
        {regularTabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`
              relative px-4 py-2 text-sm rounded-t-md transition-all duration-200 flex items-center cursor-pointer
              ${
                activeTab === tab.id
                  ? "text-white font-medium"
                  : "text-white/70 hover:text-white/90"
              }
            `}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}

        {/* Custom animated indicator - only for regular tabs */}
        <motion.div
          className="absolute h-1 bg-gradient-to-r from-primary to-secondary rounded-t"
          initial={false}
          animate={{
            left: indicatorPosition.left,
            width: indicatorPosition.width,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ bottom: 0 }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/10" />
      </div>
      {hasAITab && (
        <div className="pl-4 relative flex-1 ">
          <AIAssistant className="relative" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/10" />
        </div>
      )}
    </div>
  );
};

export default TabNavigation;
