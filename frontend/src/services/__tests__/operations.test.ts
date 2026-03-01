import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { operationsService } from '@/services/operations'

const mockOperation = {
  id: 'op-1',
  name: 'Pocket Cut',
  type: 'pocket',
  parameters: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('operationsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockOperation })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockOperation })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockOperation })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getOperations calls GET /operations and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockOperation] })
    const result = await operationsService.getOperations()
    expect(getSpy).toHaveBeenCalledWith('/operations', { params: undefined })
    expect(result).toEqual([mockOperation])
  })

  it('getOperation calls GET /operations/:id and returns data', async () => {
    const result = await operationsService.getOperation('op-1')
    expect(getSpy).toHaveBeenCalledWith('/operations/op-1')
    expect(result).toEqual(mockOperation)
  })

  it('createOperation calls POST /operations with body and returns data', async () => {
    const payload = { name: 'New Op', type: 'profile' }
    const result = await operationsService.createOperation(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/operations', payload)
    expect(result).toEqual(mockOperation)
  })

  it('updateOperation calls PATCH /operations/:id and returns data', async () => {
    const changes = { name: 'Updated' }
    const result = await operationsService.updateOperation('op-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/operations/op-1', changes)
    expect(result).toEqual(mockOperation)
  })

  it('deleteOperation calls DELETE /operations/:id', async () => {
    await operationsService.deleteOperation('op-1')
    expect(deleteSpy).toHaveBeenCalledWith('/operations/op-1')
  })
})
