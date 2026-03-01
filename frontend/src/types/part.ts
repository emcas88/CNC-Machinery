export enum PartType {
  PANEL = 'panel',
  DOOR = 'door',
  DRAWER_BOX = 'drawer_box',
  SHELF = 'shelf',
  BACK = 'back',
  DIVIDER = 'divider',
  FACE_FRAME_RAIL = 'face_frame_rail',
  FACE_FRAME_STILE = 'face_frame_stile',
  TOE_KICK = 'toe_kick',
  CROWN = 'crown',
  LIGHT_RAIL = 'light_rail',
  CUSTOM = 'custom',
}

export enum GrainDirection {
  NONE = 'none',
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}

export interface Part {
  id: string
  productId: string
  name: string
  type: PartType
  width: number
  height: number
  thickness: number
  quantity: number
  materialId?: string
  grainDirection: GrainDirection
  edgeBanding: EdgeBanding
  operations: string[]
  notes?: string
  labelCode?: string
  createdAt: string
  updatedAt: string
}

export interface EdgeBanding {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
  thickness?: number
}

export interface CreatePart {
  productId: string
  name: string
  type: PartType
  width: number
  height: number
  thickness: number
  quantity?: number
  materialId?: string
  grainDirection?: GrainDirection
  edgeBanding?: Partial<EdgeBanding>
  notes?: string
}
