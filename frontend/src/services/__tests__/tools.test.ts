import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { toolsService } from '@/services/tools'

const mockTool = {
  id: 'tool-1',
  name: '6mm End Mill',
  type: 'end_mill',
  diameter: 6,
  flutes: 2,
  material: 'carbide',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('toolsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockTool })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockTool })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockTool })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getTools calls GET /tools and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockTool] })
    const result = await toolsService.getTools()
    expect(getSpy).toHaveBeenCalledWith('/tools', { params: undefined })
    expect(result).toEqual([mockTool])
  })

  it('getTool calls GET /tools/:id and returns data', async () => {
    const result = await toolsService.getTool('tool-1')
    expect(getSpy).toHaveBeenCalledWith('/tools/tool-1')
    expect(result).toEqual(mockTool)
  })

  it('createTool calls POST /tools and returns data', async () => {
    const payload = { name: '8mm End Mill', type: 'end_mill', diameter: 8 }
    const result = await toolsService.createTool(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/tools', payload)
    expect(result).toEqual(mockTool)
  })

  it('updateTool calls PATCH /tools/:id and returns data', async () => {
    const changes = { name: 'Updated Tool' }
    const result = await toolsService.updateTool('tool-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/tools/tool-1', changes)
    expect(result).toEqual(mockTool)
  })

  it('deleteTool calls DELETE /tools/:id', async () => {
    await toolsService.deleteTool('tool-1')
    expect(deleteSpy).toHaveBeenCalledWith('/tools/tool-1')
  })
})
