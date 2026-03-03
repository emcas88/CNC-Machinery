// F27 – apiErrorHandler: Axios interceptor for global HTTP error handling.

import type { GlobalErrorState } from './useGlobalError';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiErrorHandlerConfig {
  /** The global error store to dispatch toasts to. */
  store: Pick<GlobalErrorState, 'error' | 'warning' | 'info'>;
  /** Callback when a 401 is received. Typically redirects to login. */
  onUnauthorized?: () => void;
  /** Callback when a 403 is received. */
  onForbidden?: () => void;
  /** Optional: URLs to exclude from interception (e.g., /api/auth/login). */
  excludeUrls?: string[];
}

export interface AxiosLikeError {
  response?: {
    status: number;
    data?: {
      message?: string;
      error?: string;
      details?: string;
    };
  };
  request?: unknown;
  message: string;
  config?: {
    url?: string;
    method?: string;
  };
}

// ---------------------------------------------------------------------------
// Error message extraction
// ---------------------------------------------------------------------------

export function extractErrorMessage(error: AxiosLikeError): string {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.error) return error.response.data.error;
  if (error.response?.data?.details) return error.response.data.details;
  if (error.message) return error.message;
  return 'An unexpected error occurred';
}

// ---------------------------------------------------------------------------
// Status code handlers
// ---------------------------------------------------------------------------

export function getStatusCodeMessage(status: number): { title: string; message: string } {
  switch (status) {
    case 400:
      return { title: 'Bad Request', message: 'The request was invalid. Please check your input.' };
    case 401:
      return { title: 'Unauthorized', message: 'Your session has expired. Please log in again.' };
    case 403:
      return { title: 'Forbidden', message: 'You do not have permission to perform this action.' };
    case 404:
      return { title: 'Not Found', message: 'The requested resource was not found.' };
    case 409:
      return { title: 'Conflict', message: 'The action conflicts with the current state.' };
    case 422:
      return { title: 'Validation Error', message: 'The submitted data failed validation.' };
    case 429:
      return { title: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a moment.' };
    case 500:
      return { title: 'Server Error', message: 'An internal server error occurred. Please try again later.' };
    case 502:
      return { title: 'Bad Gateway', message: 'The server is temporarily unavailable.' };
    case 503:
      return { title: 'Service Unavailable', message: 'The service is currently unavailable. Please try again.' };
    default:
      return { title: `Error ${status}`, message: 'An unexpected error occurred.' };
  }
}

// ---------------------------------------------------------------------------
// Should intercept check
// ---------------------------------------------------------------------------

export function shouldIntercept(url: string | undefined, excludeUrls: string[]): boolean {
  if (!url) return true;
  return !excludeUrls.some((excluded) => url.includes(excluded));
}

// ---------------------------------------------------------------------------
// Axios response error interceptor
// ---------------------------------------------------------------------------

export function createApiErrorInterceptor(config: ApiErrorHandlerConfig) {
  const { store, onUnauthorized, onForbidden, excludeUrls = [] } = config;

  /**
   * Axios response error interceptor.
   * Attach via: `axios.interceptors.response.use(null, interceptor)`
   */
  return function apiErrorInterceptor(error: AxiosLikeError): Promise<never> {
    const url = error.config?.url;

    // Skip excluded URLs
    if (!shouldIntercept(url, excludeUrls)) {
      return Promise.reject(error);
    }

    if (error.response) {
      const { status } = error.response;
      const apiMessage = extractErrorMessage(error);
      const { title } = getStatusCodeMessage(status);

      switch (status) {
        case 401:
          store.error(title, apiMessage);
          onUnauthorized?.();
          break;

        case 403:
          store.warning(title, apiMessage);
          onForbidden?.();
          break;

        case 404:
          // 404s are often expected (e.g., checking if a resource exists)
          // Don't show toast by default; caller should handle.
          break;

        case 422:
          store.warning(title, apiMessage);
          break;

        case 429:
          store.warning(title, apiMessage);
          break;

        case 500:
        case 502:
        case 503:
          store.error(title, apiMessage);
          break;

        default:
          if (status >= 400 && status < 500) {
            store.warning(title, apiMessage);
          } else if (status >= 500) {
            store.error(title, apiMessage);
          }
          break;
      }
    } else if (error.request) {
      // Network error – request was made but no response received
      store.error('Network Error', 'Unable to reach the server. Please check your connection.');
    } else {
      // Something went wrong setting up the request
      store.error('Request Error', error.message);
    }

    return Promise.reject(error);
  };
}

// ---------------------------------------------------------------------------
// Axios request interceptor (for auth token injection)
// ---------------------------------------------------------------------------

export interface AuthConfig {
  getToken: () => string | null;
  headerName?: string;
}

export function createAuthInterceptor(authConfig: AuthConfig) {
  const { getToken, headerName = 'Authorization' } = authConfig;

  return function authInterceptor(config: Record<string, any>) {
    const token = getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers[headerName] = `Bearer ${token}`;
    }
    return config;
  };
}

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

export interface AxiosLikeInstance {
  interceptors: {
    request: { use: (fn: (config: any) => any) => number };
    response: { use: (onFulfilled: null | ((res: any) => any), onRejected: (err: any) => any) => number };
  };
}

export function setupApiErrorHandling(
  axiosInstance: AxiosLikeInstance,
  config: ApiErrorHandlerConfig,
  authConfig?: AuthConfig
): void {
  if (authConfig) {
    axiosInstance.interceptors.request.use(createAuthInterceptor(authConfig));
  }
  axiosInstance.interceptors.response.use(null, createApiErrorInterceptor(config));
}
