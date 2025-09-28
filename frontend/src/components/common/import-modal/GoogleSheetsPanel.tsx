import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
  Table,
  Loader2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import GoogleSheetsIcon from "@/components/icons/GoogleSheetsIcon";
import GoogleSheetsPublishGuide from "./GoogleSheetsPublishGuide";
import { parseGoogleSheetsUrl } from "@/lib/google/sheetsUtils";
import useGoogleSheetsImport from "@/hooks/remote/sheets/useGoogleSheetsImport";

interface GoogleSheetsPanelProps {
  onImport: (result: any) => void;
}

const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({ onImport }) => {
  const [url, setUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  // Google Sheets detection state
  const [isGoogleSheet, setIsGoogleSheet] = useState(false);
  const [googleSheetInfo, setGoogleSheetInfo] = useState<any>(null);

  // Google Sheets import hook
  const {
    importFromGoogleSheets,
    isImporting,
    importStatus,
    importProgress,
    error: importError,
  } = useGoogleSheetsImport();

  // Analyze URL when it changes - detect Google Sheets
  useEffect(() => {
    if (!url.trim()) {
      setIsGoogleSheet(false);
      setGoogleSheetInfo(null);
      setInputError(null);
      return;
    }

    try {
      // Check if it's a Google Sheets URL
      const sheetInfo = parseGoogleSheetsUrl(url);
      setIsGoogleSheet(sheetInfo.isGoogleSheet);
      setGoogleSheetInfo(sheetInfo);
      setInputError(null);
    } catch (err) {
      setIsGoogleSheet(false);
      setGoogleSheetInfo(null);
    }
  }, [url]);

  const validateURL = (url: string): boolean => {
    // Reset previous errors
    setInputError(null);

    // Basic URL validation
    if (!url.trim()) {
      setInputError("Please enter a Google Sheets URL");
      return false;
    }

    try {
      // Create URL object to validate format
      new URL(url);

      // Validate for Google Sheets URL
      if (!isGoogleSheet) {
        setInputError(
          "Please enter a valid Google Sheets URL that's published to the web"
        );
        return false;
      }

      return true;
    } catch (err) {
      setInputError("Please enter a valid URL");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateURL(url)) {
      try {
        const result = await importFromGoogleSheets(url);

        // Add remote source metadata
        const enhancedResult = {
          ...result,
          isRemote: true,
          remoteProvider: "google-sheets",
          remoteURL: url,
          googleSheets: {
            url,
            sheetName: googleSheetInfo?.sheetName,
            format: googleSheetInfo?.format,
          },
        };

        onImport(enhancedResult);
      } catch (error) {
        // Error handling is already done by the hook
        console.error("Google Sheets import failed:", error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="google-sheets-url"
              className="block text-sm font-medium text-foreground/80 mb-2"
            >
              Google Sheets URL (published to the web)
            </label>
            <div className="relative">
              <input
                id="google-sheets-url"
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/e/2PACX..."
                className={cn(
                  "w-full px-3 py-3 h-12 bg-popover border border-border rounded-lg text-foreground/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground transition-all",
                  inputError &&
                    "border-destructive focus:ring-destructive/50 focus:border-destructive",
                  isGoogleSheet &&
                    "border-green-500/50 focus:ring-green-500/50 focus:border-green-500"
                )}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isImporting}
              />

              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isImporting ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : isGoogleSheet ? (
                  <div className="bg-green-500/20 text-green-500 p-1.5 rounded-full">
                    <Check className="h-4 w-4" />
                  </div>
                ) : url ? (
                  <div className="bg-red-500/20 text-red-500 p-1.5 rounded-full">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Input feedback */}
            {inputError && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-xs text-destructive flex items-center"
              >
                <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                {inputError}
              </motion.p>
            )}

            {/* Google Sheets info */}
            {isGoogleSheet && googleSheetInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 overflow-hidden"
              >
                <div className="bg-green-500/10 rounded-lg border border-green-500/20 p-4">
                  <div className="flex items-center text-sm text-foreground/90 mb-2">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
                    <span className="font-medium">
                      {googleSheetInfo.sheetName || "Google Sheet"}
                    </span>
                    {googleSheetInfo.format && (
                      <span className="ml-2 text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                        {googleSheetInfo.format.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-xs text-muted-foreground">
                    <Table className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <span>Published sheet - ready to import</span>
                  </div>

                  {/* Preview link */}
                  <div className="mt-2 pt-2 border-t border-green-500/20">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-400 hover:text-green-300 flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open in Google Sheets
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="outline"
              className={cn(
                "px-6 py-2.5",
                isGoogleSheet
                  ? "border-green-700 hover:border-green-700"
                  : undefined
              )}
              disabled={isImporting || !url.trim() || !isGoogleSheet}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing
                </>
              ) : (
                <>
                  Import Sheet
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
          <AnimatePresence>
            {isImporting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-center text-sm">
                    <p className="text-green-400 font-medium">{importStatus}</p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-background h-2 mt-3 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-green-500 h-full rounded-full"
                      initial={{ width: "5%" }}
                      animate={{
                        width: `${Math.max(5, importProgress * 100)}%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Google Sheets Guide */}
        <div className="mt-6">
          <GoogleSheetsPublishGuide compact={false} />
        </div>

        {/* Loading/Status indicator */}

        {/* Error message */}
        <AnimatePresence>
          {importError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 text-destructive" />
                  <p className="text-destructive text-sm">{importError}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="border-t border-border p-4 bg-accent/5">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center mb-2">
            <GoogleSheetsIcon className="h-3 w-3 mr-1.5 text-green-500" />
            <span className="font-medium text-foreground/80">Requirements:</span>
          </div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Sheet must be published to the web
            </li>
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Supports CSV, Excel, and web page formats
            </li>
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              No authentication required for published sheets
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GoogleSheetsPanel;
