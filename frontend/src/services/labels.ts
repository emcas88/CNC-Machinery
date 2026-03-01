import api from './api'
import type { LabelTemplate, CreateLabelTemplateDto, UpdateLabelTemplateDto, PrintLabelsDto } from '@/types/labels'

export const labelsService = {
  async getTemplates(params?: Record<string, unknown>): Promise<LabelTemplate[]> {
    const res = await api.get('/labels/templates', { params })
    return res.data
  },

  async getTemplate(id: string): Promise<LabelTemplate> {
    const res = await api.get(`/labels/templates/${id}`)
    return res.data
  },

  async createTemplate(data: CreateLabelTemplateDto): Promise<LabelTemplate> {
    const res = await api.post('/labels/templates', data)
    return res.data
  },

  async updateTemplate(id: string, data: UpdateLabelTemplateDto): Promise<LabelTemplate> {
    const res = await api.patch(`/labels/templates/${id}`, data)
    return res.data
  },

  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/labels/templates/${id}`)
  },

  async printLabels(data: PrintLabelsDto): Promise<Blob> {
    const res = await api.post('/labels/print', data, { responseType: 'blob' })
    return res.data
  },
}
