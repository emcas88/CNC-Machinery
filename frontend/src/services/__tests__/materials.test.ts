import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { materialsService } from '@/services/materials'

const mockMaterial = {
  id: 'mat-1',
  name: 'Plywood 18mm',
  type: 'sheet',
  thickness: 18,
  width: 2440,
  height: 1220,
  cost: 45.0,
  unit: 'sheet',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('materialsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockMaterial })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockMaterial })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockMaterial })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getMaterials calls GET /materials and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockMaterial] })
    const result = await materialsService.getMaterials()
    expect(getSpy).toHaveBeenCalledWith('/materials', { params: undefined })
    expect(result).toEqual([mockMaterial])
  })

  it('getMaterials passes params', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockMaterial] })
    await materialsService.getMaterials({ type: 'sheet' })
    expect(getSpy).toHaveBeenCalledWith('/materials', { params: { type: 'sheet' } })
  })

  it('getMaterial calls GET /materials/:id and returns data', async () => {
    const result = await materialsService.getMaterial('mat-1')
    expect(getSpy).toHaveBeenCalledWith('/materials/mat-1')
    expect(result).toEqual(mockMaterial)
  })

  it('createMaterial calls POST /materials with body and returns data', async () => {
    const payload = { name: 'MDF 12mm', type: 'sheet', thickness: 12 }
    const result = await materialsService.createMaterial(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/materials', payload)
    expect(result).toEqual(mockMaterial)
  })

  it('updateMaterial calls PATCH /materials/:id with body and returns data', async () => {
    const changes = { cost: 50.0 }
    const result = await materialsService.updateMaterial('mat-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/materials/mat-1', changes)
    expect(result).toEqual(mockMaterial)
  })

  it('deleteMaterial calls DELETE /materials/:id', async () => {
    await materialsService.deleteMaterial('mat-1')
    expect(deleteSpy).toHaveBeenCalledWith('/materials/mat-1')
  })

  it('getMaterialStock calls GET /materials/:id/stock and returns data', async () => {
    const mockStock = { quantity: 10, unit: 'sheet', lastUpdated: '2026-01-01T00:00:00Z' }
    getSpy.mockResolvedValueOnce({ data: mockStock })
    const result = await materialsService.getMaterialStock('mat-1')
    expect(getSpy).toHaveBeenCalledWith('/materials/mat-1/stock')
    expect(result).toEqual(mockStock)
  })
})
