import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export type Tab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
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
  const [indicatorPosition, setIndicatorPosition] = useState({ left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

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
    <div className={`relative ${className}`}>
      <div className="flex space-x-1 relative">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`
              relative px-4 py-2 text-sm rounded-t-md transition-all duration-200 flex items-center cursor-pointer
              ${activeTab === tab.id 
                ? "text-foreground font-medium" 
                : "text-muted-foreground hover:text-foreground"
              }
            `}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Custom animated indicator */}
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
      
      {/* Bottom border for inactive areas */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-border" />
    </div>
  );
};

export default TabNavigation;