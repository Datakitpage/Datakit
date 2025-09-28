import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Power, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import Tooltip from "@/components/ui/Tooltip";

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  databaseCount: number;
  connectionInfo: {
    token: string;
    connectedAt: Date;
  } | null;
  onDisconnect: () => void;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isConnecting,
  error,
  databaseCount,
  connectionInfo,
  onDisconnect,
  className,
}) => {
  const getStatusColor = () => {
    if (error) return "bg-red-500";
    if (isConnecting) return "bg-yellow-500";
    if (isConnected) return "bg-green-500";
    return "bg-gray-500";
  };

  const getStatusText = () => {
    if (error) return "Connection Error";
    if (isConnecting) return "Connecting...";
    if (isConnected) return "Connected";
    return "Not Connected";
  };

  const formatConnectionTime = () => {
    if (!connectionInfo?.connectedAt) return "";

    const now = new Date();
    const connected = new Date(connectionInfo.connectedAt);
    const diffMs = now.getTime() - connected.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className="relative">
          <div
            className={cn(
              "w-3 h-3 rounded-full transition-colors duration-300",
              getStatusColor(),
              isConnecting && "animate-pulse"
            )}
          />
          {isConnected && (
            <div
              className={cn(
                "absolute inset-0 w-3 h-3 rounded-full animate-ping",
                getStatusColor(),
                "opacity-75"
              )}
            />
          )}
        </div>

        {/* Status Text */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {getStatusText()}
            </span>
          </div>

          {isConnected && connectionInfo && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{databaseCount} databases</span>
              <span>•</span>
              <span>Connected {formatConnectionTime()}</span>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1 text-xs text-red-400 mt-1"
            >
              <AlertCircle size={12} />
              <span>{error}</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Actions */}
      <AnimatePresence>
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2"
          >
            <Tooltip placement="left" content="Disconnect">
              <button
                onClick={onDisconnect}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded transition-all"
              >
                <Power size={14} />
              </button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
