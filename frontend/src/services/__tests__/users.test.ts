import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../users'
import { apiClient } from '../api'

vi.mock('../api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)
const mockDelete = vi.mocked(apiClient.delete)

describe('users service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getUsers calls GET /api/users', async () => {
    mockGet.mockResolvedValue({ data: [] })
    await getUsers()
    expect(mockGet).toHaveBeenCalledWith('/api/users', { params: undefined })
  })

  it('getUsers passes query params', async () => {
    mockGet.mockResolvedValue({ data: [] })
    await getUsers({ limit: 10, offset: 20 })
    expect(mockGet).toHaveBeenCalledWith('/api/users', { params: { limit: 10, offset: 20 } })
  })

  it('getUser calls GET /api/users/:id', async () => {
    const id = 'abc-123'
    mockGet.mockResolvedValue({ data: { id } })
    const result = await getUser(id)
    expect(mockGet).toHaveBeenCalledWith(`/api/users/${id}`)
    expect(result.data.id).toBe(id)
  })

  it('createUser calls POST /api/users', async () => {
    const payload = { email: 'a@b.com', password: 'pass1234' }
    mockPost.mockResolvedValue({ data: { id: 'new-id' } })
    await createUser(payload)
    expect(mockPost).toHaveBeenCalledWith('/api/users', payload)
  })

  it('updateUser calls PUT /api/users/:id', async () => {
    const id = 'xyz'
    const payload = { first_name: 'Alice' }
    mockPut.mockResolvedValue({ data: { updated: true } })
    await updateUser(id, payload)
    expect(mockPut).toHaveBeenCalledWith(`/api/users/${id}`, payload)
  })

  it('deleteUser calls DELETE /api/users/:id', async () => {
    const id = 'del-id'
    mockDelete.mockResolvedValue({ data: null })
    await deleteUser(id)
    expect(mockDelete).toHaveBeenCalledWith(`/api/users/${id}`)
  })
})
