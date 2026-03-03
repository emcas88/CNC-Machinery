export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  DESIGNER = 'designer',
  CNC_OPERATOR = 'cnc_operator',
  SHOP_FLOOR = 'shop_floor',
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

export interface CreateUser {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateUser {
  id: string
  name?: string
  email?: string
  role?: UserRole
  isActive?: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  role?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}
