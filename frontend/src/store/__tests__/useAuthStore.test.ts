import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '../useAuthStore'
import { api } from '@/services/api'

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

const mockApi = api as {
  post: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
}

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset store
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('initial state is unauthenticated', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('login stores tokens and sets user', async () => {
    const tokens = { access_token: 'access123', refresh_token: 'refresh456', token_type: 'Bearer' }
    const user = { id: '1', email: 'test@example.com', role: 'Operator' }
    mockApi.post.mockResolvedValueOnce({ data: tokens })
    mockApi.get.mockResolvedValueOnce({ data: user })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })

    expect(localStorage.getItem('access_token')).toBe('access123')
    expect(localStorage.getItem('refresh_token')).toBe('refresh456')
    expect(result.current.user).toEqual(user)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('register stores tokens and sets user', async () => {
    const tokens = { access_token: 'access789', refresh_token: 'refresh012', token_type: 'Bearer' }
    const user = { id: '2', email: 'new@example.com', role: 'Operator' }
    mockApi.post.mockResolvedValueOnce({ data: tokens })
    mockApi.get.mockResolvedValueOnce({ data: user })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.register({
        email: 'new@example.com',
        password: 'pass',
        first_name: 'New',
        last_name: 'User',
        username: 'newuser',
      })
    })

    expect(localStorage.getItem('access_token')).toBe('access789')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout clears tokens and resets state', async () => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('refresh_token', 'refresh')
    useAuthStore.setState({ user: { id: '1' } as never, isAuthenticated: true })

    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current.logout()
    })

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('initAuth fetches user when token exists', async () => {
    localStorage.setItem('access_token', 'existing-token')
    const user = { id: '1', email: 'existing@example.com', role: 'Admin' }
    mockApi.get.mockResolvedValueOnce({ data: user })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.initAuth()
    })

    expect(result.current.user).toEqual(user)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('initAuth does nothing when no token', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.initAuth()
    })
    expect(mockApi.get).not.toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('initAuth clears tokens on error', async () => {
    localStorage.setItem('access_token', 'bad-token')
    mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'))

    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.initAuth()
    })

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('loginWithTokens stores tokens and fetches user', async () => {
    const tokens = { access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer' }
    const user = { id: '3', email: 'token@example.com', role: 'Manager' }
    mockApi.get.mockResolvedValueOnce({ data: user })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.loginWithTokens(tokens)
    })

    expect(localStorage.getItem('access_token')).toBe('new-access')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
    expect(result.current.user).toEqual(user)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login calls correct endpoint', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { access_token: 'a', refresh_token: 'r', token_type: 'Bearer' } })
    mockApi.get.mockResolvedValueOnce({ data: { id: '1' } })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => {
      await result.current.login('u@e.com', 'pass')
    })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'u@e.com', password: 'pass' })
  })

  it('register calls correct endpoint', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { access_token: 'a', refresh_token: 'r', token_type: 'Bearer' } })
    mockApi.get.mockResolvedValueOnce({ data: { id: '2' } })

    const { result } = renderHook(() => useAuthStore())
    const regData = { email: 'r@e.com', password: 'p', first_name: 'F', last_name: 'L', username: 'fl' }
    await act(async () => {
      await result.current.register(regData)
    })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/register', regData)
  })
})
