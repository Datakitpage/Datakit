import React, { useState, useEffect } from "react";
import {
  Crown,
  Key,
  CheckCircle,
  ExternalLink,
  Settings as SettingsIcon,
  CreditCard,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useAIStore } from "@/store/aiStore";
import { AIProvider } from "@/types/ai";
import { useCredits } from "@/hooks/useCredits";
import { useNavigate } from "react-router-dom";

// Import provider logos
import OpenAILogo from "@/assets/openai.webp";
import AnthropicLogo from "@/assets/anthropic.webp";
import GroqLogo from "@/assets/groq.png";

const PROVIDER_CONFIG = {
  datakit: {
    name: "DataKit Model",
    icon: <></>,
    color: "primary",
    bgGradient: "from-blue-500/20 to-purple-500/20",
    borderGradient: "from-blue-500/40 to-purple-500/40",
    description: "Optimized AI models for data analysis",
    helpText:
      "DataKit model uses your credits and provides optimized prompts for data analysis tasks.",
    keyFormat: null,
    websiteUrl: null,
    models: ["DataKit Smart (Claude 3.5 Sonnet)", "DataKit Fast (Claude 3.5 Haiku)"],
    features: [
      "Optimized for data analysis",
      "No API key required",
      "Uses workspace credits",
    ],
  },
  openai: {
    name: "OpenAI",
    icon: <img src={OpenAILogo} className="h-5 w-5" alt="OpenAI" />,
    color: "green",
    bgGradient: "from-green-500/20 to-emerald-500/20",
    borderGradient: "from-green-500/40 to-emerald-500/40",
    description: "Industry-leading GPT models",
    helpText:
      "Most capable models for complex reasoning and analysis. Perfect for sophisticated data insights and advanced analytics.",
    keyFormat: "sk-...",
    websiteUrl: "https://platform.openai.com/api-keys",
    models: ["GPT-4o", "GPT-4o Mini"],
    features: ["Advanced reasoning", "Large context window", "$5 free credits"],
  },
  anthropic: {
    name: "Anthropic",
    icon: <img src={AnthropicLogo} className="h-4 w-4" alt="Anthropic" />,
    color: "orange",
    bgGradient: "from-orange-500/20 to-amber-500/20",
    borderGradient: "from-orange-500/40 to-amber-500/40",
    description: "Claude models for thoughtful analysis",
    helpText:
      "Excellent for detailed explanations and careful analysis. Known for producing well-structured, comprehensive responses.",
    keyFormat: "sk-ant-...",
    websiteUrl: "https://console.anthropic.com/",
    models: ["Claude 3.5 Sonnet", "Claude 3.5 Haiku"],
    features: ["Detailed explanations", "Safety focused", "Free trial credits"],
  },
  groq: {
    name: "Groq",
    icon: <img src={GroqLogo} className="h-4 w-4" alt="Groq" />,
    color: "purple",
    bgGradient: "from-purple-500/20 to-violet-500/20",
    borderGradient: "from-purple-500/40 to-violet-500/40",
    description: "Lightning-fast open source models",
    helpText:
      "Blazing fast inference with Llama models. Ideal for rapid prototyping and real-time data exploration.",
    keyFormat: "gsk_...",
    websiteUrl: "https://console.groq.com/keys",
    models: ["Llama 3.1 70B", "Llama 3.1 8B"],
    features: ["Ultra-fast inference", "Open source models", "Completely free"],
  },
} as const;

interface AISettingsProps {
  onTabChange?: (tabId: string) => void;
}

const AISettings: React.FC<AISettingsProps> = ({ onTabChange }) => {
  const { currentWorkspace } = useAuthStore();
  const {
    apiKeys,
    activeProvider,
    autoExecuteSQL,
    setActiveProvider: setActiveProviderToStore,
    setApiKey,
    updateSettings,
  } = useAIStore();

  const { creditsRemaining, stats, isLoading: creditsLoading } = useCredits();
  const navigate = useNavigate();

  const [keyInputs, setKeyInputs] = useState<Map<AIProvider, string>>(
    new Map()
  );
  const [showKeys, setShowKeys] = useState<Map<AIProvider, boolean>>(new Map());
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    activeProvider || "openai"
  );
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(
    null
  );

  const isProOrTeam =
    currentWorkspace?.subscription?.planType === "pro" ||
    currentWorkspace?.subscription?.planType === "team";

  const handleUpgrade = () => {
    if (onTabChange) {
      // Use the passed tab change function if available
      onTabChange("subscription");
    } else {
      // Fallback to navigation
      navigate("/settings#subscription");
    }
  };

  const formatCredits = (credits: number): string => {
    if (credits === -1) return "Unlimited";
    return credits.toLocaleString();
  };

  const getCreditStatus = () => {
    if (creditsRemaining === -1)
      return { color: "text-green-400", label: "Unlimited" };
    if (creditsRemaining > 50)
      return { color: "text-green-400", label: "Good" };
    if (creditsRemaining > 10)
      return { color: "text-yellow-400", label: "Low" };
    return { color: "text-red-400", label: "Very Low" };
  };

  const creditStatus = getCreditStatus();

  // Initialize form with existing keys
  useEffect(() => {
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

  const handleSaveKey = (provider: AIProvider) => {
    const key = keyInputs.get(provider);
    if (key?.trim()) {
      setApiKey(provider, key.trim());
      setActiveProviderToStore(provider);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return "•".repeat(key.length);
    // Always show first 6 chars + 20 dots + last 4 chars for consistency
    return key.slice(0, 6) + "•".repeat(20) + key.slice(-4);
  };

  const getProviderStatus = (provider: AIProvider) => {
    if (provider === "datakit") {
      return isProOrTeam ? "available" : "upgrade";
    }
    const hasKey = apiKeys.has(provider) && !!apiKeys.get(provider);
    return hasKey ? "configured" : "setup";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "configured":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "upgrade":
        return <Crown className="h-4 w-4 text-amber-400" />;
      case "setup":
        return <Key className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available":
        return "Available";
      case "configured":
        return "Configured";
      case "upgrade":
        return "Pro/Team Required";
      case "setup":
        return "Setup Required";
      default:
        return "";
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Compact Header */}
      <div className="mb-5">
        <h3 className="text-lg font-medium text-foreground">AI Configuration</h3>
        <p className="text-sm text-muted-foreground">Choose how DataKit processes your data with AI</p>
      </div>

      {/* Split View - Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0">
        {/* Left Column: DataKit AI Highlight */}
        <div className="flex flex-col gap-4">
          {/* DataKit AI Premium Card - More Compact */}
          <div
            className={`relative overflow-hidden rounded-lg border-2 transition-all duration-300 flex-1 ${
              isProOrTeam
                ? "bg-gradient-to-br from-primary/20 to-primary/10 border-primary/50 shadow-lg shadow-primary/20"
                : "bg-gradient-to-br from-accent/10 to-accent/5 border-border hover:border-primary/40 hover:shadow-lg cursor-pointer"
            }`}
            onClick={!isProOrTeam ? handleUpgrade : undefined}
          >
            {!isProOrTeam && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 animate-pulse"></div>
            )}
            
            <div className="relative p-5">
             
              
              <div className="mb-3">
                <h4 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                  DataKit Models
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Premium AI models optimized for data analysis. No API keys needed.
                </p>
                
                {/* Anthropic Badge */}
                <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-accent/5 border border-border rounded-full">
                  <img src={AnthropicLogo} className="h-3 w-3" alt="Anthropic" />
                  <span className="text-xs text-muted-foreground">Powered by Anthropic</span>
                </div>
              </div>

              {/* Compact Features */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Pre-tuned for SQL & data transformation</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Claude 3.5 Sonnet & Haiku included</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Zero configuration required</span>
                </div>
              </div>

              {/* Compact Status/CTA */}
              {isProOrTeam ? (
                <div className="bg-primary/10 border border-primary/30 rounded p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-foreground">Active</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-accent/5 rounded p-2 border border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pro Plan</span>
                    <span className="text-xs text-foreground font-medium">$19/mo</span>
                  </div>
                  <button 
                    onClick={handleUpgrade}
                    className="w-full text-foreground py-2 px-3 rounded-lg font-medium text-sm transition-colors cursor-pointer"
                  >
                    View All Plans →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Compact Credits */}
          <div className="bg-accent/5 border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-3 w-3 text-blue-400" />
                <span className="text-xs text-foreground">Credits</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${creditStatus.color}`}>
                  {formatCredits(creditsRemaining)}
                </span>
                <span className="text-xs text-muted-foreground">/{!isProOrTeam ? "315" : "1,575"}</span>
              </div>
            </div>
            
            {creditsRemaining !== -1 && (
              <div className="w-full bg-accent/10 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    creditsRemaining > 50 ? 'bg-green-400' : 
                    creditsRemaining > 10 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{
                    width: `${Math.min(100, (creditsRemaining / (isProOrTeam ? 1575 : 315)) * 100)}%`
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Alternative Providers */}
        <div className="flex flex-col">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">Alternative Providers</h4>
            <p className="text-xs text-muted-foreground">Use your own API keys for these providers</p>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto pr-2">
            {(["openai", "anthropic", "groq"] as AIProvider[]).map((provider) => {
              const config = PROVIDER_CONFIG[provider];
              const status = getProviderStatus(provider);
              const isActive = activeProvider === provider;
              const hasKey = apiKeys.has(provider) && !!apiKeys.get(provider);
              const isEditing = editingProvider === provider;

              const handleUpdateKey = () => {
                setEditingProvider(provider);
                setKeyInputs(
                  new Map(keyInputs.set(provider, apiKeys.get(provider) || ""))
                );
              };

              const handleSaveUpdate = () => {
                const key = keyInputs.get(provider);
                if (key?.trim()) {
                  setApiKey(provider, key.trim());
                  setActiveProviderToStore(provider);
                }
                setEditingProvider(null);
              };

              const handleCancelUpdate = () => {
                setKeyInputs(
                  new Map(keyInputs.set(provider, apiKeys.get(provider) || ""))
                );
                setEditingProvider(null);
              };

              const handleSelectProvider = () => {
                if (hasKey) {
                  setActiveProviderToStore(provider);
                }
              };

              return (
                <div
                  key={provider}
                  className={`rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-br from-accent/10 to-accent/5 border-primary/50 shadow-lg shadow-primary/20"
                      : "bg-gradient-to-br from-accent/5 to-accent/[0.02] border-border hover:border-border hover:shadow-lg"
                  }`}
                  onClick={handleSelectProvider}
                >
                  {/* Ultra Compact Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 bg-accent/10">
                        {config.icon}
                      </div>
                      <h5 className="text-xs font-medium text-foreground">
                        {config.name}
                      </h5>
                      {hasKey && <CheckCircle className="h-3 w-3 text-green-400" />}
                    </div>
                    {config.websiteUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(config.websiteUrl!, "_blank");
                        }}
                        className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                        title="Get API key"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Ultra Compact API Key Section */}
                  {hasKey && !isEditing && (
                    <div className="flex items-center gap-1">
                      <div className="text-xs font-mono text-muted-foreground bg-accent/5 px-1.5 py-0.5 rounded flex-1 truncate">
                        {maskApiKey(apiKeys.get(provider) || "")}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateKey();
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground px-1"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  {isEditing && (
                    <div className="space-y-1">
                      <input
                        type="password"
                        value={keyInputs.get(provider) || ""}
                        onChange={(e) =>
                          handleKeyChange(provider, e.target.value)
                        }
                        placeholder={`${config.keyFormat || 'API key'}`}
                        className="w-full px-2 py-0.5 text-xs bg-accent/5 border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveUpdate();
                          }}
                          className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 flex-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelUpdate();
                          }}
                          className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {!hasKey && !isEditing && (
                    <div className="space-y-1">
                      <input
                        type="password"
                        value={keyInputs.get(provider) || ""}
                        onChange={(e) =>
                          handleKeyChange(provider, e.target.value)
                        }
                        placeholder={`${config.keyFormat || 'API key'}`}
                        className="w-full px-2 py-0.5 text-xs bg-accent/5 border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveKey(provider);
                        }}
                        disabled={!keyInputs.get(provider)?.trim()}
                        className="w-full px-2 py-0.5 text-xs text-muted-foreground rounded hover:border border-primary/30 disabled:opacity-50 transition-colors"
                      >
                        Activate
                      </button>
                    </div>
                  )}

                  {/* Active Indicator */}
                  {isActive && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-primary">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Active
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Why DataKit AI */}
          {!isProOrTeam && (
            <div className="border border-primary/20 rounded-lg p-3 mt-3">
              <h5 className="text-xs font-medium text-foreground mb-1.5">Why DataKit Models?</h5>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span>No API keys to manage</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Credits monthly</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Optimized for data tasks</span>
                </li>
              </ul>
              <button 
                onClick={handleUpgrade}
                className="mt-2 text-xs text-primary hover:text-primary/80 font-medium"
              >
                Learn More →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compact Settings Footer */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between p-3 bg-gradient-to-br from-accent/5 to-accent/[0.02] border border-border rounded-xl">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-3 w-3 text-muted-foreground" />
            <div>
              <label className="text-xs text-muted-foreground font-medium">
                Auto-execute SQL
              </label>
              <p className="text-xs text-muted-foreground">Run AI queries automatically</p>
            </div>
          </div>
          <button
            onClick={() =>
              updateSettings({ autoExecuteSQL: !autoExecuteSQL })
            }
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              autoExecuteSQL ? "bg-primary" : "bg-accent/20"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-foreground transition-transform ${
                autoExecuteSQL ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettings;