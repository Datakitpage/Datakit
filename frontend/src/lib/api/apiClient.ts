import { logApiCall, logApiResponse } from './debugHelper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.datakit.page/api'

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  _retryCount?: number;
}

class ApiClient {
  private baseURL: string;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    // UPDATE 02/07/2025
    // No need for manual headers - cookies are sent automatically

    return {};
  }

  private async refreshToken(): Promise<void> {
    if (this.isRefreshing) {
      // If already refreshing, wait for the current refresh to complete
      if (this.refreshPromise) {
        return this.refreshPromise;
      }
      return;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<void> {
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
  }

  private async handleResponse<T>(response: Response, originalRequest?: { endpoint: string; options: RequestOptions }): Promise<T> {
    if (!response.ok) {
      if (response.status === 401 && originalRequest && !originalRequest.options.skipAuth) {
        const retryCount = originalRequest.options._retryCount || 0;
        
        // Prevent infinite loops - only retry once
        if (retryCount >= 1) {
          throw new Error('Session expired. Please log in again.');
        }

        try {
          // Attempt to refresh the token
          await this.refreshToken();
          
          // Retry the original request with incremented retry count
          const retryOptions = {
            ...originalRequest.options,
            _retryCount: retryCount + 1
          };
          return this.request<T>(originalRequest.endpoint, retryOptions);
        } catch (refreshError) {
          throw new Error('Session expired. Please log in again.');
        }
      }

      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Ignore JSON parse error
      }
      
      throw new Error(errorMessage);
    }

    // Handle empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    return response.json();
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, headers = {}, ...restOptions } = options;
    
    const authHeaders = skipAuth ? {} : await this.getAuthHeaders();
    
    const finalHeaders = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    };

    const url = `${this.baseURL}${endpoint}`;
    const method = restOptions.method || 'GET';
    
    // Log API call in development
    logApiCall(method, url, restOptions.body ? JSON.parse(restOptions.body as string) : undefined);

    try {
      const response = await fetch(url, {
        ...restOptions,
        headers: finalHeaders,
        credentials: 'include', // Important: Include cookies in requests
      });

      const result = await this.handleResponse<T>(response, { endpoint, options });
      logApiResponse(url, result);
      return result;
    } catch (error) {
      logApiResponse(url, null, error);
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Special method for multipart uploads (FormData)
  async uploadFormData<T>(
    endpoint: string,
    formData: FormData,
    options?: Omit<RequestOptions, 'headers'> & { 
      onUploadProgress?: (progress: number) => void;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const { skipAuth = false, headers = {}, onUploadProgress, ...restOptions } = options || {};
    
    const authHeaders = skipAuth ? {} : await this.getAuthHeaders();
    
    // Don't set Content-Type for FormData - browser will set it with boundary
    const finalHeaders = {
      ...authHeaders,
      ...headers,
    };

    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...restOptions,
        method: 'POST',
        headers: finalHeaders,
        credentials: 'include',
        body: formData,
      });

      const result = await this.handleResponse<T>(response, { endpoint, options: { ...options, skipAuth } });
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Streaming method for AI responses
  async stream(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<Response> {
    const { skipAuth = false, headers = {}, _retryCount = 0, ...restOptions } = options || {};
    
    const authHeaders = skipAuth ? {} : await this.getAuthHeaders();
    
    const finalHeaders = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    };

    const url = `${this.baseURL}${endpoint}`;
    
    // Log API call in development
    logApiCall('POST', url, data);

    console.log(`[ApiClient] POST ${endpoint} (stream) - skipAuth: ${skipAuth}, retryCount: ${_retryCount}`);

    try {
      const response = await fetch(url, {
        ...restOptions,
        method: 'POST',
        headers: finalHeaders,
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        if (response.status === 401 && !skipAuth) {
          
          // Prevent infinite loops - only retry once
          if (_retryCount >= 1) {
            throw new Error('Session expired. Please log in again.');
          }

          try {
            // Attempt to refresh the token
            await this.refreshToken();
            
            // Retry the stream request with incremented retry count
            const retryOptions = {
              ...options,
              _retryCount: _retryCount + 1
            };
            return this.stream(endpoint, data, retryOptions);
          } catch (refreshError) {
            console.log('[ApiClient] Token refresh failed:', refreshError);
            throw new Error('Session expired. Please log in again.');
          }
        }

        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Ignore JSON parse error
        }
        throw new Error(errorMessage);
      }

      return response;
    } catch (error) {
      logApiResponse(url, null, error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;