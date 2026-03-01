export interface Remnant {
  id: string
  materialId: string
  materialName: string
  width: number
  height: number
  thickness: number
  location?: string
  notes?: string
  available: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateRemnant {
  materialId: string
  width: number
  height: number
  thickness: number
  location?: string
  notes?: string
  available?: boolean
}
