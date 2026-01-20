import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface Point {
  x: number;
  y: number;
}

interface Particle {
  id: number;
  progress: number; // 0 to 1 along the path
  speed: number;
  size: number;
  opacity: number;
}

interface DataStreamProps {
  from: Point;
  to: Point;
  dataSize?: number; // affects stream thickness and particle count
  isActive?: boolean;
  hasError?: boolean;
  color?: string;
}

function cubicBezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

export function DataStream({
  from,
  to,
  dataSize = 100,
  isActive = true,
  hasError = false,
  color = '#F59E0B',
}: DataStreamProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);

  // Calculate control points for smooth curve
  const dx = to.x - from.x;
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

  const p0 = from;
  const p1 = { x: from.x + controlOffset, y: from.y };
  const p2 = { x: to.x - controlOffset, y: to.y };
  const p3 = to;

  // Generate path string for SVG
  const pathD = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  // Stream thickness based on data size
  const streamWidth = Math.min(8, 2 + Math.log10(dataSize + 1) * 1.5);

  // Particle count based on data size
  const maxParticles = Math.min(20, 5 + Math.floor(Math.log10(dataSize + 1) * 3));

  // Spawn and animate particles
  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      return;
    }

    const spawnInterval = setInterval(() => {
      setParticles(prev => {
        if (prev.length >= maxParticles) return prev;

        particleIdRef.current++;
        return [
          ...prev,
          {
            id: particleIdRef.current,
            progress: 0,
            speed: 0.008 + Math.random() * 0.004, // Varied speeds
            size: 3 + Math.random() * 3,
            opacity: 0.6 + Math.random() * 0.4,
          },
        ];
      });
    }, 200);

    const animateInterval = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            progress: p.progress + p.speed,
          }))
          .filter(p => p.progress < 1)
      );
    }, 16);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(animateInterval);
    };
  }, [isActive, maxParticles]);

  // Calculate bounding box for SVG
  const minX = Math.min(from.x, to.x) - 50;
  const minY = Math.min(from.y, to.y) - 50;
  const width = Math.abs(to.x - from.x) + 100;
  const height = Math.abs(to.y - from.y) + 100;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* Gradient for the stream */}
        <linearGradient id={`stream-gradient-${from.x}-${to.x}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.1" />
          <stop offset="50%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`glow-${from.x}-${to.x}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Stream background (the "pipe") */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={`url(#stream-gradient-${from.x}-${to.x})`}
        strokeWidth={streamWidth * 2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Center line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={hasError ? '#EF4444' : color}
        strokeWidth={1}
        strokeOpacity={0.3}
        strokeLinecap="round"
        strokeDasharray={hasError ? '4 4' : 'none'}
        initial={{ pathLength: 0 }}
        animate={{
          pathLength: 1,
          strokeDashoffset: hasError ? [0, -8] : 0,
        }}
        transition={{
          pathLength: { duration: 0.5, ease: 'easeOut' },
          strokeDashoffset: { duration: 0.5, repeat: Infinity, ease: 'linear' },
        }}
      />

      {/* Flowing particles */}
      {particles.map(particle => {
        const pos = cubicBezierPoint(particle.progress, p0, p1, p2, p3);
        return (
          <motion.circle
            key={particle.id}
            cx={pos.x}
            cy={pos.y}
            r={particle.size}
            fill={hasError ? '#EF4444' : color}
            opacity={particle.opacity * (1 - particle.progress * 0.5)}
            filter={`url(#glow-${from.x}-${to.x})`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          />
        );
      })}

      {/* Error turbulence effect */}
      {hasError && (
        <motion.g>
          {[0.3, 0.5, 0.7].map((t, i) => {
            const pos = cubicBezierPoint(t, p0, p1, p2, p3);
            return (
              <motion.circle
                key={i}
                cx={pos.x}
                cy={pos.y}
                r={6}
                fill="none"
                stroke="#EF4444"
                strokeWidth={1}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            );
          })}
        </motion.g>
      )}
    </svg>
  );
}

// Helper component for connection preview while dragging
export function ConnectionPreview({ from, to }: { from: Point; to: Point }) {
  const dx = to.x - from.x;
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

  const pathD = `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      <motion.path
        d={pathD}
        fill="none"
        stroke="#F59E0B"
        strokeWidth={2}
        strokeDasharray="8 4"
        strokeOpacity={0.5}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
}
