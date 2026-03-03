import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/services/api'
import { usersService } from '@/services/users'

const mockUser = {
  id: 'user-1',
  email: 'john@example.com',
  name: 'John Doe',
  role: 'operator',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('usersService', () => {
  let getSpy: ReturnType<typeof vi.spyOn>
  let postSpy: ReturnType<typeof vi.spyOn>
  let patchSpy: ReturnType<typeof vi.spyOn>
  let deleteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockUser })
    postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: mockUser })
    patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: mockUser })
    deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => vi.restoreAllMocks())

  it('getUsers calls GET /users and returns data', async () => {
    getSpy.mockResolvedValueOnce({ data: [mockUser] })
    const result = await usersService.getUsers()
    expect(getSpy).toHaveBeenCalledWith('/users')
    expect(result).toEqual([mockUser])
  })

  it('getUser calls GET /users/:id and returns data', async () => {
    const result = await usersService.getUser('user-1')
    expect(getSpy).toHaveBeenCalledWith('/users/user-1')
    expect(result).toEqual(mockUser)
  })

  it('createUser calls POST /users and returns data', async () => {
    const payload = { email: 'jane@example.com', name: 'Jane Doe', role: 'operator' }
    const result = await usersService.createUser(payload as any)
    expect(postSpy).toHaveBeenCalledWith('/users', payload)
    expect(result).toEqual(mockUser)
  })

  it('updateUser calls PATCH /users/:id and returns data', async () => {
    const changes = { name: 'John Updated' }
    const result = await usersService.updateUser('user-1', changes)
    expect(patchSpy).toHaveBeenCalledWith('/users/user-1', changes)
    expect(result).toEqual(mockUser)
  })

  it('updateUser with role change calls PATCH /users/:id with role in body', async () => {
    patchSpy.mockResolvedValueOnce({ data: { ...mockUser, role: 'admin' } })
    const result = await usersService.updateUser('user-1', { role: 'admin' })
    expect(patchSpy).toHaveBeenCalledWith('/users/user-1', { role: 'admin' })
    expect(result.role).toBe('admin')
  })

  it('deleteUser calls DELETE /users/:id', async () => {
    await usersService.deleteUser('user-1')
    expect(deleteSpy).toHaveBeenCalledWith('/users/user-1')
  })
})
