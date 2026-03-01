export enum MaterialCategory {
  PLYWOOD = 'plywood',
  MDF = 'mdf',
  PARTICLE_BOARD = 'particle_board',
  SOLID_WOOD = 'solid_wood',
  MELAMINE = 'melamine',
  LAMINATE = 'laminate',
  ACRYLIC = 'acrylic',
  ALUMINIUM = 'aluminium',
  OTHER = 'other',
}

export enum CostUnit {
  PER_SHEET = 'per_sheet',
  PER_BOARD_FOOT = 'per_board_foot',
  PER_LINEAR_FOOT = 'per_linear_foot',
  PER_SQUARE_METER = 'per_square_meter',
}

export interface Material {
  id: string
  name: string
  category: MaterialCategory
  thickness: number
  sheetWidth: number
  sheetHeight: number
  costPerUnit: number
  costUnit: CostUnit
  supplier?: string
  supplierCode?: string
  textureId?: string
  color?: string
  finishSide: 'both' | 'top' | 'none'
  inStock: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MaterialTemplate {
  id: string
  name: string
  category: MaterialCategory
  thickness: number
  sheetWidth: number
  sheetHeight: number
}

export interface CreateMaterial {
  name: string
  category: MaterialCategory
  thickness: number
  sheetWidth: number
  sheetHeight: number
  costPerUnit?: number
  costUnit?: CostUnit
  supplier?: string
  supplierCode?: string
  textureId?: string
  color?: string
  finishSide?: 'both' | 'top' | 'none'
  inStock?: boolean
  notes?: string
}
