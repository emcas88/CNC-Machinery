import api from './api'

export const gcodeService = {
  async generateGcode(optimizationId: string, postProcessorId: string, options?: Record<string, unknown>): Promise<Blob> {
    const res = await api.post('/gcode/generate', { optimizationId, postProcessorId, options }, { responseType: 'blob' })
    return res.data
  },

  async getGcodePreview(optimizationId: string): Promise<unknown> {
    const res = await api.get(`/gcode/preview/${optimizationId}`)
    return res.data
  },

  async getGcodeHistory(jobId: string): Promise<unknown[]> {
    const res = await api.get('/gcode/history', { params: { jobId } })
    return res.data
  },

  async validateGcode(content: string): Promise<unknown> {
    const res = await api.post('/gcode/validate', { content })
    return res.data
  },
}
