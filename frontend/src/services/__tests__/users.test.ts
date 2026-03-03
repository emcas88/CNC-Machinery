import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usersService } from '../users'
import api from '../api'
import type { AuthResponse, UserProfile } from '@/types'

vi.mock('../api', () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:8080/api', headers: { 'Content-Type': 'application/json' } },
    interceptors: {
      request: { use: vi.fn(), handlers: [] },
      response: { use: vi.fn(), handlers: [] },
    },
  }
  return { default: instance, apiClient: instance }
})

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const mockAuthResponse: AuthResponse = {
  access_token: 'access-abc',
  refresh_token: 'refresh-xyz',
  token_type: 'Bearer',
  expires_in: 3600,
}

const mockProfile: UserProfile = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'designer',
  created_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('usersService.login', () => {
  it('calls POST /auth/login with credentials and returns AuthResponse', async () => {
    mockApi.post.mockResolvedValue({ data: mockAuthResponse })
    const result = await usersService.login({ email: 'test@example.com', password: 'pass123' })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'pass123',
    })
    expect(result).toEqual(mockAuthResponse)
  })

  it('returns object with access_token, refresh_token, token_type, expires_in', async () => {
    mockApi.post.mockResolvedValue({ data: mockAuthResponse })
    const result = await usersService.login({ email: 'a@b.com', password: 'p' })
    expect(result).toHaveProperty('access_token')
    expect(result).toHaveProperty('refresh_token')
    expect(result).toHaveProperty('token_type', 'Bearer')
    expect(result).toHaveProperty('expires_in')
  })
})

describe('usersService.register', () => {
  it('calls POST /auth/register and returns AuthResponse', async () => {
    mockApi.post.mockResolvedValue({ data: mockAuthResponse })
    const result = await usersService.register({ email: 'new@example.com', password: 'pass', name: 'New' })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      password: 'pass',
      name: 'New',
    })
    expect(result).toEqual(mockAuthResponse)
  })
})

describe('usersService.logout', () => {
  it('removes auth_token and refresh_token from localStorage', async () => {
    localStorage.setItem('auth_token', 'tok')
    localStorage.setItem('refresh_token', 'ref')
    await usersService.logout()
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('does NOT make any API call', async () => {
    await usersService.logout()
    expect(mockApi.post).not.toHaveBeenCalled()
    expect(mockApi.get).not.toHaveBeenCalled()
    expect(mockApi.delete).not.toHaveBeenCalled()
  })

  it('returns a resolved Promise', async () => {
    await expect(usersService.logout()).resolves.toBeUndefined()
  })
})

describe('usersService.changePassword', () => {
  it('sends snake_case fields current_password and new_password', async () => {
    mockApi.post.mockResolvedValue({ data: { message: 'ok' } })
    await usersService.changePassword('oldPass', 'newPass')
    expect(mockApi.post).toHaveBeenCalledWith('/auth/change-password', {
      current_password: 'oldPass',
      new_password: 'newPass',
    })
  })

  it('does NOT send camelCase fields', async () => {
    mockApi.post.mockResolvedValue({ data: {} })
    await usersService.changePassword('old', 'new')
    const payload = mockApi.post.mock.calls[0][1] as Record<string, string>
    expect(payload).not.toHaveProperty('currentPassword')
    expect(payload).not.toHaveProperty('newPassword')
  })
})

describe('usersService.me', () => {
  it('calls GET /auth/me and returns UserProfile', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    const result = await usersService.me()
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
    expect(result).toEqual(mockProfile)
  })
})

describe('usersService.getUsers', () => {
  it('calls GET /users and returns array', async () => {
    mockApi.get.mockResolvedValue({ data: [] })
    const result = await usersService.getUsers()
    expect(mockApi.get).toHaveBeenCalledWith('/users')
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('usersService.deleteUser', () => {
  it('calls DELETE /users/:id', async () => {
    mockApi.delete.mockResolvedValue({ data: null })
    await usersService.deleteUser('user-42')
    expect(mockApi.delete).toHaveBeenCalledWith('/users/user-42')
  })
})
