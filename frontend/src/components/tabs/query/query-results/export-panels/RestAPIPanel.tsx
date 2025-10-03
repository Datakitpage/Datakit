import React, { useState, useEffect } from 'react';
import { AlertTriangle, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface RestAPIPanelProps {
  results: any[];
  columns: string[];
  query?: string;
  rowCount: number;
  columnCount: number;
  sourceFileName?: string;
  onExport: (config: RestAPIConfig) => void;
  isExporting: boolean;
}

interface RestAPIConfig {
  endpoint: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  authentication: {
    type: 'none' | 'bearer' | 'api-key' | 'basic';
    value?: string;
    headerName?: string;
  };
  dataFormat: 'json' | 'csv' | 'ndjson';
  batchSize: number;
  includeMetadata: boolean;
}

const RestAPIPanel: React.FC<RestAPIPanelProps> = ({
  results,
  columns,
  rowCount,
  sourceFileName,
  onExport,
  isExporting,
}) => {
  const [config, setConfig] = useState<RestAPIConfig>({
    endpoint: '',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    authentication: {
      type: 'none',
    },
    dataFormat: 'json',
    batchSize: 1000,
    includeMetadata: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAuthValue, setShowAuthValue] = useState(false);
  const [customHeaders, setCustomHeaders] = useState('');
  const [testResponse, setTestResponse] = useState<any>(null);

  // Load saved configuration
  useEffect(() => {
    const saved = localStorage.getItem('datakit-api-export-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Don't restore sensitive auth values
        setConfig({
          ...parsed,
          authentication: {
            ...parsed.authentication,
            value: '',
          },
        });
      } catch (e) {
        // Invalid saved config
      }
    }
  }, []);

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.endpoint.trim()) {
      newErrors.endpoint = 'API endpoint is required';
    } else if (!/^https?:\/\/.+/.test(config.endpoint)) {
      newErrors.endpoint = 'Must be a valid HTTP/HTTPS URL';
    }

    if (config.authentication.type !== 'none' && !config.authentication.value?.trim()) {
      newErrors.auth = 'Authentication value is required';
    }

    if (config.authentication.type === 'api-key' && !config.authentication.headerName?.trim()) {
      newErrors.authHeader = 'API key header name is required';
    }

    if (config.batchSize < 1 || config.batchSize > 10000) {
      newErrors.batchSize = 'Batch size must be between 1 and 10,000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleExport = () => {
    if (validateConfig()) {
      // Save config (without sensitive data)
      const configToSave = {
        ...config,
        authentication: {
          ...config.authentication,
          value: undefined,
        },
      };
      localStorage.setItem('datakit-api-export-config', JSON.stringify(configToSave));
      
      onExport(config);
    }
  };

  const generateCurlCommand = (): string => {
    const headers = { ...config.headers };
    
    // Add authentication headers
    if (config.authentication.type === 'bearer') {
      headers['Authorization'] = `Bearer YOUR_TOKEN`;
    } else if (config.authentication.type === 'api-key' && config.authentication.headerName) {
      headers[config.authentication.headerName] = 'YOUR_API_KEY';
    } else if (config.authentication.type === 'basic') {
      headers['Authorization'] = 'Basic YOUR_BASE64_CREDENTIALS';
    }

    const headerString = Object.entries(headers)
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(' \\\n  ');

    const sampleData = config.dataFormat === 'json'
      ? JSON.stringify({
          metadata: config.includeMetadata ? {
            source: sourceFileName || 'DataKit Query',
            timestamp: new Date().toISOString(),
            rowCount: 3,
            columns,
          } : undefined,
          data: results.slice(0, 3),
        }, null, 2)
      : 'CSV_OR_NDJSON_DATA';

    return `curl -X ${config.method} "${config.endpoint}" \\
  ${headerString} \\
  -d '${sampleData}'`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateCurlCommand());
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Warning Box */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-white">Data Will Leave Your Browser</p>
                <p className="text-white/80">
                  By using this export method, your data will be sent to the specified API endpoint. 
                  Ensure you trust the destination and have proper authorization.
                </p>
              </div>
            </div>
          </div>

          {/* Endpoint Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                API Endpoint
              </label>
              <input
                type="text"
                value={config.endpoint}
                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary transition-colors text-white"
                placeholder="https://api.example.com/data/import"
                disabled={isExporting}
              />
              {errors.endpoint && (
                <p className="text-xs text-destructive">{errors.endpoint}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Method</label>
                <select
                  value={config.method}
                  onChange={(e) => setConfig({ ...config, method: e.target.value as 'POST' | 'PUT' })}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white"
                  disabled={isExporting}
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Data Format</label>
                <select
                  value={config.dataFormat}
                  onChange={(e) => setConfig({ ...config, dataFormat: e.target.value as any })}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white"
                  disabled={isExporting}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="ndjson">NDJSON (Newline Delimited)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white">Authentication</h3>
            
            <div className="space-y-2">
              <select
                value={config.authentication.type}
                onChange={(e) => setConfig({
                  ...config,
                  authentication: { type: e.target.value as any, value: '' }
                })}
                className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white"
                disabled={isExporting}
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="api-key">API Key</option>
                <option value="basic">Basic Auth</option>
              </select>
            </div>

            {config.authentication.type !== 'none' && (
              <div className="space-y-2">
                {config.authentication.type === 'api-key' && (
                  <input
                    type="text"
                    value={config.authentication.headerName || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      authentication: { ...config.authentication, headerName: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white"
                    placeholder="Header name (e.g., X-API-Key)"
                    disabled={isExporting}
                  />
                )}
                
                <div className="relative">
                  <input
                    type={showAuthValue ? 'text' : 'password'}
                    value={config.authentication.value || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      authentication: { ...config.authentication, value: e.target.value }
                    })}
                    className="w-full px-3 py-2 pr-10 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white"
                    placeholder={
                      config.authentication.type === 'bearer' ? 'Bearer token' :
                      config.authentication.type === 'api-key' ? 'API key value' :
                      'username:password'
                    }
                    disabled={isExporting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthValue(!showAuthValue)}
                    className="absolute right-2 top-2.5 text-white/60 hover:text-white"
                  >
                    {showAuthValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.auth && (
                  <p className="text-xs text-destructive">{errors.auth}</p>
                )}
              </div>
            )}
          </div>

          {/* Batch Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white">Batch Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">
                  Batch Size
                </label>
                <input
                  type="number"
                  value={config.batchSize}
                  onChange={(e) => setConfig({ ...config, batchSize: parseInt(e.target.value) || 1000 })}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white"
                  min="1"
                  max="10000"
                  disabled={isExporting}
                />
                {errors.batchSize && (
                  <p className="text-xs text-destructive">{errors.batchSize}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">
                  Total Requests
                </label>
                <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                  {Math.ceil(rowCount / config.batchSize)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeMetadata"
                checked={config.includeMetadata}
                onChange={(e) => setConfig({ ...config, includeMetadata: e.target.checked })}
                className="rounded border-white/20 bg-background text-primary"
                disabled={isExporting}
              />
              <label htmlFor="includeMetadata" className="text-sm text-white/80">
                Include metadata in request (source, timestamp, row count)
              </label>
            </div>
          </div>

          {/* CURL Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Example CURL Command</h3>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <pre className="p-3 bg-black/50 border border-white/10 rounded-lg text-xs text-white/80 overflow-x-auto">
              {generateCurlCommand()}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 p-4 bg-background/50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/60">
            Will send {Math.ceil(rowCount / config.batchSize)} request(s) with {rowCount.toLocaleString()} total rows
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || !config.endpoint.trim()}
            className="min-w-[120px]"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                Send to API
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RestAPIPanel;