// ─────────────────────────────────────────────────────────────────────────────
// PartEditor — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type OperationType =
  | 'Cut'
  | 'Bore'
  | 'Route'
  | 'Dado'
  | 'Pocket'
  | 'Tenon'
  | 'EdgeProfile'
  | 'Drill';

export type GrainDirection = 'None' | 'Horizontal' | 'Vertical' | 'Diagonal';

export type EdgeSide = 'top' | 'bottom' | 'left' | 'right';

// ─── Material ────────────────────────────────────────────────────────────────

export interface Material {
  id: string;
  name: string;
  thickness: number; // mm
  description?: string;
}

// ─── Edge Banding ─────────────────────────────────────────────────────────────

export interface EdgeBand {
  side: EdgeSide;
  enabled: boolean;
  materialId: string | null;
  materialName?: string;
  thickness?: number; // mm
}

export type EdgeBanding = Record<EdgeSide, EdgeBand>;

// ─── Operation ────────────────────────────────────────────────────────────────

export interface OperationPosition {
  x: number; // mm from origin
  y: number; // mm from origin
}

export interface Operation {
  id: string;
  type: OperationType;
  position: OperationPosition;
  depth: number;       // mm
  width?: number;      // mm – for Dado/Pocket/Route
  length?: number;     // mm – for Dado/Pocket/Route
  diameter?: number;   // mm – for Bore/Drill
  toolId?: string;
  toolName?: string;
  notes?: string;
}

// ─── Dimensions ───────────────────────────────────────────────────────────────

export interface Dimensions {
  length: number;   // mm
  width: number;    // mm
  thickness: number; // mm
}

// ─── Part ─────────────────────────────────────────────────────────────────────

export interface Part {
  id: string;
  name: string;
  productId: string;
  productName: string;
  dimensions: Dimensions;
  /** If null, uses the product-level default material */
  materialOverrideId: string | null;
  materialOverrideName?: string;
  grainDirection: GrainDirection;
  edgeBanding: EdgeBanding;
  operations: Operation[];
  notes: string;
  /** ISO 8601 */
  createdAt: string;
  updatedAt: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationErrors {
  name?: string;
  length?: string;
  width?: string;
  thickness?: string;
}

export interface OperationValidationErrors {
  type?: string;
  positionX?: string;
  positionY?: string;
  depth?: string;
  width?: string;
  length?: string;
  diameter?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface UpdatePartPayload {
  name?: string;
  dimensions?: Partial<Dimensions>;
  materialOverrideId?: string | null;
  grainDirection?: GrainDirection;
  edgeBanding?: Partial<EdgeBanding>;
  notes?: string;
}

export interface AddOperationPayload {
  type: OperationType;
  position: OperationPosition;
  depth: number;
  width?: number;
  length?: number;
  diameter?: number;
  toolId?: string;
  notes?: string;
}

export interface ApiError {
  message: string;
  code?: string;
}
