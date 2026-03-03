import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { renderingService } from '@/services/rendering'

const mockRenderJob = {
  id: 'render-1',
  jobId: 'job-1',
  status: 'completed',
  progress: 100,
  settings: {},
  createdAt: '2026-01-01T00:00:00Z',
}

describe('renderingService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockRenderJob })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockRenderJob })
  })

  afterEach(() => vi.restoreAllMocks())

  it('submitRender calls POST /renders with jobId, viewId, settings and returns data', async () => {
    const settings = { resolution: '1920x1080' as const }
    const result = await renderingService.submitRender('job-1', 'view-1', settings)
    expect(postSpy).toHaveBeenCalledWith('/renders', { jobId: 'job-1', viewId: 'view-1', settings })
    expect(result).toEqual(mockRenderJob)
  })

  it('getStatus calls GET /renders/:renderId and returns data', async () => {
    const result = await renderingService.getStatus('render-1')
    expect(getSpy).toHaveBeenCalledWith('/renders/render-1')
    expect(result).toEqual(mockRenderJob)
  })

  it('getRenders calls GET /jobs/:jobId/renders and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockRenderJob] })
    const result = await renderingService.getRenders('job-1')
    expect(getSpy).toHaveBeenCalledWith('/jobs/job-1/renders')
    expect(result).toEqual([mockRenderJob])
  })

  it('getResult calls GET /renders/:renderId/result and returns data', async () => {
    const mockResult = { imageUrl: 'https://example.com/render.png', downloadUrl: 'https://example.com/download' }
    getSpy.mockResolvedValueOnce({ data: mockResult })
    const result = await renderingService.getResult('render-1')
    expect(getSpy).toHaveBeenCalledWith('/renders/render-1/result')
    expect(result).toEqual(mockResult)
  })

  it('cancelRender calls POST /renders/:renderId/cancel', async () => {
    await renderingService.cancelRender('render-1')
    expect(postSpy).toHaveBeenCalledWith('/renders/render-1/cancel')
  })
})
