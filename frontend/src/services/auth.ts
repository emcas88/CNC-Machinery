import { apiClient } from './api'
import type { AuthTokens, RegisterPayload } from '@/types'

export function loginUser(email: string, password: string) {
  return apiClient.post<AuthTokens>('/api/auth/login', { email, password })
}

export function registerUser(payload: RegisterPayload) {
  return apiClient.post<AuthTokens>('/api/auth/register', payload)
}
