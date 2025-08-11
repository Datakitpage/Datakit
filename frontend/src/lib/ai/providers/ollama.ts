import { 
  AIMessage, 
  AIResponse, 
  AIStreamResponse,
  SQLGenerationRequest,
  SQLGenerationResponse,
  DataAnalysisRequest,
  DataAnalysisResponse
} from "../types";
import { createSystemPrompt, createSQLPrompt, createDataAnalysisPrompt } from "../prompts/sqlPrompts";

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider {
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:11434', model?: string) {
    // In development, use proxy. In production, use direct connection
    if (import.meta.env.DEV && baseUrl === 'http://localhost:11434') {
      this.baseUrl = '/api/ollama';
    } else {
      this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    this.model = model || 'llama3.2';
    this.timeout = 30000; // 30 second timeout
  }

  async validateConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for validation

      const response = await fetch(this.baseUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Ollama connection validation failed:', error);
      return false;
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  async generateCompletion(
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<AIResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 2048,
          },
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error || response.statusText}`);
      }

      const data: OllamaChatResponse = await response.json();
      
      // Calculate token usage from durations (approximate)
      const promptTokens = data.prompt_eval_count || 0;
      const completionTokens = data.eval_count || 0;

      return {
        content: data.message.content,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        model: data.model,
        finishReason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: Ollama is taking too long to respond');
      }
      throw error;
    }
  }

  async generateStreamCompletion(
    messages: AIMessage[],
    onChunk: (chunk: AIStreamResponse) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 2048,
          },
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let content = '';
      let promptTokens = 0;
      let completionTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            onChunk({ 
              content, 
              done: true, 
              usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
              }
            });
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const parsed: OllamaChatResponse = JSON.parse(line);
              
              if (parsed.message?.content) {
                content += parsed.message.content;
                onChunk({ content, done: false });
              }

              // Capture token counts when available
              if (parsed.prompt_eval_count) {
                promptTokens = parsed.prompt_eval_count;
              }
              if (parsed.eval_count) {
                completionTokens = parsed.eval_count;
              }

              if (parsed.done) {
                onChunk({ 
                  content, 
                  done: true,
                  usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                  }
                });
                return;
              }
            } catch (parseError) {
              // Skip invalid JSON chunks
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: Ollama is taking too long to respond');
      }
      throw error;
    }
  }

  async generateSQL(request: SQLGenerationRequest): Promise<SQLGenerationResponse> {
    const systemPrompt = createSystemPrompt(request.context);
    const userPrompt = createSQLPrompt(request.prompt, request.context, {
      includeExplanation: request.includeExplanation,
      maxRows: request.maxRows,
    });

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.1 });
    
    // Extract SQL from the response
    const sql = this.extractSQL(response.content);
    const explanation = this.extractExplanation(response.content);
    
    return {
      sql,
      explanation,
      confidence: 0.85, // Slightly lower confidence for local models
      warnings: this.extractWarnings(response.content),
    };
  }

  async analyzeData(request: DataAnalysisRequest): Promise<DataAnalysisResponse> {
    const userPrompt = createDataAnalysisPrompt(request.prompt, request.context, request.data);
    
    const messages: AIMessage[] = [
      { 
        role: 'system', 
        content: 'You are a data analyst expert. Provide clear, actionable insights with specific recommendations.' 
      },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.3 });
    
    return {
      analysis: response.content,
      insights: this.extractInsights(response.content),
      suggestions: this.extractSuggestions(response.content),
    };
  }

  private extractSQL(content: string): string {
    // Extract SQL from code blocks
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/i);
    if (sqlMatch) {
      return sqlMatch[1].trim();
    }
    
    // Fallback: look for SQL keywords
    const lines = content.split('\n');
    const sqlLines = lines.filter(line => 
      /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)/i.test(line.trim())
    );
    
    if (sqlLines.length > 0) {
      return sqlLines.join('\n').trim();
    }
    
    return content.trim();
  }

  private extractExplanation(content: string): string | undefined {
    // Look for explanation sections
    const explanationMatch = content.match(/explanation:?\s*(.*?)(?=\n\n|\n```|$)/is);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }
    
    // If no explicit explanation section, return the non-SQL parts
    const nonSqlParts = content.replace(/```sql[\s\S]*?```/gi, '').trim();
    if (nonSqlParts && nonSqlParts !== content.trim()) {
      return nonSqlParts;
    }
    
    return undefined;
  }

  private extractWarnings(content: string): string[] {
    const warnings: string[] = [];
    const warningPatterns = [
      /warning:?\s*(.*?)(?=\n|$)/gi,
      /note:?\s*(.*?)(?=\n|$)/gi,
      /performance:?\s*(.*?)(?=\n|$)/gi,
    ];
    
    warningPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        warnings.push(match[1].trim());
      }
    });
    
    return warnings;
  }

  private extractInsights(content: string): Array<{
    type: 'trend' | 'pattern' | 'anomaly' | 'summary';
    title: string;
    description: string;
    confidence: number;
  }> {
    // This is a simplified extraction - in a real implementation,
    // you'd want more sophisticated parsing
    const insights = [];
    const sections = content.split('\n').filter(line => line.trim());
    
    for (const section of sections) {
      if (section.includes('trend') || section.includes('pattern')) {
        insights.push({
          type: 'trend' as const,
          title: 'Data Trend',
          description: section.trim(),
          confidence: 0.8,
        });
      }
    }
    
    return insights;
  }

  private extractSuggestions(content: string): string[] {
    const suggestions: string[] = [];
    const suggestionPatterns = [
      /recommendation:?\s*(.*?)(?=\n|$)/gi,
      /suggest:?\s*(.*?)(?=\n|$)/gi,
      /consider:?\s*(.*?)(?=\n|$)/gi,
    ];
    
    suggestionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        suggestions.push(match[1].trim());
      }
    });
    
    return suggestions;
  }

  calculateCost(usage: { promptTokens: number; completionTokens: number }): number {
    // Ollama is free when running locally
    return 0;
  }

  // Ollama-specific methods
  async pullModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.total && parsed.completed && onProgress) {
                const progress = (parsed.completed / parsed.total) * 100;
                onProgress(progress);
              }
            } catch (parseError) {
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Failed to pull Ollama model:', error);
      throw error;
    }
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}