export interface DrawingTemplate {
  id: string
  name: string
  pageSize: 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'Letter' | 'Tabloid' | 'custom'
  pageWidth?: number
  pageHeight?: number
  orientation: 'portrait' | 'landscape'
  borderMargin: number
  titleBlock: TitleBlock
  views: DrawingView[]
  savedViews: SavedView[]
  annotationLayers: AnnotationLayer[]
  scale: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface TitleBlock {
  show: boolean
  company?: string
  logoUrl?: string
  fields: { label: string; dataKey: string }[]
}

export interface DrawingView {
  id: string
  type: 'plan' | 'elevation' | 'section' | 'detail' | '3d'
  label?: string
  x: number
  y: number
  width: number
  height: number
  scale: string
  showDimensions: boolean
  showAnnotations: boolean
}

export interface SavedView {
  id: string
  name: string
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  thumbnailUrl?: string
  createdAt: string
}

export interface AnnotationLayer {
  id: string
  name: string
  color: string
  visible: boolean
  locked: boolean
  annotations: Annotation[]
}

export interface Annotation {
  id: string
  type: 'text' | 'dimension' | 'arrow' | 'cloud' | 'symbol'
  x: number
  y: number
  content?: string
  points?: [number, number][]
}
