import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface TokenInputProps {
  onConnect: (token: string) => void;
  isConnecting: boolean;
  error: string | null;
  storedToken: string;
}

export const TokenInput: React.FC<TokenInputProps> = ({
  onConnect,
  isConnecting,
  error,
  storedToken,
}) => {
  const [authToken, setAuthToken] = useState(storedToken);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleConnect = async () => {
    if (!authToken.trim()) return;

    try {
      await onConnect(authToken.trim());
    } catch (err) {
      // Error handled by parent
    }
  };

  const isValidToken =
    authToken.trim().length > 0

  return (
    <div className="space-y-4 w-100">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Connect to MotherDuck
        </h3>
        <p className="text-sm text-muted-foreground">Import your tables for analysis</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="token" className="text-sm font-medium text-foreground/80">
            API Token
          </label>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-orange-300 hover:text-orange-200 flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            {showAdvanced ? "Hide" : "Help"}
          </button>
        </div>

        <div className="relative">
          <input
            id="token"
            type="password"
            placeholder="md_... or token_..."
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            className={cn(
              "w-full px-3 py-3 h-12 bg-popover border border-border rounded-lg text-foreground/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground transition-all",
              error &&
                "border-destructive focus:ring-destructive/50 focus:border-destructive",
              isValidToken &&
                "border-green-500/50 focus:ring-green-500/50 focus:border-green-500"
            )}
          />

          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {isConnecting ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : isValidToken ? (
              <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            ) : authToken ? (
              <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
            ) : null}
          </div>
        </div>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs"
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-blue-300 space-y-1">
                  <p>
                    <strong>What we collect:</strong> Your API token to read
                    databases
                  </p>
                  <p>
                    <strong>What we do:</strong> Import data locally for fast
                    analysis
                  </p>
                  <p>
                    <strong>Get token:</strong>{" "}
                    <a
                      href="https://app.motherduck.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-200"
                    >
                      MotherDuck Settings
                    </a>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleConnect}
            disabled={isConnecting || !isValidToken}
            className={cn(
              "px-6 py-2.5",
              isValidToken ? "hover:border-green-700" : undefined
            )}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-400">
              <p className="font-medium">Connection Error</p>
              <p className="text-xs text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
