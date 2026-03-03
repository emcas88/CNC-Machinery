// ─────────────────────────────────────────────
//  FloorPlanEditor – shared TypeScript types
// ─────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export type WallOpeningType = 'door' | 'window';

export interface WallOpening {
  id: string;
  type: WallOpeningType;
  /** Position along the wall (0–1, fraction of wall length) */
  position: number;
  /** Width in mm */
  width: number;
  /** Height in mm (relevant for windows) */
  height?: number;
  /** Distance from floor in mm (for windows) */
  sillHeight?: number;
  /** Which way the door swings (relevant for doors) */
  swingDirection?: 'left' | 'right';
}

export type WallOrientation = 'horizontal' | 'vertical' | 'angled';

export interface Wall {
  id: string;
  startPoint: Point2D;
  endPoint: Point2D;
  /** Thickness in mm */
  thickness: number;
  /** Height in mm */
  height: number;
  openings: WallOpening[];
  label?: string;
}

export type CabinetCategory =
  | 'base'
  | 'upper'
  | 'tall'
  | 'corner'
  | 'island'
  | 'appliance';

export interface CabinetTemplate {
  id: string;
  name: string;
  category: CabinetCategory;
  /** Width in mm */
  width: number;
  /** Depth in mm */
  depth: number;
  /** Height in mm */
  height: number;
  color: string;
  /** SVG path data for top-down icon */
  iconPath?: string;
  hasApplianceCutout?: boolean;
  applianceCutoutType?: ApplianceCutoutType;
}

export type ApplianceCutoutType =
  | 'sink'
  | 'cooktop'
  | 'dishwasher'
  | 'refrigerator'
  | 'oven'
  | 'microwave'
  | 'none';

export interface ApplianceCutout {
  id: string;
  type: ApplianceCutoutType;
  /** Offset from cabinet top-left in mm */
  offsetX: number;
  offsetY: number;
  width: number;
  depth: number;
}

export interface PlacedCabinet {
  id: string;
  templateId: string;
  label: string;
  /** Position on the canvas in mm */
  position: Point2D;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Width override in mm */
  width: number;
  /** Depth override in mm */
  depth: number;
  /** Height override in mm */
  height: number;
  color: string;
  /** Wall id the cabinet is snapped to, if any */
  snappedWallId?: string;
  applianceCutouts: ApplianceCutout[];
  isSelected: boolean;
}

export interface RoomDimensions {
  /** Overall bounding width in mm */
  width: number;
  /** Overall bounding depth in mm */
  depth: number;
  /** Ceiling height in mm */
  height: number;
}

export interface Room {
  id: string;
  name: string;
  walls: Wall[];
  placedCabinets: PlacedCabinet[];
  dimensions: RoomDimensions;
  /** Background grid size in mm */
  gridSize: number;
  /** Created / updated timestamps */
  createdAt: string;
  updatedAt: string;
}

// ─── Canvas / Interaction ───────────────────

export interface ViewTransform {
  /** Pan offset in canvas px */
  offsetX: number;
  offsetY: number;
  /** Zoom scale (1 = 100%) */
  scale: number;
}

export type EditorTool =
  | 'select'
  | 'drawWall'
  | 'placeCabinet'
  | 'addOpening'
  | 'measure'
  | 'pan';

export interface SnapResult {
  point: Point2D;
  snappedToGrid: boolean;
  snappedToWall: boolean;
  snappedWallId?: string;
}

export interface DragState {
  isDragging: boolean;
  dragItem: PlacedCabinet | null;
  startMousePos: Point2D | null;
  startItemPos: Point2D | null;
}

export interface WallDrawState {
  isDrawing: boolean;
  startPoint: Point2D | null;
  currentPoint: Point2D | null;
}

export interface SelectionState {
  selectedWallId: string | null;
  selectedCabinetId: string | null;
  selectedOpeningId: string | null;
}

// ─── Export ─────────────────────────────────

export interface RoomExportData {
  version: string;
  exportedAt: string;
  room: Room;
  metadata: {
    totalCabinets: number;
    totalWalls: number;
    roomArea: number;
  };
}

// ─── Validation ─────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
