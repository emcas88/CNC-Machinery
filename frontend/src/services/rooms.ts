import api from './api'
import type { Room, CreateRoom, UpdateRoom, Elevation, FloorPlan } from '@/types'

export const roomsService = {
  getRooms: (jobId: string) =>
    api.get<Room[]>(`/jobs/${jobId}/rooms`).then((r) => r.data),

  getRoom: (id: string) =>
    api.get<Room>(`/rooms/${id}`).then((r) => r.data),

  createRoom: (data: CreateRoom) =>
    api.post<Room>('/rooms', data).then((r) => r.data),

  updateRoom: (id: string, data: Partial<UpdateRoom>) =>
    api.patch<Room>(`/rooms/${id}`, data).then((r) => r.data),

  deleteRoom: (id: string) =>
    api.delete(`/rooms/${id}`).then((r) => r.data),

  getElevation: (roomId: string, wall: string) =>
    api.get<Elevation>(`/rooms/${roomId}/elevation`, { params: { wall } }).then((r) => r.data),

  getFloorplan: (roomId: string) =>
    api.get<FloorPlan>(`/rooms/${roomId}/floorplan`).then((r) => r.data),

  saveFloorplan: (roomId: string, data: FloorPlan) =>
    api.put<FloorPlan>(`/rooms/${roomId}/floorplan`, data).then((r) => r.data),
}
