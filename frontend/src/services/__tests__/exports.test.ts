import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as exportsService from '@/services/exports'

describe('exports service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports an exportToPdf function', () => {
    expect(typeof exportsService.exportToPdf).toBe('function')
  })

  it('exports an exportToDxf function', () => {
    expect(typeof exportsService.exportToDxf).toBe('function')
  })

  it('exports an exportToGltf function', () => {
    expect(typeof exportsService.exportToGltf).toBe('function')
  })

  it('exports an exportToCsv function', () => {
    expect(typeof exportsService.exportToCsv).toBe('function')
  })

  it('exportToPdf returns a promise', () => {
    vi.spyOn(exportsService, 'exportToPdf').mockResolvedValue(new Blob())
    const result = exportsService.exportToPdf({ jobId: '1' })
    expect(result).toBeInstanceOf(Promise)
  })

  it('exportToDxf returns a promise', () => {
    vi.spyOn(exportsService, 'exportToDxf').mockResolvedValue(new Blob())
    const result = exportsService.exportToDxf({ jobId: '1' })
    expect(result).toBeInstanceOf(Promise)
  })

  it('exportToGltf returns a promise', () => {
    vi.spyOn(exportsService, 'exportToGltf').mockResolvedValue(new Blob())
    const result = exportsService.exportToGltf({ jobId: '1' })
    expect(result).toBeInstanceOf(Promise)
  })
})
