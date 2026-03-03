import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { machinesService } from '@/services/machines'

const mockMachine = {
  id: 'machine-1',
  name: 'CNC Router 1',
  type: 'router',
  status: 'active',
  specs: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('machinesService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockMachine })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockMachine })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockMachine })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getMachines calls GET /machines and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockMachine] })
    const result = await machinesService.getMachines()
    expect(getSpy).toHaveBeenCalledWith('/machines')
    expect(result).toEqual([mockMachine])
  })

  it('getMachine calls GET /machines/:id and returns data', async () => {
    const result = await machinesService.getMachine('machine-1')
    expect(getSpy).toHaveBeenCalledWith('/machines/machine-1')
    expect(result).toEqual(mockMachine)
  })

  it('createMachine calls POST /machines with body and returns data', async () => {
    const payload = { name: 'New Machine', type: 'router' }
    const result = await machinesService.createMachine(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/machines', payload)
    expect(result).toEqual(mockMachine)
  })

  it('updateMachine calls PATCH /machines/:id with body and returns data', async () => {
    const changes = { name: 'Updated' }
    const result = await machinesService.updateMachine('machine-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/machines/machine-1', changes)
    expect(result).toEqual(mockMachine)
  })

  it('deleteMachine calls DELETE /machines/:id', async () => {
    await machinesService.deleteMachine('machine-1')
    expect(deleteSpy).toHaveBeenCalledWith('/machines/machine-1')
  })

  it('getToolSets calls GET /machines/:id/tool-sets and returns data', async () => {
    const mockToolSets = [{ id: 'ts-1', name: 'Default' }]
    getSpy.mockResolvedValueOnce({ data: mockToolSets })
    const result = await machinesService.getToolSets('machine-1')
    expect(getSpy).toHaveBeenCalledWith('/machines/machine-1/tool-sets')
    expect(result).toEqual(mockToolSets)
  })

  it('createToolSet calls POST /machines/:id/tool-sets and returns data', async () => {
    const mockToolSet = { id: 'ts-1', name: 'New Set' }
    postSpy.mockResolvedValueOnce({ data: mockToolSet })
    const result = await machinesService.createToolSet('machine-1', 'New Set')
    expect(postSpy).toHaveBeenCalledWith('/machines/machine-1/tool-sets', { name: 'New Set' })
    expect(result).toEqual(mockToolSet)
  })
})
