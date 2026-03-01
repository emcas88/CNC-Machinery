import api from './api'
import type { PostProcessor, CreatePostProcessor } from '@/types'

export const postProcessorService = {
  getProcessors: () =>
    api.get<PostProcessor[]>('/post-processors').then((r) => r.data),

  getProcessor: (id: string) =>
    api.get<PostProcessor>(`/post-processors/${id}`).then((r) => r.data),

  createProcessor: (data: CreatePostProcessor) =>
    api.post<PostProcessor>('/post-processors', data).then((r) => r.data),

  updateProcessor: (id: string, data: Partial<CreatePostProcessor>) =>
    api.patch<PostProcessor>(`/post-processors/${id}`, data).then((r) => r.data),

  deleteProcessor: (id: string) =>
    api.delete(`/post-processors/${id}`).then((r) => r.data),

  testProcessor: (id: string, partId: string) =>
    api.post<{ output: string }>(`/post-processors/${id}/test`, { partId }).then((r) => r.data),
}
