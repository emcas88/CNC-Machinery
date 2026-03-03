export enum OptimizationQuality {
  DRAFT = 'draft',
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum',
}

export enum OptimizationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface OptimizationSettings {
  algorithm: string
  kerf: number
  grainDirection: string
  allowRotation: boolean
  prioritizeWaste: boolean
  sheetPriority: string
  quality?: OptimizationQuality
  partSpacing?: number
  sheetEdgeMargin?: number
  respectGrain?: boolean
  groupByMaterial?: boolean
  groupByThickness?: boolean
  maxSheets?: number
}

export interface OptimizationRun {
  id: string
  jobId: string
  name?: string
  status: OptimizationStatus | 'pending' | 'running' | 'completed' | 'failed'
  efficiency: number
  totalSheets: number
  wastePercent: number
  progress?: number
  materialId?: string
  sheetCount?: number
  totalArea?: number
  usedArea?: number
  wasteArea?: number
  yieldPercent?: number
  settings: OptimizationSettings
  sheets?: NestedSheet[]
  createdAt: string
  completedAt?: string
}

export interface NestedSheet {
  id: string
  runId: string
  sheetIndex: number
  materialId: string
  materialName?: string
  width: number
  height: number
  sheetWidth?: number
  sheetHeight?: number
  thickness?: number
  utilization: number
  yieldPercent?: number
  parts: NestedPart[]
  svgData?: string
}

export interface NestedPart {
  partId: string
  partName: string
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
  color?: string
}
