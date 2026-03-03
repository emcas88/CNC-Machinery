// ============================================================
// ProductEditor — Custom Hooks
// ============================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Product,
  ProductCategory,
  ConstructionMethod,
  Dimensions,
  Part,
  Material,
  Hardware,
  ValidationError,
  CATEGORY_CONSTRAINTS,
  DEFAULT_PRODUCT,
  PartCalculatorInput,
  PartType,
} from './types';
import { listMaterials, listHardware } from './api';

// ── Validation ────────────────────────────────────────────────

export function validateProduct(product: Product): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!product.name.trim()) {
    errors.push({ field: 'name', message: 'Product name is required' });
  } else if (product.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  } else if (product.name.trim().length > 100) {
    errors.push({ field: 'name', message: 'Name must be 100 characters or fewer' });
  }

  const constraints = CATEGORY_CONSTRAINTS[product.category];
  const { width, height, depth } = product.dimensions;

  if (isNaN(width) || width < constraints.minWidth || width > constraints.maxWidth) {
    errors.push({
      field: 'width',
      message: `Width must be between ${constraints.minWidth}mm and ${constraints.maxWidth}mm`,
    });
  }
  if (isNaN(height) || height < constraints.minHeight || height > constraints.maxHeight) {
    errors.push({
      field: 'height',
      message: `Height must be between ${constraints.minHeight}mm and ${constraints.maxHeight}mm`,
    });
  }
  if (isNaN(depth) || depth < constraints.minDepth || depth > constraints.maxDepth) {
    errors.push({
      field: 'depth',
      message: `Depth must be between ${constraints.minDepth}mm and ${constraints.maxDepth}mm`,
    });
  }

  if (!product.carcassMaterialId) {
    errors.push({ field: 'carcassMaterialId', message: 'Carcass material is required' });
  }
  if (!product.doorMaterialId) {
    errors.push({ field: 'doorMaterialId', message: 'Door material is required' });
  }
  if (!product.drawerMaterialId) {
    errors.push({ field: 'drawerMaterialId', message: 'Drawer material is required' });
  }
  if (!product.backPanelMaterialId) {
    errors.push({ field: 'backPanelMaterialId', message: 'Back panel material is required' });
  }

  return errors;
}

// ── useProductForm ────────────────────────────────────────────

export interface UseProductFormReturn {
  product: Product;
  errors: ValidationError[];
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | undefined;
  updateField: <K extends keyof Product>(field: K, value: Product[K]) => void;
  updateDimension: (dim: keyof Dimensions, value: number) => void;
  setIsSaving: (v: boolean) => void;
  setSaveError: (err: string | undefined) => void;
  reset: (initial?: Product) => void;
  validate: () => boolean;
  getFieldError: (field: string) => string | undefined;
}

export function useProductForm(initialProduct?: Product): UseProductFormReturn {
  const base: Product = initialProduct ?? { ...DEFAULT_PRODUCT } as Product;

  const [product, setProduct] = useState<Product>(base);
  const [originalProduct, setOriginalProduct] = useState<Product>(base);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  const isDirty = useMemo(
    () => JSON.stringify(product) !== JSON.stringify(originalProduct),
    [product, originalProduct]
  );

  const updateField = useCallback(<K extends keyof Product>(field: K, value: Product[K]) => {
    setProduct(prev => ({ ...prev, [field]: value }));
    setErrors(prev => prev.filter(e => e.field !== field));
  }, []);

  const updateDimension = useCallback((dim: keyof Dimensions, value: number) => {
    setProduct(prev => ({
      ...prev,
      dimensions: { ...prev.dimensions, [dim]: value },
    }));
    setErrors(prev => prev.filter(e => e.field !== dim));
  }, []);

  const validate = useCallback(() => {
    const newErrors = validateProduct(product);
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [product]);

  const reset = useCallback((initial?: Product) => {
    const next = initial ?? { ...DEFAULT_PRODUCT } as Product;
    setProduct(next);
    setOriginalProduct(next);
    setErrors([]);
    setSaveError(undefined);
  }, []);

  const getFieldError = useCallback(
    (field: string) => errors.find(e => e.field === field)?.message,
    [errors]
  );

  return {
    product,
    errors,
    isDirty,
    isSaving,
    saveError,
    updateField,
    updateDimension,
    setIsSaving,
    setSaveError,
    reset,
    validate,
    getFieldError,
  };
}

// ── usePartCalculator ─────────────────────────────────────────

const PANEL_THICKNESS = 18;
const BACK_PANEL_THICKNESS = 9;
const DRAWER_BOX_THICKNESS = 12;

function getMaterialThickness(materialId: string, materials: Material[], fallback: number): number {
  return materials.find(m => m.id === materialId)?.thickness ?? fallback;
}

function makeId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

export function calculateParts(input: PartCalculatorInput): Part[] {
  const {
    dimensions,
    category,
    constructionMethod,
    carcassMaterialId,
    doorMaterialId,
    drawerMaterialId,
    backPanelMaterialId,
    materials,
  } = input;

  const { width, height, depth } = dimensions;
  const t = getMaterialThickness(carcassMaterialId, materials, PANEL_THICKNESS);
  const bt = getMaterialThickness(backPanelMaterialId, materials, BACK_PANEL_THICKNESS);
  const dt = getMaterialThickness(drawerMaterialId, materials, DRAWER_BOX_THICKNESS);

  const parts: Part[] = [];

  const innerWidth = width - 2 * t;
  const innerHeight = height - 2 * t;
  const innerDepth = depth - bt;

  const ffRailHeight = 38;
  const ffStileWidth = 38;
  const isFaceFrame = constructionMethod === 'face-frame';
  const isInset = constructionMethod === 'inset';

  let partIndex = 0;

  const addPart = (name: string, type: PartType, qty: number, w: number, h: number, d: number, matId: string): Part => {
    partIndex++;
    return {
      id: makeId(type, partIndex),
      productId: '',
      name,
      type,
      quantity: qty,
      dimensions: {
        width: Math.max(1, Math.round(w)),
        height: Math.max(1, Math.round(h)),
        depth: Math.max(1, Math.round(d)),
      },
      materialId: matId,
    };
  };

  if (['BaseUnit', 'WallUnit', 'TallUnit'].includes(category)) {
    parts.push(addPart('Side Panel', 'side', 2, t, height, innerDepth, carcassMaterialId));
    parts.push(addPart('Top Panel', 'top', 1, innerWidth, t, innerDepth, carcassMaterialId));
    parts.push(addPart('Bottom Panel', 'bottom', 1, innerWidth, t, innerDepth, carcassMaterialId));
    parts.push(addPart('Back Panel', 'back', 1, innerWidth, innerHeight, bt, backPanelMaterialId));

    if (category === 'BaseUnit') {
      parts.push(addPart('Nailer', 'nailer', 2, innerWidth, 75, t, carcassMaterialId));
    }

    const shelfQty = category === 'TallUnit' ? 3 : 1;
    const shelfDepth = innerDepth - 20;
    parts.push(addPart('Adjustable Shelf', 'shelf', shelfQty, innerWidth, t, shelfDepth, carcassMaterialId));

    if (isFaceFrame) {
      parts.push(addPart('Face Frame Stile', 'face-frame-stile', 2, ffStileWidth, height, t, carcassMaterialId));
      const railWidth = width - 2 * ffStileWidth;
      const railQty = category === 'TallUnit' ? 3 : 2;
      parts.push(addPart('Face Frame Rail', 'face-frame-rail', railQty, railWidth, ffRailHeight, t, carcassMaterialId));
    }

    if (category !== 'Drawer') {
      const doorOverlay = isInset ? 0 : isFaceFrame ? 9.5 : 12;
      const doorWidth = isFaceFrame
        ? (width - 2 * ffStileWidth) / 2 + doorOverlay * 2
        : width / 2 + doorOverlay * 2;
      const doorHeight = isFaceFrame
        ? height - 2 * ffRailHeight + doorOverlay * 2
        : height - 2 * t + doorOverlay * 2;

      if (['BaseUnit', 'WallUnit'].includes(category)) {
        parts.push(
          addPart('Door', 'door', 2,
            Math.round(doorWidth), Math.round(doorHeight), getMaterialThickness(doorMaterialId, materials, 18),
            doorMaterialId)
        );
      } else if (category === 'TallUnit') {
        const upperDoorHeight = ((height * 0.6) - (isFaceFrame ? ffRailHeight * 2 : t * 2)) + doorOverlay * 2;
        const lowerDoorHeight = ((height * 0.4) - (isFaceFrame ? ffRailHeight * 2 : t * 2)) + doorOverlay * 2;
        parts.push(addPart('Upper Door', 'door', 2, Math.round(doorWidth), Math.round(upperDoorHeight), getMaterialThickness(doorMaterialId, materials, 18), doorMaterialId));
        parts.push(addPart('Lower Door', 'door', 2, Math.round(doorWidth), Math.round(lowerDoorHeight), getMaterialThickness(doorMaterialId, materials, 18), doorMaterialId));
      }
    }
  }

  if (category === 'Drawer' || category === 'BaseUnit') {
    const drawerBoxHeight = Math.min(height - 2 * t - 10, 140);
    const drawerBoxWidth = innerWidth - 26;
    const drawerBoxDepth = innerDepth - 50;

    if (category === 'Drawer') {
      parts.push(addPart('Side Panel', 'side', 2, t, height, innerDepth, carcassMaterialId));
      parts.push(addPart('Top Panel', 'top', 1, innerWidth, t, innerDepth, carcassMaterialId));
      parts.push(addPart('Bottom Panel', 'bottom', 1, innerWidth, t, innerDepth, carcassMaterialId));
      parts.push(addPart('Back Panel', 'back', 1, innerWidth, innerHeight, bt, backPanelMaterialId));

      parts.push(addPart('Drawer Front', 'drawer-front', 1, width + 24, height + 24, getMaterialThickness(doorMaterialId, materials, 18), doorMaterialId));
      parts.push(addPart('Drawer Box Side', 'drawer-box-side', 2, dt, drawerBoxHeight, drawerBoxDepth, drawerMaterialId));
      parts.push(addPart('Drawer Box Front', 'drawer-box-front', 1, drawerBoxWidth, drawerBoxHeight, dt, drawerMaterialId));
      parts.push(addPart('Drawer Box Back', 'drawer-box-back', 1, drawerBoxWidth, drawerBoxHeight - dt, dt, drawerMaterialId));
      parts.push(addPart('Drawer Box Bottom', 'drawer-box-bottom', 1, drawerBoxWidth - dt, drawerBoxDepth - dt, bt, backPanelMaterialId));
    }
  }

  if (category === 'Door') {
    parts.push(addPart('Door Panel', 'door', 1, width, height, getMaterialThickness(doorMaterialId, materials, 18), doorMaterialId));
  }

  if (category === 'Shelf') {
    parts.push(addPart('Shelf Panel', 'shelf', 1, width, t, depth, carcassMaterialId));
  }

  return parts;
}

export interface UsePartCalculatorReturn {
  parts: Part[];
  recalculate: () => void;
}

export function usePartCalculator(input: PartCalculatorInput): UsePartCalculatorReturn {
  const [parts, setParts] = useState<Part[]>(() => calculateParts(input));

  const inputKey = useMemo(
    () =>
      JSON.stringify({
        d: input.dimensions,
        cat: input.category,
        cm: input.constructionMethod,
        mats: [
          input.carcassMaterialId,
          input.doorMaterialId,
          input.drawerMaterialId,
          input.backPanelMaterialId,
        ],
      }),
    [input]
  );

  useEffect(() => {
    setParts(calculateParts(input));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const recalculate = useCallback(() => {
    setParts(calculateParts(input));
  }, [input]);

  return { parts, recalculate };
}

// ── useMaterials ──────────────────────────────────────────────

export interface UseMaterialsReturn {
  materials: Material[];
  hardware: Hardware[];
  loading: boolean;
  error: string | undefined;
  reload: () => void;
}

export function useMaterials(): UseMaterialsReturn {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [hardware, setHardware] = useState<Hardware[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [mats, hw] = await Promise.all([listMaterials(), listHardware()]);
      setMaterials(mats);
      setHardware(hw);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { materials, hardware, loading, error, reload: load };
}

// ── calculateHardware ─────────────────────────────────────────

export interface HardwareRequirement {
  hardwareId: string;
  name: string;
  type: Hardware['type'];
  quantity: number;
  notes: string;
}

export function calculateHardware(
  product: Product,
  parts: Part[],
  hardwareCatalog: Hardware[]
): HardwareRequirement[] {
  const requirements: HardwareRequirement[] = [];

  const doorCount = parts.filter(p => p.type === 'door').reduce((s, p) => s + p.quantity, 0);
  const drawerCount = parts.filter(p => p.type === 'drawer-front').reduce((s, p) => s + p.quantity, 0);
  const shelfCount = parts.filter(p => p.type === 'shelf').reduce((s, p) => s + p.quantity, 0);

  if (doorCount > 0) {
    const hingesPerDoor = product.category === 'TallUnit' ? 3 : 2;
    requirements.push({
      hardwareId: 'hinge',
      name: 'Soft-Close Hinge',
      type: 'hinge',
      quantity: doorCount * hingesPerDoor,
      notes: `${hingesPerDoor} per door × ${doorCount} doors`,
    });
  }

  if (drawerCount > 0) {
    requirements.push({
      hardwareId: 'slide',
      name: 'Drawer Slide (undermount)',
      type: 'slide',
      quantity: drawerCount * 2,
      notes: `Pair per drawer × ${drawerCount} drawers`,
    });
  }

  if (shelfCount > 0) {
    requirements.push({
      hardwareId: 'clip',
      name: 'Shelf Pin',
      type: 'clip',
      quantity: shelfCount * 4,
      notes: `4 per shelf × ${shelfCount} shelves`,
    });
  }

  const handleCount = doorCount + drawerCount;
  if (handleCount > 0) {
    requirements.push({
      hardwareId: 'handle',
      name: 'Pull Handle',
      type: 'handle',
      quantity: handleCount,
      notes: `1 per door/drawer`,
    });
  }

  return requirements;
}
