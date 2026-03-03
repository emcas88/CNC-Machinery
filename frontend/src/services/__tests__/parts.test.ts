import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { partsService } from '@/services/parts'

const mockPart = {
  id: 'part-1',
  name: 'Door Panel',
  width: 600,
  height: 800,
  thickness: 18,
  quantity: 2,
  material: 'Plywood 18mm',
  operations: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('partsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockPart })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockPart })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockPart })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getParts calls GET /products/:productId/parts and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockPart] })
    const result = await partsService.getParts('product-1')
    expect(getSpy).toHaveBeenCalledWith('/products/product-1/parts')
    expect(result).toEqual([mockPart])
  })

  it('getPart calls GET /parts/:id and returns data', async () => {
    const result = await partsService.getPart('part-1')
    expect(getSpy).toHaveBeenCalledWith('/parts/part-1')
    expect(result).toEqual(mockPart)
  })

  it('createPart calls POST /parts with body and returns data', async () => {
    const payload = { productId: 'product-1', name: 'New Part', width: 400, height: 600 }
    const result = await partsService.createPart(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/parts', payload)
    expect(result).toEqual(mockPart)
  })

  it('updatePart calls PATCH /parts/:id and returns data', async () => {
    const changes = { quantity: 3 }
    const result = await partsService.updatePart('part-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/parts/part-1', changes)
    expect(result).toEqual(mockPart)
  })

  it('deletePart calls DELETE /parts/:id', async () => {
    await partsService.deletePart('part-1')
    expect(deleteSpy).toHaveBeenCalledWith('/parts/part-1')
  })
})
