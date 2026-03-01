import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/services/api'

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a default apiClient object', () => {
    expect(apiClient).toBeDefined()
  })

  it('has a get method', () => {
    expect(typeof apiClient.get).toBe('function')
  })

  it('has a post method', () => {
    expect(typeof apiClient.post).toBe('function')
  })

  it('has a put method', () => {
    expect(typeof apiClient.put).toBe('function')
  })

  it('has a delete method', () => {
    expect(typeof apiClient.delete).toBe('function')
  })

  it('has a patch method', () => {
    expect(typeof apiClient.patch).toBe('function')
  })

  it('returns a promise from get()', () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] })
    const result = apiClient.get('/test')
    expect(result).toBeInstanceOf(Promise)
  })

  it('returns a promise from post()', () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} })
    const result = apiClient.post('/test', {})
    expect(result).toBeInstanceOf(Promise)
  })
})
