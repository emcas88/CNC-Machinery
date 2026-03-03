// frontend/src/types/user.ts

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer'

export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: UserRole
  is_active: boolean
}

export interface CreateUserPayload {
  email: string
  password: string
  first_name?: string
  last_name?: string
  role?: UserRole
}

export interface UpdateUserPayload {
  first_name?: string
  last_name?: string
  password?: string
  role?: UserRole
}

export interface ListUsersParams {
  limit?: number
  offset?: number
}
