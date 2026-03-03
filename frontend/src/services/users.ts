import { api } from './api'
import type { User, UserProfile } from '@/types'

export const usersService = {
  getAll: () => api.get<User[]>('/users').then(r => r.data),

  getById: (id: string) => api.get<User>(`/users/${id}`).then(r => r.data),

  update: (id: string, data: Partial<User>) =>
    api.patch<User>(`/users/${id}`, data).then(r => r.data),

  delete: (id: string) => api.delete(`/users/${id}`),

  getProfile: () => api.get<UserProfile>('/auth/me').then(r => r.data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/users/change-password', data).then(r => r.data),

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },
}
