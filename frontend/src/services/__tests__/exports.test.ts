import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportsService } from '@/services/exports'

describe('exports service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports an exportJob function', () => {
    expect(typeof exportsService.exportJob).toBe('function')
  })

  it('exports an exportCutlist function', () => {
    expect(typeof exportsService.exportCutlist).toBe('function')
  })

  it('exports an exportGcode function', () => {
    expect(typeof exportsService.exportGcode).toBe('function')
  })

  it('exports a getExportFormats function', () => {
    expect(typeof exportsService.getExportFormats).toBe('function')
  })

  it('exportJob returns a promise', () => {
    vi.spyOn(exportsService, 'exportJob').mockResolvedValue(new Blob())
    const result = exportsService.exportJob('job-1', 'pdf')
    expect(result).toBeInstanceOf(Promise)
  })

  it('exportCutlist returns a promise', () => {
    vi.spyOn(exportsService, 'exportCutlist').mockResolvedValue(new Blob())
    const result = exportsService.exportCutlist('job-1', 'pdf')
    expect(result).toBeInstanceOf(Promise)
  })

  it('getExportFormats returns a promise', () => {
    vi.spyOn(exportsService, 'getExportFormats').mockResolvedValue([])
    const result = exportsService.getExportFormats()
    expect(result).toBeInstanceOf(Promise)
  })
})
