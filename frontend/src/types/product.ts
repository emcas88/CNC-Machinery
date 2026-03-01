export enum ProductType {
  BASE = 'base',
  UPPER = 'upper',
  TALL = 'tall',
  ISLAND = 'island',
  PANTRY = 'pantry',
  VANITY = 'vanity',
  WARDROBE = 'wardrobe',
  CUSTOM = 'custom',
}

export enum CabinetStyle {
  FRAMELESS = 'frameless',
  FACE_FRAME = 'face_frame',
  INSET = 'inset',
  OVERLAY = 'overlay',
  PARTIAL_OVERLAY = 'partial_overlay',
}

export interface Product {
  id: string
  roomId: string
  name: string
  type: ProductType
  style: CabinetStyle
  width: number
  height: number
  depth: number
  positionX: number
  positionY: number
  positionZ: number
  rotation: number
  materialId?: string
  constructionMethodId?: string
  notes?: string
  createdAt: string
  updatedAt: string
  partCount: number
}

export interface CreateProduct {
  roomId: string
  name: string
  type: ProductType
  style?: CabinetStyle
  width: number
  height: number
  depth: number
  positionX?: number
  positionY?: number
  positionZ?: number
  rotation?: number
  materialId?: string
  constructionMethodId?: string
  notes?: string
}

export interface UpdateProduct extends Partial<Omit<CreateProduct, 'roomId'>> {
  id: string
}
