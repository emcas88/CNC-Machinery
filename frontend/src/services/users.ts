import { apiClient } from './api'
import type { User, CreateUserPayload, UpdateUserPayload, ListUsersParams } from '@/types'

export async function getUsers(params?: ListUsersParams) {
  return apiClient.get<User[]>('/api/users', { params })
}

export async function getUser(id: string) {
  return apiClient.get<User>(`/api/users/${id}`)
}

export async function createUser(payload: CreateUserPayload) {
  return apiClient.post<{ id: string }>('/api/users', payload)
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  return apiClient.put<{ updated: boolean }>(`/api/users/${id}`, payload)
}

export async function deleteUser(id: string) {
  return apiClient.delete(`/api/users/${id}`)
}

function userFromJwt(): { id: string; email: string; role: string } | null {
  try {
    const token = localStorage.getItem('access_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      id: payload.sub,
      email: payload.email ?? '',
      role: payload.role ?? 'designer',
    }
  } catch { return null }
}

async function userFromApi(): Promise<User | null> {
  const jwt = userFromJwt()
  if (!jwt) return null
  try {
    const res = await apiClient.get<User>(`/api/users/${jwt.id}`)
    return res.data
  } catch {
    return {
      id: jwt.id,
      email: jwt.email,
      name: jwt.email?.split('@')[0] ?? 'User',
      role: jwt.role,
    } as User
  }
}

export const usersService = {
  me: () => apiClient.get<User>('/api/users/me').then(r => r.data).catch(() => userFromApi().then(u => {
    if (u) return u
    throw new Error('Unable to load user profile')
  })),
  getUsers,
  getUser: (id: string) => getUser(id).then(r => r.data),
  createUser: (payload: CreateUserPayload) => createUser(payload).then(r => r.data),
  updateUser: (id: string, payload: UpdateUserPayload) => updateUser(id, payload).then(r => r.data),
  deleteUser,
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/api/users/change-password', { currentPassword, newPassword }).then(r => r.data),
}
