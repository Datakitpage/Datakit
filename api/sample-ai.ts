/**
 * Cloudflare Worker: Sample File AI Proxy
 *
 * This worker allows users to experience AI features on sample files
 * without needing their own Anthropic API key.
 *
 * Security measures:
 * - Only allows requests for pre-defined sample file IDs
 * - Uses server-side API key (never exposed to client)
 * - Rate limiting by IP address
 * - Request validation
 *
 * Deploy:
 *   1. npm install -g wrangler
 *   2. wrangler secret put ANTHROPIC_API_KEY
 *   3. wrangler deploy
 */

export interface Env {
  ANTHROPIC_API_KEY: string;
}

// Sample file IDs that are allowed to use this proxy
const ALLOWED_SAMPLE_FILE_IDS = [
  'sample-sales',
  'sample-users',
  'sample-api',
];

// Simple in-memory rate limiting (resets on worker restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function getClientIP(request: Request): string {
  return request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  record.count++;
  return false;
}

function jsonResponse(data: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    // Check API key is configured
    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'API key not configured on server' }, 500, corsHeaders);
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    if (isRateLimited(clientIP)) {
      return jsonResponse({
        error: 'Rate limit exceeded. Please try again in a minute.',
        retryAfter: 60,
      }, 429, corsHeaders);
    }

    try {
      const body = await request.json() as Record<string, unknown>;

      // Validate fileId is a sample file
      if (!body.fileId || !ALLOWED_SAMPLE_FILE_IDS.includes(body.fileId as string)) {
        return jsonResponse({
          error: 'This endpoint only works with sample files. Please add your own API key for other files.',
        }, 403, corsHeaders);
      }

      // Extract the Anthropic request payload (remove our custom fields)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- fileId validated above, extracted but not needed
      const { fileId: _fileId, ...anthropicPayload } = body;

      // Validate required fields
      if (!anthropicPayload.messages || !Array.isArray(anthropicPayload.messages)) {
        return jsonResponse({ error: 'Invalid request: messages required' }, 400, corsHeaders);
      }

      // Set reasonable limits for sample file usage
      const limitedPayload = {
        ...anthropicPayload,
        model: anthropicPayload.model || 'claude-3-haiku-20240307', // Use Haiku for cost efficiency
        max_tokens: Math.min((anthropicPayload.max_tokens as number) || 1024, 2048), // Cap at 2048 tokens
      };

      // Proxy to Anthropic
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(limitedPayload),
      });

      const data = await response.json();

      return jsonResponse(data, response.status, corsHeaders);
    } catch (error) {
      console.error('Sample AI proxy error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500, corsHeaders);
    }
  },
};
