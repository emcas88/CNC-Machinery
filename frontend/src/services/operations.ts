import api from './api'
import type { Operation } from '@/types'

export const operationsService = {
  getOperations: (partId: string) =>
    api.get<Operation[]>(`/parts/${partId}/operations`).then((r) => r.data),

  getOperation: (id: string) =>
    api.get<Operation>(`/operations/${id}`).then((r) => r.data),

  createOperation: (data: Partial<Operation>) =>
    api.post<Operation>('/operations', data).then((r) => r.data),

  updateOperation: (id: string, data: Partial<Operation>) =>
    api.patch<Operation>(`/operations/${id}`, data).then((r) => r.data),

  deleteOperation: (id: string) =>
    api.delete(`/operations/${id}`).then((r) => r.data),
}
