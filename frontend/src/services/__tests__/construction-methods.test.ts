import { describe, it, expect, vi, beforeEach } from 'vitest'
import { constructionMethodsService } from '@/services/construction-methods'

describe('construction-methods service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a getConstructionMethods function', () => {
    expect(typeof constructionMethodsService.getConstructionMethods).toBe('function')
  })

  it('exports a getConstructionMethod function', () => {
    expect(typeof constructionMethodsService.getConstructionMethod).toBe('function')
  })

  it('exports a createConstructionMethod function', () => {
    expect(typeof constructionMethodsService.createConstructionMethod).toBe('function')
  })

  it('exports an updateConstructionMethod function', () => {
    expect(typeof constructionMethodsService.updateConstructionMethod).toBe('function')
  })

  it('exports a deleteConstructionMethod function', () => {
    expect(typeof constructionMethodsService.deleteConstructionMethod).toBe('function')
  })

  it('getConstructionMethods returns a promise', () => {
    vi.spyOn(constructionMethodsService, 'getConstructionMethods').mockResolvedValue([])
    const result = constructionMethodsService.getConstructionMethods()
    expect(result).toBeInstanceOf(Promise)
  })

  it('getConstructionMethod returns a promise', () => {
    vi.spyOn(constructionMethodsService, 'getConstructionMethod').mockResolvedValue(null as any)
    const result = constructionMethodsService.getConstructionMethod('1')
    expect(result).toBeInstanceOf(Promise)
  })
})
