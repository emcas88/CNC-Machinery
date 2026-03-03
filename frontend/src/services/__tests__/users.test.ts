import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usersService } from '../users'
import { api } from '../api'

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockApi = api as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('Users Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('getAll calls GET /users', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] })
    const result = await usersService.getAll()
    expect(mockApi.get).toHaveBeenCalledWith('/users')
    expect(result).toEqual([])
  })

  it('getById calls GET /users/:id', async () => {
    const user = { id: '1', email: 'test@example.com' }
    mockApi.get.mockResolvedValueOnce({ data: user })
    const result = await usersService.getById('1')
    expect(mockApi.get).toHaveBeenCalledWith('/users/1')
    expect(result).toEqual(user)
  })

  it('update calls PATCH /users/:id', async () => {
    const updated = { id: '1', email: 'updated@example.com' }
    mockApi.patch.mockResolvedValueOnce({ data: updated })
    const result = await usersService.update('1', { email: 'updated@example.com' })
    expect(mockApi.patch).toHaveBeenCalledWith('/users/1', { email: 'updated@example.com' })
    expect(result).toEqual(updated)
  })

  it('delete calls DELETE /users/:id', async () => {
    mockApi.delete.mockResolvedValueOnce({ data: null })
    await usersService.delete('1')
    expect(mockApi.delete).toHaveBeenCalledWith('/users/1')
  })

  it('getProfile calls GET /auth/me', async () => {
    const profile = { id: '1', email: 'me@example.com', role: 'Operator' }
    mockApi.get.mockResolvedValueOnce({ data: profile })
    const result = await usersService.getProfile()
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
    expect(result).toEqual(profile)
  })

  it('changePassword uses snake_case fields', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'ok' } })
    await usersService.changePassword({ current_password: 'old', new_password: 'new' })
    expect(mockApi.post).toHaveBeenCalledWith('/users/change-password', {
      current_password: 'old',
      new_password: 'new',
    })
  })

  it('logout removes access_token from localStorage', () => {
    localStorage.setItem('access_token', 'token')
    usersService.logout()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('logout removes refresh_token from localStorage', () => {
    localStorage.setItem('refresh_token', 'refresh')
    usersService.logout()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('logout does not call API', async () => {
    usersService.logout()
    expect(mockApi.post).not.toHaveBeenCalled()
    expect(mockApi.get).not.toHaveBeenCalled()
  })
})
