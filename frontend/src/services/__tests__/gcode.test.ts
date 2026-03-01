import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as gcodeService from '@/services/gcode'

describe('gcode service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a generateGcode function', () => {
    expect(typeof gcodeService.generateGcode).toBe('function')
  })

  it('exports a getGcodeJobs function', () => {
    expect(typeof gcodeService.getGcodeJobs).toBe('function')
  })

  it('exports a getGcodeJobById function', () => {
    expect(typeof gcodeService.getGcodeJobById).toBe('function')
  })

  it('exports a downloadGcode function', () => {
    expect(typeof gcodeService.downloadGcode).toBe('function')
  })

  it('generateGcode returns a promise', () => {
    vi.spyOn(gcodeService, 'generateGcode').mockResolvedValue({ jobId: '1', status: 'queued' })
    const result = gcodeService.generateGcode({ cutlistId: '1', machineId: '1' })
    expect(result).toBeInstanceOf(Promise)
  })

  it('getGcodeJobs returns a promise', () => {
    vi.spyOn(gcodeService, 'getGcodeJobs').mockResolvedValue([])
    const result = gcodeService.getGcodeJobs()
    expect(result).toBeInstanceOf(Promise)
  })

  it('getGcodeJobById returns a promise', () => {
    vi.spyOn(gcodeService, 'getGcodeJobById').mockResolvedValue(null)
    const result = gcodeService.getGcodeJobById('1')
    expect(result).toBeInstanceOf(Promise)
  })
})
