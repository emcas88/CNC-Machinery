import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { jobsService } from '@/services/jobs'

const mockJobResponse = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Kitchen Renovation',
  clientName: 'John Smith',
  status: 'active',
  tags: [],
  roomCount: 0,
  productCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mockDashboard = {
  job: mockJobResponse,
  milestones: [],
  stats: { rooms: 0, products: 0, parts: 0, sheets: 0, estimatedValue: 0 },
}

describe('jobsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockJobResponse })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockJobResponse })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockJobResponse })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getJobs calls GET /jobs and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockJobResponse] })
    const result = await jobsService.getJobs()
    expect(getSpy).toHaveBeenCalledWith('/jobs', expect.objectContaining({ params: undefined }))
    expect(result).toEqual([mockJobResponse])
  })

  it('getJobs passes params', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockJobResponse] })
    await jobsService.getJobs({ status: 'active' })
    expect(getSpy).toHaveBeenCalledWith('/jobs', { params: { status: 'active' } })
  })

  it('getJob calls GET /jobs/:id and returns data', async () => {
    const result = await jobsService.getJob('job-1')
    expect(getSpy).toHaveBeenCalledWith('/jobs/job-1')
    expect(result).toEqual(mockJobResponse)
  })

  it('createJob calls POST /jobs with body and returns data', async () => {
    const payload = { name: 'New Job', clientName: 'Client' }
    const result = await jobsService.createJob(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/jobs', payload)
    expect(result).toEqual(mockJobResponse)
  })

  it('updateJob calls PATCH /jobs/:id with body and returns data', async () => {
    const changes = { name: 'Updated' }
    const result = await jobsService.updateJob('job-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/jobs/job-1', changes)
    expect(result).toEqual(mockJobResponse)
  })

  it('deleteJob calls DELETE /jobs/:id and returns data', async () => {
    await jobsService.deleteJob('job-1')
    expect(deleteSpy).toHaveBeenCalledWith('/jobs/job-1')
  })

  it('getJobDashboard calls GET /jobs/:id/dashboard and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: mockDashboard })
    const result = await jobsService.getJobDashboard('job-1')
    expect(getSpy).toHaveBeenCalledWith('/jobs/job-1/dashboard')
    expect(result).toEqual(mockDashboard)
  })

  it('duplicateJob calls POST /jobs/:id/duplicate with name and returns data', async () => {
    const result = await jobsService.duplicateJob('job-1', 'Copy')
    expect(postSpy).toHaveBeenCalledWith('/jobs/job-1/duplicate', { name: 'Copy' })
    expect(result).toEqual(mockJobResponse)
  })

  it('duplicateJob works without name argument', async () => {
    await jobsService.duplicateJob('job-1')
    expect(postSpy).toHaveBeenCalledWith('/jobs/job-1/duplicate', { name: undefined })
  })
})
