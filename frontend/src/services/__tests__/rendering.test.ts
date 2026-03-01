import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { renderingService } from '@/services/rendering'

const mockRenderRequest = {
  productId: 'prod-1',
  viewType: 'perspective',
  resolution: { width: 1920, height: 1080 },
}

const mockRenderResult = {
  id: 'render-1',
  productId: 'prod-1',
  status: 'completed',
  imageUrl: 'https://example.com/render.png',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('renderingService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockRenderResult })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockRenderResult })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('render calls POST /rendering/render and returns data', async () => {
    const result = await renderingService.render(mockRenderRequest)
    expect(postSpy).toHaveBeenCalledWith('/rendering/render', mockRenderRequest)
    expect(result).toEqual(mockRenderResult)
  })

  it('getRenderResult calls GET /rendering/:id and returns data', async () => {
    const result = await renderingService.getRenderResult('render-1')
    expect(getSpy).toHaveBeenCalledWith('/rendering/render-1')
    expect(result).toEqual(mockRenderResult)
  })

  it('getProductRenders calls GET /rendering and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockRenderResult] })
    const result = await renderingService.getProductRenders('prod-1')
    expect(getSpy).toHaveBeenCalledWith('/rendering', { params: { productId: 'prod-1' } })
    expect(result).toEqual([mockRenderResult])
  })

  it('deleteRender calls DELETE /rendering/:id', async () => {
    await renderingService.deleteRender('render-1')
    expect(deleteSpy).toHaveBeenCalledWith('/rendering/render-1')
  })

  it('getRenderSettings calls GET /rendering/settings and returns data', async () => {
    const mockSettings = { defaultResolution: { width: 1920, height: 1080 } }
    getSpy.mockResolvedValueOnce({ data: mockSettings })
    const result = await renderingService.getRenderSettings()
    expect(getSpy).toHaveBeenCalledWith('/rendering/settings')
    expect(result).toEqual(mockSettings)
  })
})
