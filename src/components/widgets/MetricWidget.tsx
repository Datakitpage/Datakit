import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useDataStore } from "@/store/dataStore";

interface MetricWidgetProps {
  config: Record<string, unknown>;
}

export function MetricWidget({ config }: MetricWidgetProps) {
  const { executeQuery } = useDataStore();
  const [value, setValue] = useState<number | string>(config.value as any || 0);
  const [isLoading, setIsLoading] = useState(false);

  const label = (config.label as string) || "Metric";
  const format = (config.format as string) || "number";
  const change = config.change as number | undefined;
  const sql = config.sql as string | undefined;

  useEffect(() => {
    async function loadData() {
      if (!sql) return;
      
      setIsLoading(true);
      try {
        const result = await executeQuery(sql);
        if (result && result.length > 0) {
          const firstRow = result[0];
          const firstValue = Object.values(firstRow)[0];
          setValue(firstValue as any);
        }
      } catch (err) {
        console.error("[MetricWidget] Load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [sql, executeQuery]);

  const formatValue = (val: number | string | bigint) => {
    if (typeof val === "string") return val;

    // Handle BigInt from DuckDB (used for COUNT, SUM, etc.)
    const numVal = typeof val === "bigint" ? Number(val) : val;

    if (isNaN(numVal)) return "-";

    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0
        }).format(numVal);
      case "percent":
        return numVal.toFixed(1) + "%";
      case "compact":
        return new Intl.NumberFormat("en-US", { notation: "compact" }).format(numVal);
      default:
        return new Intl.NumberFormat("en-US").format(numVal);
    }
  };

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div 
          className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <motion.div 
      className="flex flex-col justify-center h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <motion.div 
        className="text-3xl font-semibold text-foreground tracking-tight"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        {formatValue(value)}
      </motion.div>
      <div className="text-sm text-foreground-muted mt-1">{label}</div>
      
      {change !== undefined && (
        <motion.div 
          className={clsx(
            "flex items-center gap-1 text-xs font-medium mt-2",
            isPositive && "text-success",
            isNegative && "text-destructive"
          )}
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isPositive && <IconTrendingUp size={12} stroke={2.5} />}
          {isNegative && <IconTrendingDown size={12} stroke={2.5} />}
          <span>{isPositive ? "+" : ""}{change.toFixed(1)}%</span>
        </motion.div>
      )}
    </motion.div>
  );
}
