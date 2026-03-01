import api from './api'

export const exportsService = {
  async exportJob(jobId: string, format: string, options?: Record<string, unknown>): Promise<Blob> {
    const res = await api.post('/exports/job', { jobId, format, options }, { responseType: 'blob' })
    return res.data
  },

  async exportCutlist(jobId: string, format: string): Promise<Blob> {
    const res = await api.post('/exports/cutlist', { jobId, format }, { responseType: 'blob' })
    return res.data
  },

  async exportGcode(optimizationId: string): Promise<Blob> {
    const res = await api.post('/exports/gcode', { optimizationId }, { responseType: 'blob' })
    return res.data
  },

  async getExportFormats(): Promise<unknown[]> {
    const res = await api.get('/exports/formats')
    return res.data
  },
}
