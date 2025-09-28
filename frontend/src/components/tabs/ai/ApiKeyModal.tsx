import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  ExternalLink,
  Settings,
} from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { aiService } from "@/lib/ai/aiService";
import { AIProvider } from "@/types/ai";
import { Button } from "@/components/ui/Button";
import LocalModelManager from "./LocalModelManager";
import OllamaModelManager from "./OllamaModelManager";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/auth/useAuth";
import { useNavigate } from "react-router-dom";

import OpenAILogo from "@/assets/openai.webp";
import AnthropicLogo from "@/assets/anthropic.webp";
import OllamaLogo from '@/assets/ollama.webp';
import GroqLogo from "@/assets/groq.png";

const PROVIDER_CONFIG = {
  ollama: {
    name: "Ollama",
    icon: <img src={OllamaLogo} className="h-4 w-4" />,
    color: "blue",
    description: "Local Ollama server - runs models on your machine",
    websiteUrl: "https://ollama.com",
    helpText:
      "Run AI models locally with complete privacy. Requires Ollama to be running at http://localhost:11434",
    keyFormat: "http://localhost:11434",
    isUrlInput: true,
    provider: 'local'
  },
  openai: {
    name: "OpenAI",
    icon: <img src={OpenAILogo} className="h-5 w-5" />,
    color: "blue",
    description: "GPT-4o and GPT-4o Mini models",
    websiteUrl: "https://platform.openai.com/api-keys",
    helpText: "Most capable models for complex reasoning and analysis.",
    keyFormat: "sk-...",
  },
  anthropic: {
    name: "Anthropic",
    icon: <img src={AnthropicLogo} className="h-4 w-4" />,
    color: "blue",
    description: "Claude 3.5 Sonnet and Haiku models",
    websiteUrl: "https://console.anthropic.com/",
    helpText:
      "Excellent for detailed analysis and explanations. Free credits for new users.",
    keyFormat: "sk-ant-...",
  },
  groq: {
    name: "Groq",
    icon: <img src={GroqLogo} className="h-4 w-4" />,
    color: "blue",
    description: "Ultra-fast Llama 3.1 models with free tier",
    websiteUrl: "https://console.groq.com/keys",
    helpText:
      "Fastest inference speed, perfect for trying AI features. Completely free to start.",
    keyFormat: "gsk_...",
  }
  // local: {
  //   name: "Local Models",
  //   icon: <Cpu className="h-5 w-5" />,
  //   color: "blue",
  //   description: "Run AI models locally in your browser (no API key required)",
  //   websiteUrl: null,
  //   helpText: "Local models run entirely in your browser",
  //   keyFormat: null,
  // },
} as const;

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [activeProvider, setActiveProvider] = useState<AIProvider>("openai");
  const [keyInputs, setKeyInputs] = useState<Map<AIProvider, string>>(
    new Map()
  );
  const [showKeys, setShowKeys] = useState<Map<AIProvider, boolean>>(new Map());

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const {
    apiKeys,
    activeModel,
    setActiveProvider: setActiveProviderToStore,
    setActiveModel,
    autoExecuteSQL,
    showCostEstimates,
    setApiKey,
    updateSettings,
  } = useAIStore();

  // Initialize form with existing keys
  React.useEffect(() => {
    const newInputs = new Map();
    for (const [provider, key] of apiKeys) {
      newInputs.set(provider, key);
    }
    setKeyInputs(newInputs);
  }, [apiKeys]);

  const handleKeyChange = (provider: AIProvider, value: string) => {
    setKeyInputs(new Map(keyInputs.set(provider, value)));
  };

  const handleToggleKeyVisibility = (provider: AIProvider) => {
    setShowKeys(new Map(showKeys.set(provider, !showKeys.get(provider))));
  };

  const handleSave = () => {
    // Save all keys
    for (const [provider, key] of keyInputs) {
      if (key.trim()) {
        setApiKey(provider, key.trim());
        setActiveProviderToStore(provider);
      }
    }
    onClose();
  };

  const handleUpgradeClick = () => {
    onClose();
    navigate("/settings#ai");
  };

  const getProviderColorClass = (
    provider: AIProvider,
    type: "bg" | "border" | "text"
  ) => {
    const color = PROVIDER_CONFIG[provider].color;
    switch (type) {
      case "bg":
        return `bg-${color}-500/10`;
      case "border":
        return `border-${color}-500/30`;
      case "text":
        return `text-${color}-500`;
      default:
        return "";
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "•".repeat(key.length);
    return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-background/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="w-full max-w-4xl h-[85vh] bg-background border border-border rounded-lg shadow-xl shadow-background/30 overflow-hidden flex"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Sidebar - Provider Selection */}
            <div className="w-64 bg-gradient-to-b from-popover to-background border-r border-border flex flex-col">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-heading font-medium text-foreground">
                  Configuration
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure AI providers and settings
                </p>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  {(Object.keys(PROVIDER_CONFIG) as AIProvider[]).map(
                    (provider) => {
                      const config = PROVIDER_CONFIG[provider];
                      const hasKey =
                        apiKeys.has(provider) && !!apiKeys.get(provider);

                      return (
                        <button
                          key={provider}
                          onClick={() => setActiveProvider(provider)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg mb-1 transition-all duration-200 group relative",
                            activeProvider === provider
                              ? `${getProviderColorClass(
                                  provider,
                                  "bg"
                                )} ${getProviderColorClass(
                                  provider,
                                  "border"
                                )} border text-foreground`
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/5 border border-transparent"
                          )}
                        >
                          <div className="flex items-center">
                            <div
                              className={cn(
                                "h-8 w-8 rounded-md flex items-center justify-center mr-3 border",
                                activeProvider === provider
                                  ? `${getProviderColorClass(
                                      provider,
                                      "border"
                                    )} ${getProviderColorClass(
                                      provider,
                                      "text"
                                    )}`
                                  : "bg-accent/5 border-border text-muted-foreground"
                              )}
                            >
                              {config.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center">
                                <p className="text-sm font-medium truncate">
                                  {config.name}
                                </p>
                                {hasKey && (
                                  <CheckCircle className="ml-2 h-3 w-3 text-green-400" />
                                )}
                              </div>
                              <p className="text-xs mt-0.5 truncate opacity-80">
                                {provider === "local" || provider === "ollama"
                                  ? "Local"
                                  : "Cloud API"}
                              </p>
                            </div>
                          </div>

                          {activeProvider === provider && (
                            <motion.div
                              layoutId="activeProvider"
                              className={cn(
                                "absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 rounded-r",
                                `bg-${config.color}-500`
                              )}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                              }}
                            />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-background/50 to-background/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center mr-3 border",
                        `${getProviderColorClass(
                          activeProvider,
                          "border"
                        )} ${getProviderColorClass(activeProvider, "text")}`
                      )}
                    >
                      {PROVIDER_CONFIG[activeProvider].icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground">
                        {PROVIDER_CONFIG[activeProvider].name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {PROVIDER_CONFIG[activeProvider].description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeProvider === "local" ? (
                  // Local Models Section
                  <LocalModelManager />
                ) : activeProvider === "ollama" ? (
                  // Ollama Configuration Section
                  <div className="space-y-6">
                    {/* URL Configuration */}
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-3">
                        Server Configuration
                      </h4>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Ollama Server URL
                        </label>
                        <input
                          type="text"
                          value={keyInputs.get('ollama') || ""}
                          onChange={(e) => handleKeyChange('ollama', e.target.value)}
                          placeholder="http://localhost:11434"
                          className="w-full px-3 py-2 bg-accent/5 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          The URL where your Ollama server is running
                        </p>
                      </div>
                    </div>

                    {/* Model Management */}
                    <OllamaModelManager
                      baseUrl={keyInputs.get('ollama') || 'http://localhost:11434'}
                      selectedModel={activeModel || aiService.getOllamaModel() || undefined}
                      onModelSelect={(modelName) => {
                        // Set the active model in the AI service and store
                        aiService.setOllamaModel(modelName);
                        setActiveModel(modelName);
                        console.log('Selected Ollama model:', modelName);
                      }}
                    />
                  </div>
                ) : (
                  // API Key Configuration
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-3">
                        API Key Configuration
                      </h4>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">
                            {activeProvider === 'ollama' ? 'Ollama Server URL' : 'API Key'}
                          </label>
                          <div className="relative">
                            <input
                              type={
                                activeProvider === 'ollama' || showKeys.get(activeProvider)
                                  ? "text"
                                  : "password"
                              }
                              value={keyInputs.get(activeProvider) || ""}
                              onChange={(e) =>
                                handleKeyChange(activeProvider, e.target.value)
                              }
                              placeholder={
                                activeProvider === 'ollama'
                                  ? "http://localhost:11434"
                                  : `Enter your ${PROVIDER_CONFIG[activeProvider].name} API key`
                              }
                              className="w-full px-3 py-2 pr-20 bg-accent/5 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                            />
                            {activeProvider !== 'ollama' && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleToggleKeyVisibility(activeProvider)
                                  }
                                  className="h-6 w-6 p-0"
                                >
                                  {showKeys.get(activeProvider) ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* DataKit AI Promotion for Unauthenticated Users */}
                        {!isAuthenticated && (
                          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground mb-1">
                                  Skip the API keys with DataKit credits
                                </p>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Get instant access to powerful AI models
                                  without managing API keys. Credits included
                                  with your account.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleUpgradeClick}
                                  className="h-7 bg-primary/20 hover:bg-primary/30 border-primary/50 text-primary"
                                >
                                  Sign in to get started
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {PROVIDER_CONFIG[activeProvider].websiteUrl && (
                          <div className="bg-accent/5 border border-border rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground mb-2">
                                  {PROVIDER_CONFIG[activeProvider].helpText}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(
                                        PROVIDER_CONFIG[activeProvider]
                                          .websiteUrl!,
                                        "_blank"
                                      )
                                    }
                                    className="h-7"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Get API Key
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Settings Section */}
                    <div className="border-t border-white/10 pt-6">
                      <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        General Settings
                      </h4>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Auto-execute generated SQL
                            </label>
                            <p className="text-xs text-white/60">
                              Automatically run SQL queries generated by AI
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateSettings({
                                autoExecuteSQL: !autoExecuteSQL,
                              })
                            }
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                              autoExecuteSQL ? "bg-primary" : "bg-white/20"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                autoExecuteSQL
                                  ? "translate-x-5"
                                  : "translate-x-1"
                              )}
                            />
                          </button>
                        </div>

                        {/* TODO: Make this work to show cost estimates as part of Response header */}
                        {/* <div className="flex items-center justify-between">
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Show cost estimates
                            </label>
                            <p className="text-xs text-white/60">
                              Display estimated costs for API calls
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateSettings({
                                showCostEstimates: !showCostEstimates,
                              })
                            }
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                              showCostEstimates ? "bg-primary" : "bg-white/20"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                showCostEstimates
                                  ? "translate-x-5"
                                  : "translate-x-1"
                              )}
                            />
                          </button>
                        </div> */}

                        {/* <div>
                          <label className="block text-sm text-muted-foreground mb-2">
                            Query history limit
                          </label>
                          <select
                            value={maxHistoryItems}
                            onChange={(e) =>
                              updateSettings({
                                maxHistoryItems: parseInt(e.target.value),
                              })
                            }
                            className="w-32 px-3 py-1 bg-accent/5 border border-border rounded text-sm text-foreground focus:outline-none focus:border-primary/50"
                          >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                          </select>
                        </div> */}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border bg-popover/30">
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={handleSave}>
                    Save Configuration
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ApiKeyModal;
