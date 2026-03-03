import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

// We test the module directly — import after mocking localStorage
describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('creates axios instance with baseURL on port 8080', async () => {
    const { default: api } = await import('../api')
    expect(api.defaults.baseURL).toBe('http://localhost:8080/api')
  })

  it('exports apiClient as named export equal to default', async () => {
    const mod = await import('../api')
    expect(mod.apiClient).toBe(mod.default)
  })

  it('sets Content-Type header to application/json', async () => {
    const { default: api } = await import('../api')
    // axios stores defaults under headers.common or headers
    const contentType =
      (api.defaults.headers as Record<string, unknown>)['Content-Type'] ??
      (api.defaults.headers.common as Record<string, unknown>)?.['Content-Type']
    expect(contentType).toBe('application/json')
  })

  it('request interceptor adds Authorization header when token exists', async () => {
    localStorage.setItem('auth_token', 'test-token-123')
    const { default: api } = await import('../api')

    // Simulate the request interceptor by running it against a fake config
    const handlers = (api.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: unknown) => unknown }>
    }).handlers
    const interceptor = handlers[handlers.length - 1]
    const config = { headers: {} as Record<string, string> }
    const result = interceptor.fulfilled(config) as typeof config
    expect(result.headers['Authorization']).toBe('Bearer test-token-123')
  })

  it('request interceptor does NOT add Authorization header when no token', async () => {
    localStorage.removeItem('auth_token')
    const { default: api } = await import('../api')

    const handlers = (api.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: unknown) => unknown }>
    }).handlers
    const interceptor = handlers[handlers.length - 1]
    const config = { headers: {} as Record<string, string> }
    const result = interceptor.fulfilled(config) as typeof config
    expect(result.headers['Authorization']).toBeUndefined()
  })

  it('response interceptor removes tokens and redirects on 401', async () => {
    localStorage.setItem('auth_token', 'old-token')
    localStorage.setItem('refresh_token', 'old-refresh')

    // jsdom doesn't fully support window.location.href assignment — spy on it
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location)

    const { default: api } = await import('../api')

    const handlers = (api.interceptors.response as unknown as {
      handlers: Array<{ fulfilled: (r: unknown) => unknown; rejected: (e: unknown) => unknown }>
    }).handlers
    const interceptor = handlers[handlers.length - 1]

    const error = { response: { status: 401 } }
    try {
      await interceptor.rejected(error)
    } catch {
      // expected rejection
    }

    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    locationSpy.mockRestore()
  })

  it('response interceptor passes through non-401 errors', async () => {
    const { default: api } = await import('../api')

    const handlers = (api.interceptors.response as unknown as {
      handlers: Array<{ fulfilled: (r: unknown) => unknown; rejected: (e: unknown) => unknown }>
    }).handlers
    const interceptor = handlers[handlers.length - 1]

    const error = { response: { status: 500 }, message: 'Server Error' }
    await expect(interceptor.rejected(error)).rejects.toMatchObject({ response: { status: 500 } })
  })

  it('response interceptor passes successful responses through unchanged', async () => {
    const { default: api } = await import('../api')

    const handlers = (api.interceptors.response as unknown as {
      handlers: Array<{ fulfilled: (r: unknown) => unknown; rejected: (e: unknown) => unknown }>
    }).handlers
    const interceptor = handlers[handlers.length - 1]

    const response = { status: 200, data: { ok: true } }
    const result = interceptor.fulfilled(response)
    expect(result).toEqual(response)
  })
})
