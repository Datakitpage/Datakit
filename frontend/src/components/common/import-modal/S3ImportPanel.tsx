import { useState, useEffect, FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Database,
  Globe,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

import useS3Import from "@/hooks/remote/s3/useS3Import";
import usePublicDatasets from "@/hooks/remote/usePublicDatasets";

interface S3ImportPanelProps {
  onImport: (result: any) => void;
}

const S3DatasetCard = ({ dataset, onImport, isImporting }) => {
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
            <Globe className="h-3 w-3 mr-1" />
            {dataset.region}
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

const S3ImportPanel: FC<S3ImportPanelProps> = ({ onImport }) => {
  const [customS3Url, setCustomS3Url] = useState("");
  const [inputError, setInputError] = useState(null);

  // Hooks
  const {
    datasets,
    loading: datasetsLoading,
    fetchDatasets,
  } = usePublicDatasets("aws");
  const { importFromS3, isImporting, importStatus, validateS3Url } =
    useS3Import();

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const validateURL = (url) => {
    setInputError(null);

    if (!url.trim()) {
      setInputError("Please enter an S3 URL");
      return false;
    }

    const validation = validateS3Url(url);
    if (!validation.isValid) {
      setInputError(validation.error || "Please enter a valid S3 URL");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateURL(customS3Url)) {
      try {
        const result = await importFromS3(customS3Url);
        const enhancedResult = {
          ...result,
          isRemote: true,
          remoteProvider: "s3",
          remoteURL: customS3Url,
        };
        onImport(enhancedResult);
      } catch (error) {
        console.error("Failed to import custom S3 URL:", error);
      }
    }
  };

  const handleDatasetImport = async (dataset) => {
    try {
      const result = await importFromS3(
        dataset.s3Url,
        dataset.name.replace(/[^a-zA-Z0-9_-]/g, "_")
      );

      const enhancedResult = {
        ...result,
        isRemote: true,
        remoteProvider: "s3",
        remoteURL: dataset.s3Url,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          category: dataset.category,
          bucket: dataset.bucket,
          region: dataset.region,
        },
      };

      onImport(enhancedResult);
    } catch (error) {
      console.error("Failed to import S3 dataset:", error);
    }
  };

  // Validate custom S3 URL
  const urlValidation = customS3Url.trim() ? validateS3Url(customS3Url) : null;
  const isValidS3Url = urlValidation?.isValid;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {/* S3 URL Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label
              htmlFor="s3-url"
              className="block text-sm font-medium text-foreground/80 mb-2"
            >
              S3 URL (public bucket)
            </label>
            <div className="relative">
              <input
                id="s3-url"
                type="text"
                placeholder="s3://bucket/path/file.csv or https://bucket.s3.amazonaws.com/file.csv"
                className={cn(
                  "w-full px-3 py-3 h-12 bg-popover border border-border rounded-lg text-foreground/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground transition-all",
                  inputError &&
                    "border-destructive focus:ring-destructive/50 focus:border-destructive",
                  isValidS3Url &&
                    "border-green-500/50 focus:ring-green-500/50 focus:border-green-500"
                )}
                value={customS3Url}
                onChange={(e) => setCustomS3Url(e.target.value)}
                disabled={isImporting}
              />

              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isImporting ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : isValidS3Url ? (
                  <div className="bg-green-500/20 text-green-500 p-1.5 rounded-full">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                ) : customS3Url ? (
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

            {/* S3 URL info */}
            {isValidS3Url && urlValidation?.bucket && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 overflow-hidden"
              >
                <div className="bg-green-500/10 rounded-lg border border-green-500/20 p-4">
                  <div className="flex items-center text-sm text-foreground/90 mb-2">
                    <Database className="h-4 w-4 mr-2 text-green-500" />
                    <span className="font-medium font-mono">
                      {urlValidation.bucket}
                    </span>
                    {urlValidation.region && (
                      <span className="ml-2 text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                        {urlValidation.region}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <span>Valid S3 URL - ready to import</span>
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
                isValidS3Url
                  ? "border-green-700 hover:border-green-700"
                  : undefined
              )}
              disabled={isImporting || !customS3Url.trim() || !isValidS3Url}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing
                </>
              ) : (
                <>
                  Import from S3
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
              Try these curated public datasets to get started
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
                <S3DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  onImport={handleDatasetImport}
                  isImporting={isImporting}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-border p-4 bg-accent/5">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center mb-2">
            <Shield className="h-3 w-3 mr-1.5 text-primary" />
            <span className="font-medium text-foreground/80">
              S3 Browser Access:
            </span>
          </div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Most S3 buckets require proxy access due to CORS
            </li>
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Supports CSV, JSON, Parquet, Excel formats
            </li>
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Auto-detects file format and compression
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default S3ImportPanel;
