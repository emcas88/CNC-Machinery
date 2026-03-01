import api from './api'
import type { Tool, CreateTool } from '@/types'

export const toolsService = {
  getTools: (params?: { type?: string; search?: string }) =>
    api.get<Tool[]>('/tools', { params }).then((r) => r.data),

  getTool: (id: string) =>
    api.get<Tool>(`/tools/${id}`).then((r) => r.data),

  createTool: (data: CreateTool) =>
    api.post<Tool>('/tools', data).then((r) => r.data),

  updateTool: (id: string, data: Partial<CreateTool>) =>
    api.patch<Tool>(`/tools/${id}`, data).then((r) => r.data),

  deleteTool: (id: string) =>
    api.delete(`/tools/${id}`).then((r) => r.data),
}
