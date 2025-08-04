import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/auth/useAuth';
import { DataKitProvider } from '@/lib/ai/providers/datakit';
import { aiService } from '@/lib/ai/aiService';
import type { AIMessage } from '@/lib/ai/types';
import type { NotebookContext } from './useNotebookContext';

export interface NotebookAIRequest {
  prompt: string;
  context: {
    hasContext: boolean;
    contextText: string;
    tables: any[];
    variables: any[];
    summary?: any;
  };
}

export interface NotebookAIResponse {
  generatedCode?: string;
  explanation?: string;
  suggestions?: string[];
  error?: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
  creditsUsed?: number;
}

export interface NotebookAIStatus {
  isProcessing: boolean;
  currentResponse: string;
  error: string | null;
}

/**
 * Hook for AI-powered notebook interactions using DataKit models
 * Integrates with context detection and provides streaming responses
 */
export const useNotebookAI = () => {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<NotebookAIStatus>({
    isProcessing: false,
    currentResponse: '',
    error: null,
  });

  // Initialize DataKit provider
  const initializeAI = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('Authentication required for AI features');
    }

    try {
      // Initialize DataKit provider with datakit-fast model for cost efficiency
      const datakitProvider = new DataKitProvider('datakit-fast');
      
      // Validate the provider
      const isValid = await datakitProvider.validateApiKey();
      if (!isValid) {
        throw new Error('DataKit API validation failed. Please check your authentication.');
      }

      // Set the provider in the AI service
      aiService.setProvider('datakit', datakitProvider);
      
      return datakitProvider;
    } catch (error) {
      console.error('Failed to initialize DataKit AI:', error);
      throw error;
    }
  }, [isAuthenticated]);

  // Create system prompt for notebook context
  const createNotebookSystemPrompt = useCallback((context: NotebookAIRequest['context']) => {
    let systemPrompt = `You are an expert data analyst and Python programmer working in a Jupyter-style notebook environment. Your goal is to help users analyze data and write Python code.

Environment:
- Python environment with pandas, numpy, matplotlib, plotly, and other common data science libraries
- DuckDB integration available for SQL queries
- All code should be production-ready and well-documented

Guidelines:
1. Generate clean, efficient Python code in code blocks
2. Provide clear explanations between code blocks
3. Use appropriate libraries for the task
4. Handle potential errors gracefully
5. Follow Python best practices and PEP 8 style
6. Structure response as: explanation → code blocks → explanation → etc.
7. Keep explanations concise and focused on what the code does

`;

    if (context.hasContext) {
      systemPrompt += `Current Data Context:
${context.contextText}

When generating code:
- Reference the available tables and variables by their exact names
- Consider the data types and schema when writing queries
- Suggest appropriate analysis based on the available data
- Use DuckDB SQL syntax when querying tables
- Use pandas operations when working with DataFrames

`;
    } else {
      systemPrompt += `No specific data context available. Generate general-purpose code and suggest loading sample data when appropriate.

`;
    }

    return systemPrompt;
  }, []);

  // Process AI request with streaming
  const processAIRequest = useCallback(async (
    request: NotebookAIRequest,
    onChunk?: (chunk: string) => void
  ): Promise<NotebookAIResponse> => {
    if (!isAuthenticated) {
      throw new Error('Authentication required');
    }

    setStatus({ isProcessing: true, currentResponse: '', error: null });

    try {
      // Initialize AI if needed
      const provider = await initializeAI();

      // Create messages for the AI
      const systemPrompt = createNotebookSystemPrompt(request.context);
      const messages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.prompt }
      ];

      let fullResponse = '';
      let tokensUsed = { input: 0, output: 0 };
      let creditsUsed = 0;

      // Use streaming for better UX
      await provider.generateStreamCompletion(
        messages,
        (chunk) => {
          if (chunk.content) {
            fullResponse += chunk.content;
            setStatus(prev => ({ 
              ...prev, 
              currentResponse: fullResponse 
            }));
            onChunk?.(chunk.content);
          }
          if (chunk.done && chunk.usage) {
            tokensUsed = {
              input: chunk.usage.promptTokens || 0,
              output: chunk.usage.completionTokens || 0,
            };
          }
          if (chunk._datakit?.creditsUsed) {
            creditsUsed = chunk._datakit.creditsUsed;
          }
        },
        {
          temperature: 0.1, // Low temperature for more deterministic code generation
          maxTokens: 2000,  // Reasonable limit for code generation
        }
      );

      // Parse the response to extract code and explanation
      const parsed = parseAIResponse(fullResponse);

      setStatus({ isProcessing: false, currentResponse: fullResponse, error: null });

      return {
        ...parsed,
        tokensUsed,
        creditsUsed,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI processing failed';
      setStatus({ 
        isProcessing: false, 
        currentResponse: '', 
        error: errorMessage 
      });
      
      return {
        error: errorMessage,
      };
    }
  }, [isAuthenticated, initializeAI, createNotebookSystemPrompt]);

  // Parse AI response to extract code blocks and explanations
  const parseAIResponse = useCallback((response: string): Omit<NotebookAIResponse, 'tokensUsed' | 'creditsUsed'> => {
    // Extract Python code blocks
    const codeMatches = response.match(/```python\n([\s\S]*?)\n```/g);
    let generatedCode = '';
    
    if (codeMatches && codeMatches.length > 0) {
      // Combine all code blocks
      generatedCode = codeMatches
        .map(match => match.replace(/```python\n|\n```/g, '').trim())
        .join('\n\n# --- Next Code Block ---\n\n');
    } else {
      // Fallback: look for any code-like content
      const lines = response.split('\n');
      const codeLines = lines.filter(line => 
        line.trim().startsWith('import ') ||
        line.trim().startsWith('from ') ||
        line.trim().startsWith('df') ||
        line.trim().startsWith('pd.') ||
        line.trim().startsWith('plt.') ||
        line.trim().startsWith('print(') ||
        /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(line)
      );
      
      if (codeLines.length > 0) {
        generatedCode = codeLines.join('\n');
      }
    }

    // Extract explanation (everything that's not code)
    let explanation = response;
    if (codeMatches) {
      codeMatches.forEach(match => {
        explanation = explanation.replace(match, '');
      });
    }
    explanation = explanation.trim();

    // Extract suggestions (look for bullet points or numbered lists)
    const suggestions: string[] = [];
    const suggestionPatterns = [
      /(?:^|\n)[-*•]\s+(.+?)(?=\n|$)/g,
      /(?:^|\n)\d+\.\s+(.+?)(?=\n|$)/g,
    ];
    
    suggestionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const suggestion = match[1].trim();
        if (suggestion.length > 10 && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }
    });

    return {
      generatedCode: generatedCode || undefined,
      explanation: explanation || undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }, []);

  // Reset status
  const resetStatus = useCallback(() => {
    setStatus({
      isProcessing: false,
      currentResponse: '',
      error: null,
    });
  }, []);

  return {
    status,
    processAIRequest,
    resetStatus,
    isReady: isAuthenticated,
  };
};

export default useNotebookAI;