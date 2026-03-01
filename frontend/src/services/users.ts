import api from './api'
import type { User, CreateUser, UpdateUser, LoginRequest, AuthResponse } from '@/types'

export const usersService = {
  getUsers: () =>
    api.get<User[]>('/users').then((r) => r.data),

  getUser: (id: string) =>
    api.get<User>(`/users/${id}`).then((r) => r.data),

  createUser: (data: CreateUser) =>
    api.post<User>('/users', data).then((r) => r.data),

  updateUser: (id: string, data: Partial<UpdateUser>) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),

  deleteUser: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  register: (data: CreateUser) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout').then((r) => r.data),

  me: () =>
    api.get<User>('/auth/me').then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
}
