// ============================================================
// ProductEditor — TypeScript Interfaces
// ============================================================

export type ProductCategory =
  | 'BaseUnit'
  | 'WallUnit'
  | 'TallUnit'
  | 'Drawer'
  | 'Door'
  | 'Shelf';

export type ConstructionMethod = 'face-frame' | 'frameless' | 'inset';

export type PartType =
  | 'side'
  | 'top'
  | 'bottom'
  | 'back'
  | 'shelf'
  | 'door'
  | 'drawer-front'
  | 'drawer-box-side'
  | 'drawer-box-front'
  | 'drawer-box-back'
  | 'drawer-box-bottom'
  | 'face-frame-rail'
  | 'face-frame-stile'
  | 'nailer';

export type EdgePosition = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

export interface Dimensions {
  width: number;   // mm
  height: number;  // mm
  depth: number;   // mm
}

export interface DimensionConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  minDepth: number;
  maxDepth: number;
}

export const CATEGORY_CONSTRAINTS: Record<ProductCategory, DimensionConstraints> = {
  BaseUnit: {
    minWidth: 150, maxWidth: 1200,
    minHeight: 500, maxHeight: 1000,
    minDepth: 300, maxDepth: 700,
  },
  WallUnit: {
    minWidth: 150, maxWidth: 1200,
    minHeight: 200, maxHeight: 900,
    minDepth: 150, maxDepth: 400,
  },
  TallUnit: {
    minWidth: 150, maxWidth: 900,
    minHeight: 1800, maxHeight: 2700,
    minDepth: 300, maxDepth: 700,
  },
  Drawer: {
    minWidth: 150, maxWidth: 900,
    minHeight: 100, maxHeight: 400,
    minDepth: 300, maxDepth: 600,
  },
  Door: {
    minWidth: 100, maxWidth: 900,
    minHeight: 200, maxHeight: 2400,
    minDepth: 18, maxDepth: 25,
  },
  Shelf: {
    minWidth: 150, maxWidth: 1200,
    minHeight: 18, maxHeight: 40,
    minDepth: 150, maxDepth: 700,
  },
};

export interface Material {
  id: string;
  name: string;
  type: 'sheet' | 'solid' | 'veneer' | 'laminate';
  thickness: number; // mm
  cost: number;      // per sq meter
  description?: string;
}

export interface Hardware {
  id: string;
  name: string;
  type: 'hinge' | 'slide' | 'handle' | 'clip' | 'screw' | 'cam-lock' | 'pull';
  quantity?: number;
  unitCost: number;
  description?: string;
}

export interface EdgeBanding {
  partId: string;
  edges: Partial<Record<EdgePosition, boolean>>;
  materialId?: string;
}

export interface Part {
  id: string;
  productId: string;
  name: string;
  type: PartType;
  quantity: number;
  dimensions: Dimensions;
  materialId: string;
  edgeBanding?: EdgeBanding;
  grain?: 'length' | 'width' | 'none';
  notes?: string;
}

export interface ProductHardware {
  hardwareId: string;
  quantity: number;
  notes?: string;
}

export interface Product {
  id?: string;
  name: string;
  description?: string;
  category: ProductCategory;
  dimensions: Dimensions;
  constructionMethod: ConstructionMethod;
  carcassMaterialId: string;
  doorMaterialId: string;
  drawerMaterialId: string;
  backPanelMaterialId: string;
  parts?: Part[];
  hardware?: ProductHardware[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState {
  product: Product;
  errors: ValidationError[];
  isDirty: boolean;
  isSaving: boolean;
  saveError?: string;
}

export interface PartCalculatorInput {
  dimensions: Dimensions;
  category: ProductCategory;
  constructionMethod: ConstructionMethod;
  carcassMaterialId: string;
  doorMaterialId: string;
  drawerMaterialId: string;
  backPanelMaterialId: string;
  materials: Material[];
}

export const DEFAULT_PRODUCT: Omit<Product, 'id'> = {
  name: '',
  description: '',
  category: 'BaseUnit',
  dimensions: { width: 600, height: 720, depth: 560 },
  constructionMethod: 'frameless',
  carcassMaterialId: '',
  doorMaterialId: '',
  drawerMaterialId: '',
  backPanelMaterialId: '',
  parts: [],
  hardware: [],
};
