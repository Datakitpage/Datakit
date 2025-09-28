import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { applyThemeColor } from "@/utils/theme";

interface ThemeColorPickerProps {
  defaultColor?: string;
  variant?: 'default' | 'sidebar';
}

export const ThemeColorPicker = ({
  defaultColor = "#00B8A9",
  variant = 'default',
}: ThemeColorPickerProps) => {
  const [color, setColor] = useState(defaultColor);
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  // Load saved color on mount
  useEffect(() => {
    const savedColor = localStorage.getItem("theme-primary-color");
    if (savedColor) {
      setColor(savedColor);
      applyThemeColor(savedColor);
    }
  }, []);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColor(newColor);
    applyThemeColor(newColor);
    localStorage.setItem("theme-primary-color", newColor);
  };

  const handleToggle = () => {
    if (variant === 'sidebar' && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const presetColors = [
    { color: "#00B8A9", name: "Teal" },
    { color: "#3498db", name: "Blue" },
    { color: "#9b59b6", name: "Purple" },
    { color: "#e74c3c", name: "Red" },
    { color: "#f1c40f", name: "Yellow" },
    { color: "#2ecc71", name: "Green" },
    { color: "#ff6b6b", name: "Coral" },
    { color: "#fff", name: "White" },
  ];

  const renderPanel = () => (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Color Picker Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ 
              type: "keyframes",
              stiffness: 500,
              duration: 0.05
            }}
            className="fixed p-4 bg-popover backdrop-blur-xl border border-border rounded-xl shadow-2xl z-50 w-56"
            style={{
              top: variant === 'sidebar' && buttonRect 
                ? buttonRect.top - 200 // Position above the button
                : undefined,
              left: variant === 'sidebar' && buttonRect 
                ? Math.min(buttonRect.left - 100, window.innerWidth - 240) // Ensure it stays on screen
                : undefined,
            }}
          >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Theme Color</span>
                </div>
                
                {/* TODO: Decision on having this for future or not */}
                {/* Custom Color Picker */}
                {/* <div className="space-y-2">
                  <label className="text-xs text-white/60">Custom Color</label>
                  <input
                    type="color"
                    value={color}
                    onChange={handleColorChange}
                    className="w-full h-10 cursor-pointer border border-white/20 rounded-lg overflow-hidden bg-white/5"
                  />
                </div> */}

                {/* Preset Colors */}
                <div className="space-y-2">
                  <label className="text-xs text-white/60">Presets</label>
                  <div className="grid grid-cols-4 gap-2">
                    {presetColors.map(({ color: presetColor, name }) => (
                      <motion.button
                        key={presetColor}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={`w-10 h-10 rounded-lg border-2 transition-all ${
                          color === presetColor
                            ? 'border-foreground ring-2 ring-foreground/30'
                            : 'border-border hover:border-border/60'
                        }`}
                        style={{ backgroundColor: presetColor }}
                        onClick={() => {
                          setColor(presetColor);
                          applyThemeColor(presetColor);
                          localStorage.setItem("theme-primary-color", presetColor);
                          setIsOpen(false);
                        }}
                        title={name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );

  return (
    <div className="relative flex items-center">
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-1 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        onClick={handleToggle}
      >
        <Palette size={14} />
        <div
          className="w-4 h-4 rounded-full border-2 border-border shadow-sm"
          style={{ backgroundColor: color }}
        ></div>
      </motion.button>

      {/* Render panel directly for default variant */}
      {variant === 'default' && (
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              
              {/* Color Picker Panel */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  duration: 0.2 
                }}
                className="absolute bottom-full left-0 mb-2 p-4 bg-popover backdrop-blur-xl border border-border rounded-xl shadow-2xl z-50 w-56"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Palette size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Theme Color</span>
                  </div>
                  
                  {/* Custom Color Picker */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Custom Color</label>
                    <input
                      type="color"
                      value={color}
                      onChange={handleColorChange}
                      className="w-full h-10 cursor-pointer border border-border rounded-lg overflow-hidden bg-accent/5"
                    />
                  </div>

                  {/* Preset Colors */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Presets</label>
                    <div className="grid grid-cols-4 gap-2">
                      {presetColors.map(({ color: presetColor, name }) => (
                        <motion.button
                          key={presetColor}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className={`w-10 h-10 rounded-lg border-2 transition-all ${
                            color === presetColor
                              ? 'border-foreground ring-2 ring-foreground/30'
                              : 'border-border hover:border-border/60'
                          }`}
                          style={{ backgroundColor: presetColor }}
                          onClick={() => {
                            setColor(presetColor);
                            applyThemeColor(presetColor);
                            localStorage.setItem("theme-primary-color", presetColor);
                            setIsOpen(false);
                          }}
                          title={name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Render panel via portal for sidebar variant */}
      {variant === 'sidebar' && typeof document !== 'undefined' && 
        createPortal(renderPanel(), document.body)
      }
    </div>
  );
};
