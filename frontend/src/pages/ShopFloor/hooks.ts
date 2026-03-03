// ─── Shop Floor Custom Hooks ──────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Encapsulates data-fetching, polling, and mutation logic for all shop floor views.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Job,
  MachineStatus,
  CutListItem,
  CutListGroup,
  QualityCheck,
  DimensionCheck,
  DashboardState,
  OperatorAction,
  MaterialType,
  QCResult,
} from './types';
import {
  fetchDashboard,
  fetchMachine,
  fetchCutList,
  markPartCut,
  unmarkPartCut,
  fetchQualityCheck,
  submitQualityCheck,
  updateDimensionCheckResult,
  sendEmergencyStop,
  resetMachine,
  logOperatorAction,
} from './api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MATERIAL_LABELS: Record<MaterialType, string> = {
  aluminum: 'Aluminum',
  steel: 'Steel',
  stainless_steel: 'Stainless Steel',
  titanium: 'Titanium',
  brass: 'Brass',
  plastic: 'Plastic',
  wood: 'Wood',
  composite: 'Composite',
  other: 'Other',
};

export function getMaterialLabel(material: MaterialType): string {
  return MATERIAL_LABELS[material] ?? 'Unknown';
}

export function groupCutListByMaterial(items: CutListItem[]): CutListGroup[] {
  const map = new Map<MaterialType, CutListItem[]>();

  for (const item of items) {
    const group = map.get(item.material) ?? [];
    group.push(item);
    map.set(item.material, group);
  }

  return Array.from(map.entries()).map(([material, groupItems]) => ({
    material,
    items: groupItems,
    totalParts: groupItems.reduce((sum, i) => sum + i.quantity, 0),
    cutParts: groupItems.reduce((sum, i) => sum + i.quantityCut, 0),
  }));
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatDimensions(
  d: { width: number; height: number; depth: number },
  unit = 'mm',
): string {
  return `${d.width} × ${d.height} × ${d.depth} ${unit}`;
}

// ─── useDashboard ──────────────────────────────────────────────────────────────

export interface UseDashboardResult {
  dashboard: DashboardState | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDashboard(pollingIntervalMs = 5000): UseDashboardResult {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDashboard();
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(), pollingIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load, pollingIntervalMs]);

  return { dashboard, loading, error, refresh: load };
}

// ─── useMachineMonitor ────────────────────────────────────────────────────────

export interface UseMachineMonitorResult {
  machine: MachineStatus | null;
  loading: boolean;
  error: string | null;
  emergencyStopActive: boolean;
  triggerEmergencyStop: (operatorId: string) => Promise<void>;
  triggerReset: (operatorId: string) => Promise<void>;
  refresh: () => void;
}

export function useMachineMonitor(
  machineId: string,
  pollingIntervalMs = 2000,
): UseMachineMonitorResult {
  const [machine, setMachine] = useState<MachineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emergencyStopActive, setEmergencyStopActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMachine(machineId);
      setMachine(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load machine status');
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(), pollingIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load, pollingIntervalMs]);

  const triggerEmergencyStop = useCallback(
    async (operatorId: string) => {
      setEmergencyStopActive(true);
      try {
        await sendEmergencyStop(machineId, operatorId);
        await logOperatorAction({
          type: 'emergency_stop',
          operatorId,
          operatorName: operatorId,
          machineId,
          timestamp: new Date().toISOString(),
        });
        await load();
      } catch (err) {
        setEmergencyStopActive(false);
        throw err;
      }
    },
    [machineId, load],
  );

  const triggerReset = useCallback(
    async (operatorId: string) => {
      try {
        const updated = await resetMachine(machineId, operatorId);
        setMachine(updated);
        setEmergencyStopActive(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Reset failed');
      }
    },
    [machineId],
  );

  return {
    machine,
    loading,
    error,
    emergencyStopActive,
    triggerEmergencyStop,
    triggerReset,
    refresh: load,
  };
}

// ─── useCutList ───────────────────────────────────────────────────────────────

export interface UseCutListResult {
  groups: CutListGroup[];
  items: CutListItem[];
  loading: boolean;
  error: string | null;
  toggleCut: (partId: string, operatorId: string) => Promise<void>;
  progress: { total: number; cut: number; percent: number };
  refresh: () => void;
}

export function useCutList(jobId: string): UseCutListResult {
  const [items, setItems] = useState<CutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchCutList(jobId);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cut list');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCut = useCallback(
    async (partId: string, operatorId: string) => {
      const item = items.find((i) => i.partId === partId);
      if (!item) return;

      // Optimistic update
      setItems((prev) =>
        prev.map((i) =>
          i.partId === partId
            ? {
                ...i,
                isCut: !i.isCut,
                quantityCut: !i.isCut ? i.quantity : 0,
                cutAt: !i.isCut ? new Date().toISOString() : undefined,
                cutBy: !i.isCut ? operatorId : undefined,
              }
            : i,
        ),
      );

      try {
        let updated: CutListItem;
        if (item.isCut) {
          updated = await unmarkPartCut(jobId, partId, operatorId);
        } else {
          updated = await markPartCut(jobId, partId, operatorId);
        }
        setItems((prev) => prev.map((i) => (i.partId === partId ? updated : i)));
      } catch (err) {
        // Rollback on error
        setItems((prev) => prev.map((i) => (i.partId === partId ? item : i)));
        setError(err instanceof Error ? err.message : 'Failed to update cut status');
      }
    },
    [items, jobId],
  );

  const groups = groupCutListByMaterial(items);
  const total = items.reduce((sum, i) => sum + i.quantity, 0);
  const cut = items.reduce((sum, i) => sum + i.quantityCut, 0);
  const percent = total > 0 ? Math.round((cut / total) * 100) : 0;

  return {
    groups,
    items,
    loading,
    error,
    toggleCut,
    progress: { total, cut, percent },
    refresh: load,
  };
}

// ─── useQualityCheck ──────────────────────────────────────────────────────────

export interface UseQualityCheckResult {
  check: QualityCheck | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  submitted: boolean;
  updateDimensionResult: (
    dimensionId: string,
    result: QCResult,
    measuredValue?: number,
    notes?: string,
  ) => void;
  setVisualInspection: (passed: boolean) => void;
  setSurfaceFinish: (passed: boolean) => void;
  setNotes: (notes: string) => void;
  submit: (operatorId: string) => Promise<void>;
  reset: () => void;
}

export function useQualityCheck(
  jobId: string,
  partId: string,
  initialCheck?: QualityCheck,
): UseQualityCheckResult {
  const [check, setCheck] = useState<QualityCheck | null>(initialCheck ?? null);
  const [loading, setLoading] = useState(!initialCheck);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initialCheck) return;

    let cancelled = false;
    setLoading(true);

    fetchQualityCheck(`${jobId}-${partId}`)
      .then((data) => {
        if (!cancelled) {
          setCheck(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load QC check');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, partId, initialCheck]);

  const updateDimensionResult = useCallback(
    (
      dimensionId: string,
      result: QCResult,
      measuredValue?: number,
      notes?: string,
    ) => {
      setCheck((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          dimensionChecks: prev.dimensionChecks.map((d) =>
            d.id === dimensionId ? { ...d, result, measuredValue, notes } : d,
          ),
        };
      });
    },
    [],
  );

  const setVisualInspection = useCallback((passed: boolean) => {
    setCheck((prev) => (prev ? { ...prev, visualInspectionPassed: passed } : prev));
  }, []);

  const setSurfaceFinish = useCallback((passed: boolean) => {
    setCheck((prev) => (prev ? { ...prev, surfaceFinishPassed: passed } : prev));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setCheck((prev) => (prev ? { ...prev, notes } : prev));
  }, []);

  const submit = useCallback(
    async (operatorId: string) => {
      if (!check) return;
      setSubmitting(true);
      setError(null);

      const allDimsPassed = check.dimensionChecks.every((d) => d.result === 'pass');
      const overallResult: QCResult =
        allDimsPassed &&
        check.visualInspectionPassed !== false &&
        check.surfaceFinishPassed !== false
          ? 'pass'
          : 'fail';

      try {
        const submitted_check = await submitQualityCheck({
          ...check,
          overallResult,
          inspectorId: operatorId,
          createdAt: check.createdAt ?? new Date().toISOString(),
        });
        setCheck(submitted_check);
        setSubmitted(true);

        await logOperatorAction({
          type: 'qc_submit',
          operatorId,
          operatorName: operatorId,
          jobId,
          partId,
          timestamp: new Date().toISOString(),
          details: { result: overallResult },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Submission failed');
      } finally {
        setSubmitting(false);
      }
    },
    [check, jobId, partId],
  );

  const reset = useCallback(() => {
    setSubmitted(false);
    setError(null);
    setCheck((prev) =>
      prev
        ? {
            ...prev,
            dimensionChecks: prev.dimensionChecks.map((d) => ({
              ...d,
              result: 'pending' as QCResult,
              measuredValue: undefined,
            })),
            notes: '',
            overallResult: 'pending',
            visualInspectionPassed: undefined,
            surfaceFinishPassed: undefined,
          }
        : prev,
    );
  }, []);

  return {
    check,
    loading,
    error,
    submitting,
    submitted,
    updateDimensionResult,
    setVisualInspection,
    setSurfaceFinish,
    setNotes,
    submit,
    reset,
  };
}

// ─── useOperatorActions ───────────────────────────────────────────────────────

export interface UseOperatorActionsResult {
  actions: OperatorAction[];
  loading: boolean;
  error: string | null;
  logAction: (action: Omit<OperatorAction, 'id'>) => Promise<void>;
}

export function useOperatorActions(
  machineId?: string,
  jobId?: string,
): UseOperatorActionsResult {
  const [actions, setActions] = useState<OperatorAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logAction = useCallback(
    async (action: Omit<OperatorAction, 'id'>) => {
      try {
        const saved = await logOperatorAction(action);
        setActions((prev) => [saved, ...prev].slice(0, 100));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to log action');
      }
    },
    [],
  );

  return { actions, loading, error, logAction };
}
