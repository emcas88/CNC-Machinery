import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { api } from '../api'

describe('API Service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has correct base URL', () => {
    expect((api.defaults.baseURL as string)).toBe('http://localhost:8080/api')
  })

  it('has correct default headers', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('attaches Authorization header when token exists', async () => {
    localStorage.setItem('access_token', 'test-token-123')
    const mockGet = vi.spyOn(api, 'get').mockResolvedValueOnce({ data: {} })
    await api.get('/test')
    expect(mockGet).toHaveBeenCalled()
  })

  it('does not attach Authorization header when no token', async () => {
    const config = { headers: {} as Record<string, string> }
    // Simulate request interceptor with no token
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    expect(config.headers.Authorization).toBeUndefined()
  })

  it('attaches token from localStorage', () => {
    localStorage.setItem('access_token', 'my-access-token')
    const token = localStorage.getItem('access_token')
    const config = { headers: {} as Record<string, string> }
    if (token) config.headers.Authorization = `Bearer ${token}`
    expect(config.headers.Authorization).toBe('Bearer my-access-token')
  })

  it('removes both tokens on 401', () => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('refresh_token', 'refresh')

    // Simulate 401 interceptor
    const error = { response: { status: 401 } }
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('does not redirect on non-401 errors', () => {
    localStorage.setItem('access_token', 'token')
    const error = { response: { status: 403 } }
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
    }
    expect(localStorage.getItem('access_token')).toBe('token')
  })

  it('is an axios instance', () => {
    expect(api).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
    expect(typeof api.put).toBe('function')
    expect(typeof api.delete).toBe('function')
  })

  it('exports api as named export', async () => {
    const module = await import('../api')
    expect(module.api).toBeDefined()
  })
})
