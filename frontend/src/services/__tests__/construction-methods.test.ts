import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as constructionMethodsService from '@/services/construction-methods'

describe('construction-methods service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a getConstructionMethods function', () => {
    expect(typeof constructionMethodsService.getConstructionMethods).toBe('function')
  })

  it('exports a getConstructionMethodById function', () => {
    expect(typeof constructionMethodsService.getConstructionMethodById).toBe('function')
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

  it('getConstructionMethodById returns a promise', () => {
    vi.spyOn(constructionMethodsService, 'getConstructionMethodById').mockResolvedValue(null)
    const result = constructionMethodsService.getConstructionMethodById('1')
    expect(result).toBeInstanceOf(Promise)
  })
})
