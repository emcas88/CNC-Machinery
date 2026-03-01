import api from './api'
import type { OptimizationRun, NestedSheet, OptimizationSettings } from '@/types'

export const optimizerService = {
  runOptimization: (jobId: string, settings: Partial<OptimizationSettings>) =>
    api.post<OptimizationRun>(`/jobs/${jobId}/optimize`, settings).then((r) => r.data),

  getRunStatus: (runId: string) =>
    api.get<OptimizationRun>(`/optimizer/runs/${runId}`).then((r) => r.data),

  getRuns: (jobId: string) =>
    api.get<OptimizationRun[]>(`/jobs/${jobId}/optimizer/runs`).then((r) => r.data),

  adjustNest: (runId: string, sheetId: string, adjustments: unknown) =>
    api.patch<NestedSheet>(`/optimizer/runs/${runId}/sheets/${sheetId}/adjust`, adjustments).then((r) => r.data),

  getSheets: (runId: string) =>
    api.get<NestedSheet[]>(`/optimizer/runs/${runId}/sheets`).then((r) => r.data),

  duplicateRun: (runId: string) =>
    api.post<OptimizationRun>(`/optimizer/runs/${runId}/duplicate`).then((r) => r.data),

  deleteRun: (runId: string) =>
    api.delete(`/optimizer/runs/${runId}`).then((r) => r.data),
}
