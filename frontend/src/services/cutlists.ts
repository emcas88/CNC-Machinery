import api from './api'

export interface CutlistRequest {
  jobId: string
  options?: {
    groupBy?: 'material' | 'room' | 'product'
    includeGrain?: boolean
    format?: 'pdf' | 'csv' | 'xlsx'
  }
}

export const cutlistsService = {
  async generateCutlist(data: CutlistRequest): Promise<Blob> {
    const res = await api.post('/cutlists/generate', data, { responseType: 'blob' })
    return res.data
  },

  async getCutlistPreview(jobId: string): Promise<unknown> {
    const res = await api.get(`/cutlists/preview/${jobId}`)
    return res.data
  },

  async getCutlists(jobId: string): Promise<unknown[]> {
    const res = await api.get('/cutlists', { params: { jobId } })
    return res.data
  },

  async deleteCutlist(id: string): Promise<void> {
    await api.delete(`/cutlists/${id}`)
  },
}
