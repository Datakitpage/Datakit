import React from 'react';

interface VisualizationCustomizePanelProps {
  liveConfig: any;
  onConfigUpdate: (updates: any) => void;
}

const VisualizationCustomizePanel: React.FC<VisualizationCustomizePanelProps> = ({
  liveConfig,
  onConfigUpdate
}) => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Customize</h3>
      </div>
      <div className="p-4 space-y-6">
        {/* Color Scheme */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-3">
            Color Scheme
          </label>
          <div className="space-y-2">
            {[
              { name: 'cyan', colors: ['#00bfa5', '#26c6da', '#4ac0c0'] },
              { name: 'purple', colors: ['#8b5cf6', '#a78bfa', '#c4b5fd'] },
              { name: 'gradient', colors: ['#00bfa5', '#6bc1d6', '#a78bfa'] }
            ].map((scheme) => (
              <button
                key={scheme.name}
                onClick={() => onConfigUpdate({ colorScheme: scheme.name })}
                className={`w-full flex items-center gap-3 p-3 rounded hover:bg-accent/10 transition-colors ${
                  liveConfig?.colorScheme === scheme.name ? 'bg-primary/20 border border-primary/50' : 'border border-border'
                }`}
              >
                <div className="flex gap-1">
                  {scheme.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground capitalize">{scheme.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizationCustomizePanel;