import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Globe,
  FileText,
  Github,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

import useCustomURLImport from "@/hooks/remote/custom/useCustomURLImport";
import usePublicDatasets from "@/hooks/remote/usePublicDatasets";

interface CustomURLPanelProps {
  onImport: (result: any) => void;
}

const URLDatasetCard = ({ dataset, onImport, isImporting }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-accent/5 border border-border rounded-lg p-4 hover:bg-accent/8 hover:border-border transition-all duration-200"
    >
      <div className="mb-3">
        <div className="flex items-center mb-1">
          <h4 className="text-sm font-medium text-foreground truncate mr-2">
            {dataset.name}
          </h4>
          {dataset.featured && (
            <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded">
              Featured
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {dataset.description}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <div className="flex items-center space-x-3">
          <span className="flex items-center">
            {dataset.provider === "github" ? (
              <Github className="h-3 w-3 mr-1" />
            ) : (
              <Globe className="h-3 w-3 mr-1" />
            )}
            {dataset.provider}
          </span>
          <span className="bg-accent/10 text-foreground/80 px-1.5 py-0.5 rounded">
            {dataset.format.join(", ")}
          </span>
          <span className="text-muted-foreground">{dataset.size}</span>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => onImport(dataset)}
        disabled={isImporting}
        className="w-full text-xs h-8"
      >
        {isImporting ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Importing
          </>
        ) : (
          <>
            <Download className="h-3 w-3 mr-1" />
            Import Dataset
          </>
        )}
      </Button>
    </motion.div>
  );
};

const CustomURLPanel = ({ onImport }) => {
  const [customUrl, setCustomUrl] = useState("");
  const [inputError, setInputError] = useState(null);

  // Hooks
  const {
    datasets,
    loading: datasetsLoading,
    fetchDatasets,
  } = usePublicDatasets("custom-url");

  const { importFromURL, isImporting, importStatus, validateURL } =
    useCustomURLImport();

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const validateCustomURL = (url) => {
    setInputError(null);

    if (!url.trim()) {
      setInputError("Please enter a URL");
      return false;
    }

    const validation = validateURL(url);
    if (!validation.isValid) {
      setInputError(validation.error || "Please enter a valid URL");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateCustomURL(customUrl)) {
      try {
        const result = await importFromURL(customUrl);
        console.log("result", result);
        onImport(result);
      } catch (error) {
        console.error("Failed to import custom URL:", error);
      }
    }
  };

  const handleDatasetImport = async (dataset) => {
    try {
      const result = await importFromURL(dataset.url);
      console.log("result", result);
      onImport(result);
    } catch (error) {
      console.error("Failed to import URL dataset:", error);
    }
  };

  // Validate custom URL
  const urlValidation = customUrl.trim() ? validateURL(customUrl) : null;
  const isValidUrl = urlValidation?.isValid;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Custom URL Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label
              htmlFor="custom-url"
              className="block text-sm font-medium text-foreground/80 mb-2"
            >
              File URL (public access)
            </label>
            <div className="relative">
              <input
                id="custom-url"
                type="text"
                placeholder="https://raw.githubusercontent.com/user/repo/main/data.csv"
                className={cn(
                  "w-full px-3 py-3 h-12 bg-popover border border-border rounded-lg text-foreground/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground transition-all",
                  inputError &&
                    "border-destructive focus:ring-destructive/50 focus:border-destructive",
                  isValidUrl &&
                    "border-green-500/50 focus:ring-green-500/50 focus:border-green-500"
                )}
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                disabled={isImporting}
              />

              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isImporting ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : isValidUrl ? (
                  <div className="bg-green-500/20 text-green-500 p-1.5 rounded-full">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                ) : customUrl ? (
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

            {/* URL info */}
            {isValidUrl && urlValidation?.detectedFormat && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 overflow-hidden"
              >
                <div className="bg-green-500/10 rounded-lg border border-green-500/20 p-4">
                  <div className="flex items-center text-sm text-foreground/90 mb-2">
                    <FileText className="h-4 w-4 mr-2 text-green-500" />
                    <span className="font-medium">
                      {urlValidation.detectedFormat?.toUpperCase()} file
                      detected
                    </span>
                    {urlValidation.source && (
                      <span className="ml-2 text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                        {urlValidation.source}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <span>Valid URL - ready to import</span>
                  </div>

                  {/* Preview link */}
                  <div className="mt-2 pt-2 border-t border-green-500/20">
                    <a
                      href={customUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-400 hover:text-green-300 flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open file URL
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              type="submit"
              className={cn(
                "px-6 py-2.5",
                isValidUrl ? "border-green-700 hover:bg-green-700" : undefined
              )}
              disabled={isImporting || !customUrl.trim() || !isValidUrl}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing
                </>
              ) : (
                <>
                  Import from URL
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
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center text-sm">
                    <p className="text-primary font-medium">{importStatus}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Example Datasets */}
        <div className="border-t border-border pt-6">
          <div className="mb-4">
            <h4 className="text-base font-medium text-foreground mb-2 flex items-center">
              Example Datasets
            </h4>
            <p className="text-sm text-muted-foreground">
              Try these curated public datasets from GitHub
            </p>
          </div>

          {datasetsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Loading datasets...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {datasets.map((dataset) => (
                <URLDatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  onImport={handleDatasetImport}
                  isImporting={isImporting}
                />
              ))}
            </div>
          )}
        </div>

        {/* Loading/Status indicator */}
      </div>

      {/* Footer Info */}
      <div className="border-t border-border p-4 bg-accent/5">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center mb-2">
            <Link className="h-3 w-3 mr-1.5 text-primary" />
            <span className="font-medium text-foreground/80">Supported URLs:</span>
          </div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Direct file URLs (CSV, JSON, Parquet, Excel)
            </li>
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Public data repositories and APIs
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export { CustomURLPanel };
