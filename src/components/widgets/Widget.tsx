import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { IconGripVertical, IconX, IconPalette, IconCircleFilled } from "@tabler/icons-react";
import { Widget as WidgetType, useBoardStore, Connection } from "@/store/boardStore";
import { MetricWidget } from "./MetricWidget";
import { ChartWidget } from "./ChartWidget";
import { TableWidget } from "./TableWidget";
import { TextWidget } from "./TextWidget";
import { WidgetStylePanel } from "./WidgetStylePanel";

interface WidgetProps {
  widget: WidgetType;
  index: number;
}

const GRID_UNIT = 80;

const handles: Array<{ position: Connection["sourceHandle"]; className: string }> = [
  { position: "top", className: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
  { position: "right", className: "top-1/2 right-0 -translate-y-1/2 translate-x-1/2" },
  { position: "bottom", className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" },
  { position: "left", className: "top-1/2 left-0 -translate-y-1/2 -translate-x-1/2" },
];

export function Widget({ widget, index }: WidgetProps) {
  const { 
    selectedWidgetId, 
    selectWidget, 
    removeWidget, 
    moveWidget, 
    resizeWidget,
    connectingFrom,
    startConnecting,
    endConnecting,
    addConnection
  } = useBoardStore();
  
  const isSelected = selectedWidgetId === widget.id;
  const widgetRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, widgetX: 0, widgetY: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const pixelPosition = {
    x: widget.position.x * GRID_UNIT,
    y: widget.position.y * GRID_UNIT,
    width: widget.position.width * GRID_UNIT,
    height: widget.position.height * GRID_UNIT,
  };

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      widgetX: widget.position.x,
      widgetY: widget.position.y,
    });
    selectWidget(widget.id);
  }, [widget.position.x, widget.position.y, widget.id, selectWidget]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: widget.position.width,
      h: widget.position.height,
    });
  }, [widget.position.width, widget.position.height]);

  // Handle connection
  const handleHandleMouseDown = useCallback((e: React.MouseEvent, handle: Connection["sourceHandle"]) => {
    e.preventDefault();
    e.stopPropagation();
    startConnecting(widget.id, handle);
  }, [widget.id, startConnecting]);

  const handleHandleMouseUp = useCallback((handle: Connection["sourceHandle"]) => {
    if (connectingFrom && connectingFrom.widgetId !== widget.id) {
      addConnection(connectingFrom.widgetId, widget.id, connectingFrom.handle, handle);
    }
    endConnecting();
  }, [connectingFrom, widget.id, addConnection, endConnecting]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragStart.x) / GRID_UNIT;
        const dy = (e.clientY - dragStart.y) / GRID_UNIT;
        moveWidget(widget.id, {
          x: Math.max(0, Math.round(dragStart.widgetX + dx)),
          y: Math.max(0, Math.round(dragStart.widgetY + dy)),
        });
      }
      
      if (isResizing) {
        const dx = (e.clientX - resizeStart.x) / GRID_UNIT;
        const dy = (e.clientY - resizeStart.y) / GRID_UNIT;
        resizeWidget(widget.id, {
          width: Math.max(2, Math.round(resizeStart.w + dx)),
          height: Math.max(2, Math.round(resizeStart.h + dy)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, widget.id, moveWidget, resizeWidget]);

  const renderContent = () => {
    switch (widget.type) {
      case "metric":
        return <MetricWidget config={widget.config} />;
      case "chart":
        return <ChartWidget config={widget.config} />;
      case "table":
        return <TableWidget config={widget.config} />;
      case "text":
        return <TextWidget config={widget.config} />;
      default:
        return <div className="text-foreground-muted text-sm">Unknown widget</div>;
    }
  };

  const customStyles = widget.style || {};

  return (
    <>
      <motion.div
        ref={widgetRef}
        layout
        onClick={() => selectWidget(widget.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          "absolute group",
          "bg-card border rounded-xl overflow-visible",
          isSelected ? "ring-2 ring-primary shadow-xl z-10" : "border-border hover:border-primary/30",
          (isDragging || isResizing) && "cursor-grabbing z-20"
        )}
        style={{
          left: pixelPosition.x,
          top: pixelPosition.y,
          width: pixelPosition.width,
          height: pixelPosition.height,
          backgroundColor: customStyles.backgroundColor,
          borderColor: customStyles.borderColor,
          borderRadius: customStyles.borderRadius,
          borderWidth: customStyles.borderWidth,
          boxShadow: customStyles.boxShadow,
          opacity: customStyles.opacity,
        }}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ 
          opacity: isDragging ? 0.85 : 1, 
          scale: isDragging ? 1.02 : 1, 
          y: 0,
          boxShadow: isSelected 
            ? "0 20px 40px -12px rgba(0, 0, 0, 0.25)" 
            : "0 4px 12px -4px rgba(0, 0, 0, 0.1)"
        }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30,
          delay: index * 0.05
        }}
      >
        {/* Connection Handles */}
        {(isSelected || isHovered || connectingFrom) && handles.map((handle) => (
          <motion.div
            key={handle.position}
            className={clsx(
              "absolute w-3 h-3 rounded-full cursor-crosshair z-20",
              "flex items-center justify-center",
              "bg-background border-2 border-primary",
              "hover:scale-125 hover:bg-primary",
              handle.className,
              connectingFrom && connectingFrom.widgetId !== widget.id && "animate-pulse"
            )}
            onMouseDown={(e) => handleHandleMouseDown(e, handle.position)}
            onMouseUp={() => handleHandleMouseUp(handle.position)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          />
        ))}

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0">
            <motion.div
              onMouseDown={handleDragStart}
              className={clsx(
                "cursor-grab text-foreground-subtle hover:text-foreground",
                "opacity-0 group-hover:opacity-100",
                isDragging && "cursor-grabbing opacity-100"
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <IconGripVertical size={14} stroke={1.5} />
            </motion.div>
            <span className="text-xs font-medium text-foreground-muted truncate">
              {widget.title}
            </span>
          </div>
          
          <motion.div 
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100"
            initial={false}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setShowStylePanel(true);
              }}
              className="p-1.5 hover:bg-accent rounded-lg text-foreground-muted hover:text-foreground"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <IconPalette size={12} stroke={1.5} />
            </motion.button>
            <motion.button 
              onClick={(e) => {
                e.stopPropagation();
                removeWidget(widget.id);
              }}
              className="p-1.5 hover:bg-destructive/10 rounded-lg text-foreground-muted hover:text-destructive"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <IconX size={12} stroke={2} />
            </motion.button>
          </motion.div>
        </div>

        {/* Content */}
        <div 
          className="p-3 overflow-auto"
          style={{ 
            height: "calc(100% - 41px)",
            padding: customStyles.padding,
          }}
        >
          {renderContent()}
        </div>

        {/* Resize handle */}
        {isSelected && (
          <motion.div
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize rounded-br-xl"
            style={{
              background: "linear-gradient(135deg, transparent 50%, hsl(var(--primary)) 50%)",
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          />
        )}
      </motion.div>

      {/* Style Panel */}
      <WidgetStylePanel
        widget={widget}
        isOpen={showStylePanel}
        onClose={() => setShowStylePanel(false)}
      />
    </>
  );
}
