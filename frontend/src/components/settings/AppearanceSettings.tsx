import React, { useState, useEffect } from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { ThemeColorPicker } from '@/components/common/ThemeColorPicker';
import { applyThemeColor } from '@/utils/theme';

const AppearanceSettings: React.FC = () => {
  const [currentColor, setCurrentColor] = useState('#00B8A9');

  useEffect(() => {
    const savedColor = localStorage.getItem('theme-primary-color');
    if (savedColor) {
      setCurrentColor(savedColor);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme-primary-color' && e.newValue) {
        setCurrentColor(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const savedColor = localStorage.getItem('theme-primary-color');
      if (savedColor && savedColor !== currentColor) {
        setCurrentColor(savedColor);
      }
    }, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [currentColor]);

  const presetThemes = [
    { name: 'DataKit Teal', color: '#00B8A9' },
    { name: 'Ocean Blue', color: '#3498db' },
    { name: 'Royal Purple', color: '#9b59b6' },
    { name: 'Vibrant Red', color: '#e74c3c' },
    { name: 'Forest Green', color: '#2ecc71' },
    { name: 'Coral Pink', color: '#ff6b6b' },
  ];

  const handleThemeSelect = (color: string) => {
    setCurrentColor(color);
    applyThemeColor(color);
    localStorage.setItem('theme-primary-color', color);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-1">Appearance</h3>
        <p className="text-sm text-muted-foreground">Customize DataKit's theme color</p>
      </div>

      <div className="bg-accent/5 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-md border border-border"
              style={{ backgroundColor: currentColor }}
            />
            <div>
              <div className="text-sm font-medium text-foreground">Current</div>
              <div className="text-xs text-muted-foreground">{currentColor.toUpperCase()}</div>
            </div>
          </div>
          <ThemeColorPicker />
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {presetThemes.map((theme) => (
            <button
              key={theme.color}
              onClick={() => handleThemeSelect(theme.color)}
              className={`p-2 rounded-md border transition-all text-left hover:border-border ${
                currentColor === theme.color
                  ? 'bg-accent/10 border-primary/50'
                  : 'bg-accent/5 border-border'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm border border-border flex-shrink-0"
                  style={{ backgroundColor: theme.color }}
                />
                <div className="text-xs text-foreground truncate">
                  {theme.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="opacity-50 cursor-not-allowed">
          <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Display Mode
          </h4>
          <p className="text-xs text-muted-foreground mb-3">Coming Soon</p>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-md bg-accent/5 border border-border text-center">
              <Monitor className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">System</div>
            </div>
            <div className="p-2 rounded-md bg-accent/5 border border-border text-center">
              <Sun className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">Light</div>
            </div>
            <div className="p-2 rounded-md bg-accent/10 border border-primary/30 text-center">
              <Moon className="h-4 w-4 mx-auto mb-1 text-primary/60" />
              <div className="text-xs text-primary/60">Dark</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;