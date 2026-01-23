import { motion } from 'framer-motion';

interface PulsingHotspotProps {
  /** Position relative to parent (use absolute positioning) */
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  /** Size of the hotspot dot */
  size?: number;
  /** Whether the hotspot is visible */
  visible?: boolean;
  /** Optional label shown on hover */
  label?: string;
  /** Color variant */
  variant?: 'primary' | 'success' | 'warning';
}

const variantColors = {
  primary: {
    bg: 'var(--primary)',
    glow: 'hsl(var(--accent-hue) var(--accent-saturation) var(--accent-lightness) / 0.4)',
  },
  success: {
    bg: 'var(--success)',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  warning: {
    bg: 'var(--warning)',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
};

export function PulsingHotspot({
  top,
  left,
  right,
  bottom,
  size = 8,
  visible = true,
  label,
  variant = 'primary',
}: PulsingHotspotProps) {
  if (!visible) return null;

  const colors = variantColors[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      className="absolute z-50 pointer-events-none group"
      style={{
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
      }}
    >
      {/* Pulsing ring animation */}
      <motion.div
        animate={{
          scale: [1, 2.5, 1],
          opacity: [0.6, 0, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: colors.glow,
        }}
      />

      {/* Second ring (offset timing) */}
      <motion.div
        animate={{
          scale: [1, 2.5, 1],
          opacity: [0.4, 0, 0.4],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: colors.glow,
        }}
      />

      {/* Center dot */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: colors.bg,
          boxShadow: `0 0 8px ${colors.glow}`,
        }}
      />

      {/* Label tooltip (optional) */}
      {label && (
        <div
          className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {label}
        </div>
      )}
    </motion.div>
  );
}

export default PulsingHotspot;
