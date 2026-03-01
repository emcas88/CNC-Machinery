export interface Room {
  id: string
  jobId: string
  name: string
  width: number
  height: number
  depth: number
  notes?: string
  createdAt: string
  updatedAt: string
  productCount: number
}

export interface CreateRoom {
  jobId: string
  name: string
  width: number
  height: number
  depth: number
  notes?: string
}

export interface UpdateRoom extends Partial<Omit<CreateRoom, 'jobId'>> {
  id: string
}

export interface Elevation {
  roomId: string
  wall: 'north' | 'south' | 'east' | 'west'
  svgData?: string
  imageUrl?: string
}

export interface FloorPlan {
  roomId: string
  walls: Wall[]
  openings: Opening[]
  products: PlacedProduct[]
}

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
}

export interface Opening {
  id: string
  wallId: string
  type: 'door' | 'window' | 'arch'
  position: number
  width: number
  height?: number
}

export interface PlacedProduct {
  productId: string
  x: number
  y: number
  rotation: number
}
