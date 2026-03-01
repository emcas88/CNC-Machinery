import api from './api'
import type { Job, CreateJobDto, UpdateJobDto, JobQueryParams } from '@/types/jobs'

export const jobsService = {
  async getJobs(params?: JobQueryParams): Promise<Job[]> {
    const res = await api.get('/jobs', { params })
    return res.data
  },

  async getJob(id: string): Promise<Job> {
    const res = await api.get(`/jobs/${id}`)
    return res.data
  },

  async createJob(data: CreateJobDto): Promise<Job> {
    const res = await api.post('/jobs', data)
    return res.data
  },

  async updateJob(id: string, data: UpdateJobDto): Promise<Job> {
    const res = await api.patch(`/jobs/${id}`, data)
    return res.data
  },

  async deleteJob(id: string): Promise<void> {
    await api.delete(`/jobs/${id}`)
  },

  async getJobDashboard(id: string): Promise<unknown> {
    const res = await api.get(`/jobs/${id}/dashboard`)
    return res.data
  },

  async duplicateJob(id: string, name?: string): Promise<Job> {
    const res = await api.post(`/jobs/${id}/duplicate`, { name })
    return res.data
  },
}
