import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBoardStore, Connection } from "@/store/boardStore";
import { Widget } from "../widgets/Widget";
import { EmptyState } from "./EmptyState";
import { 
  IconZoomIn, 
  IconZoomOut, 
  IconGridDots, 
  IconMaximize,
  IconCommand
} from "@tabler/icons-react";
import { clsx } from "clsx";

const GRID_UNIT = 80;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;

// Bezier curve path generator
function getBezierPath(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  sourceHandle: Connection["sourceHandle"],
  targetHandle: Connection["targetHandle"]
): string {
  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);
  const curvature = Math.min(dx, dy, 100) * 0.5;
  
  const handleOffsets: Record<string, [number, number]> = {
    top: [0, -curvature],
    right: [curvature, 0],
    bottom: [0, curvature],
    left: [-curvature, 0],
  };
  
  const [scx, scy] = handleOffsets[sourceHandle];
  const [tcx, tcy] = handleOffsets[targetHandle];
  
  return "M " + sourceX + " " + sourceY + " C " + (sourceX + scx) + " " + (sourceY + scy) + ", " + (targetX + tcx) + " " + (targetY + tcy) + ", " + targetX + " " + targetY;
}

// Get handle position on widget
function getHandlePosition(
  widget: { position: { x: number; y: number; width: number; height: number } },
  handle: Connection["sourceHandle"]
): { x: number; y: number } {
  const { x, y, width, height } = widget.position;
  const px = x * GRID_UNIT;
  const py = y * GRID_UNIT;
  const pw = width * GRID_UNIT;
  const ph = height * GRID_UNIT;
  
  switch (handle) {
    case "top": return { x: px + pw / 2, y: py };
    case "right": return { x: px + pw, y: py + ph / 2 };
    case "bottom": return { x: px + pw / 2, y: py + ph };
    case "left": return { x: px, y: py + ph / 2 };
  }
}

export function Canvas() {
  const { widgets, connections, connectingFrom, endConnecting, selectWidget } = useBoardStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const fitToView = useCallback(() => {
    if (!contentRef.current || !canvasRef.current || widgets.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    widgets.forEach((widget) => {
      minX = Math.min(minX, widget.position.x * GRID_UNIT);
      minY = Math.min(minY, widget.position.y * GRID_UNIT);
      maxX = Math.max(maxX, (widget.position.x + widget.position.width) * GRID_UNIT);
      maxY = Math.max(maxY, (widget.position.y + widget.position.height) * GRID_UNIT);
    });

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const contentWidth = maxX - minX + 100;
    const contentHeight = maxY - minY + 100;
    
    const scaleX = canvasRect.width / contentWidth;
    const scaleY = canvasRect.height / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 1);
    
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
  }, [widgets]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          resetZoom();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
    }
  }, []);

  // Track mouse for connecting line preview
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (connectingFrom && contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      });
    }
  }, [connectingFrom, zoom]);

  // Handle canvas click
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.target === contentRef.current) {
      selectWidget(null);
      endConnecting();
    }
  }, [selectWidget, endConnecting]);

  // Generate connection paths
  const connectionPaths = useMemo(() => {
    return connections.map((conn) => {
      const source = widgets.find(w => w.id === conn.sourceId);
      const target = widgets.find(w => w.id === conn.targetId);
      if (!source || !target) return null;
      
      const sourcePos = getHandlePosition(source, conn.sourceHandle);
      const targetPos = getHandlePosition(target, conn.targetHandle);
      
      return {
        id: conn.id,
        path: getBezierPath(
          sourcePos.x, sourcePos.y,
          targetPos.x, targetPos.y,
          conn.sourceHandle, conn.targetHandle
        ),
      };
    }).filter(Boolean);
  }, [connections, widgets]);

  // Preview connection line
  const previewPath = useMemo(() => {
    if (!connectingFrom) return null;
    const source = widgets.find(w => w.id === connectingFrom.widgetId);
    if (!source) return null;
    
    const sourcePos = getHandlePosition(source, connectingFrom.handle);
    return getBezierPath(
      sourcePos.x, sourcePos.y,
      mousePos.x, mousePos.y,
      connectingFrom.handle, "left"
    );
  }, [connectingFrom, widgets, mousePos]);

  if (widgets.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 relative overflow-hidden bg-background">
      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="w-full h-full overflow-auto"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      >
        <div 
          ref={contentRef}
          className="min-h-full min-w-full p-6 relative origin-top-left"
          style={{
            transform: "scale(" + zoom + ")",
            minHeight: "calc((100vh - 48px) / " + zoom + ")",
            minWidth: "calc(100vw / " + zoom + ")",
            backgroundImage: showGrid 
              ? "radial-gradient(circle, hsl(0 0% 100% / 0.03) 1px, transparent 1px)"
              : "none",
            backgroundSize: "24px 24px",
          }}
        >
          {/* SVG Connection Layer */}
          <svg 
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%", overflow: "visible" }}
          >
            <defs>
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              </linearGradient>
              <filter id="connectionGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Existing connections */}
            <AnimatePresence>
              {connectionPaths.map((conn) => conn && (
                <motion.path
                  key={conn.id}
                  d={conn.path}
                  fill="none"
                  stroke="url(#connectionGradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  filter="url(#connectionGlow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                />
              ))}
            </AnimatePresence>
            
            {/* Preview connection line */}
            {previewPath && (
              <motion.path
                d={previewPath}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.15 }}
              />
            )}
          </svg>

          {/* Widgets */}
          <AnimatePresence mode="popLayout">
            {widgets.map((widget, index) => (
              <Widget 
                key={widget.id} 
                widget={widget} 
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Canvas Controls */}
      <motion.div 
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1.5 bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-xl"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
      >
        <button
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="p-2 hover:bg-accent rounded-lg transition-all text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          title="Zoom Out"
        >
          <IconZoomOut size={16} stroke={1.5} />
        </button>

        <button
          onClick={resetZoom}
          className="px-3 py-1.5 min-w-[54px] text-[11px] font-medium text-foreground hover:bg-accent rounded-lg transition-all hover:scale-105 active:scale-95"
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="p-2 hover:bg-accent rounded-lg transition-all text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          title="Zoom In"
        >
          <IconZoomIn size={16} stroke={1.5} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={() => setShowGrid(!showGrid)}
          className={clsx(
            "p-2 rounded-lg transition-all hover:scale-105 active:scale-95",
            showGrid 
              ? "bg-primary/10 text-primary" 
              : "hover:bg-accent text-foreground-muted hover:text-foreground"
          )}
          title="Toggle Grid"
        >
          <IconGridDots size={16} stroke={1.5} />
        </button>

        <button
          onClick={fitToView}
          className="p-2 hover:bg-accent rounded-lg transition-all text-foreground-muted hover:text-foreground hover:scale-105 active:scale-95"
          title="Fit to View"
        >
          <IconMaximize size={16} stroke={1.5} />
        </button>
      </motion.div>

      {/* Keyboard Hints */}
      <motion.div 
        className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[10px] text-foreground-subtle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <IconCommand size={10} stroke={1.5} />
        <span>scroll to zoom</span>
      </motion.div>
    </div>
  );
}
