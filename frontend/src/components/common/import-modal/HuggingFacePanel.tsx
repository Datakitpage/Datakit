import { useState, useEffect, FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Database,
  Search,
  ChevronRight,
  Eye,
  Users,
  Calendar,
  Lock,
  Key,
  Zap,
  AlertTriangle,
  RefreshCw,
  Settings,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/Button";

import { cn } from "@/lib/utils";

import useHuggingFaceImport from "@/hooks/remote/huggingface/useHuggingFaceImport";
import usePublicDatasets from "@/hooks/remote/usePublicDatasets";


import type { DatasetConfig, DatasetSplit } from "@/hooks/remote/huggingface/types";

interface HuggingFacePanelProps {
  onImport: (result: any) => void;
}

/**
 * Config/Split Selector Component
 */
const ConfigSplitSelector = ({ 
  configs, 
  splits, 
  selectedConfig, 
  selectedSplit, 
  onConfigChange, 
  onSplitChange, 
  disabled = false,
  loading = false 
}: {
  configs: DatasetConfig[];
  splits: DatasetSplit[];
  selectedConfig?: string;
  selectedSplit?: string;
  onConfigChange: (config: string) => void;
  onSplitChange: (split: string) => void;
  disabled?: boolean;
  loading?: boolean;
}) => {
  const availableSplits = selectedConfig 
    ? splits.filter(s => s.config === selectedConfig)
    : splits;

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-accent/5 rounded-lg border border-border">
        <span className="text-sm text-muted-foreground">Loading configurations...</span>
      </div>
    );
  }

  if (configs.length === 0 && splits.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="space-y-3 p-4 bg-accent/5 rounded-lg border border-border"
    >
      <div className="flex items-center text-sm text-foreground/80 mb-2">
        <Settings className="h-4 w-4 mr-2" />
        <span className="font-medium">Dataset Configuration</span>
      </div>

      {/* Config Selector */}
      {configs.length > 1 && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Configuration (Subset)
          </label>
          <select
            value={selectedConfig || configs[0]?.config_name || ""}
            onChange={(e) => onConfigChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-popover border border-border rounded text-foreground/90 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
          >
            {configs.map((config) => (
              <option key={config.config_name} value={config.config_name}>
                {config.config_name}
                {config.description && ` - ${config.description}`}
              </option>
            ))}
          </select>
          
          {selectedConfig && (
            <div className="mt-2 p-2 bg-background/20 rounded text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Available splits:</span>
                <span className="text-primary">
                  {configs.find(c => c.config_name === selectedConfig)?.splits.join(", ")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Split Selector */}
      {availableSplits.length > 1 && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Split
          </label>
          <select
            value={selectedSplit || availableSplits[0]?.split || ""}
            onChange={(e) => onSplitChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-popover border border-border rounded text-foreground/90 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
          >
            {availableSplits.map((split) => (
              <option key={`${split.config}-${split.split}`} value={split.split}>
                {split.split}
                {split.num_examples && ` (${split.num_examples.toLocaleString()} examples)`}
              </option>
            ))}
          </select>
          
         
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center text-xs text-white/60 pt-1">
        <Info className="h-3 w-3 mr-1" />
        <span>
          Will import: <span className="text-foreground/80 font-medium">
            {selectedConfig || configs[0]?.config_name || "default"}/
            {selectedSplit || availableSplits[0]?.split || "train"}
          </span>
        </span>
      </div>
    </motion.div>
  );
};

/**
 * Enhanced Dataset ID Input with parsing feedback
 */
const DatasetIdInput = ({ 
  value, 
  onChange, 
  onConfigDetected, 
  onSplitDetected, 
  disabled, 
  isValid, 
  error 
}: {
  value: string;
  onChange: (value: string) => void;
  onConfigDetected: (config?: string) => void;
  onSplitDetected: (split?: string) => void;
  disabled: boolean;
  isValid: boolean;
  error?: string;
}) => {


  // Parse the input to detect config/split
  useEffect(() => {
    if (value.trim()) {
      // Parse format: dataset[:config][/split]
      let datasetPart = value.trim();
      let config: string | undefined;
      let split: string | undefined;
      
      // Extract split if present (after last /)
      const lastSlashIndex = datasetPart.lastIndexOf("/");
      if (lastSlashIndex > -1) {
        const potentialSplit = datasetPart.substring(lastSlashIndex + 1);
        const datasetWithoutSplit = datasetPart.substring(0, lastSlashIndex);
        
        // Check if this looks like a split
        const commonSplits = ["train", "test", "validation", "val", "dev", "eval"];
        if (commonSplits.includes(potentialSplit.toLowerCase()) || 
            potentialSplit.match(/^(train|test|val|validation|dev|eval)[\d_-]*$/i)) {
          split = potentialSplit;
          datasetPart = datasetWithoutSplit;
        }
      }
      
      // Extract config if present (after :)
      const colonIndex = datasetPart.indexOf(":");
      if (colonIndex > -1) {
        config = datasetPart.substring(colonIndex + 1);
      }
      
      onConfigDetected(config);
      onSplitDetected(split);
    } else {
      onConfigDetected(undefined);
      onSplitDetected(undefined);
    }
  }, [value, onConfigDetected, onSplitDetected]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="dataset-id" className="block text-sm font-medium text-foreground/80">
          Dataset ID
        </label>
      
      </div>

      <div className="relative">
        <input
          id="dataset-id"
          type="text"
          placeholder="microsoft/DialoGPT-medium or yandex/yambda:SelfRC/train"
          className={cn(
            "w-full px-3 py-3 h-12 bg-popover border border-border rounded-lg text-foreground/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground transition-all",
            error && "border-destructive focus:ring-destructive/50 focus:border-destructive",
            isValid && "border-green-500/50 focus:ring-green-500/50 focus:border-green-500"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />

        {/* Status indicator */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {disabled ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : isValid ? (
            <div className="bg-green-500/20 text-green-500 p-1.5 rounded-full">
              <CheckCircle className="h-4 w-4" />
            </div>
          ) : value ? (
            <div className="bg-red-500/20 text-red-500 p-1.5 rounded-full">
              <AlertCircle className="h-4 w-4" />
            </div>
          ) : null}
        </div>
      </div>

    

      {/* Error display */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-destructive flex items-center"
        >
          <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
          {error}
        </motion.p>
      )}
    </div>
  );
};

const HFDatasetCard = ({ dataset, onImport, isImporting }) => {
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
          {dataset.gated && <Lock className="h-3 w-3 text-yellow-500 ml-1" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {dataset.description}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <div className="flex items-center space-x-3">
          <span className="flex items-center">
            <Users className="h-3 w-3 mr-1" />
            {dataset.downloads?.toLocaleString() || "N/A"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 mr-1" />
          <span>Updated {dataset.lastModified || "Recently"}</span>
        </div>
        {dataset.likes && (
          <div className="flex items-center text-xs text-muted-foreground">
            <span>❤️ {dataset.likes}</span>
          </div>
        )}
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

const ImportStrategyIndicator = ({ strategy, status }) => {
  const strategyConfig = {
    "Direct Streaming": {
      icon: <Zap className="h-3 w-3" />,
      color: "text-blue-400",
      description: "Fastest, no download required",
    },
    "Parquet Download": {
      icon: <Download className="h-3 w-3" />,
      color: "text-green-400",
      description: "Reliable, full dataset download",
    },
    "Alternative Format": {
      icon: <RefreshCw className="h-3 w-3" />,
      color: "text-yellow-400",
      description: "Fallback to CSV/JSON format",
    },
  };

  const config = strategyConfig[strategy];
  if (!config) return null;

  return (
    <div className="flex items-center text-xs text-white/70 mb-1">
      <div className={cn("mr-2", config.color)}>{config.icon}</div>
      <span className="font-medium">{strategy}</span>
      <span className="mx-2">•</span>
      <span className="text-white/50">{config.description}</span>
    </div>
  );
};

const HuggingFacePanel: FC<HuggingFacePanelProps> = ({ onImport }) => {
  const [datasetId, setDatasetId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [inputError, setInputError] = useState(null);
  const [currentStrategy, setCurrentStrategy] = useState("");
  
  // Config/Split state
  const [availableConfigs, setAvailableConfigs] = useState<DatasetConfig[]>([]);
  const [availableSplits, setAvailableSplits] = useState<DatasetSplit[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [selectedSplit, setSelectedSplit] = useState<string>("");
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [detectedConfig, setDetectedConfig] = useState<string | undefined>();
  const [detectedSplit, setDetectedSplit] = useState<string | undefined>();

  // Hooks
  const {
    datasets,
    loading: datasetsLoading,
    fetchDatasets,
    searchDatasets,
    isSearching,
    searchResults,
  } = usePublicDatasets("huggingface");

  const {
    importWithProgressiveFallback,
    getDatasetSplits,
    isImporting,
    importStatus,
    importProgress,
    validateDatasetId,
    error: importError,
    resetError,
  } = useHuggingFaceImport();

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  // Reset error when dataset ID changes
  useEffect(() => {
    if (importError) {
      resetError();
    }
  }, [datasetId, resetError, importError]);

  // Detect import strategy from status
  useEffect(() => {
    if (importStatus) {
      if (importStatus.includes("Direct Streaming")) {
        setCurrentStrategy("Direct Streaming");
      } else if (importStatus.includes("Parquet Download")) {
        setCurrentStrategy("Parquet Download");
      } else if (importStatus.includes("Alternative Format")) {
        setCurrentStrategy("Alternative Format");
      }
    }
  }, [importStatus]);

  // Load configs and splits when dataset ID changes
  useEffect(() => {
    const loadDatasetMetadata = async () => {
      const validation = validateDatasetId(datasetId);
      if (!validation.isValid || !datasetId.trim()) {
        setAvailableConfigs([]);
        setAvailableSplits([]);
        setSelectedConfig("");
        setSelectedSplit("");
        return;
      }

      try {
        setLoadingConfigs(true);
        
        // Extract base dataset ID (without config/split)
        const baseDatasetId = validation.organization 
          ? `${validation.organization}/${validation.dataset}`
          : validation.dataset;

        const { splits, configs } = await getDatasetSplits(baseDatasetId, authToken || undefined);
        
        setAvailableConfigs(configs);
        setAvailableSplits(splits);
        
        // Set default selections or use detected values
        if (configs.length > 0) {
          const defaultConfig = detectedConfig || validation.config || configs[0].config_name;
          setSelectedConfig(defaultConfig);
          
          // Find splits for the selected config
          const configSplits = splits.filter(s => s.config === defaultConfig);
          if (configSplits.length > 0) {
            const defaultSplit = detectedSplit || validation.split || configSplits[0].split;
            setSelectedSplit(defaultSplit);
          }
        } else if (splits.length > 0) {
          const defaultSplit = detectedSplit || validation.split || splits[0].split;
          setSelectedSplit(defaultSplit);
        }
        
      } catch (error) {
        console.warn("Failed to load dataset metadata:", error);
        setAvailableConfigs([]);
        setAvailableSplits([]);
      } finally {
        setLoadingConfigs(false);
      }
    };

    const timeoutId = setTimeout(loadDatasetMetadata, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [datasetId, authToken, getDatasetSplits, validateDatasetId, detectedConfig, detectedSplit]);

  const validateInput = (id) => {
    setInputError(null);

    if (!id.trim()) {
      setInputError("Please enter a dataset ID");
      return false;
    }

    const validation = validateDatasetId(id);
    if (!validation.isValid) {
      setInputError(validation.error || "Please enter a valid dataset ID");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateInput(datasetId)) {
      try {
        const options = {
          authToken: authToken || undefined,
          config: selectedConfig || undefined,
          split: selectedSplit || undefined,
        };

        const result = await importWithProgressiveFallback(datasetId, options);

        const enhancedResult = {
          ...result,
          isRemote: true,
          remoteProvider: "huggingface",
          remoteURL: `https://huggingface.co/datasets/${datasetId}`,
        };

        onImport(enhancedResult);
      } catch (error) {
        console.error("Failed to import HuggingFace dataset:", error);
      }
    }
  };

  const handleDatasetImport = async (dataset) => {
    try {
      const options = {
        authToken: authToken || undefined,
        config: selectedConfig || undefined,
        split: selectedSplit || undefined,
      };

      const result = await importWithProgressiveFallback(dataset.id, options);

      const enhancedResult = {
        ...result,
        isRemote: true,
        remoteProvider: "huggingface",
        remoteURL: `https://huggingface.co/datasets/${dataset.id}`,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          task: dataset.task,
          downloads: dataset.downloads,
          likes: dataset.likes,
        },
      };

      onImport(enhancedResult);
    } catch (error) {
      console.error("Failed to import HuggingFace dataset:", error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('searchQuery', searchQuery);
      await searchDatasets(searchQuery.trim(), { limit: 20 });
    }
  };


  const idValidation = datasetId.trim() ? validateDatasetId(datasetId) : null;
  const isValidId = idValidation?.isValid;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Dataset ID Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <DatasetIdInput
            value={datasetId}
            onChange={setDatasetId}
            onConfigDetected={setDetectedConfig}
            onSplitDetected={setDetectedSplit}
            disabled={isImporting}
            isValid={isValidId}
            error={inputError}
          />

          {/* Import error */}
          {importError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-400">
                  <p className="font-medium">Import Failed</p>
                  <p className="text-xs text-red-400/80 mt-1">
                    {importError}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Dataset info and config/split selector */}
          {isValidId && idValidation?.organization && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 overflow-hidden space-y-4"
            >
              <div className="bg-green-500/10 rounded-lg border border-green-500/20 p-4">
                <div className="flex items-center text-sm text-foreground/90 mb-2">
                  <Database className="h-4 w-4 mr-2 text-green-500" />
                  <span className="font-medium font-mono">
                    {idValidation.organization}/{idValidation.dataset}
                  </span>
                  <a
                    href={`https://huggingface.co/datasets/${datasetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded flex items-center hover:bg-green-500/30"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </a>
                </div>

                <div className="flex items-center text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <span>Valid dataset ID - ready to import</span>
                </div>
              </div>

              {/* Config/Split Selector */}
              <ConfigSplitSelector
                configs={availableConfigs}
                splits={availableSplits}
                selectedConfig={selectedConfig}
                selectedSplit={selectedSplit}
                onConfigChange={setSelectedConfig}
                onSplitChange={setSelectedSplit}
                disabled={isImporting}
                loading={loadingConfigs}
              />
            </motion.div>
          )}

          {/* Authentication Section */}
          <div className="border border-border rounded-lg p-4 bg-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Key className="h-4 w-4 mr-2 text-yellow-500" />
                <span className="text-sm font-medium text-foreground">
                  Authentication (Optional)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAuth(!showAuth)}
                className="text-xs text-primary hover:text-primary-foreground"
              >
                {showAuth ? "Hide" : "Show"}
              </button>
            </div>

            <AnimatePresence>
              {showAuth && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-xs text-muted-foreground mb-3">
                    Required for private or gated datasets. Get your token from{" "}
                    <a
                      href="https://huggingface.co/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      HuggingFace Settings
                    </a>
                  </p>
                  <input
                    type="password"
                    placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 bg-popover border border-border rounded text-foreground/90 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              type="submit"
              className={cn(
                "px-6 py-2.5",
                isValidId
                  ? "border-green-700 hover:border-green-700"
                  : undefined
              )}
              disabled={isImporting || !datasetId.trim() || !isValidId}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing
                </>
              ) : (
                <>
                  Import Dataset
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>

          {/* Import Progress */}
          <AnimatePresence>
            {isImporting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  {/* Current strategy indicator */}
                  {currentStrategy && (
                    <ImportStrategyIndicator
                      strategy={currentStrategy}
                      status="active"
                    />
                  )}

                  <div className="flex items-center text-sm mb-2">
                    <p className="text-primary font-medium">{importStatus}</p>
                  </div>

                  {/* Progress bar */}
                  {importProgress > 0 && (
                    <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress * 100}%` }}
                      />
                    </div>
                  )}

                  <p className="text-xs text-primary/80">
                    {importProgress > 0
                      ? `${Math.round(importProgress * 100)}% complete`
                      : "Initializing..."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Search Section */}
        <div className="border-t border-white/10 pt-6 mb-6">
          <div className="mb-4">
            <h4 className="text-base font-medium text-foreground mb-2 flex items-center">
              Search Datasets
            </h4>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Search datasets by name, task, or description..."
                className="flex-1 px-3 py-2 bg-popover border border-border rounded text-foreground/90 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h5 className="text-sm font-medium text-white/80 mb-3">
                Search Results ({searchResults.length})
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.slice(0, 9).map((dataset) => (
                  <HFDatasetCard
                    key={dataset.id}
                    dataset={dataset}
                    onImport={handleDatasetImport}
                    isImporting={isImporting}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Example Datasets */}
        <div className="border-t border-white/10 pt-6">
          <div className="mb-4">
            <h4 className="text-base font-medium text-foreground mb-2 flex items-center">
              Featured Datasets
            </h4>
            <p className="text-sm text-muted-foreground">
              Popular datasets to get you started
            </p>
          </div>

          {datasetsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Loading datasets...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {datasets.slice(0, 6).map((dataset) => (
                <HFDatasetCard
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
         
            <span className="font-medium text-foreground/80">
              HuggingFace Integration:
            </span>
          </div>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Memory-efficient processing for large datasets
            </li>
            <li className="flex items-center">
              <span className="h-1 w-1 bg-muted-foreground rounded-full mr-2"></span>
              Multi-format support (Parquet, CSV, JSON, XLSX, TXT)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HuggingFacePanel;