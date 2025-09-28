import React, { useState, useEffect } from "react";
import {
  Package,
  Download,
  Check,
  Search,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";

import { usePythonStore } from "@/store/pythonStore";
import { Button } from "@/components/ui/Button";

interface PackageInfo {
  name: string;
  version?: string;
  description?: string;
  isInstalled: boolean;
  isInstalling: boolean;
}

// Common data science packages
const POPULAR_PACKAGES: Omit<PackageInfo, 'isInstalled' | 'isInstalling'>[] = [
  { name: "scikit-learn", description: "Machine learning library" },
  { name: "scipy", description: "Scientific computing library" },
  { name: "requests", description: "HTTP library" },
  { name: "pillow", description: "Image processing library" },
  { name: "lxml", description: "XML processing library" },
  { name: "statsmodels", description: "Statistical modeling" },
  // { name: "beautifulsoup4", description: "HTML/XML parsing" },
  // { name: "openpyxl", description: "Excel file handling" },
];

/**
 * Package manager component for installing Python packages in Pyodide
 */
const PackageManager: React.FC = () => {
  const {
    pyodide,
    installedPackages,
    installPythonPackage,
    refreshInstalledPackages,
  } = usePythonStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [customPackage, setCustomPackage] = useState("");
  const [installingPackages, setInstallingPackages] = useState<Set<string>>(new Set());
  const [errorMessages, setErrorMessages] = useState<Map<string, string>>(new Map());
  const [showInstalled, setShowInstalled] = useState(false);

  // Refresh installed packages on mount
  useEffect(() => {
    if (pyodide.isInitialized) {
      refreshInstalledPackages();
    }
  }, [pyodide.isInitialized, refreshInstalledPackages]);

  // Create package list with installation status
  const packageList: PackageInfo[] = POPULAR_PACKAGES.map(pkg => ({
    ...pkg,
    version: installedPackages.get(pkg.name) || undefined,
    isInstalled: installedPackages.has(pkg.name),
    isInstalling: installingPackages.has(pkg.name),
  }));

  // Filter packages based on search and installed status
  const filteredPackages = packageList.filter(pkg => {
    const matchesSearch = searchQuery === "" || 
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pkg.description && pkg.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = !showInstalled || pkg.isInstalled;
    
    return matchesSearch && matchesFilter;
  });

  const handleInstallPackage = async (packageName: string) => {
    if (!pyodide.isInitialized || installingPackages.has(packageName)) {
      return;
    }

    setInstallingPackages(prev => new Set(prev).add(packageName));
    setErrorMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(packageName);
      return newMap;
    });

    try {
      await installPythonPackage(packageName);
      console.log(`Successfully installed ${packageName}`);
      // Refresh installed packages to update UI
      await refreshInstalledPackages();
    } catch (error) {
      console.error(`Failed to install ${packageName}:`, error);
      setErrorMessages(prev => new Map(prev).set(
        packageName, 
        error instanceof Error ? error.message : 'Installation failed'
      ));
    } finally {
      setInstallingPackages(prev => {
        const newSet = new Set(prev);
        newSet.delete(packageName);
        return newSet;
      });
    }
  };

  const handleInstallCustomPackage = async () => {
    const packageName = customPackage.trim();
    if (!packageName) return;

    await handleInstallPackage(packageName);
    setCustomPackage("");
  };

  const getInstalledPackagesList = () => {
    return Array.from(installedPackages.entries()).map(([name, version]) => ({
      name,
      version,
    }));
  };

  if (!pyodide.isInitialized) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Python not initialized</p>
          <p className="text-sm text-muted-foreground">Initialize Python to manage packages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Package Manager</h3>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search packages..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-3 py-1 rounded transition-colors ${
              showInstalled
                ? "bg-primary/20 text-primary"
                : "bg-accent/10 text-muted-foreground hover:bg-accent/20"
            }`}
            onClick={() => setShowInstalled(!showInstalled)}
          >
            Show Installed Only
          </button>
          <span className="text-xs text-muted-foreground">
            {installedPackages.size} installed
          </span>
        </div>
      </div>

      {/* Custom package installation */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-4 h-4 text-secondary" />
          <span className="text-sm font-medium text-foreground">Install Custom Package</span>
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Package name (e.g., requests)"
            className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            value={customPackage}
            onChange={(e) => setCustomPackage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleInstallCustomPackage();
              }
            }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleInstallCustomPackage}
            disabled={!customPackage.trim() || installingPackages.has(customPackage.trim())}
            className="px-3"
          >
            {installingPackages.has(customPackage.trim()) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
        </div>
        {/* TODO: Here we got to put a link for those packages */}
        <div className="mt-2 text-xs text-muted-foreground flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Only pure Python packages or packages with WebAssembly builds
          </span>
        </div>
      </div>

      {/* Package list */}
      <div className="flex-1 overflow-y-auto">
        {filteredPackages.length === 0 ? (
          <div className="p-4 text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No packages found" : "No packages to show"}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.name}
                className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{pkg.name}</span>
                    {pkg.isInstalled && (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-400" />
                        {pkg.version && (
                          <span className="text-xs text-muted-foreground">v{pkg.version}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {pkg.description && (
                    <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                  )}
                  
                  {errorMessages.has(pkg.name) && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 text-red-400" />
                      <span className="text-xs text-red-400">
                        {errorMessages.get(pkg.name)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {pkg.isInstalled ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                      <Check className="w-3 h-3" />
                      <span>Installed</span>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm" 
                      onClick={() => handleInstallPackage(pkg.name)}
                      disabled={pkg.isInstalling}
                      className="h-8 px-3"
                    >
                      {pkg.isInstalling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-1" />
                          <span>Install</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Installed packages summary */}
      {installedPackages.size > 0 && (
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              Installed Packages ({installedPackages.size})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshInstalledPackages}
              className="h-7 px-2 text-xs"
            >
              Refresh
            </Button>
          </div>
          
          <div className="max-h-32 overflow-y-auto">
            <div className="grid grid-cols-1 gap-1">
              {getInstalledPackagesList().slice(0, 10).map(({ name, version }) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-xs bg-accent/5 px-2 py-1 rounded"
                >
                  <span className="text-foreground">{name}</span>
                  <span className="text-muted-foreground">{version}</span>
                </div>
              ))}
            </div>
            
            {installedPackages.size > 10 && (
              <div className="text-xs text-muted-foreground text-center mt-2">
                ... and {installedPackages.size - 10} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PackageManager;