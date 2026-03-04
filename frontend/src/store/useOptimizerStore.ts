import { create } from 'zustand'
import type { OptimizationRun, NestedSheet, OptimizationSettings } from '@/types'

interface OptimizerState {
  runs: OptimizationRun[]
  currentRunId: string | null
  sheets: Record<string, NestedSheet[]>
  currentSheet: string | null
  isRunning: boolean
  progress: number
  settings: OptimizationSettings

  setRuns: (runs: OptimizationRun[]) => void
  addRun: (run: OptimizationRun) => void
  updateRun: (id: string, data: Partial<OptimizationRun>) => void
  setSheets: (runId: string, sheets: NestedSheet[]) => void
  setCurrentSheet: (sheetId: string | null) => void
  setRunning: (running: boolean) => void
  setProgress: (progress: number) => void
  updateSettings: (settings: Partial<OptimizationSettings>) => void
}

export const useOptimizerStore = create<OptimizerState>()((set) => ({
  runs: [],
  currentRunId: null,
  sheets: {},
  currentSheet: null,
  isRunning: false,
  progress: 0,
  settings: {
    algorithm: 'guillotine',
    kerf: 3.2,
    grainDirection: 'horizontal',
    allowRotation: true,
    prioritizeWaste: false,
    sheetPriority: 'first-fit',
  },

  setRuns: (runs) => set({ runs }),

  addRun: (run) =>
    set((s) => ({ runs: [...s.runs, run], currentRunId: run.id })),

  updateRun: (id, data) =>
    set((s) => ({
      runs: s.runs.map((r) => (r.id === id ? { ...r, ...data } : r)),
    })),

  setSheets: (runId, sheets) =>
    set((s) => ({ sheets: { ...s.sheets, [runId]: sheets } })),

  setCurrentSheet: (sheetId) => set({ currentSheet: sheetId }),

  setRunning: (running) => set({ isRunning: running }),

  setProgress: (progress) => set({ progress }),

  updateSettings: (settings) =>
    set((s) => ({ settings: { ...s.settings, ...settings } })),
}))
