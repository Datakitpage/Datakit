import { AnimatePresence, motion } from "framer-motion";
import { IconX, IconDroplet, IconSquare, IconCircleHalf } from "@tabler/icons-react";
import { Widget, useBoardStore } from "@/store/boardStore";
import { clsx } from "clsx";
import { useState } from "react";

interface WidgetStylePanelProps {
  widget: Widget;
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "fill" | "stroke" | "effects";

const COLORS = [
  { name: "Default", value: undefined },
  { name: "Subtle", value: "hsl(220 13% 10%)" },
  { name: "Elevated", value: "hsl(220 13% 12%)" },
  { name: "Primary", value: "hsl(221 83% 53% / 0.1)" },
  { name: "Success", value: "hsl(142 76% 36% / 0.1)" },
  { name: "Warning", value: "hsl(38 92% 50% / 0.1)" },
  { name: "Danger", value: "hsl(0 84% 60% / 0.1)" },
];

const BORDER_COLORS = [
  { name: "Default", value: undefined },
  { name: "Subtle", value: "hsl(0 0% 100% / 0.05)" },
  { name: "Medium", value: "hsl(0 0% 100% / 0.12)" },
  { name: "Primary", value: "hsl(221 83% 53% / 0.3)" },
  { name: "Success", value: "hsl(142 76% 36% / 0.3)" },
];

const BORDER_RADIUS = [
  { name: "0", value: "0" },
  { name: "4", value: "4px" },
  { name: "8", value: "8px" },
  { name: "12", value: "12px" },
  { name: "16", value: "16px" },
];

const BORDER_WIDTH = [
  { name: "0", value: "0px" },
  { name: "1", value: "1px" },
  { name: "2", value: "2px" },
];

const PADDING = [
  { name: "0", value: "0" },
  { name: "8", value: "8px" },
  { name: "12", value: "12px" },
  { name: "16", value: "16px" },
  { name: "24", value: "24px" },
];

const SHADOWS = [
  { name: "None", value: "none" },
  { name: "SM", value: "0 1px 2px rgba(0,0,0,0.2)" },
  { name: "MD", value: "0 4px 6px rgba(0,0,0,0.25)" },
  { name: "LG", value: "0 10px 15px rgba(0,0,0,0.3)" },
  { name: "XL", value: "0 20px 25px rgba(0,0,0,0.35)" },
];

const OPACITY = [
  { name: "100%", value: "1" },
  { name: "90%", value: "0.9" },
  { name: "80%", value: "0.8" },
  { name: "70%", value: "0.7" },
  { name: "50%", value: "0.5" },
];

const PRESETS = [
  { name: "Default", style: {} },
  { name: "Card", style: { backgroundColor: "hsl(220 13% 10%)", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.25)" } },
  { name: "Elevated", style: { backgroundColor: "hsl(220 13% 12%)", borderRadius: "8px", boxShadow: "0 10px 15px rgba(0,0,0,0.3)" } },
  { name: "Accent", style: { backgroundColor: "hsl(221 83% 53% / 0.1)", borderColor: "hsl(221 83% 53% / 0.3)", borderRadius: "8px" } },
];

export function WidgetStylePanel({ widget, isOpen, onClose }: WidgetStylePanelProps) {
  const { updateWidget } = useBoardStore();
  const [activeTab, setActiveTab] = useState<TabId>("fill");
  
  const currentStyle = widget.style || {};

  const updateStyle = (key: string, value: string | undefined) => {
    updateWidget(widget.id, {
      style: { ...currentStyle, [key]: value },
    });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    updateWidget(widget.id, { style: preset.style });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "fill", label: "Fill", icon: <IconDroplet size={14} stroke={1.5} /> },
    { id: "stroke", label: "Stroke", icon: <IconSquare size={14} stroke={1.5} /> },
    { id: "effects", label: "Effects", icon: <IconCircleHalf size={14} stroke={1.5} /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed right-4 top-20 w-64 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <span className="text-xs font-medium text-foreground">Style</span>
              <motion.button 
                onClick={onClose} 
                className="p-1 hover:bg-accent rounded-lg text-foreground-muted"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <IconX size={14} stroke={2} />
              </motion.button>
            </div>

            <div className="px-3 pt-3 pb-2">
              <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Presets</label>
              <div className="flex gap-1">
                {PRESETS.map((preset) => (
                  <motion.button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="flex-1 py-1.5 text-[10px] rounded-lg border border-border hover:border-primary hover:bg-accent/50 text-foreground-muted hover:text-foreground"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {preset.name}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="flex border-b border-border px-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium border-b-2 -mb-px",
                    activeTab === tab.id
                      ? "text-primary border-primary"
                      : "text-foreground-muted border-transparent hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-3 space-y-4 max-h-80 overflow-y-auto">
              {activeTab === "fill" && (
                <>
                  <div>
                    <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Background</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((color) => (
                        <motion.button
                          key={color.name}
                          onClick={() => updateStyle("backgroundColor", color.value)}
                          className={clsx(
                            "w-6 h-6 rounded-lg border",
                            currentStyle.backgroundColor === color.value
                              ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                              : "border-border hover:border-foreground-muted"
                          )}
                          style={{ backgroundColor: color.value || "var(--card)" }}
                          title={color.name}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Padding</label>
                    <div className="flex gap-0.5">
                      {PADDING.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => updateStyle("padding", p.value)}
                          className={clsx(
                            "flex-1 py-1 text-[10px] rounded-lg",
                            currentStyle.padding === p.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground-muted hover:text-foreground"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "stroke" && (
                <>
                  <div>
                    <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Border Color</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BORDER_COLORS.map((color) => (
                        <motion.button
                          key={color.name}
                          onClick={() => updateStyle("borderColor", color.value)}
                          className={clsx(
                            "w-6 h-6 rounded-lg",
                            currentStyle.borderColor === color.value && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                          )}
                          style={{ 
                            border: "2px solid " + (color.value || "var(--border)"),
                            backgroundColor: "var(--background)",
                          }}
                          title={color.name}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Border Width</label>
                    <div className="flex gap-0.5">
                      {BORDER_WIDTH.map((w) => (
                        <button
                          key={w.name}
                          onClick={() => updateStyle("borderWidth", w.value)}
                          className={clsx(
                            "flex-1 py-1 text-[10px] rounded-lg",
                            currentStyle.borderWidth === w.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground-muted hover:text-foreground"
                          )}
                        >
                          {w.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Corner Radius</label>
                    <div className="flex gap-0.5">
                      {BORDER_RADIUS.map((r) => (
                        <button
                          key={r.name}
                          onClick={() => updateStyle("borderRadius", r.value)}
                          className={clsx(
                            "flex-1 py-1 text-[10px] rounded-lg",
                            currentStyle.borderRadius === r.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground-muted hover:text-foreground"
                          )}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "effects" && (
                <>
                  <div>
                    <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Shadow</label>
                    <div className="flex gap-0.5">
                      {SHADOWS.map((s) => (
                        <button
                          key={s.name}
                          onClick={() => updateStyle("boxShadow", s.value)}
                          className={clsx(
                            "flex-1 py-1 text-[10px] rounded-lg",
                            currentStyle.boxShadow === s.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground-muted hover:text-foreground"
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Opacity</label>
                    <div className="flex gap-0.5">
                      {OPACITY.map((o) => (
                        <button
                          key={o.name}
                          onClick={() => updateStyle("opacity", o.value)}
                          className={clsx(
                            "flex-1 py-1 text-[10px] rounded-lg",
                            currentStyle.opacity === o.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground-muted hover:text-foreground"
                          )}
                        >
                          {o.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-3 pb-3 pt-1 border-t border-border">
              <motion.button
                onClick={() => updateWidget(widget.id, { style: {} })}
                className="w-full py-1.5 text-[10px] text-foreground-muted hover:text-foreground border border-border rounded-lg hover:bg-accent"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                Reset All
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
