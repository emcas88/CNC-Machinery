import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { quotesService } from '@/services/quotes'

const mockQuote = {
  id: 'quote-1',
  jobId: 'job-1',
  status: 'draft',
  total: 5000.0,
  currency: 'USD',
  validUntil: '2026-03-01T00:00:00Z',
  lineItems: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('quotesService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockQuote })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockQuote })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockQuote })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getQuotes calls GET /jobs/:jobId/quotes and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockQuote] })
    const result = await quotesService.getQuotes('job-1')
    expect(getSpy).toHaveBeenCalledWith('/jobs/job-1/quotes', { params: undefined })
    expect(result).toEqual([mockQuote])
  })

  it('getQuote calls GET /quotes/:id and returns data', async () => {
    const result = await quotesService.getQuote('quote-1')
    expect(getSpy).toHaveBeenCalledWith('/quotes/quote-1')
    expect(result).toEqual(mockQuote)
  })

  it('createQuote calls POST /jobs/:jobId/quotes and returns data', async () => {
    const payload = { validUntil: '2026-06-01T00:00:00Z' }
    const result = await quotesService.createQuote('job-1', payload as any)
    expect(postSpy).toHaveBeenCalledWith('/jobs/job-1/quotes', payload)
    expect(result).toEqual(mockQuote)
  })

  it('updateQuote calls PATCH /quotes/:id and returns data', async () => {
    const changes = { status: 'sent' }
    const result = await quotesService.updateQuote('quote-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/quotes/quote-1', changes)
    expect(result).toEqual(mockQuote)
  })

  it('deleteQuote calls DELETE /quotes/:id', async () => {
    await quotesService.deleteQuote('quote-1')
    expect(deleteSpy).toHaveBeenCalledWith('/quotes/quote-1')
  })

  it('sendQuote calls POST /quotes/:id/send and returns data', async () => {
    postSpy.mockResolvedValueOnce({ data: { ...mockQuote, status: 'sent' } })
    const result = await quotesService.sendQuote('quote-1')
    expect(postSpy).toHaveBeenCalledWith('/quotes/quote-1/send', {})
    expect(result.status).toBe('sent')
  })
})
