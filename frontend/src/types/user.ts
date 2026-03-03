export type UserRole = 'Admin' | 'Manager' | 'Operator' | 'Viewer'

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  role: UserRole
  is_active: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  username: string
}
