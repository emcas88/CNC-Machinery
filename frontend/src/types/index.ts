// frontend/src/types/index.ts
// Central type re-exports for the frontend.

export type { User, UserRole, CreateUserPayload, UpdateUserPayload, ListUsersParams } from './user'

// Auth payloads
export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  first_name?: string
  last_name?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

// Generic paginated response
export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// API error shape returned by the backend
export interface ApiError {
  error: string
}

// Generic ID response
export interface IdResponse {
  id: string
}
