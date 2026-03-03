import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hardwareService } from '@/services/hardware'

describe('hardware service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a getHardware function', () => {
    expect(typeof hardwareService.getHardware).toBe('function')
  })

  it('exports a getHardwareItem function', () => {
    expect(typeof hardwareService.getHardwareItem).toBe('function')
  })

  it('exports a createHardware function', () => {
    expect(typeof hardwareService.createHardware).toBe('function')
  })

  it('exports an updateHardware function', () => {
    expect(typeof hardwareService.updateHardware).toBe('function')
  })

  it('exports a deleteHardware function', () => {
    expect(typeof hardwareService.deleteHardware).toBe('function')
  })

  it('exports a getHardwareCategories function', () => {
    expect(typeof hardwareService.getHardwareCategories).toBe('function')
  })

  it('getHardware returns a promise', () => {
    vi.spyOn(hardwareService, 'getHardware').mockResolvedValue([])
    const result = hardwareService.getHardware()
    expect(result).toBeInstanceOf(Promise)
  })

  it('getHardwareItem returns a promise', () => {
    vi.spyOn(hardwareService, 'getHardwareItem').mockResolvedValue(null as any)
    const result = hardwareService.getHardwareItem('1')
    expect(result).toBeInstanceOf(Promise)
  })

  it('createHardware returns a promise', () => {
    vi.spyOn(hardwareService, 'createHardware').mockResolvedValue({ id: '1' } as any)
    const result = hardwareService.createHardware({ name: 'Hinge', type: 'hinge' } as any)
    expect(result).toBeInstanceOf(Promise)
  })
})
