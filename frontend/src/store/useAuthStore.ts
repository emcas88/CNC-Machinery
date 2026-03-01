import { create } from 'zustand'
import type { User } from '@/types'

interface AuthState {
  currentUser: User | null
  token: string | null
  isAuthenticated: boolean

  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (data: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  currentUser: null,
  token: null,
  isAuthenticated: false,

  login: (user, token) => {
    localStorage.setItem('auth_token', token)
    set({ currentUser: user, token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    set({ currentUser: null, token: null, isAuthenticated: false })
  },

  updateUser: (data) =>
    set((state) => ({
      currentUser: state.currentUser ? { ...state.currentUser, ...data } : null,
    })),
}))
