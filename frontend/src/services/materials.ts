import api from './api'
import type { Material, CreateMaterial, MaterialTemplate } from '@/types'

export const materialsService = {
  getMaterials: (params?: { category?: string; search?: string }) =>
    api.get<Material[]>('/materials', { params }).then((r) => r.data),

  getMaterial: (id: string) =>
    api.get<Material>(`/materials/${id}`).then((r) => r.data),

  createMaterial: (data: CreateMaterial) =>
    api.post<Material>('/materials', data).then((r) => r.data),

  updateMaterial: (id: string, data: Partial<CreateMaterial>) =>
    api.patch<Material>(`/materials/${id}`, data).then((r) => r.data),

  deleteMaterial: (id: string) =>
    api.delete(`/materials/${id}`).then((r) => r.data),

  getTemplates: () =>
    api.get<MaterialTemplate[]>('/materials/templates').then((r) => r.data),

  createFromTemplate: (templateId: string, overrides?: Partial<CreateMaterial>) =>
    api.post<Material>(`/materials/from-template/${templateId}`, overrides).then((r) => r.data),
}
