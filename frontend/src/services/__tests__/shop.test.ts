import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { shopService } from '@/services/shop'

const mockShopSettings = {
  id: 'shop-1',
  name: 'My CNC Shop',
  currency: 'USD',
  timezone: 'America/New_York',
  workingHours: { start: '08:00', end: '17:00' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('shopService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockShopSettings })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockShopSettings })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockShopSettings })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getShopSettings calls GET /shop/settings and returns data', async () => {
    const result = await shopService.getShopSettings()
    expect(getSpy).toHaveBeenCalledWith('/shop/settings')
    expect(result).toEqual(mockShopSettings)
  })

  it('updateShopSettings calls PATCH /shop/settings and returns data', async () => {
    const changes = { name: 'Updated Shop' }
    const result = await shopService.updateShopSettings(changes)
    expect(patchSpy).toHaveBeenCalledWith('/shop/settings', changes)
    expect(result).toEqual(mockShopSettings)
  })

  it('getShopStats calls GET /shop/stats and returns data', async () => {
    const mockStats = { totalJobs: 10, activeJobs: 3, completedJobs: 7 }
    getSpy.mockResolvedValueOnce({ data: mockStats })
    const result = await shopService.getShopStats()
    expect(getSpy).toHaveBeenCalledWith('/shop/stats')
    expect(result).toEqual(mockStats)
  })

  it('getShopCapacity calls GET /shop/capacity and returns data', async () => {
    const mockCapacity = { available: 80, used: 20, unit: 'percent' }
    getSpy.mockResolvedValueOnce({ data: mockCapacity })
    const result = await shopService.getShopCapacity()
    expect(getSpy).toHaveBeenCalledWith('/shop/capacity')
    expect(result).toEqual(mockCapacity)
  })
})
