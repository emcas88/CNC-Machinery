import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as hardwareService from '@/services/hardware'

describe('hardware service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a getHardwareItems function', () => {
    expect(typeof hardwareService.getHardwareItems).toBe('function')
  })

  it('exports a getHardwareItemById function', () => {
    expect(typeof hardwareService.getHardwareItemById).toBe('function')
  })

  it('exports a createHardwareItem function', () => {
    expect(typeof hardwareService.createHardwareItem).toBe('function')
  })

  it('exports an updateHardwareItem function', () => {
    expect(typeof hardwareService.updateHardwareItem).toBe('function')
  })

  it('exports a deleteHardwareItem function', () => {
    expect(typeof hardwareService.deleteHardwareItem).toBe('function')
  })

  it('getHardwareItems returns a promise', () => {
    vi.spyOn(hardwareService, 'getHardwareItems').mockResolvedValue([])
    const result = hardwareService.getHardwareItems()
    expect(result).toBeInstanceOf(Promise)
  })

  it('getHardwareItemById returns a promise', () => {
    vi.spyOn(hardwareService, 'getHardwareItemById').mockResolvedValue(null)
    const result = hardwareService.getHardwareItemById('1')
    expect(result).toBeInstanceOf(Promise)
  })

  it('createHardwareItem returns a promise', () => {
    vi.spyOn(hardwareService, 'createHardwareItem').mockResolvedValue({ id: '1' })
    const result = hardwareService.createHardwareItem({ name: 'Hinge', type: 'hinge' })
    expect(result).toBeInstanceOf(Promise)
  })
})
