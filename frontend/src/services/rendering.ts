import api from './api'

export interface RenderJob {
  id: string
  jobId: string
  viewId?: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  resultUrl?: string
  settings: RenderSettings
  createdAt: string
  completedAt?: string
}

export interface RenderSettings {
  resolution: '1920x1080' | '2560x1440' | '3840x2160'
  quality: 'draft' | 'standard' | 'high'
  samples: number
  ambientOcclusion: boolean
  shadows: boolean
  reflections: boolean
}

export const renderingService = {
  submitRender: (jobId: string, viewId: string, settings: Partial<RenderSettings>) =>
    api.post<RenderJob>('/renders', { jobId, viewId, settings }).then((r) => r.data),

  getStatus: (renderId: string) =>
    api.get<RenderJob>(`/renders/${renderId}`).then((r) => r.data),

  getRenders: (jobId: string) =>
    api.get<RenderJob[]>(`/jobs/${jobId}/renders`).then((r) => r.data),

  batchRender: (jobId: string, viewIds: string[], settings: Partial<RenderSettings>) =>
    api.post<RenderJob[]>('/renders/batch', { jobId, viewIds, settings }).then((r) => r.data),

  getResult: (renderId: string) =>
    api.get<{ imageUrl: string; downloadUrl: string }>(`/renders/${renderId}/result`).then((r) => r.data),

  cancelRender: (renderId: string) =>
    api.post(`/renders/${renderId}/cancel`).then((r) => r.data),
}
