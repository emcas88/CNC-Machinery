import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { shopService } from '@/services/shop'

const mockCutlist = {
  jobId: 'job-1',
  parts: [],
  sheets: [],
}

describe('shopService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockCutlist })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getCutlist calls GET /shop/cutlist with jobId and optional runId and returns data', async () => {
    const result = await shopService.getCutlist('job-1')
    expect(getSpy).toHaveBeenCalledWith('/shop/cutlist', { params: { jobId: 'job-1', runId: undefined } })
    expect(result).toEqual(mockCutlist)
  })

  it('getCutlist passes runId when provided', async () => {
    await shopService.getCutlist('job-1', 'run-1')
    expect(getSpy).toHaveBeenCalledWith('/shop/cutlist', { params: { jobId: 'job-1', runId: 'run-1' } })
  })

  it('getAssembly calls GET /shop/assembly/:jobId and returns data', async () => {
    const mockAssembly = { steps: [] }
    getSpy.mockResolvedValueOnce({ data: mockAssembly })
    const result = await shopService.getAssembly('job-1')
    expect(getSpy).toHaveBeenCalledWith('/shop/assembly/job-1')
    expect(result).toEqual(mockAssembly)
  })

  it('printLabel calls POST /shop/print-label with partId', async () => {
    await shopService.printLabel('part-1')
    expect(postSpy).toHaveBeenCalledWith('/shop/print-label', { partId: 'part-1' })
  })

  it('getProgress calls GET /shop/progress/:jobId and returns data', async () => {
    const mockProgress = { total: 10, cut: 5, assembled: 2, percent: 50 }
    getSpy.mockResolvedValueOnce({ data: mockProgress })
    const result = await shopService.getProgress('job-1')
    expect(getSpy).toHaveBeenCalledWith('/shop/progress/job-1')
    expect(result).toEqual(mockProgress)
  })
})
