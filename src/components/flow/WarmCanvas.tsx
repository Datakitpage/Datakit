import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { useCanvas } from '@/hooks/useCanvas';

interface WarmCanvasProps {
  children: React.ReactNode;
  onCanvasClick?: (position: { x: number; y: number }) => void;
  onFileDrop?: (file: File, position: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
}

export interface WarmCanvasRef {
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  fitToContent: (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  screenToCanvas: (x: number, y: number) => { x: number; y: number };
}

export const WarmCanvas = forwardRef<WarmCanvasRef, WarmCanvasProps>(({
  children,
  onCanvasClick,
  onFileDrop,
  onZoomChange,
  onPanChange,
}, ref) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Canvas interactions
  const canvas = useCanvas({
    minZoom: 0.1,
    maxZoom: 3,
    zoomSensitivity: 0.008,
    panSensitivity: 1,
    enableMomentum: true,
    onZoomChange,
    onPanChange,
  });

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    zoom: canvas.zoom,
    pan: canvas.pan,
    setZoom: canvas.setZoom,
    setPan: canvas.setPan,
    zoomIn: canvas.zoomIn,
    zoomOut: canvas.zoomOut,
    reset: canvas.reset,
    fitToContent: canvas.fitToContent,
    screenToCanvas: canvas.screenToCanvas,
  }), [canvas]);

  // Subtle cursor trail
  useEffect(() => {
    let trailId = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });

      // Add trail point
      trailId++;
      setTrail(prev => [...prev.slice(-8), { x, y, id: trailId }]);
    };

    const wrapper = wrapperRef.current;
    wrapper?.addEventListener('mousemove', handleMouseMove);
    return () => wrapper?.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Clear old trail points
  useEffect(() => {
    const interval = setInterval(() => {
      setTrail(prev => prev.slice(1));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger if clicking on the canvas wrapper or canvas content area
    const target = e.target as HTMLElement;
    if (
      target === wrapperRef.current ||
      target === canvas.canvasRef.current ||
      target.getAttribute('data-canvas-bg') === 'true'
    ) {
      const canvasPos = canvas.screenToCanvas(e.clientX, e.clientY);
      onCanvasClick?.(canvasPos);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onFileDrop) {
      const canvasPos = canvas.screenToCanvas(e.clientX, e.clientY);
      files.forEach(file => onFileDrop(file, canvasPos));
    }
  };

  return (
    <div
      ref={wrapperRef}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full h-full overflow-hidden"
      style={{
        backgroundColor: 'var(--canvas-bg)',
        backgroundImage: `
          radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, var(--canvas-glow) 0%, transparent 400px),
          radial-gradient(circle, var(--canvas-dot) 1px, transparent 1px)
        `,
        backgroundSize: 'cover, 24px 24px',
        cursor: canvas.isSpacePressed
          ? canvas.isPanning ? 'grabbing' : 'grab'
          : 'default',
      }}
    >
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Cursor trail */}
      {trail.map((point) => (
        <motion.div
          key={point.id}
          className="absolute w-1 h-1 rounded-full pointer-events-none z-50"
          style={{
            left: point.x - 2,
            top: point.y - 2,
            backgroundColor: 'var(--primary)',
          }}
          initial={{ opacity: 0.3, scale: 1 }}
          animate={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.3 }}
        />
      ))}

      {/* Drop zone indicator */}
      <motion.div
        className="absolute inset-4 rounded-2xl border-2 border-dashed pointer-events-none z-40"
        initial={false}
        animate={{
          opacity: isDragOver ? 1 : 0,
          borderColor: isDragOver ? 'var(--primary)' : 'transparent',
          backgroundColor: isDragOver ? 'var(--primary-subtle)' : 'transparent',
        }}
        transition={{ duration: 0.2 }}
      >
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ color: 'var(--primary)' }}
              className="text-lg font-light"
            >
              Drop your files
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Pan mode indicator */}
      {canvas.isSpacePressed && (
        <motion.div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-medium"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {canvas.isPanning ? 'Panning...' : 'Drag to pan'}
        </motion.div>
      )}

      {/* Zoomable/pannable container */}
      <div
        ref={canvas.canvasRef}
        className="absolute inset-0"
        data-canvas-bg="true"
      >
        <div
          className="w-full h-full origin-top-left"
          style={canvas.getTransformStyle()}
          data-canvas-bg="true"
        >
          {children}
        </div>
      </div>

      {/* Zoom indicator (shows briefly when zooming) */}
      <ZoomIndicator zoom={canvas.zoom} />
    </div>
  );
});

WarmCanvas.displayName = 'WarmCanvas';

/**
 * Brief zoom percentage indicator
 */
function ZoomIndicator({ zoom }: { zoom: number }) {
  const [visible, setVisible] = useState(false);
  const [displayZoom, setDisplayZoom] = useState(zoom);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevZoom = useRef(zoom);

  useEffect(() => {
    if (Math.abs(zoom - prevZoom.current) > 0.01) {
      setDisplayZoom(zoom);
      setVisible(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 1000);
    }
    prevZoom.current = zoom;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [zoom]);

  return (
    <motion.div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-mono pointer-events-none"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
      transition={{ duration: 0.15 }}
    >
      {Math.round(displayZoom * 100)}%
    </motion.div>
  );
}

export { WarmCanvas as default };
