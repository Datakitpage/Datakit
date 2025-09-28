import React, { useState, useEffect } from "react";
import { 
  Download, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  HardDrive,
  Cpu,
  Clock,
  RefreshCw
} from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { aiService } from "@/lib/ai/aiService";
import { modelManager, ModelDownloadProgress, ModelStorageInfo } from "@/lib/ai/modelManager";
import { LocalModel } from "@/types/ai";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface LocalModelManagerProps {
  onClose?: () => void;
}

const LocalModelManager: React.FC<LocalModelManagerProps> = ({ onClose }) => {
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<LocalModel[]>([]);
  const [storageInfo, setStorageInfo] = useState<ModelStorageInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, ModelDownloadProgress>>(new Map());
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { setActiveModel, setActiveProvider } = useAIStore();

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Check WebGPU support
      const webgpuSupported = await aiService.isWebGPUSupported();
      setWebGPUSupported(webgpuSupported);

      // Get available models from WebLLM
      const available = aiService.getAvailableLocalModels();
      setAvailableModels(available);

      // Get downloaded models
      const downloaded = modelManager.getDownloadedModels();
      setDownloadedModels(downloaded);

      // Get storage info
      const storage = await modelManager.getStorageInfo();
      setStorageInfo(storage);

    } catch (error) {
      console.error('Failed to load local model data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadModel = async (model: any) => {
    try {
      const localModel: LocalModel = {
        id: model.id,
        name: model.name,
        provider: 'local',
        type: 'chat',
        contextWindow: 4096,
        capabilities: model.capabilities || ['sql', 'analysis'],
        requiresApiKey: false,
        isLocal: true,
        size: model.size,
        quantization: '4bit',
      };

      // Register progress callback
      modelManager.onDownloadProgress(model.id, (progress) => {
        setDownloadProgress(prev => new Map(prev.set(model.id, progress)));
        
        if (progress.stage === 'ready') {
          // Refresh downloaded models list
          loadData();
        }
      });

      // Start download
      await modelManager.startDownload(localModel);
      
      // Load the model in WebLLM (this triggers the actual download)
      await aiService.loadLocalModel(model.id, (progress) => {
        modelManager.emitProgress({
          modelId: model.id,
          progress,
          stage: progress < 100 ? 'downloading' : 'loading',
          message: progress < 100 ? `Downloading... ${progress.toFixed(1)}%` : 'Loading model...',
        });
      });

      // Mark as downloaded
      modelManager.handleDownloadComplete(localModel);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      modelManager.handleDownloadError(model.id, errorMessage);
      console.error('Model download failed:', error);
    }
  };

  const handleDeleteModel = (modelId: string) => {
    if (confirm('Are you sure you want to delete this model? This cannot be undone.')) {
      modelManager.removeModel(modelId);
      // Also unload if it's currently loaded
      const loadedModel = aiService.getLoadedLocalModel();
      if (loadedModel === modelId) {
        aiService.unloadLocalModel();
      }
      loadData();
    }
  };

  const handleUseModel = async (modelId: string) => {
    try {
      // Load the model if not already loaded
      const currentModel = aiService.getLoadedLocalModel();
      if (currentModel !== modelId) {
        await aiService.loadLocalModel(modelId);
      }
      
      // Set as active model
      setActiveProvider('local');
      setActiveModel(modelId);
      
      // Mark as used
      modelManager.markModelUsed(modelId);
      
      if (onClose) onClose();
      
    } catch (error) {
      console.error('Failed to load model:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatModelSize = (sizeMB: number): string => {
    if (sizeMB >= 1024) {
      return `${(sizeMB / 1024).toFixed(1)} GB`;
    }
    return `${sizeMB} MB`;
  };

  const getDownloadProgress = (modelId: string): ModelDownloadProgress | null => {
    return downloadProgress.get(modelId) || null;
  };

  const isModelDownloaded = (modelId: string): boolean => {
    return downloadedModels.some(m => m.id === modelId);
  };

  const getCurrentModel = aiService.getLoadedLocalModel();

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading local models...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-h-[80vh] overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Local AI Models</h3>
        <p className="text-sm text-muted-foreground">
          Run AI models locally in your browser with complete privacy
        </p>
      </div>

      {/* WebGPU Status */}
      <div className={cn(
        "mb-6 p-4 rounded-lg border",
        webGPUSupported 
          ? "bg-green-500/10 border-green-500/30" 
          : "bg-red-500/10 border-red-500/30"
      )}>
        <div className="flex items-center gap-2 mb-2">
          {webGPUSupported ? (
            <CheckCircle className="h-4 w-4 text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-foreground">
            WebGPU {webGPUSupported ? 'Supported' : 'Not Supported'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {webGPUSupported 
            ? "Your browser supports WebGPU acceleration for faster local AI inference."
            : "WebGPU is required for local models. Please use Chrome 113+, Edge 113+, or Firefox 110+."
          }
        </p>
      </div>

      {/* Storage Info */}
      {storageInfo && (
        <div className="mb-6 p-4 bg-accent/5 border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Storage Usage</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Downloaded Models:</span>
              <span className="text-foreground ml-2">{storageInfo.totalModels}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Storage Used:</span>
              <span className="text-foreground ml-2">{formatBytes(storageInfo.totalSizeBytes)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Available Models */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Download className="h-4 w-4" />
          Available Models
        </h4>
        
        <div className="space-y-3">
          {availableModels.map((model) => {
            const progress = getDownloadProgress(model.id);
            const isDownloaded = isModelDownloaded(model.id);
            const isCurrent = getCurrentModel === model.id;
            
            return (
              <div key={model.id} className="p-4 bg-accent/5 border border-border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-medium text-foreground">{model.name}</h5>
                      {isCurrent && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{model.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Size: {formatModelSize(model.size)}</span>
                      <span>Capabilities: {model.capabilities.join(', ')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {progress && progress.stage !== 'ready' ? (
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{progress.message}</span>
                        </div>
                        <div className="w-20 h-1 bg-accent/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progress.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : isDownloaded ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUseModel(model.id)}
                        className="h-7"
                      >
                        {isCurrent ? 'Current' : 'Use Model'}
                      </Button>
                    ) : webGPUSupported ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadModel(model)}
                        className="h-7"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    ) : (
                      <span className="text-xs text-destructive">WebGPU Required</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Downloaded Models */}
      {downloadedModels.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Downloaded Models
          </h4>
          
          <div className="space-y-3">
            {downloadedModels.map((model) => {
              const isCurrent = getCurrentModel === model.id;
              
              return (
                <div key={model.id} className="p-4 bg-accent/5 border border-border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-sm font-medium text-foreground">{model.name}</h5>
                        {isCurrent && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Size: {formatModelSize(model.size)}</span>
                        {model.lastUsed && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last used: {new Date(model.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUseModel(model.id)}
                        className="h-7"
                        disabled={isCurrent}
                      >
                        {isCurrent ? 'Current' : 'Use Model'}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModel(model.id)}
                        className="h-7 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={loadData}
          className="h-7"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
        
        {onClose && (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
};

export default LocalModelManager;