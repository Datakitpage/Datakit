import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock import.meta.env before importing the module
vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id-123');

import { parseOAuthHash, isOAuthConfigured, fetchUserInfo, revokeToken, initiateOAuth } from './oauth';

describe('oauth — parseOAuthHash', () => {
  it('should parse a valid hash with all fields', () => {
    const hash = '#access_token=ya29.abc123&expires_in=3600&token_type=Bearer';
    const result = parseOAuthHash(hash);

    expect(result).toEqual({
      accessToken: 'ya29.abc123',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  });

  it('should return null for empty hash', () => {
    expect(parseOAuthHash('')).toBeNull();
    expect(parseOAuthHash('#')).toBeNull();
  });

  it('should return null when access_token is missing', () => {
    const hash = '#expires_in=3600&token_type=Bearer';
    expect(parseOAuthHash(hash)).toBeNull();
  });

  it('should default expiresIn to 3600 when not provided', () => {
    const hash = '#access_token=ya29.abc123';
    const result = parseOAuthHash(hash);

    expect(result).toEqual({
      accessToken: 'ya29.abc123',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  });

  it('should default tokenType to Bearer when not provided', () => {
    const hash = '#access_token=ya29.abc123&expires_in=7200';
    const result = parseOAuthHash(hash);

    expect(result?.tokenType).toBe('Bearer');
    expect(result?.expiresIn).toBe(7200);
  });

  it('should handle hash with error parameter', () => {
    const hash = '#error=access_denied';
    expect(parseOAuthHash(hash)).toBeNull();
  });
});

describe('oauth — isOAuthConfigured', () => {
  it('should return true when VITE_GOOGLE_CLIENT_ID is set', () => {
    expect(isOAuthConfigured()).toBe(true);
  });
});

describe('oauth — fetchUserInfo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and return user info', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    const result = await fetchUserInfo('test-token');

    expect(result).toEqual({
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: 'Bearer test-token' } }
    );
  });

  it('should throw on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(fetchUserInfo('bad-token')).rejects.toThrow('Failed to fetch user info');
  });

  it('should handle missing picture field', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        email: 'user@example.com',
        name: 'No Photo User',
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    const result = await fetchUserInfo('test-token');
    expect(result.picture).toBeUndefined();
  });
});

describe('oauth — revokeToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call revoke endpoint with POST', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    await revokeToken('test-token');

    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/revoke?token=test-token',
      { method: 'POST' }
    );
  });

  it('should not throw when revocation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    // Should not throw
    await expect(revokeToken('test-token')).resolves.toBeUndefined();
  });
});

describe('oauth — initiateOAuth', () => {
  let originalOpen: typeof window.open;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    originalOpen = window.open;
    localStorage.clear();

    // Mock crypto.getRandomValues
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      const uint8 = array as Uint8Array;
      for (let i = 0; i < uint8.length; i++) {
        uint8[i] = i % 256;
      }
      return array;
    });
  });

  afterEach(() => {
    window.open = originalOpen;
    vi.useRealTimers();
    localStorage.clear();
  });

  it('should reject when popup is blocked', async () => {
    window.open = vi.fn().mockReturnValue(null);

    const promise = initiateOAuth();
    await expect(promise).rejects.toThrow('Failed to open OAuth popup');
  });

  it('should open popup with correct OAuth URL', async () => {
    const mockPopup = { closed: false };
    window.open = vi.fn().mockReturnValue(mockPopup);

    // Start OAuth — attach catch to avoid unhandled rejection
    const promise = initiateOAuth().catch(() => {});

    expect(window.open).toHaveBeenCalledOnce();
    const openCall = (window.open as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = openCall[0] as string;

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=');
    expect(url).toContain('response_type=token');
    expect(url).toContain('prompt=consent');
    expect(url).toContain('scope=');

    // Clean up: simulate result to resolve the promise
    const state = localStorage.getItem('google-oauth-state');
    localStorage.setItem('google-oauth-result', JSON.stringify({
      accessToken: 'ya29.resolved',
      expiresIn: 3600,
      state,
    }));
    await vi.advanceTimersByTimeAsync(500);
    await promise;
  });

  it('should resolve when localStorage gets a valid result', async () => {
    const mockPopup = { closed: false };
    window.open = vi.fn().mockReturnValue(mockPopup);

    const promise = initiateOAuth();

    // Get the state that was written
    const state = localStorage.getItem('google-oauth-state');
    expect(state).toBeTruthy();

    // Simulate callback page writing result
    localStorage.setItem('google-oauth-result', JSON.stringify({
      accessToken: 'ya29.test-token',
      expiresIn: 7200,
      state,
    }));

    // Advance timer to trigger poll
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toEqual({
      accessToken: 'ya29.test-token',
      expiresIn: 7200,
      tokenType: 'Bearer',
    });

    // Should clean up localStorage
    expect(localStorage.getItem('google-oauth-result')).toBeNull();
    expect(localStorage.getItem('google-oauth-state')).toBeNull();
  });

  it('should reject on state mismatch', async () => {
    const mockPopup = { closed: false };
    window.open = vi.fn().mockReturnValue(mockPopup);

    // Attach .catch early to prevent unhandled rejection
    let rejectedError: Error | undefined;
    const promise = initiateOAuth().catch(e => { rejectedError = e; });

    // Write result with wrong state
    localStorage.setItem('google-oauth-result', JSON.stringify({
      accessToken: 'ya29.test-token',
      state: 'wrong-state-value',
    }));

    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(rejectedError?.message).toBe('OAuth state mismatch');
  });

  it('should reject when result contains error', async () => {
    const mockPopup = { closed: false };
    window.open = vi.fn().mockReturnValue(mockPopup);

    let rejectedError: Error | undefined;
    const promise = initiateOAuth().catch(e => { rejectedError = e; });

    localStorage.setItem('google-oauth-result', JSON.stringify({
      error: 'access_denied',
    }));

    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(rejectedError?.message).toBe('access_denied');
  });

  it('should reject on timeout after 5 minutes', async () => {
    const mockPopup = { closed: false };
    window.open = vi.fn().mockReturnValue(mockPopup);

    let rejectedError: Error | undefined;
    const promise = initiateOAuth().catch(e => { rejectedError = e; });

    // Advance past the 5-minute timeout
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 500);
    await promise;

    expect(rejectedError?.message).toBe('OAuth timed out. Please try again.');
  });

  it('should reject on malformed JSON in result', async () => {
    const mockPopup = { closed: false };
    window.open = vi.fn().mockReturnValue(mockPopup);

    let rejectedError: Error | undefined;
    const promise = initiateOAuth().catch(e => { rejectedError = e; });

    localStorage.setItem('google-oauth-result', 'not-valid-json');

    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(rejectedError?.message).toBe('Failed to parse OAuth result');
  });
});
