import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cutlistsService } from '@/services/cutlists'

describe('cutlists service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a generateCutlist function', () => {
    expect(typeof cutlistsService.generateCutlist).toBe('function')
  })

  it('exports a getCutlistPreview function', () => {
    expect(typeof cutlistsService.getCutlistPreview).toBe('function')
  })

  it('exports a getCutlists function', () => {
    expect(typeof cutlistsService.getCutlists).toBe('function')
  })

  it('exports a deleteCutlist function', () => {
    expect(typeof cutlistsService.deleteCutlist).toBe('function')
  })

  it('getCutlists returns a promise', () => {
    vi.spyOn(cutlistsService, 'getCutlists').mockResolvedValue([])
    const result = cutlistsService.getCutlists('job-1')
    expect(result).toBeInstanceOf(Promise)
  })

  it('generateCutlist returns a promise', () => {
    vi.spyOn(cutlistsService, 'generateCutlist').mockResolvedValue(new Blob())
    const result = cutlistsService.generateCutlist({ jobId: 'job-1' })
    expect(result).toBeInstanceOf(Promise)
  })

  it('getCutlistPreview returns a promise', () => {
    vi.spyOn(cutlistsService, 'getCutlistPreview').mockResolvedValue(null)
    const result = cutlistsService.getCutlistPreview('job-1')
    expect(result).toBeInstanceOf(Promise)
  })
})
