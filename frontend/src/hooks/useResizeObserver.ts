import { useEffect, useState, useRef } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * Hook to observe element size changes using ResizeObserver
 */
export const useResizeObserver = <T extends HTMLElement>(): [React.RefObject<T>, Size] => {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0) return;
      
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      
      setSize({ width, height });
    });

    resizeObserver.observe(element);

    // Set initial size
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [ref, size];
};

/**
 * Hook to get container dimensions with minimum sizes for chart rendering
 */
export const useChartDimensions = (minWidth = 400, minHeight = 300) => {
  const [ref, size] = useResizeObserver<HTMLDivElement>();
  
  const chartWidth = Math.max(size.width || minWidth, minWidth);
  const chartHeight = Math.max(size.height || minHeight, minHeight);
  
  return {
    ref,
    width: chartWidth,
    height: chartHeight,
    isReady: size.width > 0 && size.height > 0
  };
};