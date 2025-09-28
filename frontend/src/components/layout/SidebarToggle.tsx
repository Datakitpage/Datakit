import React from "react";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { useAppStore } from "@/store/appStore";

interface SidebarToggleProps {
  className?: string;
  variant?: "chevron" | "hamburger";
}

/**
 * A reusable toggle button for the sidebar
 */
const SidebarToggle: React.FC<SidebarToggleProps> = ({ 
  className = "", 
  variant = "chevron" 
}) => {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  
  return (
    <button
      onClick={toggleSidebar}
      className={`p-2 rounded hover:bg-accent/20 transition-colors text-muted-foreground hover:text-foreground ${className}`}
      aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {variant === "chevron" ? (
        sidebarCollapsed ? (
          <ChevronRight size={18} />
        ) : (
          <ChevronLeft size={18} />
        )
      ) : (
        <Menu size={18} />
      )}
    </button>
  );
};

export default SidebarToggle;