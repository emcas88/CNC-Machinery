import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/useAuthStore'
import type { User } from '@/types'
import { UserRole } from '@/types'

const mockUser: User = {
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  role: UserRole.DESIGNER,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mockToken = 'eyJhbGciOiJIUzI1NiJ9.dGVzdA.signature'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      currentUser: null,
      token: null,
      isAuthenticated: false,
    })
    // Reset localStorage mock
    window.localStorage.clear()
    ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockClear()
    ;(window.localStorage.setItem as ReturnType<typeof vi.fn>).mockClear()
    ;(window.localStorage.removeItem as ReturnType<typeof vi.fn>).mockClear()
  })

  describe('initial state', () => {
    it('has null currentUser', () => {
      expect(useAuthStore.getState().currentUser).toBeNull()
    })

    it('has null token', () => {
      expect(useAuthStore.getState().token).toBeNull()
    })

    it('has isAuthenticated as false', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('sets currentUser', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      expect(useAuthStore.getState().currentUser).toEqual(mockUser)
    })

    it('sets token', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      expect(useAuthStore.getState().token).toBe(mockToken)
    })

    it('sets isAuthenticated to true', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    it('stores token in localStorage', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      expect(window.localStorage.setItem).toHaveBeenCalledWith('auth_token', mockToken)
    })
  })

  describe('logout', () => {
    it('clears currentUser', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      useAuthStore.getState().logout()
      expect(useAuthStore.getState().currentUser).toBeNull()
    })

    it('clears token', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      useAuthStore.getState().logout()
      expect(useAuthStore.getState().token).toBeNull()
    })

    it('sets isAuthenticated to false', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      useAuthStore.getState().logout()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })

    it('removes token from localStorage', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      useAuthStore.getState().logout()
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_token')
    })
  })

  describe('updateUser', () => {
    it('merges partial changes into currentUser', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      useAuthStore.getState().updateUser({ name: 'Alice Updated' })
      expect(useAuthStore.getState().currentUser?.name).toBe('Alice Updated')
    })

    it('preserves unchanged fields', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      useAuthStore.getState().updateUser({ name: 'Bob' })
      expect(useAuthStore.getState().currentUser?.email).toBe('alice@example.com')
    })

    it('can update role', () => {
      useAuthStore.getState().login(mockUser, mockToken)
      useAuthStore.getState().updateUser({ role: UserRole.ADMIN })
      expect(useAuthStore.getState().currentUser?.role).toBe(UserRole.ADMIN)
    })

    it('stays null when currentUser is null', () => {
      useAuthStore.getState().updateUser({ name: 'Ghost' })
      expect(useAuthStore.getState().currentUser).toBeNull()
    })
  })
})
