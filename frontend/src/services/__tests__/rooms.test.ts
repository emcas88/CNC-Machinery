import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { roomsService } from '@/services/rooms'

const mockRoom = {
  id: 'room-1',
  name: 'Kitchen',
  jobId: 'job-1',
  width: 4000,
  height: 2400,
  depth: 3500,
  productCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('roomsService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let putSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockRoom })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockRoom })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockRoom })
    putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: mockRoom })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getRooms calls GET /jobs/:jobId/rooms and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockRoom] })
    const result = await roomsService.getRooms('job-1')
    expect(getSpy).toHaveBeenCalledWith('/jobs/job-1/rooms')
    expect(result).toEqual([mockRoom])
  })

  it('getRoom calls GET /rooms/:id and returns data', async () => {
    const result = await roomsService.getRoom('room-1')
    expect(getSpy).toHaveBeenCalledWith('/rooms/room-1')
    expect(result).toEqual(mockRoom)
  })

  it('createRoom calls POST /rooms with body and returns data', async () => {
    const payload = { jobId: 'job-1', name: 'Living Room', width: 5000, height: 2400, depth: 4000 }
    const result = await roomsService.createRoom(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/rooms', payload)
    expect(result).toEqual(mockRoom)
  })

  it('updateRoom calls PATCH /rooms/:id and returns data', async () => {
    const changes = { name: 'Updated Kitchen' }
    const result = await roomsService.updateRoom('room-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/rooms/room-1', changes)
    expect(result).toEqual(mockRoom)
  })

  it('deleteRoom calls DELETE /rooms/:id', async () => {
    await roomsService.deleteRoom('room-1')
    expect(deleteSpy).toHaveBeenCalledWith('/rooms/room-1')
  })

  it('getElevation calls GET /rooms/:id/elevation with wall param and returns data', async () => {
    const mockElevation = { wall: 'north', data: {} }
    getSpy.mockResolvedValueOnce({ data: mockElevation })
    const result = await roomsService.getElevation('room-1', 'north')
    expect(getSpy).toHaveBeenCalledWith('/rooms/room-1/elevation', { params: { wall: 'north' } })
    expect(result).toEqual(mockElevation)
  })

  it('getFloorplan calls GET /rooms/:id/floorplan and returns data', async () => {
    const mockFloorplan = { products: [], walls: [] }
    getSpy.mockResolvedValueOnce({ data: mockFloorplan })
    const result = await roomsService.getFloorplan('room-1')
    expect(getSpy).toHaveBeenCalledWith('/rooms/room-1/floorplan')
    expect(result).toEqual(mockFloorplan)
  })
})
