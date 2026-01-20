import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Canvas state for zoom/pan
 */
export interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  isSpacePressed: boolean;
}

/**
 * Canvas interaction options
 */
export interface UseCanvasOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomSensitivity?: number;
  panSensitivity?: number;
  enableMomentum?: boolean;
  enableDragPan?: boolean; // Enable drag on empty canvas to pan
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
}

/**
 * Comprehensive canvas interaction hook
 *
 * Handles:
 * - Trackpad pinch-to-zoom (two fingers)
 * - Trackpad scroll to pan
 * - Mouse wheel + Cmd/Ctrl to zoom
 * - Space + drag to pan
 * - Click + drag on empty canvas to pan
 * - Middle mouse button drag to pan
 * - Smooth momentum-based movements
 */
export function useCanvas(options: UseCanvasOptions = {}) {
  const {
    minZoom = 0.1,
    maxZoom = 3,
    zoomSensitivity = 0.005,
    panSensitivity = 1,
    enableMomentum = true,
    enableDragPan = true,
    onZoomChange,
    onPanChange,
  } = options;

  const canvasRef = useRef<HTMLDivElement>(null);

  // State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Internal refs for smooth interactions
  const lastPinchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const isDragPanning = useRef(false);

  /**
   * Clamp zoom to valid range
   */
  const clampZoom = useCallback((z: number) => {
    return Math.min(maxZoom, Math.max(minZoom, z));
  }, [minZoom, maxZoom]);

  /**
   * Zoom towards a point (for pinch/scroll zoom)
   */
  const zoomToPoint = useCallback((
    newZoom: number,
    point: { x: number; y: number }
  ) => {
    const clampedZoom = clampZoom(newZoom);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(clampedZoom);
      onZoomChange?.(clampedZoom);
      return;
    }

    // Calculate point relative to center
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const pointX = point.x - rect.left;
    const pointY = point.y - rect.top;

    // Adjust pan to zoom towards the point
    const zoomRatio = clampedZoom / zoom;
    const newPanX = pointX - (pointX - centerX - pan.x) * zoomRatio - centerX;
    const newPanY = pointY - (pointY - centerY - pan.y) * zoomRatio - centerY;

    setZoom(clampedZoom);
    setPan({ x: newPanX, y: newPanY });
    onZoomChange?.(clampedZoom);
    onPanChange?.({ x: newPanX, y: newPanY });
  }, [zoom, pan, clampZoom, onZoomChange, onPanChange]);

  /**
   * Handle wheel events (scroll/pinch-to-zoom)
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    // Pinch-to-zoom on trackpad (ctrlKey is true for pinch gestures)
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * zoomSensitivity;
      const newZoom = zoom * (1 + delta);
      zoomToPoint(newZoom, { x: e.clientX, y: e.clientY });
    } else {
      // Regular scroll = pan
      const newPan = {
        x: pan.x - e.deltaX * panSensitivity,
        y: pan.y - e.deltaY * panSensitivity,
      };
      setPan(newPan);
      onPanChange?.(newPan);

      // Track velocity for momentum
      if (enableMomentum) {
        velocity.current = {
          x: -e.deltaX * panSensitivity * 0.5,
          y: -e.deltaY * panSensitivity * 0.5,
        };
      }
    }
  }, [zoom, pan, zoomSensitivity, panSensitivity, enableMomentum, zoomToPoint, onPanChange]);

  /**
   * Handle touch start (for multi-touch gestures)
   */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Start of pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastPinchDistance.current = distance;
      lastTouchCenter.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }
  }, []);

  /**
   * Handle touch move (pinch-to-zoom on touch devices)
   */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      e.preventDefault();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };

      // Calculate zoom delta from pinch
      const delta = (distance - lastPinchDistance.current) * 0.01;
      const newZoom = zoom * (1 + delta);
      zoomToPoint(newZoom, center);

      // Also handle pan from gesture center movement
      if (lastTouchCenter.current) {
        const panDelta = {
          x: center.x - lastTouchCenter.current.x,
          y: center.y - lastTouchCenter.current.y,
        };
        setPan(prev => ({
          x: prev.x + panDelta.x,
          y: prev.y + panDelta.y,
        }));
      }

      lastPinchDistance.current = distance;
      lastTouchCenter.current = center;
    }
  }, [zoom, zoomToPoint]);

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(() => {
    lastPinchDistance.current = null;
    lastTouchCenter.current = null;
  }, []);

  /**
   * Handle keyboard events (space to pan)
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' && !isSpacePressed) {
      // Don't capture if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      setIsSpacePressed(true);
    }
  }, [isSpacePressed]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      setIsSpacePressed(false);
      setIsPanning(false);
      dragStart.current = null;
    }
  }, []);

  /**
   * Check if target is the canvas background (empty space)
   */
  const isCanvasBackground = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;

    // Check for explicit canvas background marker
    if (target.getAttribute('data-canvas-bg') === 'true') return true;

    // Check if it's the canvas ref itself
    if (target === canvasRef.current) return true;

    return false;
  }, []);

  /**
   * Handle mouse down for panning
   */
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Space + any click = pan
    if (isSpacePressed) {
      e.preventDefault();
      setIsPanning(true);
      isDragPanning.current = false;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    // Middle mouse button = pan
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      isDragPanning.current = true;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    // Left click on empty canvas = pan (when enableDragPan is true)
    if (enableDragPan && e.button === 0 && isCanvasBackground(e.target)) {
      setIsPanning(true);
      isDragPanning.current = true;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  }, [isSpacePressed, pan, enableDragPan, isCanvasBackground]);

  /**
   * Handle mouse move for panning
   */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const newPan = {
        x: dragStart.current.panX + dx,
        y: dragStart.current.panY + dy,
      };
      setPan(newPan);
      onPanChange?.(newPan);
    }
  }, [isPanning, onPanChange]);

  /**
   * Handle mouse up
   */
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      isDragPanning.current = false;
      dragStart.current = null;
    }
  }, [isPanning]);

  /**
   * Momentum animation loop
   */
  useEffect(() => {
    if (!enableMomentum) return;

    const animate = () => {
      if (Math.abs(velocity.current.x) > 0.1 || Math.abs(velocity.current.y) > 0.1) {
        setPan(prev => ({
          x: prev.x + velocity.current.x,
          y: prev.y + velocity.current.y,
        }));

        // Friction
        velocity.current.x *= 0.95;
        velocity.current.y *= 0.95;

        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [enableMomentum]);

  /**
   * Set up event listeners
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Wheel events
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    // Mouse events for panning
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Keyboard events
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Prevent context menu on middle click
    const handleContextMenu = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
    handleKeyUp,
  ]);

  /**
   * Utility functions
   */
  const zoomIn = useCallback((amount = 0.25) => {
    const newZoom = clampZoom(zoom + amount);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  }, [zoom, clampZoom, onZoomChange]);

  const zoomOut = useCallback((amount = 0.25) => {
    const newZoom = clampZoom(zoom - amount);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  }, [zoom, clampZoom, onZoomChange]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    onZoomChange?.(1);
  }, [onZoomChange]);

  const resetPan = useCallback(() => {
    setPan({ x: 0, y: 0 });
    onPanChange?.({ x: 0, y: 0 });
  }, [onPanChange]);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onZoomChange?.(1);
    onPanChange?.({ x: 0, y: 0 });
  }, [onZoomChange, onPanChange]);

  const fitToContent = useCallback((
    contentBounds: { minX: number; minY: number; maxX: number; maxY: number },
    padding = 50
  ) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const contentWidth = contentBounds.maxX - contentBounds.minX + padding * 2;
    const contentHeight = contentBounds.maxY - contentBounds.minY + padding * 2;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const newZoom = clampZoom(Math.min(scaleX, scaleY, 1));

    const centerX = (contentBounds.minX + contentBounds.maxX) / 2;
    const centerY = (contentBounds.minY + contentBounds.maxY) / 2;

    const newPan = {
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    };

    setZoom(newZoom);
    setPan(newPan);
    onZoomChange?.(newZoom);
    onPanChange?.(newPan);
  }, [clampZoom, onZoomChange, onPanChange]);

  /**
   * Get the transform style for the canvas content
   */
  const getTransformStyle = useCallback(() => ({
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: '0 0',
  }), [zoom, pan]);

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: screenX, y: screenY };

    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  /**
   * Convert canvas coordinates to screen coordinates
   */
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: canvasX, y: canvasY };

    return {
      x: canvasX * zoom + pan.x + rect.left,
      y: canvasY * zoom + pan.y + rect.top,
    };
  }, [zoom, pan]);

  return {
    canvasRef,
    zoom,
    pan,
    isPanning,
    isSpacePressed,
    setZoom: (z: number) => {
      const clamped = clampZoom(z);
      setZoom(clamped);
      onZoomChange?.(clamped);
    },
    setPan: (p: { x: number; y: number }) => {
      setPan(p);
      onPanChange?.(p);
    },
    zoomIn,
    zoomOut,
    resetZoom,
    resetPan,
    reset,
    fitToContent,
    getTransformStyle,
    screenToCanvas,
    canvasToScreen,
  };
}

export default useCanvas;
