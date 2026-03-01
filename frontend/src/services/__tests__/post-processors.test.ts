import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { postProcessorsService } from '@/services/post-processors'

const mockPostProcessor = {
  id: 'pp-1',
  name: 'Fanuc 30i',
  manufacturer: 'Fanuc',
  controllerType: 'Fanuc 30i',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('postProcessorsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockPostProcessor })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockPostProcessor })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockPostProcessor })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getPostProcessors calls GET /post-processors and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockPostProcessor] })
    const result = await postProcessorsService.getPostProcessors()
    expect(getSpy).toHaveBeenCalledWith('/post-processors', { params: undefined })
    expect(result).toEqual([mockPostProcessor])
  })

  it('getPostProcessor calls GET /post-processors/:id and returns data', async () => {
    const result = await postProcessorsService.getPostProcessor('pp-1')
    expect(getSpy).toHaveBeenCalledWith('/post-processors/pp-1')
    expect(result).toEqual(mockPostProcessor)
  })

  it('createPostProcessor calls POST /post-processors and returns data', async () => {
    const payload = { name: 'New PP', manufacturer: 'Heidenhain' }
    const result = await postProcessorsService.createPostProcessor(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/post-processors', payload)
    expect(result).toEqual(mockPostProcessor)
  })

  it('updatePostProcessor calls PATCH /post-processors/:id and returns data', async () => {
    const changes = { name: 'Updated' }
    const result = await postProcessorsService.updatePostProcessor('pp-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/post-processors/pp-1', changes)
    expect(result).toEqual(mockPostProcessor)
  })

  it('deletePostProcessor calls DELETE /post-processors/:id', async () => {
    await postProcessorsService.deletePostProcessor('pp-1')
    expect(deleteSpy).toHaveBeenCalledWith('/post-processors/pp-1')
  })
})
