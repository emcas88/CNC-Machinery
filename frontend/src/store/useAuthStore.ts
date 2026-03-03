import { create } from 'zustand'
import { api } from '@/services/api'
import type { User, TokenPair, RegisterRequest } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
  initAuth: () => Promise<void>
  loginWithTokens: (tokens: TokenPair) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const { data } = await api.post<TokenPair>('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const { data: user } = await api.get<User>('/auth/me')
    set({ user, isAuthenticated: true })
  },

  register: async (formData: RegisterRequest) => {
    const { data } = await api.post<TokenPair>('/auth/register', formData)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const { data: user } = await api.get<User>('/auth/me')
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  initAuth: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    try {
      const { data: user } = await api.get<User>('/auth/me')
      set({ user, isAuthenticated: true })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ user: null, isAuthenticated: false })
    }
  },

  loginWithTokens: async (tokens: TokenPair) => {
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    const { data: user } = await api.get<User>('/auth/me')
    set({ user, isAuthenticated: true })
  },
}))
