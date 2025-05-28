import { useAIAssistantStore } from '@/store/aiAssistantStore';

export interface ModelConfig {
  id: string;
  name: string;
  task: string;
  size: string;
  capabilities: string[];
  priority: 'high' | 'medium' | 'low';
  cdnUrl: string;
}

export interface ModelLoadingProgress {
  modelId: string;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  progress: number;
  error?: string;
}

/**
 * Available AI models for different tasks
 */
export const AI_MODELS: Record<string, ModelConfig> = {
  'text2sql-small': {
    id: 'text2sql-small',
    name: 'Xenova/flan-t5-small',
    task: 'text2text-generation',
    size: '~60MB',
    capabilities: ['sql-generation', 'query-explanation'],
    priority: 'high',
    cdnUrl: 'https://huggingface.co/Xenova/flan-t5-small'
  },
  'text2sql-base': {
    id: 'text2sql-base',
    name: 'Xenova/flan-t5-base',
    task: 'text2text-generation', 
    size: '~220MB',
    capabilities: ['advanced-sql', 'complex-queries', 'optimization'],
    priority: 'medium',
    cdnUrl: 'https://huggingface.co/Xenova/flan-t5-base'
  },
  'intent-classifier': {
    id: 'intent-classifier',
    name: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    task: 'text-classification',
    size: '~30MB',
    capabilities: ['intent-classification', 'sentiment-analysis'],
    priority: 'high',
    cdnUrl: 'https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english'
  },
  'embeddings': {
    id: 'embeddings',
    name: 'Xenova/all-MiniLM-L6-v2',
    task: 'feature-extraction',
    size: '~25MB',
    capabilities: ['semantic-search', 'similarity', 'embeddings'],
    priority: 'medium',
    cdnUrl: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2'
  }
};

/**
 * AI Model Manager - handles loading and caching of ML models
 */
export class AIModelManager {
  private static instance: AIModelManager;
  private loadedModels = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  private modelCache = new Map<string, { model: any; timestamp: number }>();
  
  // Cache TTL - 30 minutes
  private readonly CACHE_TTL = 30 * 60 * 1000;
  
  private constructor() {}
  
  static getInstance(): AIModelManager {
    if (!AIModelManager.instance) {
      AIModelManager.instance = new AIModelManager();
    }
    return AIModelManager.instance;
  }
  
  /**
   * Load a model on demand with progress tracking
   */
  async loadModel(modelId: string): Promise<any> {
    // Check if already loaded
    if (this.loadedModels.has(modelId)) {
      return this.loadedModels.get(modelId);
    }
    
    // Check if currently loading
    if (this.loadingPromises.has(modelId)) {
      return this.loadingPromises.get(modelId);
    }
    
    // Check cache
    const cached = this.modelCache.get(modelId);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      this.loadedModels.set(modelId, cached.model);
      return cached.model;
    }
    
    const config = AI_MODELS[modelId];
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    
    // Start loading
    const loadingPromise = this.loadModelFromCDN(config);
    this.loadingPromises.set(modelId, loadingPromise);
    
    try {
      const model = await loadingPromise;
      
      // Cache the model
      this.loadedModels.set(modelId, model);
      this.modelCache.set(modelId, { model, timestamp: Date.now() });
      this.loadingPromises.delete(modelId);
      
      // Update store
      useAIAssistantStore.getState().setModelLoadingState(modelId, 'loaded');
      
      console.log(`[ModelManager] Successfully loaded model: ${modelId}`);
      return model;
      
    } catch (error) {
      this.loadingPromises.delete(modelId);
      useAIAssistantStore.getState().setModelLoadingState(modelId, 'error', String(error));
      throw error;
    }
  }
  
  /**
   * Load model from CDN with progress tracking
   */
  private async loadModelFromCDN(config: ModelConfig): Promise<any> {
    console.log(`[ModelManager] Loading model: ${config.id} (${config.size})`);
    
    // Update store - model loading started
    useAIAssistantStore.getState().setModelLoadingState(config.id, 'loading');
    
    try {
      // Dynamically import transformers
      const { pipeline } = await import('@xenova/transformers');
      
      // Load the model with progress callback
      const model = await pipeline(config.task, config.name, {
        progress_callback: (progress: any) => {
          // Update loading progress in store
          useAIAssistantStore.getState().setModelLoadingProgress(config.id, progress);
          
          if (progress.status === 'downloading') {
            const percent = progress.progress ? Math.round(progress.progress * 100) : 0;
            console.log(`[ModelManager] Downloading ${config.id}: ${percent}%`);
          } else if (progress.status === 'loading') {
            console.log(`[ModelManager] Loading ${config.id}...`);
          }
        }
      });
      
      return model;
      
    } catch (error) {
      console.error(`[ModelManager] Failed to load model ${config.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a loaded model (throws if not loaded)
   */
  getModel(modelId: string): any {
    const model = this.loadedModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} is not loaded. Call loadModel() first.`);
    }
    return model;
  }
  
  /**
   * Check if a model is loaded
   */
  isModelLoaded(modelId: string): boolean {
    return this.loadedModels.has(modelId);
  }
  
  /**
   * Get loading status for a model
   */
  getModelStatus(modelId: string): 'idle' | 'loading' | 'loaded' | 'error' {
    if (this.loadedModels.has(modelId)) return 'loaded';
    if (this.loadingPromises.has(modelId)) return 'loading';
    return 'idle';
  }
  
  /**
   * Unload a model to free memory
   */
  unloadModel(modelId: string): void {
    this.loadedModels.delete(modelId);
    this.modelCache.delete(modelId);
    console.log(`[ModelManager] Unloaded model: ${modelId}`);
  }
  
  /**
   * Unload least recently used models if memory is getting full
   */
  async manageMemory(): Promise<void> {
    const MAX_MODELS = 3; // Keep max 3 models in memory
    
    if (this.loadedModels.size > MAX_MODELS) {
      // Sort by timestamp (LRU)
      const modelsByAge = Array.from(this.modelCache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp);
      
      // Unload oldest models
      const modelsToUnload = modelsByAge.slice(0, this.loadedModels.size - MAX_MODELS);
      
      for (const [modelId] of modelsToUnload) {
        this.unloadModel(modelId);
      }
      
      console.log(`[ModelManager] Unloaded ${modelsToUnload.length} models for memory management`);
    }
  }
  
  /**
   * Get information about all available models
   */
  getAvailableModels(): ModelConfig[] {
    return Object.values(AI_MODELS);
  }
  
  /**
   * Get models by capability
   */
  getModelsByCapability(capability: string): ModelConfig[] {
    return Object.values(AI_MODELS).filter(model => 
      model.capabilities.includes(capability)
    );
  }
  
  /**
   * Clear all models and cache
   */
  clearAll(): void {
    this.loadedModels.clear();
    this.loadingPromises.clear();
    this.modelCache.clear();
    console.log('[ModelManager] Cleared all models and cache');
  }
  
  /**
   * Get memory usage info
   */
  getMemoryInfo(): { loadedModels: number; cacheSize: number; totalSize: string } {
    const loadedModels = this.loadedModels.size;
    const cacheSize = this.modelCache.size;
    
    // Estimate total size
    const loadedModelSizes = Array.from(this.loadedModels.keys())
      .map(id => AI_MODELS[id]?.size || '0MB')
      .join(', ');
      
    return {
      loadedModels,
      cacheSize,
      totalSize: loadedModelSizes
    };
  }
}

/**
 * Singleton instance
 */
export const modelManager = AIModelManager.getInstance();

/**
 * Convenient functions for common operations
 */
export async function loadText2SQLModel(): Promise<any> {
  return modelManager.loadModel('text2sql-small');
}

export async function loadIntentClassifier(): Promise<any> {
  return modelManager.loadModel('intent-classifier');
}

export async function loadEmbeddingsModel(): Promise<any> {
  return modelManager.loadModel('embeddings');
}

/**
 * Check if we should use advanced models based on query complexity
 */
export function shouldUseAdvancedModel(query: string): boolean {
  const complexityIndicators = [
    'join', 'union', 'subquery', 'nested', 'window', 'partition',
    'aggregate', 'having', 'case when', 'exists', 'with'
  ];
  
  const queryLower = query.toLowerCase();
  const complexityScore = complexityIndicators.filter(indicator => 
    queryLower.includes(indicator)
  ).length;
  
  // Use advanced model if complexity score > 2 or query is very long
  return complexityScore > 2 || query.length > 200;
}

/**
 * Preload high-priority models based on user activity
 */
export async function preloadEssentialModels(): Promise<void> {
  try {
    // Load high-priority models in background
    const highPriorityModels = Object.values(AI_MODELS)
      .filter(model => model.priority === 'high')
      .map(model => model.id);
    
    // Load them one by one to avoid overwhelming the browser
    for (const modelId of highPriorityModels) {
      await modelManager.loadModel(modelId);
      // Small delay between loads
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('[ModelManager] Preloaded essential models');
  } catch (error) {
    console.warn('[ModelManager] Failed to preload some models:', error);
  }
}