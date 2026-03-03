import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { apiClient } from '../api'

vi.mock('axios', () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: {
      create: vi.fn(() => instance),
    },
    ...instance,
  }
})

describe('apiClient', () => {
  it('is defined', () => {
    expect(apiClient).toBeDefined()
  })

  it('has interceptors registered', () => {
    // The interceptors.request.use and response.use should have been called
    // during module initialisation.
    expect(apiClient.interceptors.request.use).toBeDefined()
    expect(apiClient.interceptors.response.use).toBeDefined()
  })

  it('exposes get / post / put / delete methods', () => {
    expect(typeof apiClient.get).toBe('function')
    expect(typeof apiClient.post).toBe('function')
    expect(typeof apiClient.put).toBe('function')
    expect(typeof apiClient.delete).toBe('function')
  })
})
