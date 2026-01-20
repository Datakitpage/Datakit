import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnectionStore, type Port } from '@/store/connectionStore';

interface ConnectionPortProps {
  nodeId: string;
  type: 'input' | 'output';
  color: string;
  position: 'left' | 'right' | 'top' | 'bottom';
  onConnectionComplete?: (fromId: string, toId: string) => void;
  alwaysVisible?: boolean;
  isNodeHovered?: boolean;
  isNodeSelected?: boolean;
}

/**
 * Smart connection port with drag-to-connect
 *
 * Features:
 * - Drag from output to create connection
 * - Magnetic snapping to valid targets
 * - Visual feedback for valid/invalid targets
 * - Smooth animations
 */
export function ConnectionPort({
  nodeId,
  type,
  color,
  position,
  onConnectionComplete,
  alwaysVisible = false,
  isNodeHovered = false,
  isNodeSelected = false,
}: ConnectionPortProps) {
  const portRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const {
    activeConnection,
    startConnection,
    updateConnectionPosition,
    completeConnection,
    cancelConnection,
    registerPort,
    unregisterPort,
    updatePortPosition,
    isValidConnection,
  } = useConnectionStore();

  // Get port ID
  const portId = `${nodeId}-${type}`;

  // Track if we're a valid target for the current connection
  const isValidTarget =
    activeConnection &&
    activeConnection.fromPort.nodeId !== nodeId &&
    type === 'input' &&
    isValidConnection(activeConnection.fromPort, {
      nodeId,
      type,
      position: { x: 0, y: 0 },
    });

  const isSnapped =
    activeConnection?.snappedTarget?.nodeId === nodeId &&
    activeConnection?.snappedTarget?.type === type;

  // Update port position when component mounts/updates
  useEffect(() => {
    const updatePosition = () => {
      if (!portRef.current) return;

      const rect = portRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      const port: Port = {
        nodeId,
        type,
        position: { x, y },
      };

      registerPort(portId, port);
      updatePortPosition(portId, { x, y });
    };

    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      unregisterPort(portId);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [nodeId, type, portId, registerPort, unregisterPort, updatePortPosition]);

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (type !== 'output') return; // Only drag from outputs

      e.preventDefault();
      e.stopPropagation();

      const rect = portRef.current?.getBoundingClientRect();
      if (!rect) return;

      setIsDragging(true);

      const port: Port = {
        nodeId,
        type,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      };

      startConnection(port);
    },
    [nodeId, type, startConnection]
  );

  // Handle global mouse move for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      updateConnectionPosition({ x: clientX, y: clientY });
    };

    const handleEnd = () => {
      setIsDragging(false);
      const result = completeConnection();

      if (result && onConnectionComplete) {
        onConnectionComplete(result.from.nodeId, result.to.nodeId);
      }
    };

    const handleCancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDragging(false);
        cancelConnection();
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('keydown', handleCancel);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('keydown', handleCancel);
    };
  }, [isDragging, updateConnectionPosition, completeConnection, cancelConnection, onConnectionComplete]);

  // Handle click on input port during connection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (type !== 'input' || !activeConnection) return;

      e.preventDefault();
      e.stopPropagation();

      const result = completeConnection();
      if (result && onConnectionComplete) {
        onConnectionComplete(result.from.nodeId, result.to.nodeId);
      }
    },
    [type, activeConnection, completeConnection, onConnectionComplete]
  );

  // Determine visibility
  const shouldShow =
    alwaysVisible ||
    isNodeHovered ||
    isNodeSelected ||
    isDragging ||
    !!activeConnection;

  // Position styles
  const positionStyles = {
    left: { left: -6, top: '50%', transform: 'translateY(-50%)' },
    right: { right: -6, top: '50%', transform: 'translateY(-50%)' },
    top: { top: -6, left: '50%', transform: 'translateX(-50%)' },
    bottom: { bottom: -6, left: '50%', transform: 'translateX(-50%)' },
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          ref={portRef}
          className="absolute z-20 cursor-pointer"
          style={positionStyles[position]}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: isSnapped ? 1.4 : isHovered || isDragging ? 1.2 : 1,
            opacity: 1,
          }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={handleClick}
        >
          {/* Outer ring */}
          <motion.div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'white',
              border: `2px solid ${color}`,
              boxShadow: isSnapped
                ? `0 0 0 4px ${color}40, 0 0 12px ${color}60`
                : isValidTarget
                ? `0 0 0 2px ${color}30`
                : '0 2px 4px rgba(0,0,0,0.1)',
            }}
            animate={{
              borderWidth: isSnapped ? 3 : 2,
            }}
          >
            {/* Inner dot */}
            <motion.div
              className="rounded-full"
              style={{ backgroundColor: color }}
              animate={{
                width: isSnapped ? 8 : isDragging || isHovered ? 6 : 4,
                height: isSnapped ? 8 : isDragging || isHovered ? 6 : 4,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </motion.div>

          {/* Pulse effect for valid targets */}
          {isValidTarget && !isSnapped && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: color,
                opacity: 0.3,
              }}
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}

          {/* Snap indicator */}
          {isSnapped && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${color}`,
              }}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.5, 1] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Connection line preview during drag
 */
export function ConnectionLinePreview() {
  const activeConnection = useConnectionStore((state) => state.activeConnection);

  if (!activeConnection) return null;

  const { fromPort, currentPosition, snappedTarget } = activeConnection;
  const targetPos = snappedTarget?.position || currentPosition;

  // Calculate bezier curve control points
  const dx = targetPos.x - fromPort.position.x;
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

  const path = `M ${fromPort.position.x} ${fromPort.position.y}
                C ${fromPort.position.x + controlOffset} ${fromPort.position.y},
                  ${targetPos.x - controlOffset} ${targetPos.y},
                  ${targetPos.x} ${targetPos.y}`;

  return (
    <svg
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Shadow/glow */}
      <motion.path
        d={path}
        fill="none"
        stroke={snappedTarget ? '#10B981' : '#9CA3AF'}
        strokeWidth={snappedTarget ? 4 : 3}
        strokeLinecap="round"
        strokeOpacity={0.2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.2 }}
      />

      {/* Main line */}
      <motion.path
        d={path}
        fill="none"
        stroke={snappedTarget ? '#10B981' : '#6B7280'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={snappedTarget ? 'none' : '8 4'}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.2 }}
      />

      {/* Animated particles along path */}
      {snappedTarget && (
        <>
          <motion.circle
            r={3}
            fill="#10B981"
            initial={{ offsetDistance: '0%' }}
            animate={{ offsetDistance: '100%' }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              offsetPath: `path("${path}")`,
            }}
          />
        </>
      )}
    </svg>
  );
}

export default ConnectionPort;
