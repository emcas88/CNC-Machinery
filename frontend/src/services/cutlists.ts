import api from './api'

export interface BomRow {
  id: string
  description: string
  category: string
  quantity: number
  unit: string
  unitCost: number
  total: number
  supplier?: string
  partName?: string
  material?: string
}

export interface CutlistRow {
  id: string
  partName: string
  material: string
  length: number
  width: number
  thickness: number
  quantity: number
  grainDirection?: string
  edgeBanding?: string
  roomName?: string
  productName?: string
}

export interface CutlistRequest {
  jobId: string
  options?: {
    groupBy?: 'material' | 'room' | 'product'
    includeGrain?: boolean
    format?: 'pdf' | 'csv' | 'xlsx'
  }
}

export const cutlistsService = {
  async generateCutlist(data: CutlistRequest): Promise<Blob> {
    const res = await api.post('/cutlists/generate', data, { responseType: 'blob' })
    return res.data
  },

  async getCutlistPreview(jobId: string): Promise<unknown> {
    const res = await api.get(`/cutlists/preview/${jobId}`)
    return res.data
  },

  async getCutlists(jobId: string): Promise<unknown[]> {
    const res = await api.get('/cutlists', { params: { jobId } })
    return res.data
  },

  async deleteCutlist(id: string): Promise<void> {
    await api.delete(`/cutlists/${id}`)
  },

  async getBom(jobId: string): Promise<BomRow[]> {
    const res = await api.get<BomRow[]>(`/cutlists/bom`, { params: { jobId } })
    return res.data
  },

  async getBoq(jobId: string): Promise<BomRow[]> {
    const res = await api.get<BomRow[]>(`/cutlists/boq`, { params: { jobId } })
    return res.data
  },
}
