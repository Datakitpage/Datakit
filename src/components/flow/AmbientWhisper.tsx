import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Whisper {
  id: string;
  message: string;
  type: 'insight' | 'suggestion' | 'warning' | 'pattern';
  position: { x: number; y: number };
  targetId?: string; // ID of the element this whisper relates to
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AmbientWhisperProps {
  whisper: Whisper;
  onDismiss: (id: string) => void;
  onAction?: () => void;
}

const whisperStyles: Record<string, { color: string; bgColor: string; glowColor: string; icon: string }> = {
  insight: {
    color: '#0369A1',
    bgColor: 'rgba(14, 165, 233, 0.08)',
    glowColor: 'rgba(14, 165, 233, 0.2)',
    icon: '◐',
  },
  suggestion: {
    color: '#059669',
    bgColor: 'rgba(16, 185, 129, 0.08)',
    glowColor: 'rgba(16, 185, 129, 0.2)',
    icon: '◈',
  },
  warning: {
    color: '#D97706',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    glowColor: 'rgba(245, 158, 11, 0.2)',
    icon: '◇',
  },
  pattern: {
    color: '#7C3AED',
    bgColor: 'rgba(139, 92, 246, 0.08)',
    glowColor: 'rgba(139, 92, 246, 0.2)',
    icon: '◎',
  },
};

export function AmbientWhisper({ whisper, onDismiss, onAction }: AmbientWhisperProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const style = whisperStyles[whisper.type] || whisperStyles.insight;

  // Auto-dismiss after 10 seconds if not interacted with
  useEffect(() => {
    if (!isHovered) {
      const timeout = setTimeout(() => {
        onDismiss(whisper.id);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isHovered, whisper.id, onDismiss]);

  return (
    <motion.div
      className="absolute pointer-events-auto"
      style={{
        left: whisper.position.x,
        top: whisper.position.y,
      }}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onMouseEnter={() => {
        setIsHovered(true);
        setShowFull(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setTimeout(() => setShowFull(false), 300);
      }}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute -inset-4 rounded-full pointer-events-none"
        style={{ backgroundColor: style.glowColor }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Collapsed state - just a glowing dot */}
      <AnimatePresence mode="wait">
        {!showFull ? (
          <motion.div
            key="dot"
            className="relative cursor-pointer"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <motion.div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: style.color }}
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            className="relative"
            initial={{ opacity: 0, width: 12 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 12 }}
            transition={{ duration: 0.2 }}
          >
            {/* Card */}
            <div
              className="rounded-lg shadow-sm overflow-hidden"
              style={{
                backgroundColor: style.bgColor,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${style.color}20`,
                maxWidth: 240,
              }}
            >
              {/* Header with icon */}
              <div className="px-3 py-2 flex items-start gap-2">
                <span
                  className="text-sm leading-none mt-0.5"
                  style={{ color: style.color }}
                >
                  {style.icon}
                </span>
                <p
                  className="text-sm leading-snug"
                  style={{ color: style.color }}
                >
                  {whisper.message}
                </p>
              </div>

              {/* Action button */}
              {whisper.action && (
                <div className="px-3 pb-2">
                  <motion.button
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{
                      backgroundColor: `${style.color}15`,
                      color: style.color,
                    }}
                    whileHover={{ backgroundColor: `${style.color}25` }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      whisper.action?.onClick();
                      onDismiss(whisper.id);
                    }}
                  >
                    {whisper.action.label}
                  </motion.button>
                </div>
              )}

              {/* Dismiss hint */}
              <motion.div
                className="px-3 pb-1.5 text-xs opacity-40"
                style={{ color: style.color }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 0.5 }}
              >
                click away to dismiss
              </motion.div>
            </div>

            {/* Connector line to target (if near an element) */}
            <svg
              className="absolute -left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              width="8"
              height="2"
            >
              <line
                x1="0"
                y1="1"
                x2="8"
                y2="1"
                stroke={style.color}
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Container for managing multiple whispers
interface WhisperContainerProps {
  whispers: Whisper[];
  onDismiss: (id: string) => void;
}

export function WhisperContainer({ whispers, onDismiss }: WhisperContainerProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {whispers.map(whisper => (
          <AmbientWhisper
            key={whisper.id}
            whisper={whisper}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// AI Engine that generates whispers based on data analysis
export function useAmbientAI(files: Array<{ id: string; data?: unknown[]; position: { x: number; y: number }; name: string }>) {
  const [whispers, setWhispers] = useState<Whisper[]>([]);

  const addWhisper = (whisper: Omit<Whisper, 'id'>) => {
    const id = `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setWhispers(prev => [...prev, { ...whisper, id }]);
  };

  const dismissWhisper = (id: string) => {
    setWhispers(prev => prev.filter(w => w.id !== id));
  };

  // Analyze files and generate insights
  useEffect(() => {
    files.forEach(file => {
      if (!file.data || file.data.length === 0) return;

      const data = file.data as Record<string, unknown>[];

      // Check for date columns
      const columns = Object.keys(data[0] || {});
      columns.forEach(col => {
        const sample = data.slice(0, 5).map(row => row[col]);
        const looksLikeDate = sample.every(v =>
          typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v as string)
        );

        if (looksLikeDate) {
          // Check if we already have this whisper
          const existingWhisper = whispers.find(
            w => w.targetId === file.id && w.message.includes(col)
          );
          if (!existingWhisper) {
            setTimeout(() => {
              addWhisper({
                message: `"${col}" looks like dates. Parse them?`,
                type: 'suggestion',
                position: {
                  x: file.position.x + 180,
                  y: file.position.y + 20,
                },
                targetId: file.id,
                action: {
                  label: 'Parse dates',
                  onClick: () => {
                    console.log(`Parsing dates in ${col}`);
                  },
                },
              });
            }, 1500);
          }
        }
      });

      // Check for null values
      const nullCounts: Record<string, number> = {};
      columns.forEach(col => {
        nullCounts[col] = data.filter(row => row[col] == null || row[col] === '').length;
      });

      const highNullCol = Object.entries(nullCounts).find(
        ([, count]) => count / data.length > 0.1
      );

      if (highNullCol) {
        const [col, count] = highNullCol;
        const pct = Math.round((count / data.length) * 100);
        const existingWhisper = whispers.find(
          w => w.targetId === file.id && w.message.includes('null')
        );
        if (!existingWhisper) {
          setTimeout(() => {
            addWhisper({
              message: `"${col}" has ${pct}% empty values`,
              type: 'warning',
              position: {
                x: file.position.x + 180,
                y: file.position.y + 50,
              },
              targetId: file.id,
            });
          }, 2500);
        }
      }
    });
  }, [files]);

  return { whispers, addWhisper, dismissWhisper };
}
