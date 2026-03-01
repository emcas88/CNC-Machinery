import api from './api'
import type { DrawingTemplate, CreateDrawingTemplateDto, UpdateDrawingTemplateDto } from '@/types/drawings'

export const drawingsService = {
  async getTemplates(params?: Record<string, unknown>): Promise<DrawingTemplate[]> {
    const res = await api.get('/drawings/templates', { params })
    return res.data
  },

  async getTemplate(id: string): Promise<DrawingTemplate> {
    const res = await api.get(`/drawings/templates/${id}`)
    return res.data
  },

  async createTemplate(data: CreateDrawingTemplateDto): Promise<DrawingTemplate> {
    const res = await api.post('/drawings/templates', data)
    return res.data
  },

  async updateTemplate(id: string, data: UpdateDrawingTemplateDto): Promise<DrawingTemplate> {
    const res = await api.patch(`/drawings/templates/${id}`, data)
    return res.data
  },

  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/drawings/templates/${id}`)
  },

  async generateDrawing(productId: string, templateId: string): Promise<Blob> {
    const res = await api.post('/drawings/generate', { productId, templateId }, { responseType: 'blob' })
    return res.data
  },

  async getProductDrawings(productId: string): Promise<unknown[]> {
    const res = await api.get('/drawings', { params: { productId } })
    return res.data
  },
}
