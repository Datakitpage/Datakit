import { useTheme } from '@/contexts/ThemeContext';

/**
 * Hook to generate theme-aware class names
 * @param darkClasses - Classes to apply in dark mode
 * @param lightClasses - Classes to apply in light mode
 * @returns Combined class string
 */
export const useThemeClasses = (darkClasses: string, lightClasses: string) => {
  const { theme } = useTheme();
  return theme === 'dark' ? darkClasses : lightClasses;
};

/**
 * Hook to get conditional theme classes
 * @param baseClasses - Classes that apply to both themes
 * @param darkClasses - Additional classes for dark mode
 * @param lightClasses - Additional classes for light mode
 * @returns Combined class string
 */
export const useConditionalThemeClasses = (
  baseClasses: string,
  darkClasses: string = '',
  lightClasses: string = ''
) => {
  const { theme } = useTheme();
  const themeClasses = theme === 'dark' ? darkClasses : lightClasses;
  return `${baseClasses} ${themeClasses}`.trim();
};