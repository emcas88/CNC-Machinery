import api from './api'
import type { Part, CreatePart } from '@/types'

export const partsService = {
  getParts: (productId: string) =>
    api.get<Part[]>(`/products/${productId}/parts`).then((r) => r.data),

  getPart: (id: string) =>
    api.get<Part>(`/parts/${id}`).then((r) => r.data),

  createPart: (data: CreatePart) =>
    api.post<Part>('/parts', data).then((r) => r.data),

  updatePart: (id: string, data: Partial<CreatePart>) =>
    api.patch<Part>(`/parts/${id}`, data).then((r) => r.data),

  deletePart: (id: string) =>
    api.delete(`/parts/${id}`).then((r) => r.data),

  duplicatePart: (id: string) =>
    api.post<Part>(`/parts/${id}/duplicate`).then((r) => r.data),
}
