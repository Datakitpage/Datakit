import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEngineStats, initEngines } from '@/lib/engine/WASMDataEngine';

interface PerformanceStats {
  fps: number;
  memory: number;
  queryTime: number;
  queriesExecuted: number;
  engineStatus: {
    polars: boolean;
    duckdb: boolean;
  };
}

interface PerformanceMonitorProps {
  isExpanded?: boolean;
  onToggle?: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function PerformanceMonitor({
  isExpanded = false,
  onToggle,
  position = 'bottom-left',
}: PerformanceMonitorProps) {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 60,
    memory: 0,
    queryTime: 0,
    queriesExecuted: 0,
    engineStatus: { polars: false, duckdb: false },
  });

  const [fpsHistory, setFpsHistory] = useState<number[]>(new Array(30).fill(60));

  // Track FPS
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFPS = () => {
      frameCount++;
      const now = performance.now();

      if (now - lastTime >= 1000) {
        const fps = Math.round(frameCount * 1000 / (now - lastTime));
        setFpsHistory(prev => [...prev.slice(-29), fps]);
        setStats(prev => ({ ...prev, fps }));
        frameCount = 0;
        lastTime = now;
      }

      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Track memory (if available)
  useEffect(() => {
    const measureMemory = () => {
      // @ts-expect-error - Memory API not in all browsers
      if (performance.memory) {
        // @ts-expect-error - Memory API property access not typed
        const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        setStats(prev => ({ ...prev, memory: usedMB }));
      }
    };

    measureMemory();
    const interval = setInterval(measureMemory, 2000);
    return () => clearInterval(interval);
  }, []);

  // Track engine stats
  useEffect(() => {
    const updateEngineStats = () => {
      const engineStats = getEngineStats();
      setStats(prev => ({
        ...prev,
        queryTime: engineStats.avgQueryTimeMs,
        queriesExecuted: engineStats.queriesExecuted,
      }));
    };

    updateEngineStats();
    const interval = setInterval(updateEngineStats, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize engines
  useEffect(() => {
    initEngines().then(status => {
      setStats(prev => ({ ...prev, engineStatus: status }));
    });
  }, []);

  // Position styles
  const positionStyles = {
    'top-left': { top: 64, left: 16 },
    'top-right': { top: 64, right: 16 },
    'bottom-left': { bottom: 80, left: 16 },
    'bottom-right': { bottom: 80, right: 16 },
  };

  // FPS color based on performance
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#22c55e'; // green
    if (fps >= 30) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  // Render mini spark chart
  const renderSparkline = useCallback(() => {
    const width = 60;
    const height = 20;
    const max = Math.max(...fpsHistory, 60);
    const min = Math.min(...fpsHistory, 0);
    const range = max - min || 1;

    const points = fpsHistory
      .map((fps, i) => {
        const x = (i / (fpsHistory.length - 1)) * width;
        const y = height - ((fps - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="opacity-60">
        <polyline
          points={points}
          fill="none"
          stroke={getFpsColor(stats.fps)}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }, [fpsHistory, stats.fps]);

  return (
    <motion.div
      className="fixed z-50"
      style={positionStyles[position]}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 }}
    >
      {/* Collapsed state - just FPS indicator */}
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="collapsed"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm border border-stone-200/50 hover:bg-white transition-colors"
            onClick={onToggle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getFpsColor(stats.fps) }}
            />
            <span
              className="text-xs font-mono"
              style={{ color: getFpsColor(stats.fps) }}
            >
              {stats.fps}
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-stone-200/50 p-3 min-w-[200px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-stone-600">Performance</span>
              <button
                className="text-stone-400 hover:text-stone-600 transition-colors"
                onClick={onToggle}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* FPS */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getFpsColor(stats.fps) }}
                />
                <span className="text-xs text-stone-500">FPS</span>
              </div>
              <div className="flex items-center gap-2">
                {renderSparkline()}
                <span
                  className="text-sm font-mono font-medium"
                  style={{ color: getFpsColor(stats.fps) }}
                >
                  {stats.fps}
                </span>
              </div>
            </div>

            {/* Memory */}
            {stats.memory > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-stone-500">Memory</span>
                <span className="text-sm font-mono text-stone-700">{stats.memory} MB</span>
              </div>
            )}

            {/* Query stats */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-stone-500">Queries</span>
              <span className="text-sm font-mono text-stone-700">{stats.queriesExecuted}</span>
            </div>

            {stats.queryTime > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-stone-500">Avg Query</span>
                <span className="text-sm font-mono text-stone-700">
                  {stats.queryTime.toFixed(2)}ms
                </span>
              </div>
            )}

            {/* Engine status */}
            <div className="pt-2 border-t border-stone-100">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 block mb-1.5">
                Engines
              </span>
              <div className="flex gap-2">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                  stats.engineStatus.polars
                    ? 'bg-green-50 text-green-700'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    stats.engineStatus.polars ? 'bg-green-500' : 'bg-stone-300'
                  }`} />
                  Polars
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                  stats.engineStatus.duckdb
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    stats.engineStatus.duckdb ? 'bg-blue-500' : 'bg-stone-300'
                  }`} />
                  DuckDB
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Hook for tracking operation performance
 */
// eslint-disable-next-line react-refresh/only-export-components -- Hook is related to PerformanceMonitor
export function usePerformanceTracker() {
  const [operations, setOperations] = useState<{
    name: string;
    duration: number;
    timestamp: number;
  }[]>([]);

  const trackOperation = useCallback(
    async <T,>(name: string, operation: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      try {
        const result = await operation();
        const duration = performance.now() - start;
        setOperations(prev => [
          ...prev.slice(-99),
          { name, duration, timestamp: Date.now() },
        ]);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        setOperations(prev => [
          ...prev.slice(-99),
          { name: `${name} (failed)`, duration, timestamp: Date.now() },
        ]);
        throw error;
      }
    },
    []
  );

  const getStats = useCallback(() => {
    if (operations.length === 0) return { count: 0, avg: 0, min: 0, max: 0 };

    const durations = operations.map(o => o.duration);
    return {
      count: operations.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }, [operations]);

  return { trackOperation, operations, getStats };
}

export default PerformanceMonitor;
