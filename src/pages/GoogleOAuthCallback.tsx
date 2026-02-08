import { useEffect, useState } from 'react';
import { parseOAuthHash } from '@/lib/google/oauth';

/**
 * OAuth callback page - handles redirect from Google OAuth
 *
 * This page:
 * 1. Parses the access token from the URL hash
 * 2. Writes result to localStorage (parent polls for it)
 * 3. Closes itself
 */
export function GoogleOAuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const LS_OAUTH_RESULT = 'google-oauth-result';

    // Parse the URL
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);

    // Check for error from Google
    const error = searchParams.get('error');
    if (error) {
      setStatus('error');
      setErrorMessage(
        error === 'access_denied'
          ? 'Access was denied. Please try again.'
          : `Authentication failed: ${error}`
      );
      localStorage.setItem(LS_OAUTH_RESULT, JSON.stringify({
        error,
        state: searchParams.get('state'),
      }));
      return;
    }

    // Parse tokens from hash
    const result = parseOAuthHash(hash);

    if (!result) {
      setStatus('error');
      setErrorMessage('No authentication token received. Please try again.');
      return;
    }

    // Get state from hash params
    const hashParams = new URLSearchParams(hash.substring(1));
    const state = hashParams.get('state');

    // Write result to localStorage — parent window polls for this
    localStorage.setItem(LS_OAUTH_RESULT, JSON.stringify({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      state,
    }));

    setStatus('success');

    // Close popup after parent has time to read localStorage
    setTimeout(() => {
      window.close();
    }, 2000);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#fafafa',
        padding: '20px',
      }}
    >
      {status === 'processing' && (
        <>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid #e5e5e5',
              borderTopColor: '#0F9D58',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>
            {`@keyframes spin { to { transform: rotate(360deg); } }`}
          </style>
          <p style={{ marginTop: 16, color: '#666' }}>Completing authentication...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#0F9D58',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20,6 9,17 4,12" />
            </svg>
          </div>
          <p style={{ marginTop: 16, color: '#333', fontWeight: 500 }}>
            Connected to Google Sheets!
          </p>
          <p style={{ marginTop: 8, color: '#666', fontSize: 14 }}>
            This window will close automatically...
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p style={{ marginTop: 16, color: '#333', fontWeight: 500 }}>
            Authentication Failed
          </p>
          <p style={{ marginTop: 8, color: '#666', fontSize: 14, textAlign: 'center' }}>
            {errorMessage}
          </p>
          <button
            onClick={() => window.close()}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              backgroundColor: '#333',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Close Window
          </button>
        </>
      )}
    </div>
  );
}
