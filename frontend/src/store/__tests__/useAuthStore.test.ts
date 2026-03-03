import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useAuthStore } from '../useAuthStore'
import api from '@/services/api'
import type { AuthResponse, UserProfile } from '@/types'

vi.mock('@/services/api', () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { baseURL: 'http://localhost:8080/api', headers: {} },
    interceptors: {
      request: { use: vi.fn(), handlers: [] },
      response: { use: vi.fn(), handlers: [] },
    },
  }
  return { default: instance, apiClient: instance }
})

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> }

const mockTokens: AuthResponse = {
  access_token: 'access-abc123',
  refresh_token: 'refresh-xyz789',
  token_type: 'Bearer',
  expires_in: 3600,
}

const mockProfile: UserProfile = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  role: 'designer',
  created_at: '2024-01-15T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Reset store state before each test
  useAuthStore.setState({
    currentUser: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  })
})

afterEach(() => {
  localStorage.clear()
})

describe('useAuthStore.loginWithTokens', () => {
  it('stores access_token in localStorage', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    expect(localStorage.getItem('auth_token')).toBe('access-abc123')
  })

  it('stores refresh_token in localStorage', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    expect(localStorage.getItem('refresh_token')).toBe('refresh-xyz789')
  })

  it('sets token in store state', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    expect(useAuthStore.getState().token).toBe('access-abc123')
  })

  it('calls GET /auth/me to fetch user profile', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
  })

  it('sets isAuthenticated to true on success', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('maps profile to user with correct fields', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    const user = useAuthStore.getState().currentUser
    expect(user?.id).toBe('user-1')
    expect(user?.email).toBe('alice@example.com')
    expect(user?.name).toBe('Alice')
    expect(user?.role).toBe('designer')
    expect(user?.createdAt).toBe('2024-01-15T10:00:00Z')
  })

  it('clears tokens and throws if /me fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'))
    await expect(useAuthStore.getState().loginWithTokens(mockTokens)).rejects.toThrow('Failed to fetch user profile')
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('sets isLoading to false after successful login', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})

describe('useAuthStore.logout', () => {
  it('removes auth_token from localStorage', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    useAuthStore.getState().logout()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('removes refresh_token from localStorage', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    useAuthStore.getState().logout()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('sets isAuthenticated to false', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('sets currentUser to null', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().currentUser).toBeNull()
  })

  it('sets token to null', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().token).toBeNull()
  })
})

describe('useAuthStore.initialize', () => {
  it('sets isAuthenticated false and exits early when no token in localStorage', async () => {
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(mockApi.get).not.toHaveBeenCalled()
  })

  it('restores session from localStorage token by calling /me', async () => {
    localStorage.setItem('auth_token', 'stored-token')
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().initialize()
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('restores currentUser from profile on initialize', async () => {
    localStorage.setItem('auth_token', 'stored-token')
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().currentUser?.email).toBe('alice@example.com')
  })

  it('clears tokens and marks unauthenticated if /me fails on initialize', async () => {
    localStorage.setItem('auth_token', 'bad-token')
    localStorage.setItem('refresh_token', 'bad-refresh')
    mockApi.get.mockRejectedValue(new Error('Unauthorized'))
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})

describe('useAuthStore.updateUser', () => {
  it('merges partial data into currentUser', async () => {
    mockApi.get.mockResolvedValue({ data: mockProfile })
    await useAuthStore.getState().loginWithTokens(mockTokens)
    useAuthStore.getState().updateUser({ name: 'Alice Updated' })
    expect(useAuthStore.getState().currentUser?.name).toBe('Alice Updated')
  })

  it('leaves currentUser null if it was null', () => {
    useAuthStore.getState().updateUser({ name: 'Nobody' })
    expect(useAuthStore.getState().currentUser).toBeNull()
  })
})
