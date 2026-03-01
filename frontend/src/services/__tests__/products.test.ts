import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { productsService } from '@/services/products'

const mockProduct = {
  id: 'prod-1',
  name: 'Kitchen Cabinet',
  jobId: 'job-1',
  roomId: 'room-1',
  type: 'base',
  width: 600,
  height: 720,
  depth: 560,
  partCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('productsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockProduct })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockProduct })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockProduct })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getProducts calls GET /jobs/:jobId/products and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockProduct] })
    const result = await productsService.getProducts('job-1')
    expect(getSpy).toHaveBeenCalledWith('/jobs/job-1/products', { params: undefined })
    expect(result).toEqual([mockProduct])
  })

  it('getProduct calls GET /products/:id and returns data', async () => {
    const result = await productsService.getProduct('prod-1')
    expect(getSpy).toHaveBeenCalledWith('/products/prod-1')
    expect(result).toEqual(mockProduct)
  })

  it('createProduct calls POST /jobs/:jobId/products and returns data', async () => {
    const payload = { name: 'Wall Unit', type: 'wall' }
    const result = await productsService.createProduct('job-1', payload as any)
    expect(postSpy).toHaveBeenCalledWith('/jobs/job-1/products', payload)
    expect(result).toEqual(mockProduct)
  })

  it('updateProduct calls PATCH /products/:id and returns data', async () => {
    const changes = { name: 'Updated Cabinet' }
    const result = await productsService.updateProduct('prod-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/products/prod-1', changes)
    expect(result).toEqual(mockProduct)
  })

  it('deleteProduct calls DELETE /products/:id', async () => {
    await productsService.deleteProduct('prod-1')
    expect(deleteSpy).toHaveBeenCalledWith('/products/prod-1')
  })

  it('duplicateProduct calls POST /products/:id/duplicate and returns data', async () => {
    const result = await productsService.duplicateProduct('prod-1')
    expect(postSpy).toHaveBeenCalledWith('/products/prod-1/duplicate', {})
    expect(result).toEqual(mockProduct)
  })
})
