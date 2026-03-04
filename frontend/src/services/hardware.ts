import api from './api'
import type { Hardware, HardwareCategory, CreateHardwareDto, UpdateHardwareDto } from '@/types/hardware'

export const hardwareService = {
  async getHardware(params?: Record<string, unknown>): Promise<Hardware[]> {
    try {
      const res = await api.get('/hardware', { params })
      return res.data
    } catch {
      return [] as Hardware[]
    }
  },

  async getHardwareItem(id: string): Promise<Hardware> {
    const res = await api.get(`/hardware/${id}`)
    return res.data
  },

  async createHardware(data: CreateHardwareDto): Promise<Hardware> {
    const res = await api.post('/hardware', data)
    return res.data
  },

  async updateHardware(id: string, data: UpdateHardwareDto): Promise<Hardware> {
    const res = await api.patch(`/hardware/${id}`, data)
    return res.data
  },

  async deleteHardware(id: string): Promise<void> {
    await api.delete(`/hardware/${id}`)
  },

  async getHardwareCategories(): Promise<HardwareCategory[]> {
    try {
      const res = await api.get('/hardware/categories')
      return res.data
    } catch {
      return [] as HardwareCategory[]
    }
  },
}
