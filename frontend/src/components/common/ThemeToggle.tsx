import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'default' | 'sidebar';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'default' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-1 p-2 rounded-lg text-white/70 dark:text-white/70 light:text-black/70 hover:text-white dark:hover:text-white light:hover:text-black hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 transition-colors"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === 'light' ? 180 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {theme === 'light' ? (
          <Moon size={14} />
        ) : (
          <Sun size={14} />
        )}
      </motion.div>
      
      {variant === 'default' && (
        <span className="text-xs">
          {theme === 'light' ? 'Dark' : 'Light'}
        </span>
      )}
    </motion.button>
  );
};