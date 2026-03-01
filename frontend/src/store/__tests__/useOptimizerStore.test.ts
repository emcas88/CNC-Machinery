import { describe, it, expect, beforeEach } from 'vitest'
import { useOptimizerStore } from '@/store/useOptimizerStore'
import type { OptimizationRun, NestedSheet, OptimizationSettings } from '@/types'
import { OptimizationStatus } from '@/types'

const mockSettings: OptimizationSettings = {
  algorithm: 'guillotine',
  kerf: 3.2,
  grainDirection: 'horizontal',
  allowRotation: true,
  prioritizeWaste: false,
  sheetPriority: 'first-fit',
}

const mockRun: OptimizationRun = {
  id: 'run-1',
  jobId: 'job-1',
  status: OptimizationStatus.COMPLETED,
  efficiency: 87.5,
  totalSheets: 3,
  wastePercent: 12.5,
  settings: mockSettings,
  createdAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-01T00:01:00Z',
}

const mockSheet: NestedSheet = {
  id: 'sheet-1',
  runId: 'run-1',
  sheetIndex: 0,
  materialId: 'mat-1',
  width: 2440,
  height: 1220,
  utilization: 88.2,
  parts: [],
}

describe('useOptimizerStore', () => {
  beforeEach(() => {
    useOptimizerStore.setState({
      runs: [],
      currentRunId: null,
      sheets: {},
      isRunning: false,
      progress: 0,
      settings: mockSettings,
    })
  })

  describe('initial state', () => {
    it('has empty runs array', () => {
      expect(useOptimizerStore.getState().runs).toEqual([])
    })

    it('has null currentRunId', () => {
      expect(useOptimizerStore.getState().currentRunId).toBeNull()
    })

    it('has empty sheets map', () => {
      expect(useOptimizerStore.getState().sheets).toEqual({})
    })

    it('has isRunning as false', () => {
      expect(useOptimizerStore.getState().isRunning).toBe(false)
    })

    it('has progress as 0', () => {
      expect(useOptimizerStore.getState().progress).toBe(0)
    })
  })

  describe('setRuns', () => {
    it('replaces the runs array', () => {
      useOptimizerStore.getState().setRuns([mockRun])
      expect(useOptimizerStore.getState().runs).toEqual([mockRun])
    })

    it('replaces with empty array', () => {
      useOptimizerStore.getState().setRuns([mockRun])
      useOptimizerStore.getState().setRuns([])
      expect(useOptimizerStore.getState().runs).toEqual([])
    })
  })

  describe('addRun', () => {
    it('appends a run', () => {
      useOptimizerStore.getState().addRun(mockRun)
      expect(useOptimizerStore.getState().runs).toHaveLength(1)
    })

    it('sets currentRunId', () => {
      useOptimizerStore.getState().addRun(mockRun)
      expect(useOptimizerStore.getState().currentRunId).toBe('run-1')
    })
  })

  describe('updateRun', () => {
    it('merges partial changes into existing run', () => {
      useOptimizerStore.getState().addRun(mockRun)
      useOptimizerStore.getState().updateRun('run-1', { efficiency: 90 })
      const run = useOptimizerStore.getState().runs.find((r) => r.id === 'run-1')
      expect(run?.efficiency).toBe(90)
    })

    it('preserves unchanged fields', () => {
      useOptimizerStore.getState().addRun(mockRun)
      useOptimizerStore.getState().updateRun('run-1', { efficiency: 90 })
      const run = useOptimizerStore.getState().runs.find((r) => r.id === 'run-1')
      expect(run?.totalSheets).toBe(3)
    })
  })

  describe('setSheets', () => {
    it('stores sheets keyed by runId', () => {
      useOptimizerStore.getState().setSheets('run-1', [mockSheet])
      expect(useOptimizerStore.getState().sheets['run-1']).toEqual([mockSheet])
    })

    it('stores sheets for multiple runs independently', () => {
      const sheet2 = { ...mockSheet, id: 'sheet-2', runId: 'run-2' }
      useOptimizerStore.getState().setSheets('run-1', [mockSheet])
      useOptimizerStore.getState().setSheets('run-2', [sheet2])
      expect(useOptimizerStore.getState().sheets['run-1']).toHaveLength(1)
      expect(useOptimizerStore.getState().sheets['run-2']).toHaveLength(1)
    })
  })

  describe('setRunning', () => {
    it('sets isRunning to true', () => {
      useOptimizerStore.getState().setRunning(true)
      expect(useOptimizerStore.getState().isRunning).toBe(true)
    })

    it('sets isRunning to false', () => {
      useOptimizerStore.getState().setRunning(true)
      useOptimizerStore.getState().setRunning(false)
      expect(useOptimizerStore.getState().isRunning).toBe(false)
    })
  })

  describe('setProgress', () => {
    it('sets progress value', () => {
      useOptimizerStore.getState().setProgress(50)
      expect(useOptimizerStore.getState().progress).toBe(50)
    })

    it('sets progress to 100', () => {
      useOptimizerStore.getState().setProgress(100)
      expect(useOptimizerStore.getState().progress).toBe(100)
    })
  })

  describe('updateSettings', () => {
    it('merges partial settings', () => {
      useOptimizerStore.getState().updateSettings({ kerf: 5.0 })
      expect(useOptimizerStore.getState().settings.kerf).toBe(5.0)
    })

    it('preserves unchanged settings', () => {
      useOptimizerStore.getState().updateSettings({ kerf: 5.0 })
      expect(useOptimizerStore.getState().settings.algorithm).toBe('guillotine')
    })
  })
})
