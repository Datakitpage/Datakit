import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { useCanvas } from '@/hooks/useCanvas';

// 450MB in bytes
const MAX_FILE_SIZE = 450 * 1024 * 1024;

interface WarmCanvasProps {
  children: React.ReactNode;
  onCanvasClick?: (position: { x: number; y: number }) => void;
  onFileDrop?: (file: File, position: { x: number; y: number }, handle?: FileSystemFileHandle) => void;
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
  const [largeFileWarning, setLargeFileWarning] = useState<{ fileName: string; fileSize: number } | null>(null);

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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!onFileDrop) return;

    const canvasPos = canvas.screenToCanvas(e.clientX, e.clientY);
    const items = Array.from(e.dataTransfer.items);

    for (const item of items) {
      if (item.kind !== 'file') continue;

      const file = item.getAsFile();
      if (!file) continue;

      // Check for large files
      if (file.size > MAX_FILE_SIZE) {
        setLargeFileWarning({ fileName: file.name, fileSize: file.size });
        return;
      }

      // Try to get FileSystemFileHandle for persistence (Chrome/Edge only)
      let handle: FileSystemFileHandle | undefined;
      try {
        if ('getAsFileSystemHandle' in item) {
          const fsHandle = await (item as DataTransferItem & { getAsFileSystemHandle(): Promise<FileSystemHandle | null> }).getAsFileSystemHandle();
          if (fsHandle?.kind === 'file') {
            handle = fsHandle as FileSystemFileHandle;
          }
        }
      } catch {
        // File System Access API not supported or failed, continue without handle
      }

      onFileDrop(file, canvasPos, handle);
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

      {/* Large file warning dialog */}
      <Dialog.Root open={!!largeFileWarning} onOpenChange={(open) => !open && setLargeFileWarning(null)}>
        <Dialog.Portal>
          <Dialog.Overlay asChild>
            <motion.div
              className="fixed inset-0 z-50 backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <motion.div
              className="fixed z-50 w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                left: '50%',
                top: '50%',
              }}
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            >
              {/* Header with file info */}
              <div className="p-5 pb-4">
                {/* File icon and info */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--surface-secondary)' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Dialog.Title
                      className="text-sm font-medium truncate mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {largeFileWarning?.fileName}
                    </Dialog.Title>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-lg font-semibold tabular-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {largeFileWarning ? Math.round(largeFileWarning.fileSize / (1024 * 1024)) : 0} MB
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--error-subtle)', color: 'var(--error)' }}
                      >
                        Too large
                      </span>
                    </div>
                  </div>
                </div>

                {/* Size comparison bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span style={{ color: 'var(--text-tertiary)' }}>Web limit: 450 MB</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {largeFileWarning ? Math.round((largeFileWarning.fileSize / (1024 * 1024) / 450) * 100) : 0}% over
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--surface-tertiary)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: '100%',
                        background: 'linear-gradient(90deg, var(--primary) 0%, var(--primary) 45%, var(--error) 45%, var(--error) 100%)',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    <span style={{ color: 'var(--text-tertiary)' }}>0</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>450 MB</span>
                    <span style={{ color: 'var(--error)' }}>
                      {largeFileWarning ? Math.round(largeFileWarning.fileSize / (1024 * 1024)) : 0} MB
                    </span>
                  </div>
                </div>

                <Dialog.Description className="sr-only">
                  This file exceeds the 450MB limit for the web version.
                </Dialog.Description>
              </div>

              {/* macOS promo card */}
              <div
                className="mx-5 mb-5 p-4 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, var(--surface-secondary) 0%, var(--surface-tertiary) 100%)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'var(--surface-primary)' }}
                  >
                    <svg width="18" height="22" viewBox="0 0 384 512" fill="var(--text-secondary)">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
                      Desktop app coming soon
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      No file size limits with native performance
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div
                className="px-5 py-4 flex gap-3"
                style={{
                  backgroundColor: 'var(--surface-secondary)',
                  borderTop: '1px solid var(--border-default)',
                }}
              >
                <Dialog.Close asChild>
                  <button
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{
                      backgroundColor: '#3B82F6',
                      color: '#FFFFFF',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                    }}
                  >
                    Got it
                  </button>
                </Dialog.Close>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
      /* eslint-disable react-hooks/set-state-in-effect -- Intentional state update on zoom change */
      setDisplayZoom(zoom);
      setVisible(true);
      /* eslint-enable react-hooks/set-state-in-effect */

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
