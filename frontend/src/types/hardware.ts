export enum HardwareType {
  HINGE = 'hinge',
  SLIDE = 'slide',
  HANDLE = 'handle',
  KNOB = 'knob',
  LOCK = 'lock',
  CLIP = 'clip',
  DOWEL = 'dowel',
  SCREW = 'screw',
  CAM_LOCK = 'cam_lock',
  SHELF_PIN = 'shelf_pin',
  SOFT_CLOSE = 'soft_close',
  PUSH_OPEN = 'push_open',
  LAZY_SUSAN = 'lazy_susan',
  OTHER = 'other',
}

export interface Hardware {
  id: string
  brandId?: string
  name: string
  type: HardwareType
  sku?: string
  description?: string
  imageUrl?: string
  drillingPatternUrl?: string
  drillingX?: number
  drillingY?: number
  drillingDiameter?: number
  costPerUnit: number
  inStock: boolean
  notes?: string
  createdAt: string
}

export interface HardwareBrand {
  id: string
  name: string
  logoUrl?: string
  website?: string
  itemCount: number
}

export interface CreateHardware {
  brandId?: string
  name: string
  type: HardwareType
  sku?: string
  description?: string
  drillingX?: number
  drillingY?: number
  drillingDiameter?: number
  costPerUnit?: number
  inStock?: boolean
  notes?: string
}
