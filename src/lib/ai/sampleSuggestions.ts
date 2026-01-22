/**
 * Sample file AI support.
 *
 * This module provides:
 * 1. Pre-computed suggestions as fallback
 * 2. Proxy API calls to Cloudflare Worker for real AI on sample files
 *
 * Users without an API key can experience AI features on sample files
 * through the Cloudflare Worker proxy.
 */

// Get proxy URL from environment
const SAMPLE_AI_PROXY_URL = import.meta.env.VITE_SAMPLE_AI_PROXY_URL as string | undefined;

// Sample file IDs (must match the Cloudflare Worker)
export const SAMPLE_FILE_IDS = ['sample-sales', 'sample-users', 'sample-api'] as const;
export type SampleFileId = (typeof SAMPLE_FILE_IDS)[number];

/**
 * Pre-computed smart suggestions for each sample file.
 * Used as fallback when proxy is not available.
 */
export const SAMPLE_FILE_SUGGESTIONS: Record<string, string[]> = {
  // Sales data - sales.csv
  'sample-sales': [
    'Show revenue by region',
    'Find top 5 products by quantity sold',
    'Show distribution of sales by category',
    'Calculate total revenue per product',
  ],

  // Users data - sample.csv
  'sample-users': [
    'Count users by country',
    'Show all Pro plan users',
    'Find inactive users',
    'Group signups by month',
  ],

  // API logs - api_logs.json
  'sample-api': [
    'Find slow requests over 1000ms',
    'Show error rate by endpoint',
    'Count requests by method type',
    'Find requests with error status',
  ],
};

/**
 * Check if a file is a sample file.
 */
export function isSampleFile(fileId: string): boolean {
  return SAMPLE_FILE_IDS.includes(fileId as SampleFileId);
}

/**
 * Get pre-computed suggestions for a sample file.
 * Returns empty array if the file is not a sample file.
 */
export function getSampleSuggestions(fileId: string): string[] {
  return SAMPLE_FILE_SUGGESTIONS[fileId] || [];
}

/**
 * Check if the sample AI proxy is configured.
 */
export function isSampleProxyConfigured(): boolean {
  return !!SAMPLE_AI_PROXY_URL && SAMPLE_AI_PROXY_URL.length > 0;
}

/**
 * Get the sample AI proxy URL.
 */
export function getSampleProxyUrl(): string | undefined {
  return SAMPLE_AI_PROXY_URL;
}

/**
 * Call the Anthropic API through the sample file proxy.
 * This allows users without an API key to use AI features on sample files.
 *
 * @param fileId - The sample file ID (must be a valid sample file)
 * @param payload - The Anthropic API payload (messages, model, max_tokens, etc.)
 * @returns The Anthropic API response
 * @throws Error if not a sample file, proxy not configured, or request fails
 */
export async function callSampleAIProxy(
  fileId: string,
  payload: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    max_tokens?: number;
    system?: string;
  }
): Promise<{
  content: Array<{ type: string; text: string }>;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}> {
  if (!isSampleFile(fileId)) {
    throw new Error('This endpoint only works with sample files.');
  }

  if (!SAMPLE_AI_PROXY_URL) {
    throw new Error('Sample AI proxy is not configured.');
  }

  const response = await fetch(SAMPLE_AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      ...payload,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Proxy request failed: ${response.status}`);
  }

  return data;
}

/**
 * Generate smart suggestions for a sample file via the proxy.
 * Falls back to pre-computed suggestions if proxy fails.
 */
export async function generateSampleSuggestions(
  fileId: string,
  context: {
    schema: Array<{ name: string; type: string }>;
    totalRows: number;
    tableName?: string;
  }
): Promise<string[]> {
  // Always have fallback ready
  const fallbackSuggestions = getSampleSuggestions(fileId);

  // If proxy not configured, use fallback
  if (!isSampleProxyConfigured()) {
    return fallbackSuggestions;
  }

  try {
    const schemaStr = context.schema
      .filter(c => c.name !== '_rowid')
      .map(c => `${c.name} (${c.type})`)
      .join(', ');

    const prompt = `Given this data schema: ${schemaStr}
With ${context.totalRows.toLocaleString()} total rows.

Generate exactly 4 short, natural language questions/commands a user might want to try. Include a mix of:
- Simple operations (sort, filter, search)
- Analytical queries (correlations, distributions, aggregations, statistics)
- Finding patterns, outliers, or data quality issues

Return ONLY a JSON array of 4 strings, no explanation. Example:
["Show distribution by category", "Find correlation between price and rating", "Sort by date", "Show rows with missing values"]`;

    const response = await callSampleAIProxy(fileId, {
      messages: [{ role: 'user', content: prompt }],
      model: 'claude-3-haiku-20240307',
      max_tokens: 256,
    });

    const text = response.content[0]?.text || '';

    // Parse JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const suggestions = JSON.parse(match[0]);
      if (Array.isArray(suggestions)) {
        return suggestions.slice(0, 4);
      }
    }

    return fallbackSuggestions;
  } catch (error) {
    console.warn('Failed to generate suggestions via proxy, using fallback:', error);
    return fallbackSuggestions;
  }
}
