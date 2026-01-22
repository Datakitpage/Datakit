/**
 * Operation Feedback Component
 *
 * Renders toast notifications for operation results.
 * Supports success, error, info, and warning types with animations.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { type FeedbackItem, FEEDBACK_TYPE_CONFIG } from '@/hooks/useOperationFeedback';

interface OperationFeedbackProps {
  items: FeedbackItem[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
}

export function OperationFeedback({
  items,
  onDismiss,
  position = 'bottom-right',
}: OperationFeedbackProps) {
  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: 80, right: 16 },
    'top-center': { top: 80, left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-center': { bottom: 16, left: '50%', transform: 'translateX(-50%)' },
  };

  // Animation variants based on position
  const isTop = position.startsWith('top');
  const variants = {
    initial: { opacity: 0, y: isTop ? -20 : 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: isTop ? -10 : 10, scale: 0.95 },
  };

  return (
    <div
      className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
      style={{ ...positionStyles[position], maxWidth: 400, width: '100%' }}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const config = FEEDBACK_TYPE_CONFIG[item.type];

          return (
            <motion.div
              key={item.id}
              layout
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-auto rounded-lg shadow-lg overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-default)',
              }}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Icon */}
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: config.bgColor,
                    color: config.color,
                  }}
                >
                  {config.icon}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.message}
                  </p>
                  {item.description && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item.description}
                    </p>
                  )}

                  {/* Action button */}
                  {item.action && (
                    <button
                      className="mt-2 text-xs font-medium hover:underline"
                      style={{ color: config.color }}
                      onClick={item.action.onClick}
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>

                {/* Dismiss button */}
                <button
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-tertiary)' }}
                  onClick={() => onDismiss(item.id)}
                >
                  ✕
                </button>
              </div>

              {/* Progress bar for auto-dismiss */}
              {item.duration > 0 && (
                <motion.div
                  className="h-0.5"
                  style={{ backgroundColor: config.color, opacity: 0.5 }}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: item.duration / 1000, ease: 'linear' }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default OperationFeedback;
