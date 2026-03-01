import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { optimizerService } from '@/services/optimizer'

const mockOptimizationRequest = {
  jobId: 'job-1',
  algorithm: 'guillotine',
  settings: { kerf: 3.2, grain: true },
}

const mockOptimizationResult = {
  id: 'opt-1',
  jobId: 'job-1',
  status: 'completed',
  efficiency: 0.87,
  sheets: [],
  createdAt: '2026-01-01T00:00:00Z',
}

describe('optimizerService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockOptimizationResult })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockOptimizationResult })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('optimize calls POST /optimizer/optimize and returns data', async () => {
    const result = await optimizerService.optimize(mockOptimizationRequest)
    expect(postSpy).toHaveBeenCalledWith('/optimizer/optimize', mockOptimizationRequest)
    expect(result).toEqual(mockOptimizationResult)
  })

  it('getOptimizationResult calls GET /optimizer/:id and returns data', async () => {
    const result = await optimizerService.getOptimizationResult('opt-1')
    expect(getSpy).toHaveBeenCalledWith('/optimizer/opt-1')
    expect(result).toEqual(mockOptimizationResult)
  })

  it('getJobOptimizations calls GET /optimizer and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockOptimizationResult] })
    const result = await optimizerService.getJobOptimizations('job-1')
    expect(getSpy).toHaveBeenCalledWith('/optimizer', { params: { jobId: 'job-1' } })
    expect(result).toEqual([mockOptimizationResult])
  })

  it('deleteOptimization calls DELETE /optimizer/:id', async () => {
    await optimizerService.deleteOptimization('opt-1')
    expect(deleteSpy).toHaveBeenCalledWith('/optimizer/opt-1')
  })

  it('reoptimize calls POST /optimizer/:id/reoptimize and returns data', async () => {
    const overrides = { settings: { kerf: 3.5 } }
    const result = await optimizerService.reoptimize('opt-1', overrides)
    expect(postSpy).toHaveBeenCalledWith('/optimizer/opt-1/reoptimize', overrides)
    expect(result).toEqual(mockOptimizationResult)
  })

  it('getAlgorithms calls GET /optimizer/algorithms and returns data', async () => {
    const mockAlgorithms = [{ id: 'guillotine', name: 'Guillotine' }]
    getSpy.mockResolvedValueOnce({ data: mockAlgorithms })
    const result = await optimizerService.getAlgorithms()
    expect(getSpy).toHaveBeenCalledWith('/optimizer/algorithms')
    expect(result).toEqual(mockAlgorithms)
  })
})
