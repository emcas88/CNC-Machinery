import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from '../useAuthStore'

// Mock the API modules used by the store
const mockLoginApi = vi.fn()
const mockRegisterApi = vi.fn()
const mockRefreshApi = vi.fn()

vi.mock('@/services/auth', () => ({
  loginUser: (...args: unknown[]) => mockLoginApi(...args),
  registerUser: (...args: unknown[]) => mockRegisterApi(...args),
  refreshToken: (...args: unknown[]) => mockRefreshApi(...args),
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    localStorage.clear()
  })

  // ------------------------------------------------------------------
  // initial state
  // ------------------------------------------------------------------

  it('has correct initial state', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // ------------------------------------------------------------------
  // login
  // ------------------------------------------------------------------

  it('sets isLoading=true while login is in-flight', async () => {
    let resolveLogin!: (v: unknown) => void
    mockLoginApi.mockReturnValue(new Promise(r => { resolveLogin = r }))

    const { result } = renderHook(() => useAuthStore())

    act(() => { result.current.login('a@b.com', 'pass') })
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      resolveLogin({ data: { access_token: 'at', refresh_token: 'rt', token_type: 'Bearer' } })
    })
  })

  it('sets isAuthenticated=true on successful login', async () => {
    mockLoginApi.mockResolvedValue({
      data: {
        access_token: 'access-123',
        refresh_token: 'refresh-123',
        token_type: 'Bearer',
      },
    })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => { await result.current.login('user@test.com', 'password') })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.accessToken).toBe('access-123')
  })

  it('sets error on failed login', async () => {
    mockLoginApi.mockRejectedValue({
      response: { data: { error: 'Invalid credentials' } },
    })

    const { result } = renderHook(() => useAuthStore())
    await act(async () => { await result.current.login('bad@user.com', 'wrong') })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  // ------------------------------------------------------------------
  // logout
  // ------------------------------------------------------------------

  it('clears auth state on logout', async () => {
    // Pre-populate state
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: '1', email: 'a@b.com', role: 'viewer', is_active: true },
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useAuthStore())
    act(() => { result.current.logout() })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.accessToken).toBeNull()
    expect(result.current.user).toBeNull()
  })

  // ------------------------------------------------------------------
  // clearError
  // ------------------------------------------------------------------

  it('clearError sets error to null', () => {
    useAuthStore.setState({ error: 'some error', isAuthenticated: false, isLoading: false, user: null, accessToken: null, refreshToken: null })
    const { result } = renderHook(() => useAuthStore())
    act(() => { result.current.clearError() })
    expect(result.current.error).toBeNull()
  })
})
