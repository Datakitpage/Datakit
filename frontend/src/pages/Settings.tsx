import React, { useState, useEffect } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthStore } from "@/store/authStore";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SettingsSidebar from "@/components/layout/SettingsSidebar";
import WorkspaceSettings from "@/components/settings/WorkspaceSettings";
import AISettings from "@/components/settings/AISettings";
import AppearanceSettings from "@/components/settings/AppearanceSettings";
import SubscriptionSettings from "@/components/settings/SubscriptionSettings";
import { SEO } from "@/components/common/SEO";

const Settings: React.FC = () => {
  const { user, updateProfile, updateSettings, settings, isLoading } =
    useAuth();
  const { currentWorkspace } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Get initial tab from URL hash or default to "profile"
  const getInitialTab = () => {
    const hash = location.hash.replace("#", "");
    const validTabs = [
      "profile",
      "workspace",
      "ai",
      "appearance",
      "notifications",
      "subscription",
    ];
    return validTabs.includes(hash) ? hash : "profile";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  const [preferencesData, setPreferencesData] = useState({
    defaultAIProvider: settings?.defaultAIProvider || "openai",
    defaultModel: settings?.defaultModel || "gpt-4",
    theme: settings?.theme || "dark",
    emailNotifications: settings?.emailNotifications ?? true,
    usageAlerts: settings?.usageAlerts ?? true,
  });

  // Handle URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const newTab = getInitialTab();
      setActiveTab(newTab);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    navigate(`/settings#${tabId}`, { replace: true });
  };

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        name: profileData.name,
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handlePreferencesUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(preferencesData);
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">
                Profile Information
              </h3>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background/20 border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-3 py-2 bg-background/10 border border-border rounded-md text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>

                <Button variant="outline" type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </div>
          </div>
        );

      case "workspace":
        return <WorkspaceSettings />;

      case "ai":
        return <AISettings onTabChange={handleTabChange} />;

      case "appearance":
        return <AppearanceSettings />;

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Email Notifications
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Receive updates about new features and announcements
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferencesData.emailNotifications}
                      onChange={(e) =>
                        setPreferencesData((prev) => ({
                          ...prev,
                          emailNotifications: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Usage Alerts
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Get notified when you're close to your credit limit
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferencesData.usageAlerts}
                      onChange={(e) =>
                        setPreferencesData((prev) => ({
                          ...prev,
                          usageAlerts: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <Button
                  variant="outline"
                  onClick={handlePreferencesUpdate}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Notification Settings"}
                </Button>
              </div>
            </div>
          </div>
        );

      case "subscription":
        return <SubscriptionSettings />;

      default:
        return null;
    }
  };

  return (
    <ProtectedRoute>
      <>
        <SEO
          title="Settings - DataKit"
          description="Manage your DataKit account settings, AI preferences, notifications, and subscription"
          keywords="settings, profile, ai settings, notifications, subscription, datakit"
        />

        <div className="flex h-screen bg-background overflow-hidden">
          {/* Settings Sidebar */}
          <SettingsSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          {/* Main Content Area */}
          <div className="flex-1 h-full overflow-hidden flex items-center justify-center">
            <div className="w-full max-w-6xl p-8">
              <div className="bg-popover rounded-lg p-8">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </>
    </ProtectedRoute>
  );
};

export default Settings;
