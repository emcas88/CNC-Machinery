// F27 – apiErrorHandler tests

import { describe, it, expect, vi } from 'vitest';
import {
  createApiErrorInterceptor,
  createAuthInterceptor,
  setupApiErrorHandling,
  extractErrorMessage,
  getStatusCodeMessage,
  shouldIntercept,
  type AxiosLikeError,
  type ApiErrorHandlerConfig,
} from './apiErrorHandler';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mockStore() {
  return {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };
}

function makeError(
  status: number,
  data?: Record<string, any>,
  url?: string
): AxiosLikeError {
  return {
    response: { status, data },
    message: `Request failed with status code ${status}`,
    config: { url, method: 'GET' },
  };
}

function networkError(): AxiosLikeError {
  return {
    request: {},
    message: 'Network Error',
    config: { url: '/api/test' },
  };
}

function requestSetupError(): AxiosLikeError {
  return {
    message: 'Invalid URL',
  };
}

// ---------------------------------------------------------------------------
// extractErrorMessage
// ---------------------------------------------------------------------------

describe('extractErrorMessage', () => {
  // Test 1
  it('extracts message from response data', () => {
    const err = makeError(400, { message: 'Invalid input' });
    expect(extractErrorMessage(err)).toBe('Invalid input');
  });

  // Test 2
  it('extracts error field from response data', () => {
    const err = makeError(400, { error: 'Bad field' });
    expect(extractErrorMessage(err)).toBe('Bad field');
  });

  // Test 3
  it('extracts details field from response data', () => {
    const err = makeError(400, { details: 'Field X required' });
    expect(extractErrorMessage(err)).toBe('Field X required');
  });

  // Test 4
  it('falls back to error.message', () => {
    const err = makeError(500);
    expect(extractErrorMessage(err)).toBe('Request failed with status code 500');
  });
});

// ---------------------------------------------------------------------------
// getStatusCodeMessage
// ---------------------------------------------------------------------------

describe('getStatusCodeMessage', () => {
  // Test 5
  it('returns correct message for 401', () => {
    const { title } = getStatusCodeMessage(401);
    expect(title).toBe('Unauthorized');
  });

  // Test 6
  it('returns correct message for 403', () => {
    const { title } = getStatusCodeMessage(403);
    expect(title).toBe('Forbidden');
  });

  // Test 7
  it('returns correct message for 500', () => {
    const { title } = getStatusCodeMessage(500);
    expect(title).toBe('Server Error');
  });

  // Test 8
  it('returns generic message for unknown status', () => {
    const { title } = getStatusCodeMessage(418);
    expect(title).toBe('Error 418');
  });
});

// ---------------------------------------------------------------------------
// shouldIntercept
// ---------------------------------------------------------------------------

describe('shouldIntercept', () => {
  // Test 9
  it('returns true for non-excluded URLs', () => {
    expect(shouldIntercept('/api/parts', ['/api/auth'])).toBe(true);
  });

  // Test 10
  it('returns false for excluded URLs', () => {
    expect(shouldIntercept('/api/auth/login', ['/api/auth'])).toBe(false);
  });

  // Test 11
  it('returns true for undefined URL', () => {
    expect(shouldIntercept(undefined, ['/api/auth'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createApiErrorInterceptor
// ---------------------------------------------------------------------------

describe('createApiErrorInterceptor', () => {
  // Test 12
  it('shows error toast on 401 and calls onUnauthorized', async () => {
    const store = mockStore();
    const onUnauthorized = vi.fn();
    const interceptor = createApiErrorInterceptor({ store, onUnauthorized });

    const err = makeError(401, { message: 'Token expired' });
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.error).toHaveBeenCalledWith('Unauthorized', 'Token expired');
    expect(onUnauthorized).toHaveBeenCalled();
  });

  // Test 13
  it('shows warning toast on 403 and calls onForbidden', async () => {
    const store = mockStore();
    const onForbidden = vi.fn();
    const interceptor = createApiErrorInterceptor({ store, onForbidden });

    const err = makeError(403, { message: 'Admin only' });
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.warning).toHaveBeenCalledWith('Forbidden', 'Admin only');
    expect(onForbidden).toHaveBeenCalled();
  });

  // Test 14
  it('does not show toast on 404', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = makeError(404);
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.error).not.toHaveBeenCalled();
    expect(store.warning).not.toHaveBeenCalled();
  });

  // Test 15
  it('shows error toast on 500', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = makeError(500, { message: 'Internal error' });
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.error).toHaveBeenCalledWith('Server Error', 'Internal error');
  });

  // Test 16
  it('shows error toast on 502', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = makeError(502);
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.error).toHaveBeenCalled();
  });

  // Test 17
  it('shows warning toast on 422 validation error', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = makeError(422, { message: 'Name is required' });
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.warning).toHaveBeenCalledWith('Validation Error', 'Name is required');
  });

  // Test 18
  it('shows warning toast on 429 rate limit', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = makeError(429, { message: 'Slow down' });
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.warning).toHaveBeenCalledWith('Too Many Requests', 'Slow down');
  });

  // Test 19
  it('handles network errors (no response)', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = networkError();
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.error).toHaveBeenCalledWith(
      'Network Error',
      'Unable to reach the server. Please check your connection.'
    );
  });

  // Test 20
  it('handles request setup errors', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = requestSetupError();
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.error).toHaveBeenCalledWith('Request Error', 'Invalid URL');
  });

  // Test 21
  it('skips excluded URLs', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({
      store,
      excludeUrls: ['/api/auth/login'],
    });

    const err = makeError(401, { message: 'Bad creds' }, '/api/auth/login');
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.error).not.toHaveBeenCalled();
  });

  // Test 22
  it('handles generic 4xx errors with warning', async () => {
    const store = mockStore();
    const interceptor = createApiErrorInterceptor({ store });

    const err = makeError(409, { message: 'Conflict' });
    await expect(interceptor(err)).rejects.toBe(err);

    expect(store.warning).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createAuthInterceptor
// ---------------------------------------------------------------------------

describe('createAuthInterceptor', () => {
  // Test 23
  it('adds authorization header when token exists', () => {
    const interceptor = createAuthInterceptor({
      getToken: () => 'my-token-123',
    });
    const config = { headers: {} };
    const result = interceptor(config);
    expect(result.headers.Authorization).toBe('Bearer my-token-123');
  });

  // Test 24
  it('does not add header when token is null', () => {
    const interceptor = createAuthInterceptor({
      getToken: () => null,
    });
    const config = { headers: {} };
    const result = interceptor(config);
    expect(result.headers.Authorization).toBeUndefined();
  });

  // Test 25
  it('uses custom header name', () => {
    const interceptor = createAuthInterceptor({
      getToken: () => 'tok',
      headerName: 'X-API-Key',
    });
    const config = { headers: {} };
    const result = interceptor(config);
    expect(result.headers['X-API-Key']).toBe('Bearer tok');
  });
});

// ---------------------------------------------------------------------------
// setupApiErrorHandling
// ---------------------------------------------------------------------------

describe('setupApiErrorHandling', () => {
  function mockAxios() {
    return {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };
  }

  // Test 26
  it('registers response interceptor', () => {
    const axios = mockAxios();
    const store = mockStore();
    setupApiErrorHandling(axios, { store });
    expect(axios.interceptors.response.use).toHaveBeenCalledWith(null, expect.any(Function));
  });

  // Test 27
  it('registers auth interceptor when authConfig provided', () => {
    const axios = mockAxios();
    const store = mockStore();
    setupApiErrorHandling(axios, { store }, { getToken: () => 'tok' });
    expect(axios.interceptors.request.use).toHaveBeenCalledWith(expect.any(Function));
  });

  // Test 28
  it('does not register auth interceptor when no authConfig', () => {
    const axios = mockAxios();
    const store = mockStore();
    setupApiErrorHandling(axios, { store });
    expect(axios.interceptors.request.use).not.toHaveBeenCalled();
  });
});
