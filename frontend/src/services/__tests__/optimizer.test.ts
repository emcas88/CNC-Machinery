import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { optimizerService } from '@/services/optimizer'

const mockOptimizationRun = {
  id: 'run-1',
  jobId: 'job-1',
  status: 'completed',
  efficiency: 0.87,
  sheets: [],
  createdAt: '2026-01-01T00:00:00Z',
}

describe('optimizerService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockOptimizationRun })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockOptimizationRun })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockOptimizationRun })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('runOptimization calls POST /jobs/:jobId/optimize and returns data', async () => {
    const settings = { kerf: 3.2, grain: true }
    const result = await optimizerService.runOptimization('job-1', settings)
    expect(postSpy).toHaveBeenCalledWith('/jobs/job-1/optimize', settings)
    expect(result).toEqual(mockOptimizationRun)
  })

  it('getRunStatus calls GET /optimizer/runs/:runId and returns data', async () => {
    const result = await optimizerService.getRunStatus('run-1')
    expect(getSpy).toHaveBeenCalledWith('/optimizer/runs/run-1')
    expect(result).toEqual(mockOptimizationRun)
  })

  it('getRuns calls GET /jobs/:jobId/optimizer/runs and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockOptimizationRun] })
    const result = await optimizerService.getRuns('job-1')
    expect(getSpy).toHaveBeenCalledWith('/jobs/job-1/optimizer/runs')
    expect(result).toEqual([mockOptimizationRun])
  })

  it('deleteRun calls DELETE /optimizer/runs/:runId', async () => {
    await optimizerService.deleteRun('run-1')
    expect(deleteSpy).toHaveBeenCalledWith('/optimizer/runs/run-1')
  })

  it('getSheets calls GET /optimizer/runs/:runId/sheets and returns data', async () => {
    const mockSheets = [{ id: 'sheet-1', parts: [] }]
    getSpy.mockResolvedValueOnce({ data: mockSheets })
    const result = await optimizerService.getSheets('run-1')
    expect(getSpy).toHaveBeenCalledWith('/optimizer/runs/run-1/sheets')
    expect(result).toEqual(mockSheets)
  })

  it('duplicateRun calls POST /optimizer/runs/:runId/duplicate and returns data', async () => {
    const result = await optimizerService.duplicateRun('run-1')
    expect(postSpy).toHaveBeenCalledWith('/optimizer/runs/run-1/duplicate')
    expect(result).toEqual(mockOptimizationRun)
  })
})
