import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { texturesService } from '@/services/textures'

const mockTexture = {
  id: 'tex-1',
  name: 'Oak Veneer',
  type: 'wood',
  imageUrl: 'https://example.com/oak.jpg',
  thumbnailUrl: 'https://example.com/oak-thumb.jpg',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('texturesService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockTexture })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockTexture })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockTexture })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getTextures calls GET /textures and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockTexture] })
    const result = await texturesService.getTextures()
    expect(getSpy).toHaveBeenCalledWith('/textures', { params: undefined })
    expect(result).toEqual([mockTexture])
  })

  it('getTextures passes params', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockTexture] })
    await texturesService.getTextures({ groupId: 'group-1' })
    expect(getSpy).toHaveBeenCalledWith('/textures', { params: { groupId: 'group-1' } })
  })

  it('getTexture calls GET /textures/:id and returns data', async () => {
    const result = await texturesService.getTexture('tex-1')
    expect(getSpy).toHaveBeenCalledWith('/textures/tex-1')
    expect(result).toEqual(mockTexture)
  })

  it('createTexture calls POST /textures with body and returns data', async () => {
    const payload = { name: 'Walnut', type: 'wood' }
    const result = await texturesService.createTexture(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/textures', payload)
    expect(result).toEqual(mockTexture)
  })

  it('updateTexture calls PATCH /textures/:id and returns data', async () => {
    const changes = { name: 'Dark Oak' }
    const result = await texturesService.updateTexture('tex-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/textures/tex-1', changes)
    expect(result).toEqual(mockTexture)
  })

  it('deleteTexture calls DELETE /textures/:id', async () => {
    await texturesService.deleteTexture('tex-1')
    expect(deleteSpy).toHaveBeenCalledWith('/textures/tex-1')
  })

  it('uploadTexture calls POST /textures/upload with FormData and returns data', async () => {
    const formData = new FormData()
    formData.append('file', new Blob(['data'], { type: 'image/jpeg' }), 'oak.jpg')
    formData.append('name', 'Oak Veneer')
    postSpy.mockResolvedValueOnce({ data: mockTexture })
    const result = await texturesService.uploadTexture(formData)
    expect(postSpy).toHaveBeenCalledWith('/textures/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    expect(result).toEqual(mockTexture)
  })
})
