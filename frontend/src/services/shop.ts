import api from './api'

export const shopService = {
  getCutlist: (jobId: string, runId?: string) =>
    api.get(`/shop/cutlist`, { params: { jobId, runId } }).then((r) => r.data),

  getAssembly: (jobId: string) =>
    api.get(`/shop/assembly/${jobId}`).then((r) => r.data),

  printLabel: (partId: string) =>
    api.post('/shop/print-label', { partId }).then((r) => r.data),

  remakeBin: (jobId: string) =>
    api.get(`/shop/remake-bin/${jobId}`).then((r) => r.data),

  addToRemakeBin: (partId: string, reason: string, quantity?: number) =>
    api.post('/shop/remake-bin', { partId, reason, quantity }).then((r) => r.data),

  markPartComplete: (partId: string) =>
    api.post(`/shop/parts/${partId}/complete`).then((r) => r.data),

  getProgress: (jobId: string) =>
    api.get<{ total: number; cut: number; assembled: number; percent: number }>(
      `/shop/progress/${jobId}`
    ).then((r) => r.data),
}
