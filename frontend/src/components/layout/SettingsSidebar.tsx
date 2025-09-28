import React, { useState } from "react";
import { 
  ArrowLeft, 
  User, 
  Trees, 
  Bell, 
  CreditCard, 
  Users, 
  Palette, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Home
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/auth/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@components/ui/Button";

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showSuccess } = useNotifications();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      
      // Show success notification for signout
      showSuccess(
        "Signed out successfully",
        "You've been securely signed out of DataKit.",
        { 
          icon: 'shield',
          duration: 3000
        }
      );
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const tabs = [
    { id: "profile", name: "Profile", icon: User },
    { id: "workspace", name: "Workspace & Team", icon: Users },
    { id: "ai", name: "AI assistant settings", icon: Trees },
    { id: "appearance", name: "Appearance", icon: Palette },
    { id: "notifications", name: "Notifications", icon: Bell },
    { id: "subscription", name: "Subscription", icon: CreditCard },
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Variants for framer-motion animations
  const sidebarVariants = {
    expanded: { width: "16rem" }, // w-64 = 16rem
    collapsed: { width: "4rem" }, // mini sidebar width
  };

  // Render collapsed content
  const renderCollapsedContent = () => (
    <>
      <div className="p-4 border-b border-border">
        {/* Header space for collapsed mode */}
      </div>

      {/* Settings Navigation - Icon Only */}
      <div className="px-2 pt-2 pb-2 flex-1">
        <div className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center justify-center p-3 rounded transition-custom ${
                  activeTab === tab.id
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-accent/5 hover:text-foreground"
                }`}
                title={tab.name}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Home and Sign Out Buttons */}
      <div className="px-2 py-3 space-y-2 border-t border-border">
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-accent/5 rounded transition-custom"
          title="Back to DataKit"
        >
          <Home size={16} />
        </button>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center p-2 text-red-400/60 hover:text-red-400 hover:bg-red-400/5 rounded transition-custom"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  );

  // Render expanded content
  const renderExpandedContent = () => (
    <>
      {/* Header with title - matching main sidebar style */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground transition-custom p-1 cursor-pointer hover:bg-accent/5 rounded"
            aria-label="Back to DataKit"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-foreground font-heading font-medium text-lg">
              Settings
            </h1>
            <p className="text-xs text-muted-foreground">Manage your account</p>
          </div>
        </div>
      </div>

      {/* Settings Navigation */}
      <div className="px-5 pt-2 pb-2 flex-1">
     
        <div className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full text-left flex items-center p-3 rounded text-sm transition-custom ${
                  activeTab === tab.id
                    ? "border border-primary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:bg-opacity-30"
                }`}
              >
                <Icon
                  size={16}
                  className={`mr-3 flex-shrink-0 ${
                    activeTab === tab.id ? "text-foreground" : "text-primary"
                  }`}
                />
                <span className="font-medium">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="px-5 py-3 border-t border-border">
        <Button
        variant="outline"
          onClick={handleLogout}
          className="w-full flex items-center p-3 rounded text-sm text-muted-foreground hover:bg-accent hover:bg-opacity-30 transition-custom"
        >
          <LogOut
            size={16}
            className="mr-1 flex-shrink-0 text-muted-foreground"
          />
          <span className="font-medium">Sign Out</span>
        </Button>
      </div>

      <div className="px-4 py-3 text-center border-t border-border">
        <p className="text-xs text-muted-foreground">
          Powered by DuckDB {" | "}
          <a
            href="https://amin.contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            built
          </a>
          {" @ "}
          <a
            href="https://www.linkedin.com/company/datakitpage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            DataKit
          </a>
        </p>
      </div>
    </>
  );

  return (
    <div className="relative">
      <motion.div
        className="bg-popover flex flex-col h-full border-r border-border overflow-hidden"
        initial={isCollapsed ? "collapsed" : "expanded"}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
      </motion.div>
      
      {/* Collapse/Expand Toggle Button on Border */}
      <button
        onClick={toggleSidebar}
        className="absolute top-4 -right-3 w-6 h-6 bg-popover border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors z-100 shadow-lg"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );
};

export default SettingsSidebar;
