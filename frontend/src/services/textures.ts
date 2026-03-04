import api from './api'
import type { Texture, TextureGroup, CreateTexture } from '@/types'

export const texturesService = {
  getTextures: (params?: { groupId?: string; search?: string }) =>
    api.get<Texture[]>('/textures', { params }).then((r) => r.data).catch(() => [] as Texture[]),

  getTexture: (id: string) =>
    api.get<Texture>(`/textures/${id}`).then((r) => r.data),

  createTexture: (data: CreateTexture) =>
    api.post<Texture>('/textures', data).then((r) => r.data),

  updateTexture: (id: string, data: Partial<CreateTexture>) =>
    api.patch<Texture>(`/textures/${id}`, data).then((r) => r.data),

  deleteTexture: (id: string) =>
    api.delete(`/textures/${id}`).then((r) => r.data),

  getGroups: () =>
    api.get<TextureGroup[]>('/textures/groups').then((r) => r.data).catch(() => [] as TextureGroup[]),

  createGroup: (name: string, description?: string) =>
    api.post<TextureGroup>('/textures/groups', { name, description }).then((r) => r.data),

  uploadTexture: (formData: FormData) =>
    api.post<Texture>('/textures/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
}
