/**
 * ThreeDViewer Types
 * Feature 18: ThreeDViewer/Component Unification
 */

import * as React from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface Transform {
  position: Vector3D;
  rotation: Vector3D;
  scale: Vector3D;
}

// ---------------------------------------------------------------------------
// Operation geometry (bores, dados, rabbets, etc.)
// ---------------------------------------------------------------------------

export type OperationType =
  | 'bore'
  | 'dado'
  | 'rabbet'
  | 'pocket'
  | 'profile'
  | 'slot'
  | 'countersink'
  | 'counterbore';

export interface OperationGeometry {
  id: string;
  type: OperationType;
  /** Position relative to the part origin */
  position: Vector3D;
  /** For bores/counterbores: radius */
  radius?: number;
  /** For bores/counterbores: depth into the part */
  depth?: number;
  /** For dados/rabbets/slots: width */
  width?: number;
  /** For dados/rabbets/slots: height/depth */
  cutDepth?: number;
  /** Length of a dado/slot along its primary axis */
  length?: number;
  /** Rotation of the operation in the part's local space */
  rotation?: Vector3D;
  /** Diameter (alternative to radius) */
  diameter?: number;
  /** Label shown in annotations */
  label?: string;
}

// ---------------------------------------------------------------------------
// Part geometry
// ---------------------------------------------------------------------------

export type PartMaterial =
  | 'plywood'
  | 'mdf'
  | 'solid_wood'
  | 'melamine'
  | 'hardboard'
  | 'acrylic'
  | 'aluminum';

export type WoodSpecies =
  | 'oak'
  | 'maple'
  | 'walnut'
  | 'cherry'
  | 'pine'
  | 'birch'
  | 'mahogany';

export interface PartGeometry {
  id: string;
  name: string;
  /** Outer bounding box dimensions in mm */
  dimensions: Dimensions;
  /** World transform */
  transform: Transform;
  /** Machining operations on this part */
  operations: OperationGeometry[];
  /** Material type */
  material: PartMaterial;
  /** Wood species for grain rendering (when applicable) */
  species?: WoodSpecies;
  /** Whether the part is currently selected */
  selected?: boolean;
  /** Axis along which this part separates in exploded view */
  explodeAxis?: Vector3D;
  /** Distance to move along explode axis */
  explodeDistance?: number;
  /** Optional custom color (overrides material colour) */
  color?: string;
  /** Thickness (for panels, same as smallest dimension) */
  thickness?: number;
}

// ---------------------------------------------------------------------------
// Scene data (top-level prop)
// ---------------------------------------------------------------------------

export interface SceneData {
  id: string;
  name: string;
  parts: PartGeometry[];
  /** Overall cabinet bounding box (computed or provided) */
  boundingBox?: {
    min: Vector3D;
    max: Vector3D;
  };
  /** Metadata */
  metadata?: {
    projectName?: string;
    version?: string;
    author?: string;
    createdAt?: string;
    units?: 'mm' | 'inch';
  };
}

// ---------------------------------------------------------------------------
// View modes
// ---------------------------------------------------------------------------

export type ViewMode =
  | 'perspective'
  | 'orthographic'
  | 'wireframe'
  | 'solid'
  | 'xray'
  | 'realistic';

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------

export type CameraPresetName =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'iso'
  | 'iso_back';

export interface CameraPreset {
  name: CameraPresetName;
  label: string;
  position: Vector3D;
  target: Vector3D;
  /** Field of view for perspective camera */
  fov?: number;
  /** Whether to use orthographic projection */
  orthographic?: boolean;
}

// ---------------------------------------------------------------------------
// Exploded view state
// ---------------------------------------------------------------------------

export type ExplodePhase = 'collapsed' | 'exploding' | 'exploded' | 'collapsing';

export interface ExplodedState {
  phase: ExplodePhase;
  /** 0 = fully collapsed, 1 = fully exploded */
  progress: number;
  /** Multiplier for explosion distance */
  magnitude: number;
  /** Per-part current world positions during animation */
  partPositions: Record<string, Vector3D>;
}

// ---------------------------------------------------------------------------
// Selection state
// ---------------------------------------------------------------------------

export interface SelectionState {
  selectedPartIds: string[];
  hoveredPartId: string | null;
}

// ---------------------------------------------------------------------------
// Annotation
// ---------------------------------------------------------------------------

export interface DimensionAnnotationData {
  id: string;
  /** Start point in world space */
  start: Vector3D;
  /** End point in world space */
  end: Vector3D;
  /** Human-readable label (e.g. "450mm") */
  label: string;
  /** Axis the dimension measures ('x' | 'y' | 'z') */
  axis: 'x' | 'y' | 'z';
  /** Offset from the measured edge */
  offset?: number;
}

// ---------------------------------------------------------------------------
// Screenshot / export
// ---------------------------------------------------------------------------

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  /** MIME type */
  format?: 'image/png' | 'image/jpeg';
  quality?: number;
  /** If true, render a transparent background */
  transparent?: boolean;
}

export interface ScreenshotResult {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface ThreeDViewerProps {
  scene: SceneData;
  /** Initial view mode */
  viewMode?: ViewMode;
  /** Initial camera preset */
  initialPreset?: CameraPresetName;
  /** Whether to show dimension annotations */
  showDimensions?: boolean;
  /** Whether to start in exploded view */
  startExploded?: boolean;
  /** Callback when a part is clicked/selected */
  onPartSelect?: (partId: string | null) => void;
  /** Callback when a screenshot is taken */
  onScreenshot?: (result: ScreenshotResult) => void;
  /** Background color (CSS string) */
  backgroundColor?: string;
  /** Whether to show the view controls toolbar */
  showControls?: boolean;
  /** Width of the canvas (CSS string or number) */
  width?: string | number;
  /** Height of the canvas (CSS string or number) */
  height?: string | number;
  /** className for the outer wrapper */
  className?: string;
}

export interface CabinetMeshProps {
  parts: PartGeometry[];
  selectedPartIds?: string[];
  hoveredPartId?: string | null;
  wireframe?: boolean;
  explodedState?: ExplodedState;
  onPartClick?: (partId: string) => void;
  onPartHover?: (partId: string | null) => void;
  showOperations?: boolean;
}

export interface PartMeshProps {
  part: PartGeometry;
  selected?: boolean;
  hovered?: boolean;
  wireframe?: boolean;
  position?: Vector3D;
  showOperations?: boolean;
  onClick?: (partId: string) => void;
  onHover?: (partId: string | null) => void;
}

export interface WoodMaterialProps {
  species?: WoodSpecies;
  material?: PartMaterial;
  color?: string;
  wireframe?: boolean;
  selected?: boolean;
  hovered?: boolean;
  opacity?: number;
}

export interface DimensionAnnotationProps {
  annotation: DimensionAnnotationData;
  color?: string;
  lineWidth?: number;
  fontSize?: number;
  visible?: boolean;
}

export interface ViewControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPresetSelect: (preset: CameraPresetName) => void;
  onScreenshot: () => void;
  onExplodeToggle: () => void;
  exploded: boolean;
  showDimensions: boolean;
  onDimensionsToggle: () => void;
  className?: string;
}

export interface ExplodedViewProps {
  parts: PartGeometry[];
  explodedState: ExplodedState;
  onExplodeComplete?: () => void;
  onCollapseComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Internal renderer context
// ---------------------------------------------------------------------------

export interface ThreeSceneContext {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  takeScreenshot: (opts?: ScreenshotOptions) => ScreenshotResult | null;
}

// ---------------------------------------------------------------------------
// Hook return types
// ---------------------------------------------------------------------------

export interface UseThreeSceneReturn {
  sceneRef: React.RefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  takeScreenshot: (opts?: ScreenshotOptions) => ScreenshotResult | null;
}

export interface UseExplodedViewReturn {
  explodedState: ExplodedState;
  triggerExplode: () => void;
  triggerCollapse: () => void;
  toggle: () => void;
  setMagnitude: (magnitude: number) => void;
  isAnimating: boolean;
}

export interface UseViewPresetsReturn {
  presets: CameraPreset[];
  currentPreset: CameraPresetName;
  applyPreset: (name: CameraPresetName) => void;
  getPreset: (name: CameraPresetName) => CameraPreset | undefined;
}
