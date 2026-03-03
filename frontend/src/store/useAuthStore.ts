import { create } from 'zustand'
import type { User, AuthResponse, UserProfile } from '@/types'
import { UserRole } from '@/types'
import api from '@/services/api'

interface AuthState {
  currentUser: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  loginWithTokens: (tokens: AuthResponse) => Promise<void>
  setUser: (user: User) => void
  logout: () => void
  updateUser: (data: Partial<User>) => void
  initialize: () => Promise<void>
}

function mapProfileToUser(profile: UserProfile): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role as UserRole,
    isActive: true,
    createdAt: profile.created_at,
    updatedAt: profile.created_at,
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  currentUser: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  loginWithTokens: async (tokens: AuthResponse) => {
    localStorage.setItem('auth_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    set({ token: tokens.access_token, isLoading: true })

    try {
      const response = await api.get<UserProfile>('/auth/me')
      const user = mapProfileToUser(response.data)
      set({ currentUser: user, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      set({ token: null, isAuthenticated: false, isLoading: false })
      throw new Error('Failed to fetch user profile')
    }
  },

  setUser: (user: User) => {
    set({ currentUser: user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    set({ currentUser: null, token: null, isAuthenticated: false })
  },

  updateUser: (data) =>
    set((state) => ({
      currentUser: state.currentUser ? { ...state.currentUser, ...data } : null,
    })),

  initialize: async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      set({ isAuthenticated: false, isLoading: false })
      return
    }

    set({ token, isLoading: true })
    try {
      const response = await api.get<UserProfile>('/auth/me')
      const user = mapProfileToUser(response.data)
      set({ currentUser: user, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      set({ token: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
