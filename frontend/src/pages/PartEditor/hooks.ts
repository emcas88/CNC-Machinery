// ─────────────────────────────────────────────────────────────────────────────
// PartEditor — Custom Hooks
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  getPart,
  updatePart,
  listOperations,
  addOperation,
  updateOperation,
  deleteOperation,
} from './api';
import type {
  Part,
  Operation,
  Dimensions,
  GrainDirection,
  EdgeSide,
  EdgeBanding,
  UpdatePartPayload,
  AddOperationPayload,
  ValidationErrors,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// usePartForm
// ─────────────────────────────────────────────────────────────────────────────

export interface PartFormState {
  name: string;
  dimensions: Dimensions;
  materialOverrideId: string | null;
  grainDirection: GrainDirection;
  edgeBanding: EdgeBanding;
  notes: string;
}

export interface UsePartFormReturn {
  /** The remote part (null while loading) */
  part: Part | null;
  /** Editable local form state */
  form: PartFormState;
  /** Fields that differ from the last saved version */
  isDirty: boolean;
  /** Per-field validation errors */
  errors: ValidationErrors;
  /** true while initial load is in flight */
  isLoading: boolean;
  /** Error message from the last failed API call */
  apiError: string | null;
  /** true while a save is in flight */
  isSaving: boolean;
  setName: (name: string) => void;
  setDimension: (field: keyof Dimensions, value: number) => void;
  setMaterialOverride: (id: string | null) => void;
  setGrainDirection: (dir: GrainDirection) => void;
  toggleEdgeBand: (side: EdgeSide) => void;
  setEdgeBandMaterial: (side: EdgeSide, materialId: string | null) => void;
  setNotes: (notes: string) => void;
  save: () => Promise<void>;
  reset: () => void;
}

function buildFormFromPart(part: Part): PartFormState {
  return {
    name: part.name,
    dimensions: { ...part.dimensions },
    materialOverrideId: part.materialOverrideId,
    grainDirection: part.grainDirection,
    edgeBanding: {
      top: { ...part.edgeBanding.top },
      bottom: { ...part.edgeBanding.bottom },
      left: { ...part.edgeBanding.left },
      right: { ...part.edgeBanding.right },
    },
    notes: part.notes,
  };
}

function validateForm(form: PartFormState): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.name.trim()) {
    errors.name = 'Part name is required.';
  }
  if (!Number.isFinite(form.dimensions.length) || form.dimensions.length <= 0) {
    errors.length = 'Length must be greater than 0.';
  }
  if (!Number.isFinite(form.dimensions.width) || form.dimensions.width <= 0) {
    errors.width = 'Width must be greater than 0.';
  }
  if (
    !Number.isFinite(form.dimensions.thickness) ||
    form.dimensions.thickness <= 0
  ) {
    errors.thickness = 'Thickness must be greater than 0.';
  }
  return errors;
}

export function usePartForm(partId: string): UsePartFormReturn {
  const [part, setPart] = useState<Part | null>(null);
  const [form, setForm] = useState<PartFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load part on mount / when partId changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setApiError(null);

    getPart(partId)
      .then((loaded) => {
        if (cancelled) return;
        setPart(loaded);
        setForm(buildFormFromPart(loaded));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setApiError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [partId]);

  const safeForm = form ?? {
    name: '',
    dimensions: { length: 0, width: 0, thickness: 0 },
    materialOverrideId: null,
    grainDirection: 'None' as GrainDirection,
    edgeBanding: {
      top: { side: 'top', enabled: false, materialId: null },
      bottom: { side: 'bottom', enabled: false, materialId: null },
      left: { side: 'left', enabled: false, materialId: null },
      right: { side: 'right', enabled: false, materialId: null },
    } as EdgeBanding,
    notes: '',
  };

  const isDirty = part !== null && form !== null
    ? JSON.stringify(buildFormFromPart(part)) !== JSON.stringify(form)
    : false;

  const errors = form ? validateForm(form) : {};

  const setName = useCallback((name: string) => {
    setForm((prev) => prev ? { ...prev, name } : prev);
  }, []);

  const setDimension = useCallback((field: keyof Dimensions, value: number) => {
    setForm((prev) =>
      prev ? { ...prev, dimensions: { ...prev.dimensions, [field]: value } } : prev
    );
  }, []);

  const setMaterialOverride = useCallback((id: string | null) => {
    setForm((prev) => prev ? { ...prev, materialOverrideId: id } : prev);
  }, []);

  const setGrainDirection = useCallback((dir: GrainDirection) => {
    setForm((prev) => prev ? { ...prev, grainDirection: dir } : prev);
  }, []);

  const toggleEdgeBand = useCallback((side: EdgeSide) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        edgeBanding: {
          ...prev.edgeBanding,
          [side]: {
            ...prev.edgeBanding[side],
            enabled: !prev.edgeBanding[side].enabled,
          },
        },
      };
    });
  }, []);

  const setEdgeBandMaterial = useCallback(
    (side: EdgeSide, materialId: string | null) => {
      setForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          edgeBanding: {
            ...prev.edgeBanding,
            [side]: { ...prev.edgeBanding[side], materialId },
          },
        };
      });
    },
    []
  );

  const setNotes = useCallback((notes: string) => {
    setForm((prev) => prev ? { ...prev, notes } : prev);
  }, []);

  const save = useCallback(async () => {
    if (!form || !part) return;
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) return;

    setIsSaving(true);
    setApiError(null);
    try {
      const payload: UpdatePartPayload = {
        name: form.name,
        dimensions: form.dimensions,
        materialOverrideId: form.materialOverrideId,
        grainDirection: form.grainDirection,
        edgeBanding: form.edgeBanding,
        notes: form.notes,
      };
      const updated = await updatePart(part.id, payload);
      setPart(updated);
      setForm(buildFormFromPart(updated));
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [form, part]);

  const reset = useCallback(() => {
    if (part) setForm(buildFormFromPart(part));
  }, [part]);

  return {
    part,
    form: safeForm,
    isDirty,
    errors,
    isLoading,
    apiError,
    isSaving,
    setName,
    setDimension,
    setMaterialOverride,
    setGrainDirection,
    toggleEdgeBand,
    setEdgeBandMaterial,
    setNotes,
    save,
    reset,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useOperations
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOperationsReturn {
  operations: Operation[];
  isLoading: boolean;
  apiError: string | null;
  isMutating: boolean;
  add: (payload: AddOperationPayload) => Promise<Operation | null>;
  edit: (
    operationId: string,
    payload: Partial<AddOperationPayload>
  ) => Promise<Operation | null>;
  remove: (operationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOperations(partId: string): UseOperationsReturn {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const fetchOperations = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const ops = await listOperations(partId);
      setOperations(ops);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [partId]);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  const add = useCallback(
    async (payload: AddOperationPayload): Promise<Operation | null> => {
      setIsMutating(true);
      setApiError(null);
      try {
        const op = await addOperation(partId, payload);
        setOperations((prev) => [...prev, op]);
        return op;
      } catch (err) {
        setApiError((err as Error).message);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [partId]
  );

  const edit = useCallback(
    async (
      operationId: string,
      payload: Partial<AddOperationPayload>
    ): Promise<Operation | null> => {
      setIsMutating(true);
      setApiError(null);
      try {
        const updated = await updateOperation(partId, operationId, payload);
        setOperations((prev) =>
          prev.map((op) => (op.id === operationId ? updated : op))
        );
        return updated;
      } catch (err) {
        setApiError((err as Error).message);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [partId]
  );

  const remove = useCallback(
    async (operationId: string): Promise<void> => {
      setIsMutating(true);
      setApiError(null);
      try {
        await deleteOperation(partId, operationId);
        setOperations((prev) => prev.filter((op) => op.id !== operationId));
      } catch (err) {
        setApiError((err as Error).message);
      } finally {
        setIsMutating(false);
      }
    },
    [partId]
  );

  return {
    operations,
    isLoading,
    apiError,
    isMutating,
    add,
    edit,
    remove,
    refresh: fetchOperations,
  };
}
