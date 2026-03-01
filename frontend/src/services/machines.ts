import api from './api'
import type { Machine, AtcToolSet, CreateMachine } from '@/types'

export const machinesService = {
  getMachines: () =>
    api.get<Machine[]>('/machines').then((r) => r.data),

  getMachine: (id: string) =>
    api.get<Machine>(`/machines/${id}`).then((r) => r.data),

  createMachine: (data: CreateMachine) =>
    api.post<Machine>('/machines', data).then((r) => r.data),

  updateMachine: (id: string, data: Partial<CreateMachine>) =>
    api.patch<Machine>(`/machines/${id}`, data).then((r) => r.data),

  deleteMachine: (id: string) =>
    api.delete(`/machines/${id}`).then((r) => r.data),

  getToolSets: (machineId: string) =>
    api.get<AtcToolSet[]>(`/machines/${machineId}/tool-sets`).then((r) => r.data),

  createToolSet: (machineId: string, name: string) =>
    api.post<AtcToolSet>(`/machines/${machineId}/tool-sets`, { name }).then((r) => r.data),

  updateToolSet: (machineId: string, setId: string, data: Partial<AtcToolSet>) =>
    api.patch<AtcToolSet>(`/machines/${machineId}/tool-sets/${setId}`, data).then((r) => r.data),

  deleteToolSet: (machineId: string, setId: string) =>
    api.delete(`/machines/${machineId}/tool-sets/${setId}`).then((r) => r.data),
}
