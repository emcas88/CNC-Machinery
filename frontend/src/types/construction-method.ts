export interface ConstructionMethod {
  id: string
  name: string
  description?: string
  joiningMethod: JoiningMethod
  backPanel: BackPanelStyle
  bottomPanel: BottomPanelStyle
  caseThickness: number
  backThickness: number
  insetDepth: number
  overlap: number
  blumSystemHole: boolean
  systemHoleSpacing: number
  notes?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export enum JoiningMethod {
  DOWEL = 'dowel',
  CAM_LOCK = 'cam_lock',
  BISCUIT = 'biscuit',
  SCREW = 'screw',
  DOMINO = 'domino',
  RABBET = 'rabbet',
  POCKET_SCREW = 'pocket_screw',
}

export enum BackPanelStyle {
  DADO = 'dado',
  RABBET = 'rabbet',
  SURFACE_MOUNT = 'surface_mount',
  NONE = 'none',
}

export enum BottomPanelStyle {
  DADO = 'dado',
  SURFACE_MOUNT = 'surface_mount',
  RABBET = 'rabbet',
}

export type CreateConstructionMethodDto = CreateConstructionMethod
export type UpdateConstructionMethodDto = Partial<CreateConstructionMethod>

export interface CreateConstructionMethod {
  name: string
  description?: string
  joiningMethod?: JoiningMethod
  backPanel?: BackPanelStyle
  bottomPanel?: BottomPanelStyle
  caseThickness?: number
  backThickness?: number
  insetDepth?: number
  overlap?: number
  blumSystemHole?: boolean
  systemHoleSpacing?: number
  notes?: string
}
