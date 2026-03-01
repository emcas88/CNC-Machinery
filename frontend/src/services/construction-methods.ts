import api from './api'
import type { ConstructionMethod, CreateConstructionMethodDto, UpdateConstructionMethodDto } from '@/types/construction-methods'

export const constructionMethodsService = {
  async getConstructionMethods(params?: Record<string, unknown>) {
    const res = await api.get('/construction-methods', { params })
    return res.data
  },

  async getConstructionMethod(id: string): Promise<ConstructionMethod> {
    const res = await api.get(`/construction-methods/${id}`)
    return res.data
  },

  async createConstructionMethod(data: CreateConstructionMethodDto): Promise<ConstructionMethod> {
    const res = await api.post('/construction-methods', data)
    return res.data
  },

  async updateConstructionMethod(id: string, data: UpdateConstructionMethodDto): Promise<ConstructionMethod> {
    const res = await api.patch(`/construction-methods/${id}`, data)
    return res.data
  },

  async deleteConstructionMethod(id: string): Promise<void> {
    await api.delete(`/construction-methods/${id}`)
  },
}
