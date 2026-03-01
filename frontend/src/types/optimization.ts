export enum OptimizationQuality {
  DRAFT = 'draft',
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum',
}

export interface OptimizationRun {
  id: string
  jobId: string
  name: string
  quality: OptimizationQuality
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  materialId?: string
  sheetCount: number
  totalArea: number
  usedArea: number
  wasteArea: number
  yieldPercent: number
  settings: OptimizationSettings
  sheets: NestedSheet[]
  createdAt: string
  completedAt?: string
}

export interface OptimizationSettings {
  quality: OptimizationQuality
  partSpacing: number
  sheetEdgeMargin: number
  respectGrain: boolean
  allowRotation: boolean
  groupByMaterial: boolean
  groupByThickness: boolean
  maxSheets?: number
}

export interface NestedSheet {
  id: string
  runId: string
  sheetIndex: number
  materialId: string
  materialName: string
  sheetWidth: number
  sheetHeight: number
  thickness: number
  parts: NestedPart[]
  yieldPercent: number
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
