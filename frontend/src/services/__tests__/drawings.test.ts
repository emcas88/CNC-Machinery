import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as drawingsService from '@/services/drawings'

describe('drawings service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a getDrawings function', () => {
    expect(typeof drawingsService.getDrawings).toBe('function')
  })

  it('exports a getDrawingById function', () => {
    expect(typeof drawingsService.getDrawingById).toBe('function')
  })

  it('exports a createDrawing function', () => {
    expect(typeof drawingsService.createDrawing).toBe('function')
  })

  it('exports an updateDrawing function', () => {
    expect(typeof drawingsService.updateDrawing).toBe('function')
  })

  it('exports a deleteDrawing function', () => {
    expect(typeof drawingsService.deleteDrawing).toBe('function')
  })

  it('getDrawings returns a promise', () => {
    vi.spyOn(drawingsService, 'getDrawings').mockResolvedValue([])
    const result = drawingsService.getDrawings()
    expect(result).toBeInstanceOf(Promise)
  })

  it('getDrawingById returns a promise', () => {
    vi.spyOn(drawingsService, 'getDrawingById').mockResolvedValue(null)
    const result = drawingsService.getDrawingById('1')
    expect(result).toBeInstanceOf(Promise)
  })
})
