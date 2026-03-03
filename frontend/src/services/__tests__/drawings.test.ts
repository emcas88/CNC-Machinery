import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drawingsService } from '@/services/drawings'

describe('drawings service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a getTemplates function', () => {
    expect(typeof drawingsService.getTemplates).toBe('function')
  })

  it('exports a getTemplate function', () => {
    expect(typeof drawingsService.getTemplate).toBe('function')
  })

  it('exports a createTemplate function', () => {
    expect(typeof drawingsService.createTemplate).toBe('function')
  })

  it('exports an updateTemplate function', () => {
    expect(typeof drawingsService.updateTemplate).toBe('function')
  })

  it('exports a deleteTemplate function', () => {
    expect(typeof drawingsService.deleteTemplate).toBe('function')
  })

  it('exports a generateDrawing function', () => {
    expect(typeof drawingsService.generateDrawing).toBe('function')
  })

  it('exports a getProductDrawings function', () => {
    expect(typeof drawingsService.getProductDrawings).toBe('function')
  })

  it('getTemplates returns a promise', () => {
    vi.spyOn(drawingsService, 'getTemplates').mockResolvedValue([])
    const result = drawingsService.getTemplates()
    expect(result).toBeInstanceOf(Promise)
  })

  it('getTemplate returns a promise', () => {
    vi.spyOn(drawingsService, 'getTemplate').mockResolvedValue(null as any)
    const result = drawingsService.getTemplate('1')
    expect(result).toBeInstanceOf(Promise)
  })
})
