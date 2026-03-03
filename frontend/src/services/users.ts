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
