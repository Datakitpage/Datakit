/**
 * Google OAuth utilities for web popup flow
 *
 * Flow:
 * 1. Call initiateOAuth() to open popup
 * 2. User authenticates in popup
 * 3. Popup redirects to callback URL with token in hash
 * 4. Callback page writes result to localStorage
 * 5. This module polls localStorage and resolves the promise
 */

// OAuth configuration
// Users need to replace this with their own Google Cloud OAuth Client ID
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// OAuth scopes for read-write access (needed for two-way sync)
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

// Google OAuth endpoints
const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// localStorage keys for cross-tab communication
const LS_OAUTH_STATE = 'google-oauth-state';
const LS_OAUTH_RESULT = 'google-oauth-result';

export interface OAuthResult {
  accessToken: string;
  expiresIn: number; // seconds
  tokenType: string;
}

export interface UserInfo {
  email: string;
  name: string;
  picture?: string;
}

/**
 * Get the OAuth redirect URI based on current location
 */
function getRedirectUri(): string {
  const origin = window.location.origin;
  return `${origin}/oauth/google/callback`;
}

/**
 * Generate a random state string for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse OAuth tokens from URL hash
 */
export function parseOAuthHash(hash: string): OAuthResult | null {
  if (!hash || hash.length < 2) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const tokenType = params.get('token_type');

  if (!accessToken) return null;

  return {
    accessToken,
    expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600,
    tokenType: tokenType || 'Bearer',
  };
}

/**
 * Check if Google OAuth is configured
 */
export function isOAuthConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 0;
}

/**
 * Initiate OAuth flow with popup
 *
 * Uses localStorage for cross-tab communication (most reliable method).
 * The callback page writes the result, and we poll for it here.
 */
export function initiateOAuth(): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    if (!isOAuthConfigured()) {
      reject(new Error('Google OAuth is not configured. Please set VITE_GOOGLE_CLIENT_ID environment variable.'));
      return;
    }

    // Clear any stale result
    localStorage.removeItem(LS_OAUTH_RESULT);

    // Generate state for CSRF protection and store it so callback can read it
    const state = generateState();
    localStorage.setItem(LS_OAUTH_STATE, state);

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: getRedirectUri(),
      response_type: 'token',
      scope: SCOPES,
      state,
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    const authUrl = `${OAUTH_URL}?${params.toString()}`;

    // Calculate popup position (centered)
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    // Open popup
    const popup = window.open(
      authUrl,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      localStorage.removeItem(LS_OAUTH_STATE);
      reject(new Error('Failed to open OAuth popup. Please allow popups for this site.'));
      return;
    }

    let settled = false;
    const startTime = Date.now();
    const OAUTH_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    // Poll localStorage for the result written by the callback page
    // NOTE: We do NOT check popup.closed because COOP headers
    // (Cross-Origin-Opener-Policy: same-origin, needed for DuckDB WASM)
    // sever the popup reference when it navigates to Google (cross-origin),
    // making popup.closed return true immediately.
    const pollTimer = setInterval(() => {
      if (settled) return;

      // Check for result from callback
      const resultStr = localStorage.getItem(LS_OAUTH_RESULT);
      if (resultStr) {
        settled = true;
        clearInterval(pollTimer);
        localStorage.removeItem(LS_OAUTH_RESULT);
        localStorage.removeItem(LS_OAUTH_STATE);

        try {
          const result = JSON.parse(resultStr);

          if (result.error) {
            reject(new Error(result.error));
            return;
          }

          // Verify state
          if (result.state !== state) {
            reject(new Error('OAuth state mismatch'));
            return;
          }

          resolve({
            accessToken: result.accessToken,
            expiresIn: result.expiresIn || 3600,
            tokenType: 'Bearer',
          });
        } catch {
          reject(new Error('Failed to parse OAuth result'));
        }
        return;
      }

      // Timeout after 5 minutes (user likely abandoned the flow)
      if (Date.now() - startTime > OAUTH_TIMEOUT) {
        settled = true;
        clearInterval(pollTimer);
        localStorage.removeItem(LS_OAUTH_STATE);
        reject(new Error('OAuth timed out. Please try again.'));
      }
    }, 500);
  });
}

/**
 * Fetch user info using access token
 */
export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = await response.json();

  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

/**
 * Revoke access token (on disconnect)
 */
export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
    });
  } catch (error) {
    // Ignore errors on revoke, token might already be invalid
    console.warn('[OAuth] Token revocation failed:', error);
  }
}
